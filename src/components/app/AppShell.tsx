import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { LayoutDashboard, Users, Receipt, Settings, Plus, Search, Loader2, ArrowDown, HardHat, CalendarDays, Wrench, CalendarClock, Cloud, ShoppingCart, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeviceLock } from "./DeviceLock";
import { useEffect } from "react";
import { flushQueue } from "@/lib/offline";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptic";
import { useMe } from "@/hooks/use-me";
import { GlobalSearch } from "./GlobalSearch";
import { QuickAdd } from "./QuickAdd";
import { useAppointmentReminders } from "@/lib/reminders";

const NAV = [
  { to: "/panel", label: "Panel", icon: LayoutDashboard },
  { to: "/isler", label: "İşler", icon: HardHat },
  { to: "/cari", label: "Cari", icon: Users },
  { to: "/yevmiye", label: "Yevmiye", icon: CalendarDays },
  { to: "/ekipman", label: "Ekipman", icon: Wrench },
] as const;

const EXTRA_NAV = [
  { to: "/hava", label: "Hava", icon: Cloud },
  { to: "/banka", label: "Banka", icon: Landmark },
  { to: "/alim", label: "Alım", icon: ShoppingCart },
] as const;

export function AppShell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  const isUsta = me.data?.isUsta ?? false;
  useAppointmentReminders(isUsta, () => void navigate({ to: "/randevu" }));
  useEffect(() => {
    const sync = () => void flushQueue();
    const refresh = () => void qc.invalidateQueries();
    window.addEventListener("online", sync);
    window.addEventListener("saha-synced", refresh);
    if (me.data) sync();
    return () => { window.removeEventListener("online", sync); window.removeEventListener("saha-synced", refresh); };
  }, [me.data?.id, qc]);

  async function refresh() {
    setRefreshing(true);
    haptic();
    await qc.invalidateQueries();
    setRefreshing(false);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/90 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur">
        <div className="flex items-center gap-2"><Button variant="secondary"
          onClick={() => setSearchOpen(true)}
          className="flex h-11 min-w-0 flex-1 justify-start gap-3 px-3 text-sm text-muted-foreground"
        >
          <Search className="size-4" /><span className="truncate">Saha · Ara</span>
        </Button>{isUsta&&<Button asChild variant="ghost" size="icon" title="Randevular"><Link to="/randevu"><CalendarClock/></Link></Button>}{isUsta&&<Button asChild variant="ghost" size="icon" title="Hava Durumu"><Link to="/hava"><Cloud/></Link></Button>}{isUsta&&<Button asChild variant="ghost" size="icon" title="Banka"><Link to="/banka"><Landmark/></Link></Button>}{isUsta&&<Button asChild variant="ghost" size="icon" title="Giderler"><Link to="/giderler"><Receipt/></Link></Button>}<Button asChild variant="ghost" size="icon" title="Ayarlar"><Link to="/ayarlar"><Settings/></Link></Button></div>
      </header>

      <main
        className="flex-1 px-4 pb-32 pt-4"
        onTouchStart={(e) => {
          startY.current = window.scrollY <= 0 ? e.touches[0]?.clientY ?? null : null;
        }}
        onTouchMove={(e) => {
          if (startY.current === null) return;
          const touch = e.touches[0];
          if (!touch) return;
          const d = touch.clientY - startY.current;
          setPull(d > 0 ? Math.min(d / 2, 80) : 0);
        }}
        onTouchEnd={() => {
          if (pull >= 60) void refresh();
          setPull(0);
          startY.current = null;
        }}
      >
        {(pull > 0 || refreshing) && (
          <div className="flex justify-center text-muted-foreground" style={{ height: refreshing ? 40 : pull }}>
            {refreshing ? <Loader2 className="mt-2 size-5 animate-spin" /> : <ArrowDown className={cn("mt-2 size-5 transition", pull >= 60 && "rotate-180 text-primary")} />}
          </div>
        )}
        {me.isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : !isUsta && !["/ayarlar", "/isler", "/yevmiye"].includes(path) ? (
          <div className="rounded-2xl border bg-card p-6 text-center">
            <h2 className="text-lg font-semibold">Çırak hesabı</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Finansal veriler yalnızca Usta tarafından görülebilir.
            </p>
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      {isUsta && (
        <Button
          aria-label="Hızlı ekle"
          onClick={() => {
            haptic();
            setAddOpen(true);
          }}
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-[max(1.25rem,calc(50%-18rem+1.25rem))] z-40 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 active:scale-95"
        >
          <Plus className="size-6" />
        </Button>
      )}

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {NAV.filter(n => isUsta || ["/isler", "/yevmiye"].includes(n.to)).map((n) => {
            const active = path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => haptic(8)}
                className={cn("flex flex-col items-center gap-1 py-3 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}
              >
                <n.icon className="size-5" />
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {isUsta && <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} onPick={(id) => navigate({ to: "/cari/$id", params: { id } })} />}
      {isUsta && <QuickAdd open={addOpen} onOpenChange={setAddOpen} />}
      {me.data && <DeviceLock user={me.data.id} />}
    </div>
  );
}
