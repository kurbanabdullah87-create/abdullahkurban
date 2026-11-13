CREATE TABLE public.work_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_id uuid NOT NULL DEFAULT public.current_team(), owner_id uuid NOT NULL DEFAULT auth.uid(), kind text NOT NULL CHECK(kind IN ('job','payroll','advance','equipment','maintenance','shopping','job_template','settings')), payload jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_records TO authenticated;
GRANT ALL ON public.work_records TO service_role;
ALTER TABLE public.work_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team master or own apprentice read" ON public.work_records FOR SELECT TO authenticated USING(team_id=public.current_team() AND (public.is_team_usta() OR (owner_id=auth.uid() AND kind IN ('job','payroll','advance'))));
CREATE POLICY "master operational writes" ON public.work_records FOR ALL TO authenticated USING(team_id=public.current_team() AND public.is_team_usta()) WITH CHECK(team_id=public.current_team() AND public.is_team_usta() AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=owner_id AND p.team_id=public.current_team()));
CREATE INDEX ON public.work_records(team_id,kind);
ALTER TABLE public.transactions ADD COLUMN job_record_id uuid REFERENCES public.work_records(id);
CREATE UNIQUE INDEX transactions_job_record_unique ON public.transactions(job_record_id) WHERE job_record_id IS NOT NULL;
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
CREATE OR REPLACE FUNCTION public.validate_work_record() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.kind='payroll' AND (coalesce((NEW.payload->>'days')::numeric,0) NOT IN (1,0.5,0.25) OR coalesce((NEW.payload->>'multiplier')::numeric,0) NOT IN (1,1.5,2) OR coalesce((NEW.payload->>'rate')::numeric,-1)<0) THEN RAISE EXCEPTION 'Geçersiz yevmiye'; END IF;
 IF NEW.kind='advance' AND coalesce((NEW.payload->>'amount')::numeric,0)<=0 THEN RAISE EXCEPTION 'Geçersiz avans'; END IF;
 NEW.updated_at:=now(); RETURN NEW;
END; $$;
CREATE TRIGGER validate_work_record BEFORE INSERT OR UPDATE ON public.work_records FOR EACH ROW EXECUTE FUNCTION public.validate_work_record();