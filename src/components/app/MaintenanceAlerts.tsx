import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";
import { maintenanceStatus, useRecords } from "@/lib/work";

/** Çalışma saatine göre yaklaşan / geçen bakımları uyarı kartı olarak gösterir. */
export function MaintenanceAlerts() {
  const equipment = useRecords("equipment");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const alerts = (equipment.data ?? [])
    .map((e) => {
      const m = maintenanceStatus(e.payload, now);
      return { e, interval: m.interval, used: m.used, ratio: m.ratio, level: m.level };
    })
    .filter((a) => a.level === "warn" || a.level === "over")
    .sort((a, b) => b.ratio - a.ratio);
  if (!alerts.length) return null;
  return (
    <section className="space-y-2">
      {alerts.map(({ e, interval, used, ratio }) => {
        const overdue = ratio >= 1;
        return (
          <Link key={e.id} to="/ekipman" className={"flex items-center gap-3 rounded-2xl border p-4 " + (overdue ? "border-destructive/50 bg-destructive/10" : "border-warning/50 bg-warning/10")}>
            <Wrench className={overdue ? "text-destructive" : "text-warning"} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{String(e.payload.name)}</p>
              <p className="text-xs text-muted-foreground">
                {overdue ? `Bakım ${(used - interval).toFixed(1)} saat gecikti` : `Bakıma ${(interval - used).toFixed(1)} saat kaldı`} · {used.toFixed(1)}/{interval} saat
              </p>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
