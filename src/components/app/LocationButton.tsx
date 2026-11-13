import { useState } from "react";
import { Loader2, LocateFixed, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { coordsOf, getPosition } from "@/lib/geo";
import type { Payload } from "@/lib/work";

export function LocationButton({ value, onChange }: { value: Payload; onChange: (p: Payload) => void }) {
  const [busy, setBusy] = useState(false);
  const c = coordsOf(value);
  async function capture() {
    setBusy(true);
    try {
      const pos = await getPosition();
      onChange({ ...value, lat: pos.lat, lng: pos.lng });
      toast.success("Konum kaydedildi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Konum alınamadı");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="secondary" className="h-11 flex-1" disabled={busy} onClick={() => void capture()}>
        {busy ? <Loader2 className="animate-spin" /> : <LocateFixed />}
        {c ? `Konum: ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}` : "Mevcut konumu kaydet"}
      </Button>
      {c && (
        <Button type="button" variant="ghost" size="icon" aria-label="Konumu sil" onClick={() => onChange({ ...value, lat: null, lng: null })}>
          <X />
        </Button>
      )}
    </div>
  );
}
