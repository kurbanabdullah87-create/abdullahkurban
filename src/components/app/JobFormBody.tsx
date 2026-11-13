import { AlertTriangle, Cog, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { RecordFields } from "@/components/app/RecordFields";
import type { Customer } from "@/lib/data";
import { jobFields, type Member } from "@/lib/job-fields";
import {
  findMachineConflicts,
  machineChosen,
  maintenanceStatus,
  type Payload,
  type WorkRecord,
} from "@/lib/work";
import { cn } from "@/lib/utils";

const tone = (level: string) =>
  level === "over"
    ? "border-destructive/50 bg-destructive/10 text-destructive"
    : level === "warn"
      ? "border-warning/50 bg-warning/10 text-warning"
      : "bg-secondary text-muted-foreground";

/** Makinenin bakım durumu: kalan saat, %80 sarı, %100 kırmızı. */
export function MachineInfo({
  equipment,
  id,
  extraSeconds = 0,
}: {
  equipment: WorkRecord[];
  id: string;
  extraSeconds?: number;
}) {
  const eq = equipment.find((e) => e.id === id);
  if (!eq) return null;
  const m = maintenanceStatus(eq.payload, Date.now(), extraSeconds);
  return (
    <div
      role={m.level === "over" || m.level === "warn" ? "alert" : undefined}
      className={cn("flex items-center gap-2 rounded-lg border p-2 text-xs", tone(m.level))}
    >
      <Wrench className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <b>{String(eq.payload.name)}</b> · {m.used.toFixed(1)}/{m.interval} saat ·{" "}
        {m.level === "over"
          ? `Bakım zamanı geçti (${(-m.remaining).toFixed(1)} sa)`
          : m.level === "warn"
            ? `Bakım yaklaşıyor (${m.remaining.toFixed(1)} sa kaldı)`
            : m.level === "none"
              ? "Bakım aralığı tanımsız"
              : `Bakıma ${m.remaining.toFixed(1)} sa kaldı`}
      </span>
    </div>
  );
}

/** Adım 1: önce makine (ya da "Makinesiz iş") seçilir. */
export function MachineGate({
  equipment,
  form,
  onChange,
}: {
  equipment: WorkRecord[];
  form: Payload;
  onChange: (p: Payload) => void;
}) {
  const pick = (id: string | null) =>
    onChange({ ...form, equipment_id: id, no_machine: id === null });
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-semibold">
        1 · Kullanılacak makine <span className="text-destructive">*</span>
      </legend>
      <div className="grid gap-2" role="radiogroup" aria-label="Kullanılacak makine">
        {equipment.map((e) => {
          const m = maintenanceStatus(e.payload);
          const on = form.equipment_id === e.id;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={on}
              key={e.id}
              onClick={() => pick(e.id)}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm",
                on ? "border-primary bg-accent text-primary" : "bg-secondary",
              )}
            >
              <Cog className="size-5 shrink-0" />
              <span className="min-w-0 flex-1 truncate font-medium">{String(e.payload.name)}</span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px]",
                  m.level === "over"
                    ? "bg-destructive/20 text-destructive"
                    : m.level === "warn"
                      ? "bg-warning/20 text-warning"
                      : "text-muted-foreground",
                )}
              >
                {m.level === "over"
                  ? "Bakım geçti"
                  : m.level === "warn"
                    ? `${m.remaining.toFixed(0)} sa kaldı`
                    : m.level === "none"
                      ? ""
                      : `${m.remaining.toFixed(0)} sa`}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={form.no_machine === true}
          onClick={() => pick(null)}
          className={cn(
            "min-h-12 rounded-xl border px-3 py-2 text-left text-sm font-medium",
            form.no_machine === true ? "border-primary bg-accent text-primary" : "bg-secondary",
          )}
        >
          Makinesiz iş
        </button>
      </div>
    </fieldset>
  );
}

/** İş formu gövdesi: makine seçimi → (seçilince) bakım/çakışma uyarıları + iş bilgileri. İşler ve Randevu ortak kullanır. */
export function JobFormBody({
  form,
  onChange,
  customers,
  members,
  equipment,
  jobs,
  selfId,
  startingNow,
  children,
}: {
  form: Payload;
  onChange: (p: Payload) => void;
  customers: Customer[];
  members: Member[];
  equipment: WorkRecord[];
  jobs: WorkRecord[];
  selfId?: string | undefined;
  startingNow?: boolean;
  children?: ReactNode;
}) {
  const chosen = machineChosen(form);
  const eqId = String(form.equipment_id ?? "");
  const planned = Math.max(0, Number(form.planned_hours ?? 0)) * 3600;
  const conflicts = eqId
    ? findMachineConflicts(
        jobs,
        startingNow ? { ...form, started_at: new Date().toISOString() } : form,
        selfId,
      )
    : [];
  const done = form.status === "Tamamlandı";
  return (
    <>
      <MachineGate equipment={equipment} form={form} onChange={onChange} />
      {!chosen && (
        <p className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
          İş bilgileri, makine seçildikten sonra açılır.
        </p>
      )}
      {chosen && (
        <>
          {eqId && (
            <MachineInfo equipment={equipment} id={eqId} extraSeconds={done ? 0 : planned} />
          )}
          {conflicts.length > 0 && (
            <p
              role="alert"
              className="flex items-start gap-1.5 rounded-lg border border-warning/50 bg-warning/10 p-2 text-xs text-warning"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              Çakışma: bu makine aynı zaman aralığında şu işte de görünüyor —{" "}
              {conflicts
                .map(
                  (j) =>
                    `${String(j.payload.title)} (${String(j.payload.date)}${j.payload.time ? " " + String(j.payload.time) : ""})`,
                )
                .join(", ")}
            </p>
          )}
          <h3 className="pt-1 text-sm font-semibold">2 · İş bilgileri</h3>
          <RecordFields fields={jobFields(customers, members)} value={form} onChange={onChange} />
          {children}
        </>
      )}
    </>
  );
}
