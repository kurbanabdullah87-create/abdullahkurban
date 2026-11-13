import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { coordsOf, googleRoute, yandexRoute } from "@/lib/geo";
import type { Payload } from "@/lib/work";

/** Kayıtlı koordinat varsa rota, yoksa adres araması açar. */
export function RouteButtons({ p }: { p: Payload }) {
  const c = coordsOf(p);
  const address = String(p.address ?? "").trim();
  if (!c && !address) return null;
  const google = c ? googleRoute(c) : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  const yandex = c ? yandexRoute(c) : `https://yandex.com/maps/?text=${encodeURIComponent(address)}`;
  const Icon = c ? Navigation : MapPin;
  return (
    <div className="flex gap-2">
      <Button asChild size="sm" variant="outline"><a href={google} target="_blank" rel="noreferrer"><Icon />{c ? "Rota · Google" : "Google"}</a></Button>
      <Button asChild size="sm" variant="outline"><a href={yandex} target="_blank" rel="noreferrer"><Icon />{c ? "Rota · Yandex" : "Yandex"}</a></Button>
    </div>
  );
}
