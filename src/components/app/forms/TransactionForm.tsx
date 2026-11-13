import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCustomers, useUpsert } from "@/lib/data";
import { formatTL, profitBreakdown, todayISO, type TxKind } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { FormDrawer } from "./FormDrawer";

export function TransactionForm({
  open,
  onOpenChange,
  customerId,
  defaultKind = "debt",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  customerId?: string;
  defaultKind?: TxKind;
}) {
  const customers = useCustomers();
  const upsert = useUpsert("transactions");
  const [kind, setKind] = useState<TxKind>(defaultKind);
  const [cid, setCid] = useState(customerId ?? "");
  const [amount, setAmount] = useState("");
  const [material, setMaterial] = useState("");
  const [vat, setVat] = useState(0);
  const [method, setMethod] = useState("Nakit");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());

  useEffect(() => {
    if (open) {
      setKind(defaultKind);
      setCid(customerId ?? "");
      setAmount("");
      setMaterial("");
      setVat(0);
      setMethod("Nakit");
      setDescription("");
      setDate(todayISO());
    }
  }, [open, customerId, defaultKind]);

  const n = Number(amount.replace(",", ".")) || 0;
  const m = Number(material.replace(",", ".")) || 0;
  const pb = profitBreakdown(n, m, vat);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={kind === "debt" ? "Borç / İş ücreti ekle" : "Tahsilat ekle"}
      busy={upsert.isPending}
      onSubmit={() => {
        if (!cid) { toast.error("Müşteri seçin"); return; }
        if (!(n > 0)) { toast.error("Geçerli bir tutar girin"); return; }
        if (m < 0) { toast.error("Malzeme tutarı negatif olamaz"); return; }
        upsert.mutate(
          {
            customer_id: cid,
            kind,
            amount: n,
            material_cost: kind === "debt" ? m : 0,
            vat_rate: kind === "debt" ? vat : 0,
            method: kind === "payment" ? method : null,
            description: description.trim() || null,
            occurred_on: date,
          },
          { onSuccess: () => onOpenChange(false) },
        );
      }}
    >
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-secondary p-1">
        {(["debt", "payment"] as const).map((k) => (
          <button
            type="button"
            key={k}
            onClick={() => setKind(k)}
            className={cn("rounded-lg py-2.5 text-sm font-semibold", kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
          >
            {k === "debt" ? "Borç" : "Tahsilat"}
          </button>
        ))}
      </div>
      {!customerId && (
        <div className="space-y-2">
          <Label>Müşteri</Label>
          <Select value={cid} onValueChange={setCid}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder={customers.data?.length ? "Seçin" : "Önce müşteri ekleyin"} />
            </SelectTrigger>
            <SelectContent>
              {customers.data?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label>{kind === "debt" ? "Toplam iş ücreti (KDV dahil)" : "Alınan tutar"}</Label>
        <Input className="num h-14 text-2xl" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      {kind === "debt" ? (
        <>
          <div className="space-y-2">
            <Label>Malzeme maliyeti</Label>
            <Input className="num h-12" inputMode="decimal" value={material} onChange={(e) => setMaterial(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>KDV</Label>
            <div className="grid grid-cols-3 gap-2">
              {[0, 10, 20].map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => setVat(v)}
                  className={cn("rounded-xl border py-2.5 text-sm font-medium", vat === v ? "border-primary bg-accent text-primary" : "bg-secondary")}
                >
                  {v === 0 ? "Yok" : `%${v}`}
                </button>
              ))}
            </div>
          </div>
          {n > 0 && (
            <div className="num grid grid-cols-3 gap-2 rounded-xl border p-3 text-center text-xs">
              <div>
                <div className="text-muted-foreground">KDV</div>
                {formatTL(pb.vat)}
              </div>
              <div>
                <div className="text-muted-foreground">Malzeme</div>
                {formatTL(pb.material)}
              </div>
              <div>
                <div className="text-muted-foreground">Net kâr</div>
                <span className={pb.profit < 0 ? "text-destructive" : "text-success"}>{formatTL(pb.profit)}</span>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2">
          <Label>Ödeme şekli</Label>
          <div className="grid grid-cols-3 gap-2">
            {["Nakit", "Havale", "Kart"].map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => setMethod(v)}
                className={cn("rounded-xl border py-2.5 text-sm font-medium", method === v ? "border-primary bg-accent text-primary" : "bg-secondary")}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2">
        <Label>{kind === "debt" ? "Yapılan iş" : "Açıklama"}</Label>
        <Input className="h-12" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Tarih</Label>
        <Input className="h-12" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
    </FormDrawer>
  );
}
