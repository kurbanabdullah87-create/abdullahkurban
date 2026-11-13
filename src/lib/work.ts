import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cachedRead, persistWrite } from '@/lib/offline';

export type WorkKind = 'job' | 'payroll' | 'advance' | 'equipment' | 'maintenance' | 'shopping' | 'job_template' | 'settings' | 'appointment';
export type Payload = Record<string, string | number | boolean | null | undefined> & {seconds?: string | number | boolean | null | undefined; started_at?: string | number | boolean | null | undefined; business?: string | number | boolean | null | undefined; status?: string | number | boolean | null | undefined; date?: string | number | boolean | null | undefined; title?: string | number | boolean | null | undefined; customer_id?: string | number | boolean | null | undefined; address?: string | number | boolean | null | undefined; hourly_rate?: string | number | boolean | null | undefined; price?: string | number | boolean | null | undefined; billed?: string | number | boolean | null | undefined; notes?: string | number | boolean | null | undefined; material_cost?: string | number | boolean | null | undefined; vat_rate?: string | number | boolean | null | undefined; days?: string | number | boolean | null | undefined; rate?: string | number | boolean | null | undefined; multiplier?: string | number | boolean | null | undefined; amount?: string | number | boolean | null | undefined; site?: string | number | boolean | null | undefined; name?: string | number | boolean | null | undefined; borrower?: string | number | boolean | null | undefined; borrowed_on?: string | number | boolean | null | undefined; last_service_seconds?: string | number | boolean | null | undefined; maintenance_hours?: string | number | boolean | null | undefined; purchased?: string | number | boolean | null | undefined; years?: string | number | boolean | null | undefined; code?: string | number | boolean | null | undefined; equipment_id?: string | number | boolean | null | undefined; cost?: string | number | boolean | null | undefined; done?: string | number | boolean | null | undefined; target?: string | number | boolean | null | undefined; owner_id?: string | number | boolean | null | undefined; job_seconds?: string | number | boolean | null | undefined; time?: string | number | boolean | null | undefined; planned_hours?: string | number | boolean | null | undefined; no_machine?: string | number | boolean | null | undefined; machine_applied_seconds?: string | number | boolean | null | undefined; machine_applied_to?: string | number | boolean | null | undefined;};
export interface WorkRecord { id: string; owner_id: string; team_id: string; kind: WorkKind; payload: Payload; created_at: string; }
/** Randevular, mevcut "shopping" türünde (payload._t = 'appointment') saklanır; ek migration gerekmez. */
const dbKind = (k: WorkKind) => (k === 'appointment' ? 'shopping' : k);
export function useRecords(kind: WorkKind) {
  return useQuery({networkMode:'always',queryKey:['work',kind],queryFn:async () => {
    const rows = await cachedRead('work:'+dbKind(kind), async () => {
      const {data,error}=await supabase.from('work_records').select('*').eq('kind',dbKind(kind)).order('created_at',{ascending:false});
      if(error) throw error; return data as unknown as WorkRecord[];
    });
    if(kind==='appointment') return rows.filter((r)=>r.payload._t==='appointment');
    if(kind==='shopping') return rows.filter((r)=>r.payload._t!=='appointment');
    return rows;
  }});
}
export function useSaveRecord(kind: WorkKind) {
 const qc=useQueryClient();
 return useMutation({networkMode:'always',mutationFn: async (row:{id?:string | undefined;owner_id?:string | undefined;payload:Payload}) => {
   const {data}=await supabase.auth.getSession(); if(!data.session) throw new Error('Oturum gerekli');
   const id=row.id??crypto.randomUUID();
   await persistWrite('work_records',row.id?'update':'insert',{...row,owner_id:row.owner_id??data.session.user.id,id,kind:dbKind(kind),payload:kind==='appointment'?{...row.payload,_t:'appointment'}:row.payload}); return id;
 },onSuccess:()=>{qc.invalidateQueries({queryKey:['work']});toast.success('Kaydedildi');},onError:(e:Error)=>toast.error(e.message)});
}
export function elapsedSeconds(p:Payload, now=Date.now()) {
 return Math.max(0,Number(p.seconds??0)+(p.started_at?Math.max(0,(now-Date.parse(String(p.started_at)))/1000):0));
}
export function hourlyCharge(seconds:number,rate:number) { return Math.round(seconds/3600*rate*100)/100; }
export function payrollAmount(days:number,rate:number,multiplier:number) {
 if(![1,.5,.25].includes(days)||![1,1.5,2].includes(multiplier)||rate<0) throw new Error('Geçersiz yevmiye');
 return Math.round(days*rate*multiplier*100)/100;
}
export function payrollBalance(earned:number,advances:number) {return Math.round((earned-advances)*100)/100;}
export function depreciation(price:number,years:number,purchased:string,now=new Date()) {
 const age=Math.max(0,(now.getTime()-new Date(purchased+'T00:00:00').getTime())/(365.25*86400000));
 return Math.round(Math.max(0,price*(1-age/Math.max(1,years)))*100)/100;
}
export function pageHead(title:string,description:string) {return {meta:[{title:title+' — Saha'},{name:'description',content:description},{property:'og:title',content:title+' — Saha'},{property:'og:description',content:description},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]};}
export type MaintLevel='ok'|'warn'|'over'|'none';
export const MAINT_WARN=0.8; // bakım aralığının %80'inde "yaklaşıyor", %100'de "geçti"
/** Makinenin toplam çalışma süresi (sn) = elle kronometre (+çalışıyorsa akan süre) + tamamlanan işlerden gelen süre. */
export function machineSeconds(p:Payload, now=Date.now()) {
 return elapsedSeconds(p,now)+Math.max(0,Number(p.job_seconds??0));
}
/** Bakım durumu: son bakımdan beri çalışılan saat / aralık. extraSeconds: henüz sayaca işlenmemiş ek süre (tahmin). */
export function maintenanceStatus(p:Payload, now=Date.now(), extraSeconds=0) {
 const interval=Number(p.maintenance_hours??0);
 const used=Math.max(0,(machineSeconds(p,now)+extraSeconds-Number(p.last_service_seconds??0))/3600);
 const ratio=interval>0?used/interval:0;
 const level:MaintLevel=interval<=0?'none':ratio>=1?'over':ratio>=MAINT_WARN?'warn':'ok';
 return {interval,used,remaining:interval-used,ratio,level};
}
const DAY=86400000;
/** İşin makineyi tuttuğu zaman aralığı [başlangıç, bitiş] (ms). Saat yoksa tüm gün; saat var süre yoksa 1 saat varsayılır. */
export function jobWindow(p:Payload, now=Date.now()):[number,number]|null {
 const date=String(p.date??''); if(!date) return null;
 const planned=Math.max(0,Number(p.planned_hours??0))*3600000;
 const started=p.started_at?Date.parse(String(p.started_at)):NaN;
 if(!Number.isNaN(started)) return [started,Math.max(now,started+planned)];
 if(p.time){const t=new Date(date+'T'+String(p.time)+':00').getTime(); if(!Number.isNaN(t)) return [t,t+(planned||3600000)];}
 const d0=new Date(date+'T00:00:00').getTime(); return Number.isNaN(d0)?null:[d0,d0+DAY];
}
/** Aynı makineyi aynı zaman aralığında kullanan (bitmemiş, ertelenmemiş) diğer işler. */
export function findMachineConflicts(jobs:WorkRecord[], cand:Payload, selfId?:string, now=Date.now()) {
 const eq=cand.equipment_id; if(!eq) return [];
 const w=jobWindow(cand,now); if(!w) return [];
 return jobs.filter((j)=>j.id!==selfId && j.payload.equipment_id===eq && !j.payload.billed && j.payload.status!=='Tamamlandı' && j.payload.status!=='Ertelendi')
  .filter((j)=>{const v=jobWindow(j.payload,now); return !!v && v[0]<w[1] && w[0]<v[1];});
}
export const machineChosen=(f:Payload)=>Boolean(f.equipment_id)||f.no_machine===true;
/** İş formu doğrulaması: makine seçimi zorunlu; bakım ve çakışma uyarı üretir (engellemez). */
export function validateJobForm(f:Payload, equipment:WorkRecord[], jobs:WorkRecord[], selfId?:string, now=Date.now()):{error?:string;warnings:string[]} {
 const warnings:string[]=[];
 if(!machineChosen(f)) return {error:'Önce kullanılacak makineyi seçin (makinesiz ise "Makinesiz iş").',warnings};
 if(f.equipment_id){
  const eq=equipment.find((e)=>e.id===f.equipment_id);
  if(!eq) return {error:'Seçilen makine bulunamadı. Lütfen yeniden seçin.',warnings};
  const m=maintenanceStatus(eq.payload,now);
  if(m.level==='over') warnings.push(`${String(eq.payload.name)}: bakım zamanı ${(-m.remaining).toFixed(1)} saat geçti.`);
  const c=findMachineConflicts(jobs,f,selfId,now);
  if(c.length) warnings.push(`${String(eq.payload.name)} aynı zaman aralığında ${c.length} başka işte kullanılıyor: ${c.map((j)=>String(j.payload.title)).join(', ')}.`);
 }
 return {warnings};
}
