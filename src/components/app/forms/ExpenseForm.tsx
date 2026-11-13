import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpsert } from "@/lib/data";
import { EXPENSE_LABELS, todayISO, type ExpenseCategory } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { FormDrawer } from "./FormDrawer";

export function ExpenseForm({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [category, setCategory] = useState<ExpenseCategory>("yakit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());
  const upsert = useUpsert("expenses");

  useEffect(() => {
    if (open) {
      setAmount("");
      setDescription("");
      setDate(todayISO());
    }
  }, [open]);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Gider ekle"
      busy={upsert.isPending}
      onSubmit={() => {
        const n = Number(amount.replace(",", "."));
        if (!(n > 0)) { toast.error("Geçerli bir tutar girin"); return; }
        upsert.mutate({ category, amount: n, description: description.trim() || null, occurred_on: date }, { onSuccess: () => onOpenChange(false) });
      }}
    >
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(EXPENSE_LABELS) as ExpenseCategory[]).map((c) => (
          <button
            type="button"
            key={c}
            onClick={() => setCategory(c)}
            className={cn("rounded-xl border px-3 py-3 text-sm font-medium", category === c ? "border-primary bg-accent text-primary" : "bg-secondary")}
          >
            {EXPENSE_LABELS[c]}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <Label>Tutar (TL)</Label>
        <Input className="num h-14 text-2xl" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Açıklama</Label>
        <Input className="h-12" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Tarih</Label>
        <Input className="h-12" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
    </FormDrawer>
  );
}
