import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Play, Pause, Wrench, ScanLine, Check, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormDrawer } from "@/components/app/forms/FormDrawer";
import { RecordFields, type Field } from "@/components/app/RecordFields";
import { MediaTools } from "@/components/app/MediaTools";
import { CodeScanner } from "@/components/app/CodeScanner";
import { useUndoableDelete } from "@/lib/data";
import {
  useRecords,
  useSaveRecord,
  elapsedSeconds,
  depreciation,
  hourlyCharge,
  machineSeconds,
  maintenanceStatus,
  pageHead,
  type Payload,
  type WorkRecord,
} from "@/lib/work";
import { todayISO, formatTL, formatDate } from "@/lib/finance";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/ekipman")({
  head: () => pageHead("Ekipman", "Ekipman sicili, bakım ve emanet takibi."),
  component: Equipment,
});

function Equipment() {
  const items = useRecords("equipment");
  const jobs = useRecords("job");
  const maintenance = useRecords("maintenance");
  const shopping = useRecords("shopping");
  const save = useSaveRecord("equipment");
  const saveShopping = useSaveRecord("shopping");
  const delEquipment = useUndoableDelete("equipment");
  const delShopping = useUndoableDelete("shopping");

  const qc = useQueryClient();
  const [servicing, setServicing] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WorkRecord>();
  const [form, setForm] = useState<Payload>({});
  const [selected, setSelected] = useState<string>();
  const [tab, setTab] = useState("Ekipman");
  const [scan, setScan] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [shoppingText, setShoppingText] = useState("");
  const [borrower, setBorrower] = useState("");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const fields: Field[] = [
    { key: "name", label: "Ekipman adı", required: true },
    { key: "code", label: "QR / barkod numarası" },
    { key: "purchased", label: "Alış tarihi", type: "date", required: true },
    { key: "price", label: "Alış bedeli (TL)", type: "number" },
    { key: "years", label: "Amortisman süresi (yıl)", type: "number" },
    { key: "maintenance_hours", label: "Bakım aralığı (saat)", type: "number", required: true },
    { key: "notes", label: "Sicil notları" },
  ];

  function edit(item?: WorkRecord) {
    setEditing(item);
    setForm(
      item?.payload ?? {
        name: "",
        purchased: todayISO(),
        price: 0,
        years: 5,
        maintenance_hours: 30,
        seconds: 0,
        last_service_seconds: 0,
      },
    );
    setOpen(true);
  }

  async function change(item: WorkRecord, p: Payload) {
    await save.mutateAsync({ id: item.id, payload: p });
  }

  const rows = (items.data ?? []).filter((i) => tab !== "Emanet" || i.payload.borrower);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Ekipman</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            title="QR / barkod tara"
            onClick={() => setScan(true)}
          >
            <ScanLine />
          </Button>
          <Button size="sm" onClick={() => edit()}>
            <Plus />
            Ekipman
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {["Ekipman", "Emanet", "Alınacaklar"].map((t) => (
          <Button
            size="sm"
            key={t}
            variant={tab === t ? "default" : "secondary"}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </div>
      {scan && (
        <CodeScanner
          onClose={() => setScan(false)}
          onRead={(code) => {
            const found = items.data?.find((i) => i.id === code || i.payload.code === code);
            setScan(false);
            if (found) {
              setTab("Ekipman");
              setSelected(found.id);
            } else toast.error("Bu koda ait ekipman bulunamadı.");
          }}
        />
      )}
      {tab === "Alınacaklar" ? (
        <>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (shoppingText.trim())
                saveShopping.mutate(
                  { payload: { name: shoppingText, done: false } },
                  { onSuccess: () => setShoppingText("") },
                );
            }}
          >
            <Input
              aria-label="Alınacak malzeme"
              value={shoppingText}
              onChange={(e) => setShoppingText(e.target.value)}
              required
            />
            <Button type="submit" aria-label="Listeye ekle">
              <Plus />
            </Button>
          </form>
          {shopping.data?.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3 border-b py-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  aria-label={String(i.payload.name)}
                  checked={Boolean(i.payload.done)}
                  onChange={(e) =>
                    saveShopping.mutate({
                      id: i.id,
                      payload: { ...i.payload, done: e.target.checked },
                    })
                  }
                />
                <span className={i.payload.done ? "line-through text-muted-foreground" : ""}>
                  {i.payload.name}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 h-8 px-2"
                onClick={() => {
                  if (confirm("Bu malzemeyi listeden silmek istediğinize emin misiniz?")) {
                    delShopping(i.id);
                  }
                }}
              >
                Sil
              </Button>
            </div>
          ))}
        </>
      ) : (
        <>
          {items.error && <p className="text-destructive">Ekipmanlar yüklenemedi.</p>}
          {!rows.length && !items.isLoading && (
            <p className="py-8 text-center text-muted-foreground">Kayıt yok.</p>
          )}
          {rows.map((item) => {
            const p = item.payload;
            const seconds = elapsedSeconds(p, now); // yalnızca elle kronometre
            const total = machineSeconds(p, now); // kronometre + tamamlanan işler
            const m = maintenanceStatus(p, now);
            const mine = (jobs.data ?? []).filter((j) => j.payload.equipment_id === item.id && j.payload.billed);
            const earned = mine.reduce((t, j) => t + (Number(j.payload.hourly_rate) > 0 ? hourlyCharge(Number(j.payload.seconds ?? 0), Number(j.payload.hourly_rate)) : Number(j.payload.price ?? 0)), 0);
            const price = Number(p.price ?? 0);
            return (
              <article key={item.id} className="space-y-3 rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold break-words">{p.name}</h2>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelected(selected === item.id ? undefined : item.id);
                        setBorrower(String(p.borrower ?? ""));
                      }}
                    >
                      Sicil
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm("Bu ekipmanı silmek istediğinize emin misiniz?")) {
                          delEquipment(item.id);
                        }
                      }}
                    >
                      Sil
                    </Button>
                  </div>
                </div>
                <p className="num text-lg">{(total / 3600).toFixed(2)} saat <span className="text-xs text-muted-foreground">toplam çalışma</span></p>
                {m.level === "over" && <p className="rounded-md bg-destructive/10 p-2 text-sm font-semibold text-destructive">🔴 Bakım zamanı geçti ({(-m.remaining).toFixed(1)} saat) — yağ / motor bakımı yapın</p>}
                {m.level === "warn" && <p className="rounded-md bg-warning/10 p-2 text-sm font-semibold text-warning">🟡 Bakım yaklaşıyor: {m.remaining.toFixed(1)} saat kaldı</p>}
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className={"h-full " + (m.level === "over" ? "bg-destructive" : m.level === "warn" ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(100, m.ratio * 100)}%` }} /></div>
                {mine.length > 0 && (
                  <p className="num text-xs text-muted-foreground">
                    {mine.length} iş · kazandırdığı {formatTL(earned)}{price > 0 ? ` · geri dönüş %${Math.round((earned / price) * 100)}` : ""}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Son bakımdan sonra {m.used.toFixed(2)} / {p.maintenance_hours} saat · {m.remaining >= 0 ? `${m.remaining.toFixed(1)} saat kaldı` : `${(-m.remaining).toFixed(1)} saat gecikti`}
                </p>
                {p.borrower && (
                  <p className="text-warning text-sm">
                    {p.borrower} · {p.borrowed_on ? formatDate(String(p.borrowed_on)) : ""}
                  </p>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={save.isPending}
                  onClick={() =>
                    void change(item, {
                      ...p,
                      seconds,
                      started_at: p.started_at ? null : new Date().toISOString(),
                    })
                  }
                >
                  {p.started_at ? <Pause /> : <Play />}
                  {p.started_at ? "Durdur" : "Çalıştır"}
                </Button>
                {(m.level === "warn" || m.level === "over") && (
                  <Button variant="outline" size="sm" className="ml-2" onClick={() => setSelected(item.id)}>
                    <Wrench /> Bakım kaydı gir
                  </Button>
                )}
                {selected === item.id && (
                  <div className="space-y-4 border-t pt-3">
                    <p className="text-sm">
                      Alış: {p.purchased ? formatDate(String(p.purchased)) : "—"} ·{" "}
                      {formatTL(Number(p.price ?? 0))}
                    </p>
                    <p className="text-sm">
                      Kalan değer:{" "}
                      {formatTL(
                        depreciation(
                          Number(p.price ?? 0),
                          Number(p.years ?? 5),
                          String(p.purchased ?? todayISO()),
                        ),
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {p.notes} · Kod: {p.code || item.id}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => edit(item)}>
                      Sicili düzenle
                    </Button>
                    <MediaTools record={item} onSave={(p) => change(item, p)} />
                    <h3 className="font-semibold">Emanet</h3>
                    <Input
                      aria-label="Ekipman kimde"
                      value={borrower}
                      onChange={(e) => setBorrower(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={!borrower.trim()}
                        onClick={() =>
                          void change(item, { ...p, borrower, borrowed_on: todayISO() })
                        }
                      >
                        <ArrowRightLeft />
                        Emanete ver
                      </Button>
                      {p.borrower && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            void change(item, { ...p, borrower: null, borrowed_on: null })
                          }
                        >
                          <Check />
                          Geri alındı
                        </Button>
                      )}
                    </div>
                    <h3 className="font-semibold">Bakım kaydı</h3>
                    <Input
                      aria-label="Bakım açıklaması"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <Input
                      type="number"
                      min="0"
                      aria-label="Bakım maliyeti"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                    />
                    <Button
                      size="sm"
                      disabled={servicing || !navigator.onLine}
                      onClick={async () => {
                        if (Number(cost || 0) < 0) return void toast.error("Bakım maliyeti negatif olamaz");
                        setServicing(true);
                        // Sunucuda atomik: son bakım sayacı toplam saate eşitlenir, toplam çalışma saati korunur.
                        const { error } = await supabase.rpc("service_equipment", { _equipment_id: item.id, _note: note.trim() || "Periyodik bakım", _cost: Number(cost || 0) });
                        setServicing(false);
                        if (error) return void toast.error("Bakım kaydedilemedi: " + error.message);
                        await qc.invalidateQueries({ queryKey: ["work"] });
                        toast.success("Bakım kaydedildi; bakım sayacı güncellendi.");
                        setCost("");
                        setNote("");
                      }}
                    >
                      <Wrench />
                      Bakım yapıldı
                    </Button>
                    {!navigator.onLine && <p className="text-xs text-muted-foreground">Bakım kaydı için internet gerekir (sayaç sunucuda güvenle güncellenir).</p>}
                    {maintenance.data
                      ?.filter((m) => m.payload.equipment_id === item.id)
                      .map((m) => (
                        <p className="text-xs border-b py-2" key={m.id}>
                          {m.payload.date} · {m.payload.notes} · {formatTL(Number(m.payload.cost))}
                        </p>
                      ))}
                  </div>
                )}
              </article>
            );
          })}
        </>
      )}
      <FormDrawer
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Sicili düzenle" : "Yeni ekipman"}
        busy={save.isPending}
        onSubmit={() =>
          save.mutate({ id: editing?.id, payload: form }, { onSuccess: () => setOpen(false) })
        }
      >
        <RecordFields fields={fields} value={form} onChange={setForm} />
      </FormDrawer>
    </div>
  );
}
