-- Makine çalışma saati ve bakım sayacı (atomik, çift sayıma kapalı).
-- Güvenle yeniden çalıştırılabilir (CREATE OR REPLACE / DROP IF EXISTS).
--
-- Tasarım:
--  * İşin süresi, iş "Tamamlandı" olduğunda makineye eklenir. Cari işlemden (bill_job) BAĞIMSIZDIR.
--  * Hangi sürenin makineye zaten eklendiği işin kendisinde tutulur (machine_applied_seconds / machine_applied_to).
--    Tetikleyici bu değerleri istemciden DEĞİL, satırın eski halinden (OLD) okur → istemci sahteciliği ve
--    çevrimdışı kuyruğun tekrar gönderilmesi çift sayım yaratamaz.
--  * Tamamlanmış işin süresi değişirse yalnızca fark eklenir/düşülür; makine değişirse saat eski makineden yenisine taşınır;
--    iş "Tamamlandı"dan geri alınırsa saat düşülür. İş silinirse makinenin gerçekten çalıştığı saat KORUNUR.
--  * Makinedeki job_seconds / last_service_seconds / last_service_on yalnızca sunucu tarafından değişir.
--  * Toplam makine saati = seconds (elle kronometre) + job_seconds (işlerden). Bakım "sıfırlama" yoktur:
--    last_service_seconds toplamın o anki değerine eşitlenir, toplam saat korunur.

-- 0) Önceki taslakta bill_job içine makine ekleme konduysa geri al (orijinal gövde).
CREATE OR REPLACE FUNCTION public.bill_job(_job_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.work_records; c public.customers; result uuid; seconds numeric; amount numeric;
BEGIN
 IF NOT public.is_team_usta() THEN RAISE EXCEPTION 'Yetkisiz'; END IF;
 SELECT * INTO j FROM public.work_records WHERE id=_job_id AND team_id=public.current_team() AND kind='job' FOR UPDATE;
 IF j.id IS NULL THEN RAISE EXCEPTION 'İş bulunamadı'; END IF;
 SELECT id INTO result FROM public.transactions WHERE job_record_id=j.id;
 IF result IS NOT NULL THEN RETURN result; END IF;
 SELECT * INTO c FROM public.customers WHERE id=(j.payload->>'customer_id')::uuid AND team_id=public.current_team();
 IF c.id IS NULL THEN RAISE EXCEPTION 'Müşteri seçin'; END IF;
 seconds:=coalesce((j.payload->>'seconds')::numeric,0);
 IF j.payload->>'started_at' IS NOT NULL THEN seconds:=seconds+greatest(0,extract(epoch FROM now()-(j.payload->>'started_at')::timestamptz)); END IF;
 amount:=CASE WHEN coalesce((j.payload->>'hourly_rate')::numeric,0)>0 THEN round(seconds/3600*(j.payload->>'hourly_rate')::numeric,2) ELSE coalesce((j.payload->>'price')::numeric,0) END;
 IF amount<=0 THEN RAISE EXCEPTION 'İş tutarı sıfır olamaz'; END IF;
 INSERT INTO public.transactions(customer_id,kind,amount,description,material_cost,vat_rate,job_record_id) VALUES(c.id,'debt',amount,j.payload->>'title',coalesce((j.payload->>'material_cost')::numeric,0),coalesce((j.payload->>'vat_rate')::smallint,0),j.id) RETURNING id INTO result;
 UPDATE public.work_records SET payload=payload||jsonb_build_object('status','Tamamlandı','seconds',seconds,'started_at',null,'billed',true),updated_at=now() WHERE id=j.id;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.bill_job(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bill_job(uuid) TO authenticated,service_role;

-- 1) Yardımcılar
CREATE OR REPLACE FUNCTION public.try_uuid(t text) RETURNS uuid LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN RETURN NULLIF(t,'')::uuid; EXCEPTION WHEN others THEN RETURN NULL; END; $$;

CREATE OR REPLACE FUNCTION public.bump_machine_seconds(_eq uuid, _team uuid, _delta numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n int;
BEGIN
 IF _delta=0 THEN RETURN; END IF;
 PERFORM set_config('saha.machine_sync','1',true);
 UPDATE public.work_records
    SET payload=jsonb_set(payload,'{job_seconds}',to_jsonb(greatest(0,coalesce((payload->>'job_seconds')::numeric,0)+_delta))),updated_at=now()
  WHERE id=_eq AND team_id=_team AND kind='equipment';
 GET DIAGNOSTICS n=ROW_COUNT;
 PERFORM set_config('saha.machine_sync','0',true);
 IF n=0 AND _delta>0 THEN RAISE EXCEPTION 'Makine bulunamadı'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.bump_machine_seconds(uuid,uuid,numeric) FROM PUBLIC;

-- 2) Mevcut tamamlanmış makineli işleri "zaten sayıldı" diye işaretle (çift sayım olmasın)
UPDATE public.work_records
   SET payload=payload||jsonb_build_object('machine_applied_seconds',coalesce((payload->>'seconds')::numeric,0),'machine_applied_to',payload->>'equipment_id')
 WHERE kind='job' AND payload->>'status'='Tamamlandı' AND public.try_uuid(payload->>'equipment_id') IS NOT NULL AND (payload->'machine_applied_to') IS NULL;

-- 3) İş tetikleyicisi
CREATE OR REPLACE FUNCTION public.sync_job_machine_hours() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old_eq uuid; new_eq uuid; old_applied numeric; secs numeric; desired numeric; done boolean;
BEGIN
 IF NEW.kind<>'job' THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
  -- İstemci bu alanları belirleyemez. (Yan etki AFTER INSERT tetikleyicisinde; ON CONFLICT yolunda çift işlem olmasın.)
  NEW.payload:=NEW.payload-'machine_applied_seconds'-'machine_applied_to';
  RETURN NEW;
 END IF;
 old_eq:=public.try_uuid(OLD.payload->>'machine_applied_to');
 old_applied:=greatest(0,coalesce((OLD.payload->>'machine_applied_seconds')::numeric,0));
 secs:=greatest(0,coalesce(nullif(NEW.payload->>'seconds','')::numeric,0));
 done:=NEW.payload->>'status'='Tamamlandı';
 IF done AND NEW.payload->>'started_at' IS NOT NULL THEN
  secs:=secs+greatest(0,extract(epoch FROM now()-(NEW.payload->>'started_at')::timestamptz));
  NEW.payload:=NEW.payload||jsonb_build_object('seconds',secs,'started_at',null);
 END IF;
 new_eq:=public.try_uuid(NEW.payload->>'equipment_id');
 desired:=CASE WHEN done AND new_eq IS NOT NULL THEN secs ELSE 0 END;
 IF old_eq IS NOT DISTINCT FROM new_eq THEN
  IF new_eq IS NOT NULL THEN PERFORM public.bump_machine_seconds(new_eq,NEW.team_id,desired-old_applied); END IF;
 ELSE
  IF old_eq IS NOT NULL AND old_applied>0 THEN PERFORM public.bump_machine_seconds(old_eq,NEW.team_id,-old_applied); END IF;
  IF new_eq IS NOT NULL AND desired>0 THEN PERFORM public.bump_machine_seconds(new_eq,NEW.team_id,desired); END IF;
 END IF;
 NEW.payload:=NEW.payload||jsonb_build_object('machine_applied_seconds',desired,'machine_applied_to',new_eq);
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS sync_job_machine_hours ON public.work_records;
CREATE TRIGGER sync_job_machine_hours BEFORE INSERT OR UPDATE ON public.work_records FOR EACH ROW EXECUTE FUNCTION public.sync_job_machine_hours();

-- Doğrudan "Tamamlandı" olarak eklenen iş (ör. çevrimdışı kuyruktan) için: satır gerçekten eklendiyse bir kez işle.
CREATE OR REPLACE FUNCTION public.sync_job_machine_hours_after_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.kind='job' AND NEW.payload->>'status'='Tamamlandı' AND public.try_uuid(NEW.payload->>'equipment_id') IS NOT NULL THEN
  UPDATE public.work_records SET updated_at=now() WHERE id=NEW.id;
 END IF;
 RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS sync_job_machine_hours_after_insert ON public.work_records;
CREATE TRIGGER sync_job_machine_hours_after_insert AFTER INSERT ON public.work_records FOR EACH ROW EXECUTE FUNCTION public.sync_job_machine_hours_after_insert();

-- 4) Makine sayaçlarını istemci değiştiremez
CREATE OR REPLACE FUNCTION public.protect_machine_counters() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.kind<>'equipment' OR coalesce(current_setting('saha.machine_sync',true),'')='1' THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
  NEW.payload:=(NEW.payload-'last_service_on')||jsonb_build_object('job_seconds',0,'last_service_seconds',0);
 ELSE
  NEW.payload:=NEW.payload||jsonb_build_object('job_seconds',coalesce(OLD.payload->'job_seconds','0'::jsonb),'last_service_seconds',coalesce(OLD.payload->'last_service_seconds','0'::jsonb));
  IF OLD.payload->'last_service_on' IS NOT NULL THEN NEW.payload:=NEW.payload||jsonb_build_object('last_service_on',OLD.payload->'last_service_on');
  ELSE NEW.payload:=NEW.payload-'last_service_on'; END IF;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS protect_machine_counters ON public.work_records;
CREATE TRIGGER protect_machine_counters BEFORE INSERT OR UPDATE ON public.work_records FOR EACH ROW EXECUTE FUNCTION public.protect_machine_counters();

-- 5) Bakım kaydı: son bakım sayacını toplam saate eşitler, toplam saati SIFIRLAMAZ; bakım kaydını aynı işlemde yazar.
CREATE OR REPLACE FUNCTION public.service_equipment(_equipment_id uuid, _note text DEFAULT NULL, _cost numeric DEFAULT 0) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.work_records; total numeric; today text:=to_char(now() AT TIME ZONE 'Europe/Istanbul','YYYY-MM-DD');
BEGIN
 IF NOT public.is_team_usta() THEN RAISE EXCEPTION 'Yetkisiz'; END IF;
 IF coalesce(_cost,0)<0 THEN RAISE EXCEPTION 'Bakım maliyeti negatif olamaz'; END IF;
 SELECT * INTO e FROM public.work_records WHERE id=_equipment_id AND team_id=public.current_team() AND kind='equipment' FOR UPDATE;
 IF e.id IS NULL THEN RAISE EXCEPTION 'Ekipman bulunamadı'; END IF;
 total:=coalesce((e.payload->>'seconds')::numeric,0)+coalesce((e.payload->>'job_seconds')::numeric,0);
 IF e.payload->>'started_at' IS NOT NULL THEN total:=total+greatest(0,extract(epoch FROM now()-(e.payload->>'started_at')::timestamptz)); END IF;
 PERFORM set_config('saha.machine_sync','1',true);
 UPDATE public.work_records SET payload=payload||jsonb_build_object('last_service_seconds',total,'last_service_on',today),updated_at=now() WHERE id=e.id;
 PERFORM set_config('saha.machine_sync','0',true);
 INSERT INTO public.work_records(team_id,owner_id,kind,payload) VALUES(e.team_id,auth.uid(),'maintenance',
  jsonb_build_object('equipment_id',e.id,'date',today,'cost',coalesce(_cost,0),'notes',coalesce(nullif(trim(_note),''),'Periyodik bakım'),'service_seconds',total));
 RETURN total;
END; $$;
REVOKE ALL ON FUNCTION public.service_equipment(uuid,text,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_equipment(uuid,text,numeric) TO authenticated,service_role;
