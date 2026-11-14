import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, Bell, ChevronLeft, ChevronRight, MessageCircle, Phone, Play, Plus, Search, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDrawer } from "@/components/app/forms/FormDrawer";
import { JobFormBody } from "@/components/app/JobFormBody";
import { SwipeRow } from "@/components/app/SwipeRow";
import { useMe } from "@/hooks/use-me";
import { useCustomers } from "@/lib/data";
import { formatDate, todayISO } from "@/lib/finance";
import { useMembers } from "@/lib/job-fields";
import { persistWrite } from "@/lib/offline";
import { REMIND_OPTIONS, apptStart, enableAppointmentPush, notifySupported } from "@/lib/reminders";
import { whatsappLink } from "@/lib/templates";
import { appointmentReminderText } from "@/lib/statement";
import { pageHead, useRecords, useSaveRecord, validateJobForm, type Payload, type WorkRecord } from "@/lib/work";

export const Route = createFileRoute("/_authenticated/randevu")({
  head: () => pageHead("Randevular", "İsme göre randevu takibi."),
  component: Appointments,
});

const STATUSES = ["Bekliyor", "Geldi", "İptal"] as const;
const norm = (s: unknown) => String(s ?? "").toLocaleLowerCase("tr-TR").trim();
const empty = (): Payload => ({ name: "", phone: "", date: todayISO(), time: "09:00", title: "", notes: "", status: "Bekliyor", remind: "30" });

function Appointments() {
  const recs = useRecords("appointment");
  const customers = useCustomers();
  const save = useSaveRecord("appointment");
  const saveJob = useSaveRecord("job");
  const members = useMembers();
  const equipment = useRecords("equipment");
  const jobsAll = useRecords("job");
  const settings = useRecords("settings");
  const profile = settings.data?.[0]?.payload;
  const me = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [view, setView] = useState<"all" | "day" | "archive">("all");
  const [day, setDay] = useState(todayISO());
  const [edit, setEdit] = useState<{ id?: string; owner_id?: string; payload: Payload } | null>(null);
  const [job, setJob] = useState<{ appt: WorkRecord; form: Payload } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [perm, setPerm] = useState(notifySupported() ? Notification.permission : "denied");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (!notifySupported() || Notification.permission !== "granted" || !("serviceWorker" in navigator)) {
      return () => { active = false; };
    }
    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => { if (active) setPushEnabled(Boolean(subscription)); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const archivedCount = (recs.data ?? []).filter((r) => r.payload.archived).length;
  const rows = useMemo(() => {
    const needle = norm(q);
    return (recs.data ?? [])
      .filter(
        (r) =>
          !!r.payload.archived === (view === "archive") &&
          (!needle || norm(r.payload.name).includes(needle)) &&
          (view === "archive" || !status || r.payload.status === status) &&
          (view !== "day" || r.payload.date === day),
      )
      .sort((a, b) => {
        const k = `${a.payload.date}${a.payload.time}`.localeCompare(`${b.payload.date}${b.payload.time}`);
        return view === "archive" ? -k : k;
      });
  }, [recs.data, q, status, view, day]);

  const groups = useMemo(() => {
    const m = new Map<string, WorkRecord[]>();
    for (const r of rows) {
      const d = String(r.payload.date ?? "");
      m.set(d, [...(m.get(d) ?? []), r]);
    }
    return [...m.entries()];
  }, [rows]);

  const setArchived = (r: WorkRecord, archived: boolean) =>
    save.mutate(
      { id: r.id, owner_id: r.owner_id, payload: { ...r.payload, archived, archived_at: archived ? new Date().toISOString() : null } },
      {
        onSuccess: () =>
          archived
            ? toast("Arşive taşındı", { action: { label: "Geri al", onClick: () => setArchived(r, false) } })
            : toast("Randevu geri alındı"),
      },
    );

  function purge(r: WorkRecord) {
    toast(`${String(r.payload.name)} kalıcı olarak silinsin mi?`, {
      description: "Bu işlem geri alınamaz.",
      action: {
        label: "Kalıcı sil",
        onClick: async () => {
          try {
            await persistWrite("work_records", "delete", { id: r.id });
            qc.invalidateQueries({ queryKey: ["work"] });
            toast.success("Kalıcı olarak silindi");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Silinemedi");
          }
        },
      },
    });
  }

  function purgeAll() {
    const list = (recs.data ?? []).filter((r) => r.payload.archived);
    if (!list.length) return;
    toast(`Arşivdeki ${list.length} randevu kalıcı silinsin mi?`, {
      description: "Bu işlem geri alınamaz.",
      action: {
        label: "Hepsini sil",
        onClick: async () => {
          try {
            for (const r of list) await persistWrite("work_records", "delete", { id: r.id });
            qc.invalidateQueries({ queryKey: ["work"] });
            toast.success("Arşiv temizlendi");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Silinemedi");
          }
        },
      },
    });
  }

  const shiftDay = (n: number) => setDay(new Date(Date.parse(day + "T12:00:00") + n * 86_400_000).toISOString().slice(0, 10));

  function setPickedName(name: string) {
    const c = (customers.data ?? []).find((x) => norm(x.name) === norm(name));
    setEdit((s) => s && { ...s, payload: { ...s.payload, name, customer_id: c?.id ?? null, phone: s.payload.phone || c?.phone || "" } });
  }

  function submitAppointment() {
    if (!edit) return;
    const p = edit.payload;
    if (!norm(p.name)) return void toast.error("İsim gerekli");
    const clash = (recs.data ?? []).find(
      (r) => r.id !== edit.id && !r.payload.archived && r.payload.status === "Bekliyor" && r.payload.date === p.date && r.payload.time === p.time,
    );
    if (clash) toast.warning(`Aynı saatte ${String(clash.payload.name)} ile randevu var.`);
    save.mutate(edit, { onSuccess: () => setEdit(null) });
  }

  function openStartJob(a: WorkRecord) {
    const c = (customers.data ?? []).find((x) => x.id === a.payload.customer_id);
    setJob({
      appt: a,
      form: {
        title: String(a.payload.title || `${a.payload.name} işi`),
        customer_id: c?.id ?? null,
        owner_id: me.data?.id,
        date: todayISO(),
        equipment_id: null,
        address: c?.address ?? "",
        notes: String(a.payload.notes ?? ""),
        vat_rate: 0,
        seconds: 0,
      },
    });
  }

  async function startJob() {
    if (!job) return;
    const { owner_id, ...payload } = job.form;
    if (!String(payload.title ?? "").trim()) return void toast.error("İş adı gerekli");
    const v = validateJobForm(job.form, equipment.data ?? [], jobsAll.data ?? []);
    if (v.error) return void toast.error(v.error);
    v.warnings.forEach((w) => toast.warning(w));
    try {
      const jobId = await saveJob.mutateAsync({
        owner_id: String(owner_id ?? me.data?.id),
        payload: { ...payload, status: "Devam Ediyor", started_at: new Date().toISOString(), appointment_id: job.appt.id },
      });
      await save.mutateAsync({ id: job.appt.id, owner_id: job.appt.owner_id, payload: { ...job.appt.payload, status: "Geldi", job_id: jobId } });
      setJob(null);
      void navigate({ to: "/isler" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İş başlatılamadı");
    }
  }

  const today = todayISO();
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const tomorrowList = (recs.data ?? []).filter((r) => !r.payload.archived && r.payload.status === "Bekliyor" && r.payload.date === tomorrow);
  const upd = (k: string, v: string) => setEdit((s) => s && { ...s, payload: { ...s.payload, [k]: v } });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Randevular</h1>
        <Button onClick={() => setEdit({ payload: empty() })}>
          <Plus />
          Randevu
        </Button>
      </div>

      {notifySupported() && (
        <Button
          variant="secondary"
          className="w-full"
          disabled={perm === "denied" || pushBusy || pushEnabled}
          onClick={async () => {
            setPushBusy(true);
            try {
              await enableAppointmentPush();
              setPerm("granted");
              setPushEnabled(true);
              toast.success("Randevu bildirimleri bu cihaza bağlandı.");
            } catch (error) {
              setPerm(Notification.permission);
              toast.error(error instanceof Error ? error.message : "Bildirim kaydı yapılamadı.");
            } finally {
              setPushBusy(false);
            }
          }}
        >
          <Bell />
          {pushEnabled
            ? "Randevu bildirimleri bu cihazda açık"
            : perm === "denied"
              ? "Bildirimler tarayıcı ayarlarından engelli"
              : pushBusy
                ? "Bildirimler etkinleştiriliyor…"
                : perm === "granted"
                  ? "Randevu bildirim kaydını tamamla"
                  : "Randevu bildirimlerini aç"}
        </Button>
      )}

      {tomorrowList.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-primary/40 bg-primary/10 p-4">
          <h2 className="text-sm font-semibold">Yarın {tomorrowList.length} randevu var · müşterilere hatırlat</h2>
          {tomorrowList.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{String(r.payload.time)} · {String(r.payload.name)}</span>
              {r.payload.phone ? (
                <Button asChild size="sm" variant="secondary">
                  <a href={whatsappLink(String(r.payload.phone), appointmentReminderText(profile, r.payload))} target="_blank" rel="noreferrer"><MessageCircle />Gönder</a>
                </Button>
              ) : <span className="text-xs text-muted-foreground">Telefon yok</span>}
            </div>
          ))}
        </section>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
        <Input aria-label="İsme göre ara" placeholder="İsme göre ara…" className="h-11 pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button size="sm" variant={view === "all" ? "default" : "secondary"} onClick={() => setView("all")}>Tüm tarihler</Button>
        <Button size="sm" variant={view === "day" ? "default" : "secondary"} onClick={() => setView("day")}>Gün gün</Button>
        <Button size="sm" variant={view === "archive" ? "default" : "secondary"} onClick={() => setView("archive")}>
          <Archive /> Arşiv{archivedCount ? ` (${archivedCount})` : ""}
        </Button>
      </div>

      {view === "day" && (
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" aria-label="Önceki gün" onClick={() => shiftDay(-1)}><ChevronLeft /></Button>
          <Input type="date" aria-label="Gün" className="h-10 flex-1" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
          <Button variant="secondary" size="icon" aria-label="Sonraki gün" onClick={() => shiftDay(1)}><ChevronRight /></Button>
          <Button variant="ghost" size="sm" onClick={() => setDay(todayISO())}>Bugün</Button>
        </div>
      )}

      {view === "archive" ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Silinen randevular burada durur; geri alabilir veya kalıcı silebilirsiniz.</p>
          {archivedCount > 0 && <Button size="sm" variant="ghost" className="text-destructive" onClick={purgeAll}>Arşivi boşalt</Button>}
        </div>
      ) : (
        <div className="flex gap-2">
          {["", ...STATUSES].map((s) => (
            <Button key={s || "all"} size="sm" variant={status === s ? "default" : "secondary"} onClick={() => setStatus(s)}>
              {s || "Tümü"}
            </Button>
          ))}
        </div>
      )}

      {recs.error && <p className="text-destructive">Randevular yüklenemedi.</p>}

      {groups.map(([date, list]) => (
        <section key={date} className="space-y-2">
          <h2 className={"text-sm font-semibold " + (date === today ? "text-primary" : "text-muted-foreground")}>
            {date === today ? "Bugün · " : ""}
            {formatDate(date)}
          </h2>
          {list.map((r) => {
            const due = r.payload.status === "Bekliyor" && now >= apptStart(r.payload);
            const phone = String(r.payload.phone ?? "");
            return (
              <SwipeRow key={r.id} onDelete={() => (view === "archive" ? purge(r) : setArchived(r, true))}>
                <div className="space-y-3 p-4">
                  <button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setEdit({ id: r.id, owner_id: r.owner_id, payload: r.payload })}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{String(r.payload.name)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {String(r.payload.time ?? "")} {r.payload.title ? "· " + r.payload.title : ""}
                      </p>
                    </div>
                    <span className={"rounded-full px-2 py-1 text-xs " + (r.payload.status === "Geldi" ? "bg-primary/15 text-primary" : r.payload.status === "İptal" ? "bg-destructive/15 text-destructive" : due ? "bg-warning/20 text-warning" : "bg-secondary")}>
                      {due ? "Zamanı geldi" : String(r.payload.status ?? "Bekliyor")}
                    </span>
                  </button>
                  {(
                    <div className="flex items-center gap-2">
                      {view === "archive" ? (
                        <>
                          <Button variant="secondary" className="h-11 flex-1" onClick={() => setArchived(r, false)}>
                            <Undo2 />
                            Geri al
                          </Button>
                          <Button variant="ghost" className="h-11 text-destructive hover:bg-destructive/10" onClick={() => purge(r)}>
                            <Trash2 />
                            Kalıcı sil
                          </Button>
                        </>
                      ) : null}
                      {view !== "archive" && due && (
                        <Button className="h-11 flex-1" onClick={() => openStartJob(r)}>
                          <Play />
                          İşi başlat
                        </Button>
                      )}
                      {view !== "archive" && phone && (
                        <>
                          <Button asChild variant="secondary" size="icon" className="h-11 w-11" title="Ara">
                            <a href={"tel:" + phone}><Phone /></a>
                          </Button>
                          <Button asChild variant="secondary" size="icon" className="h-11 w-11" title="WhatsApp ile hatırlat">
                            <a target="_blank" rel="noreferrer" href={whatsappLink(phone, appointmentReminderText(profile, r.payload))}>
                              <MessageCircle />
                            </a>
                          </Button>
                        </>
                      )}
                      {view !== "archive" && (
                        <Button variant="ghost" size="icon" className="ml-auto h-11 w-11 text-destructive hover:bg-destructive/10" title="Sil (arşive taşı)" onClick={() => setArchived(r, true)}>
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </SwipeRow>
            );
          })}
        </section>
      ))}
      {!rows.length && !recs.isLoading && (
        <p className="py-8 text-center text-muted-foreground">{q ? "Bu isimle randevu bulunamadı." : view === "archive" ? "Arşiv boş." : view === "day" ? "Bu gün için randevu yok." : "Randevu yok."}</p>
      )}

      <FormDrawer open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit?.id ? "Randevuyu düzenle" : "Yeni randevu"} busy={save.isPending} onSubmit={submitAppointment}>
        {edit && (
          <>
            <div className="space-y-2">
              <Label htmlFor="ap-name">İsim</Label>
              <Input id="ap-name" required list="ap-customers" autoComplete="off" value={String(edit.payload.name ?? "")} onChange={(e) => setPickedName(e.target.value)} />
              <datalist id="ap-customers">
                {(customers.data ?? []).map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ap-date">Tarih</Label>
                <Input id="ap-date" type="date" required value={String(edit.payload.date ?? "")} onChange={(e) => upd("date", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ap-time">Saat</Label>
                <Input id="ap-time" type="time" required value={String(edit.payload.time ?? "")} onChange={(e) => upd("time", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ap-phone">Telefon</Label>
              <Input id="ap-phone" type="tel" value={String(edit.payload.phone ?? "")} onChange={(e) => upd("phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ap-title">Konu</Label>
              <Input id="ap-title" value={String(edit.payload.title ?? "")} onChange={(e) => upd("title", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ap-remind">Hatırlat</Label>
                <select id="ap-remind" className="h-11 w-full rounded-md border bg-secondary px-3 text-sm" value={String(edit.payload.remind ?? "30")} onChange={(e) => upd("remind", e.target.value)}>
                  {REMIND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ap-status">Durum</Label>
                <select id="ap-status" className="h-11 w-full rounded-md border bg-secondary px-3 text-sm" value={String(edit.payload.status ?? "Bekliyor")} onChange={(e) => upd("status", e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ap-notes">Not</Label>
              <Input id="ap-notes" value={String(edit.payload.notes ?? "")} onChange={(e) => upd("notes", e.target.value)} />
            </div>
          </>
        )}
      </FormDrawer>

      <FormDrawer open={!!job} onOpenChange={(o) => !o && setJob(null)} title="İşi başlat" busy={saveJob.isPending} onSubmit={() => void startJob()}>
        {job && <JobFormBody form={job.form} onChange={(form) => setJob({ ...job, form })} customers={customers.data ?? []} members={members} equipment={equipment.data ?? []} jobs={jobsAll.data ?? []} startingNow />}
      </FormDrawer>
    </div>
  );
}
