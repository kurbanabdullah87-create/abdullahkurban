import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Banknote, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDrawer } from "@/components/app/forms/FormDrawer";
import { RecordFields, type Field } from "@/components/app/RecordFields";
import { useMe } from "@/hooks/use-me";
import { supabase } from "@/integrations/supabase/client";
import {
  useRecords,
  useSaveRecord,
  payrollAmount,
  payrollBalance,
  pageHead,
  type Payload,
} from "@/lib/work";
import { todayISO, formatTL, formatDate } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/yevmiye")({
  head: () => pageHead("Yevmiye ve Bordro", "Şantiye takvimi, hakediş ve avans hesabı."),
  component: Payroll,
});

function Payroll() {
  const pay = useRecords("payroll");
  const advances = useRecords("advance");
  const savePay = useSaveRecord("payroll");
  const saveAdvance = useSaveRecord("advance");
  const me = useMe();
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [user, setUser] = useState("");
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"payroll" | "advance">("payroll");
  const [form, setForm] = useState<Payload>({});
  const [members, setMembers] = useState<{ id: string; username: string }[]>([]);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id,username")
      .then(({ data }) => setMembers(data ?? []));
  }, []);

  const chosen = user || me.data?.id;
  const rows = (pay.data ?? []).filter(
    (r) => r.owner_id === chosen && String(r.payload.date).startsWith(month),
  );
  const av = (advances.data ?? []).filter(
    (r) => r.owner_id === chosen && String(r.payload.date).startsWith(month),
  );

  const earned = rows.reduce(
    (s, r) =>
      s +
      payrollAmount(Number(r.payload.days), Number(r.payload.rate), Number(r.payload.multiplier)),
    0,
  );
  const advanced = av.reduce((s, r) => s + Number(r.payload.amount), 0);

  function add(k: "payroll" | "advance", date = todayISO()) {
    setKind(k);
    setForm({ date, days: 1, multiplier: 1, rate: 0, owner_id: chosen });
    setOpen(true);
  }

  function shift(d: number) {
    const dt = new Date(month + "-01T12:00:00");
    dt.setMonth(dt.getMonth() + d);
    setMonth(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
  }

  const fields: Field[] = [
    {
      key: "owner_id",
      label: "Çalışan",
      required: true,
      options: members.map((m) => ({ value: m.id, label: m.username })),
    },
    { key: "date", label: "Tarih", type: "date", required: true },
    ...(kind === "payroll"
      ? [
          { key: "site", label: "Şantiye / çalışma yeri", required: true },
          { key: "rate", label: "Günlük yevmiye (TL)", type: "number", required: true },
          {
            key: "days",
            label: "Mesai",
            options: [
              { value: "1", label: "1 Tam Gün" },
              { value: "0.5", label: "0.5 Yarım Gün" },
              { value: "0.25", label: "0.25 Çeyrek Gün" },
            ],
          },
          {
            key: "multiplier",
            label: "Çarpan",
            options: [
              { value: "1", label: "x1" },
              { value: "1.5", label: "x1.5" },
              { value: "2", label: "x2" },
            ],
          },
        ]
      : [{ key: "amount", label: "Avans (TL)", type: "number", required: true }]),
    { key: "notes", label: "Açıklama" },
  ];

  const first = new Date(month + "-01T12:00:00");
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Yevmiye ve bordro</h1>
      {me.data?.isUsta && (
        <select
          aria-label="Çalışan filtresi"
          className="h-11 w-full rounded-md border bg-secondary px-3"
          value={chosen}
          onChange={(e) => setUser(e.target.value)}
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.username}
            </option>
          ))}
        </select>
      )}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" aria-label="Önceki ay" onClick={() => shift(-1)}>
          <ChevronLeft />
        </Button>
        <h2>{first.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}</h2>
        <Button variant="ghost" size="icon" aria-label="Sonraki ay" onClick={() => shift(1)}>
          <ChevronRight />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          ["Hakediş", earned],
          ["Avans", advanced],
          ["Kalan", payrollBalance(earned, advanced)],
        ].map(([l, v]) => (
          <div key={l} className="border-b py-3">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="num break-words text-sm font-semibold">{formatTL(Number(v))}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pa"].map((d) => (
          <span className="py-1 text-center text-xs text-muted-foreground" key={d}>
            {d}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={"e" + i} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const d = `${month}-${String(i + 1).padStart(2, "0")}`;
          const worked = rows.filter((r) => r.payload.date === d);
          return (
            <Button
              key={d}
              variant={worked.length ? "default" : "secondary"}
              className="h-12 px-0 flex-col gap-0"
              disabled={!me.data?.isUsta}
              onClick={() => add("payroll", d)}
            >
              {i + 1}
              <span className="text-[10px]">
                {worked.length ? worked.reduce((s, r) => s + Number(r.payload.days), 0) + " g" : ""}
              </span>
            </Button>
          );
        })}
      </div>
      {me.data?.isUsta && (
        <div className="flex gap-2">
          <Button onClick={() => add("payroll")}>
            <Plus />
            Yevmiye
          </Button>
          <Button variant="secondary" onClick={() => add("advance")}>
            <Banknote />
            Avans
          </Button>
        </div>
      )}
      {pay.error && <p className="text-destructive">Kayıtlar yüklenemedi.</p>}
      {[
        ...rows.map((r) => ({
          r,
          amount: payrollAmount(
            Number(r.payload.days),
            Number(r.payload.rate),
            Number(r.payload.multiplier),
          ),
          label: String(r.payload.site),
        })),
        ...av.map((r) => ({ r, amount: -Number(r.payload.amount), label: "Avans" })),
      ]
        .sort((a, b) => String(b.r.payload.date).localeCompare(String(a.r.payload.date)))
        .map(({ r, amount, label }) => (
          <div key={r.id} className="flex items-center justify-between gap-2 border-b py-3">
            <div className="min-w-0 flex-1">
              <p className="break-words font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(String(r.payload.date))}
                {r.kind === "payroll" ? ` · ${r.payload.days} gün × ${r.payload.multiplier}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p className={`num text-sm ${amount < 0 ? "text-warning" : "text-success"}`}>
                {formatTL(amount)}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 h-8 px-2"
                onClick={async () => {
                  if (confirm("Bu kaydı silmek istediğinize emin misiniz?")) {
                    const { error } = await supabase.from("work_records").delete().eq("id", r.id);
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
          </div>
        ))}
      <FormDrawer
        open={open}
        onOpenChange={setOpen}
        title={kind === "payroll" ? "Yevmiye ekle" : "Avans ekle"}
        busy={savePay.isPending || saveAdvance.isPending}
        onSubmit={() => {
          const { owner_id, ...payload } = form;
          (kind === "payroll" ? savePay : saveAdvance).mutate(
            { owner_id: String(owner_id), payload },
            { onSuccess: () => setOpen(false) },
          );
        }}
      >
        <RecordFields fields={fields} value={form} onChange={setForm} />
      </FormDrawer>
    </div>
  );
}
