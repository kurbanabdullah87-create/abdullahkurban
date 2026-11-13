import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUpsert, type Customer } from "@/lib/data";
import { cn } from "@/lib/utils";
import { FormDrawer } from "./FormDrawer";

export function CustomerForm({ open, onOpenChange, customer }: { open: boolean; onOpenChange: (o: boolean) => void; customer?: Customer }) {
  const [f, setF] = useState({ name: "", phone: "", address: "", notes: "", rating: 0 });
  const upsert = useUpsert("customers");

  useEffect(() => {
    if (open)
      setF({
        name: customer?.name ?? "",
        phone: customer?.phone ?? "",
        address: customer?.address ?? "",
        notes: customer?.notes ?? "",
        rating: customer?.rating ?? 0,
      });
  }, [open, customer]);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={customer ? "Müşteriyi düzenle" : "Yeni müşteri"}
      busy={upsert.isPending}
      onSubmit={() => {
        if (!f.name.trim()) { toast.error("Müşteri adı gerekli"); return; }
        upsert.mutate(
          {
            id: customer?.id,
            name: f.name.trim(),
            phone: f.phone.trim() || null,
            address: f.address.trim() || null,
            notes: f.notes.trim() || null,
            rating: f.rating || null,
          },
          { onSuccess: () => onOpenChange(false) },
        );
      }}
    >
      <div className="space-y-2">
        <Label>Ad Soyad / Firma</Label>
        <Input className="h-12" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Telefon</Label>
        <Input className="h-12" type="tel" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Adres</Label>
        <Textarea value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Gizli puan (sadece sen görürsün)</Label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} onClick={() => setF({ ...f, rating: f.rating === n ? 0 : n })} aria-label={`${n} yıldız`}>
              <Star className={cn("size-8", n <= f.rating ? "fill-warning text-warning" : "text-muted-foreground")} />
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Not</Label>
        <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </div>
    </FormDrawer>
  );
}
