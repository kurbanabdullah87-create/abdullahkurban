import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Play, Pause, Check, Copy, ChevronDown, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormDrawer } from "@/components/app/forms/FormDrawer";
import { JobFormBody, MachineInfo } from "@/components/app/JobFormBody";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MediaTools } from "@/components/app/MediaTools";
import { useCustomers } from "@/lib/data";
import { useMembers } from "@/lib/job-fields";
import { RouteButtons } from "@/components/app/RouteButtons";
import { LocationButton } from "@/components/app/LocationButton";
import { VoiceNoteButton } from "@/components/app/VoiceNoteButton";
import { useMe } from "@/hooks/use-me";
import { supabase } from "@/integrations/supabase/client";
import {
  useRecords,
  useSaveRecord,
  elapsedSeconds,
  hourlyCharge,
  maintenanceStatus,
  validateJobForm,
  pageHead,
  type Payload,
  type WorkRecord,
} from "@/lib/work";
import { todayISO, formatTL } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/isler")({
  head: () => pageHead("İşler", "İş planı, çalışma süreleri ve saha kayıtları."),
  component: Jobs,
});

const STATUSES = ["Bekliyor", "Devam Ediyor", "Tamamlandı", "Ertelendi"];

function Jobs() {
  const jobs = useRecords("job");
  const templates = useRecords("job_template");
  const saveTemplate = useSaveRecord("job_template");
  const save = useSaveRecord("job");
  const customers = useCustomers();
  const equipment = useRecords("equipment");
  const me = useMe();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WorkRecord>();
  const [form, setForm] = useState<Payload>({});
  const [filter, setFilter] = useState("Tümü");
  const [date, setDate] = useState(todayISO());
  const [showProgress, setShowProgress] = useState(true);
  const [expanded, setExpanded] = useState<string>();
  const [now, setNow] = useState(Date.now());
  const [billing, setBilling] = useState(false);
  const [weather, setWeather] = useState("");
  const [dur, setDur] = useState<{ job: WorkRecord; h: string; m: string } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const members = useMembers();

  function edit(j?: WorkRecord, p?: Payload) {
    setEditing(j);
    setForm(
      j
        ? { ...j.payload, owner_id: j.owner_id }
        : {
            title: "",
            date,
            seconds: 0,
            started_at: null,
            status: "Bekliyor",
            vat_rate: 0,
            equipment_id: null,
            owner_id: me.data?.id,
            ...p,
          },
    );
    setOpen(true);
  }

  async function change(j: WorkRecord, p: Payload) {
    await save.mutateAsync({ id: j.id, owner_id: j.owner_id, payload: p });
  }

  async function bill(j: WorkRecord) {
    setBilling(true);
    try {
      const { error } = await supabase.rpc("bill_job", { _job_id: j.id });
      if (error) throw error;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["work"] }),
        qc.invalidateQueries({ queryKey: ["transactions"] }),
      ]);
      toast.success("Borç cariye işlendi.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cariye işlenemedi");
    } finally {
      setBilling(false);
    }
  }

  /** İşi tamamlar (cariden bağımsız). Süreyi makine sayacına ekleme işini veritabanı tetikleyicisi bir kez yapar. */
  async function complete(j: WorkRecord, seconds: number) {
    const p = j.payload;
    const secs = Math.round(seconds);
    const eq = equipment.data?.find((e) => e.id === p.equipment_id);
    if (eq && secs < 60 && !confirm("Bu işin süresi 0. Makine sayacına süre eklenmeyecek. Yine de tamamlansın mı? (Süreyi sonradan 'Süreyi düzenle' ile girebilirsiniz.)")) return;
    await change(j, { ...p, seconds: secs, started_at: null, status: "Tamamlandı", completed_at: new Date().toISOString() });
    if (!eq) return;
    const applied = p.machine_applied_to === eq.id ? Number(p.machine_applied_seconds ?? 0) : 0;
    const m = maintenanceStatus(eq.payload, Date.now(), secs - applied);
    toast.info(`${String(eq.payload.name)} sayacına ${((secs - applied) / 3600).toFixed(2)} saat eklenecek.`);
    if (m.level === "over") toast.error(`${String(eq.payload.name)}: bakım zamanı geçti (${(-m.remaining).toFixed(1)} saat)`);
    else if (m.level === "warn") toast.warning(`${String(eq.payload.name)}: bakıma ${m.remaining.toFixed(1)} saat kaldı`);
  }

  function getWeather() {
    if (!navigator.geolocation) {
      setWeather("Konum desteklenmiyor");
      return;
    }
    setWeather("Hava durumu alınıyor…");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const r = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,precipitation,wind_speed_10m&timezone=auto`,
          );
          if (!r.ok) throw new Error();
          const w = await r.json();
          setWeather(
            `${w.current.temperature_2m}°C · Yağış ${w.current.precipitation} mm · Rüzgâr ${w.current.wind_speed_10m} km/sa`,
          );
        } catch {
          setWeather("Hava durumu alınamadı");
        }
      },
      () => setWeather("Konum izni verilmedi"),
    );
  }

  const rows = (jobs.data ?? []).filter(
    (j) => (filter === "Tümü" || j.payload.status === filter) && (!date || j.payload.date === date),
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">İşler</h1>
        {me.data?.isUsta && (
          <Button onClick={() => edit()}>
            <Plus />
            İş ekle
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="İş günü"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border bg-secondary p-2 text-sm"
        />
        <Button variant="ghost" size="sm" onClick={() => setDate("")}>
          Tüm tarihler
        </Button>
        <Button variant="outline" size="sm" onClick={getWeather}>
          Hava durumu
        </Button>
      </div>
      {weather && <p className="text-sm text-muted-foreground">{weather}</p>}
      <select
        aria-label="İş durumu filtresi"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="h-11 w-full rounded-md border bg-secondary px-3"
      >
        {["Tümü", ...STATUSES].map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      {me.data?.isUsta && !!templates.data?.length && (
        <div className="flex flex-wrap gap-2">
          {templates.data.map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant="secondary"
              onClick={() => edit(undefined, t.payload)}
            >
              <Copy />
              {t.payload.title}
            </Button>
          ))}
        </div>
      )}
      {jobs.error && <p className="text-destructive">İşler yüklenemedi.</p>}
      {jobs.isLoading ? (
        <p className="text-muted-foreground">Yükleniyor…</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Bu tarihte iş yok.</p>
      ) : (
        rows.map((j, index) => {
          const p = j.payload;
          const seconds = elapsedSeconds(p, now);
          const customer = customers.data?.find((c) => c.id === p.customer_id);
          const address = String(p.address || customer?.address || "");
          return (
            <article key={j.id} className="space-y-3 rounded-lg border bg-card p-4">
              <div className="flex justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-semibold break-words">
                    {index + 1}. {p.title}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {customer?.name} · {p.date}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="İş detayları"
                  onClick={() => setExpanded(expanded === j.id ? undefined : j.id)}
                >
                  <ChevronDown />
                </Button>
              </div>
              {Boolean(p.equipment_id) && <MachineInfo equipment={equipment.data ?? []} id={String(p.equipment_id)} />}
              <div className="flex items-center justify-between">
                <span className={p.status === "Tamamlandı" ? "text-success" : "text-warning"}>
                  {p.status}
                </span>
                <span className="num">
                  {Math.floor(seconds / 3600)}:
                  {String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:
                  {String(Math.floor(seconds) % 60).padStart(2, "0")}
                </span>
              </div>
              {me.data?.isUsta && (
                <>
                  <p className="num text-primary">
                    {formatTL(
                      Number(p.hourly_rate) > 0
                        ? hourlyCharge(seconds, Number(p.hourly_rate))
                        : Number(p.price ?? 0),
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={save.isPending || Boolean(p.billed) || p.status === "Tamamlandı"}
                      onClick={() =>
                        void change(j, {
                          ...p,
                          seconds,
                          started_at: p.started_at ? null : new Date().toISOString(),
                          status: p.started_at ? "Bekliyor" : "Devam Ediyor",
                        })
                      }
                    >
                      {p.started_at ? <Pause /> : <Play />}
                      {p.started_at ? "Duraklat" : "Başlat"}
                    </Button>
                    {p.status !== "Tamamlandı" && (
                      <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => void complete(j, seconds)}>
                        <Check />
                        İşi tamamla
                      </Button>
                    )}
                    {p.status === "Tamamlandı" && !p.billed && (
                      <Button size="sm" variant="outline" onClick={() => setDur({ job: j, h: String(Math.floor(Number(p.seconds ?? 0) / 3600)), m: String(Math.round((Number(p.seconds ?? 0) % 3600) / 60)) })}>
                        <Clock />
                        Süreyi düzenle
                      </Button>
                    )}
                    <Button
                      size="sm"
                      disabled={billing || Boolean(p.billed) || !navigator.onLine}
                      onClick={() => void bill(j)}
                    >
                      <Check />
                      {p.billed ? "Cariye işlendi" : "Cariye işle"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={Boolean(p.billed)}
                      onClick={() => edit(j)}
                    >
                      Düzenle
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={async () => {
                        if (confirm("Bu işi silmek istediğinize emin misiniz?")) {
                          // Önce transactions tablosundaki olası bağlantı sütunlarını temizliyoruz
                          await supabase.from("transactions").delete().eq("job_record_id", j.id);

                          // Şimdi işi siliyoruz
                          const { error } = await supabase.from("work_records").delete().eq("id", j.id);
                          if (error) {
                            alert("Silinemedi: " + error.message);
                          } else {
                            window.location.reload();
                          }
                        }
                      }}
                    >
                      Sil
                    </Button>
                  </div>
                </>
              )}
              <RouteButtons p={{ ...p, address }} />
              {expanded === j.id && (
                <div className="space-y-3 border-t pt-3">
                  <p className="text-sm break-words">{p.notes}</p>
                  {me.data?.isUsta && (
                    <>
                      <select
                        aria-label="İş durumunu değiştir"
                        className="w-full rounded-md border bg-secondary p-2"
                        disabled={Boolean(p.billed)}
                        value={String(p.status)}
                        onChange={(e) => (e.target.value === "Tamamlandı" ? void complete(j, seconds) : void change(j, { ...p, status: e.target.value }))}
                      >
                        {STATUSES.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          saveTemplate.mutate({
                            payload: {
                              title: p.title,
                              hourly_rate: p.hourly_rate,
                              price: p.price,
                              material_cost: p.material_cost,
                              vat_rate: p.vat_rate,
                              notes: p.notes,
                            },
                          })
                        }
                      >
                        <Copy />
                        Şablon olarak kaydet
                      </Button>
                    </>
                  )}
                  <MediaTools record={j} readOnly={!me.data?.isUsta} onSave={(p) => change(j, p)} />
                </div>
              )}
            </article>
          );
        })
      )}
      <FormDrawer
        open={open}
        onOpenChange={setOpen}
        title={editing ? "İşi düzenle" : "Yeni iş"}
        busy={save.isPending}
        onSubmit={() => {
          if (!String(form.title ?? "").trim()) return void toast.error("İş adı gerekli");
          const v = validateJobForm(form, equipment.data ?? [], jobs.data ?? [], editing?.id);
          if (v.error) return void toast.error(v.error);
          v.warnings.forEach((w) => toast.warning(w));
          const { owner_id, ...payload } = form;
          save.mutate(
            { id: editing?.id, owner_id: String(owner_id ?? me.data?.id), payload },
            { onSuccess: () => setOpen(false) },
          );
        }}
      >
        <JobFormBody form={form} onChange={setForm} customers={customers.data ?? []} members={members} equipment={equipment.data ?? []} jobs={jobs.data ?? []} selfId={editing?.id}>
          <LocationButton value={form} onChange={setForm} />
          <VoiceNoteButton onText={(t) => setForm((f) => ({ ...f, notes: [f.notes, t].filter(Boolean).join(" ") }))} />
        </JobFormBody>
      </FormDrawer>
      <FormDrawer
        open={!!dur}
        onOpenChange={(o) => !o && setDur(null)}
        title="Çalışma süresini düzenle"
        busy={save.isPending}
        onSubmit={() => {
          if (!dur) return;
          const secs = Math.max(0, Math.round(Number(dur.h || 0) * 3600 + Number(dur.m || 0) * 60));
          void change(dur.job, { ...dur.job.payload, seconds: secs }).then(() => setDur(null));
        }}
      >
        {dur && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="dur-h">Saat</Label><Input id="dur-h" className="h-12" type="number" min="0" inputMode="numeric" value={dur.h} onChange={(e) => setDur({ ...dur, h: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="dur-m">Dakika</Label><Input id="dur-m" className="h-12" type="number" min="0" max="59" inputMode="numeric" value={dur.m} onChange={(e) => setDur({ ...dur, m: e.target.value })} /></div>
            </div>
            <p className="text-xs text-muted-foreground">Makine sayacına yalnızca eski ve yeni süre arasındaki fark eklenir ya da düşülür.</p>
          </>
        )}
      </FormDrawer>
    </div>
  );
}
