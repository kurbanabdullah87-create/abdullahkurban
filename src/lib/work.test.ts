import {describe,it,expect} from 'vitest';
import {hourlyCharge,payrollAmount,payrollBalance,elapsedSeconds,depreciation} from './work';
describe('İş ve yevmiye kuralları',()=>{
 it('500 TL saatlik iş 30 dakikada 250 TL',()=>expect(hourlyCharge(1800,500)).toBe(250));
 it('tam gün 1500 TL',()=>expect(payrollAmount(1,1500,1)).toBe(1500));
 it('yarım gün 750 TL',()=>expect(payrollAmount(.5,1500,1)).toBe(750));
 it('çeyrek gün 375 TL',()=>expect(payrollAmount(.25,1500,1)).toBe(375));
 it('x1.5 mesai 2250 TL',()=>expect(payrollAmount(1,1500,1.5)).toBe(2250));
 it('x2 mesai 3000 TL',()=>expect(payrollAmount(1,1500,2)).toBe(3000));
 it('avans hakedişten düşülür',()=>expect(payrollBalance(5000,2000)).toBe(3000));
 it('duraklatılan süre sabit',()=>expect(elapsedSeconds({seconds:120},5000)).toBe(120));
 it('amortisman negatif olmaz',()=>expect(depreciation(1000,1,'2020-01-01',new Date('2026-01-01'))).toBe(0));
});
import {machineSeconds,maintenanceStatus,findMachineConflicts,validateJobForm,jobWindow,type WorkRecord} from './work';
const rec=(id:string,payload:Record<string,string|number|boolean|null>):WorkRecord=>({id,owner_id:'u',team_id:'t',kind:'job',payload,created_at:''});
describe('Makine bakım sayacı',()=>{
 const H=3600;
 it('toplam saat = kronometre + işlerden gelen süre',()=>expect(machineSeconds({seconds:2*H,job_seconds:3*H},0)).toBe(5*H));
 it('100 saatlik aralıkta 75 saat çalışıldı → 25 saat kaldı',()=>{
  const m=maintenanceStatus({maintenance_hours:100,seconds:75*H,last_service_seconds:0},0);
  expect(m.used).toBe(75); expect(m.remaining).toBe(25); expect(m.level).toBe('ok');
 });
 it('%80 sarı',()=>expect(maintenanceStatus({maintenance_hours:100,seconds:80*H},0).level).toBe('warn'));
 it('%100 kırmızı (geçti)',()=>{const m=maintenanceStatus({maintenance_hours:100,seconds:105*H},0); expect(m.level).toBe('over'); expect(m.remaining).toBe(-5);});
 it('bakım sonrası sayaç son bakımdan itibaren sayılır, toplam saat korunur',()=>{
  const p={maintenance_hours:100,seconds:60*H,job_seconds:60*H,last_service_seconds:120*H};
  expect(maintenanceStatus(p,0).used).toBe(0); expect(machineSeconds(p,0)).toBe(120*H);
 });
 it('tahmini ek süre durumu ileri alır',()=>expect(maintenanceStatus({maintenance_hours:100,seconds:70*H},0,10*H).level).toBe('warn'));
 it('aralık tanımsızsa uyarı yok',()=>expect(maintenanceStatus({seconds:999*H},0).level).toBe('none'));
});
describe('İş formu: makine seçimi ve çakışma',()=>{
 const eq=rec('m1',{name:'Motopomp',maintenance_hours:100,seconds:105*3600});
 it('makine seçilmeden kayıt reddedilir',()=>expect(validateJobForm({title:'x'},[eq],[]).error).toBeTruthy());
 it('"Makinesiz iş" geçerlidir',()=>expect(validateJobForm({title:'x',no_machine:true},[eq],[]).error).toBeUndefined());
 it('olmayan makine reddedilir',()=>expect(validateJobForm({equipment_id:'yok'},[eq],[]).error).toBeTruthy());
 it('bakımı geçen makinede uyarı verilir ama engellenmez',()=>{const v=validateJobForm({equipment_id:'m1'},[eq],[]); expect(v.error).toBeUndefined(); expect(v.warnings.join()).toContain('bakım zamanı');});
 it('aynı saat aralığı çakışır',()=>{
  const a=rec('j1',{equipment_id:'m1',date:'2026-11-14',time:'09:00',planned_hours:3,status:'Bekliyor'});
  expect(findMachineConflicts([a],{equipment_id:'m1',date:'2026-11-14',time:'11:00',planned_hours:1})).toHaveLength(1);
  expect(findMachineConflicts([a],{equipment_id:'m1',date:'2026-11-14',time:'12:00',planned_hours:1})).toHaveLength(0);
 });
 it('farklı makine / tamamlanmış iş / kendisi çakışmaz',()=>{
  const done=rec('j2',{equipment_id:'m1',date:'2026-11-14',status:'Tamamlandı'});
  const other=rec('j3',{equipment_id:'m2',date:'2026-11-14',status:'Bekliyor'});
  const self=rec('j4',{equipment_id:'m1',date:'2026-11-14',status:'Bekliyor'});
  expect(findMachineConflicts([done,other,self],{equipment_id:'m1',date:'2026-11-14'},'j4')).toHaveLength(0);
 });
 it('saatsiz iş tüm günü tutar',()=>{const w=jobWindow({date:'2026-11-14'}); expect(w![1]-w![0]).toBe(86400000);});
});
