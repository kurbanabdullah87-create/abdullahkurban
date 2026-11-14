import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { fetchWeather, wmo, DEFAULT_LOCATION, type WeatherData } from "@/lib/weather";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useCustomers, useExpenses, useTransactions } from "@/lib/data";
import { customerBalance, EXPENSE_LABELS, formatTL, monthKey, monthSummary, overdueAmount, profitBreakdown, todayISO, type ExpenseCategory } from "@/lib/finance";
import { pageHead } from "@/lib/work";
import { MaintenanceAlerts } from "@/components/app/MaintenanceAlerts";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => pageHead("Panel", "Aylık gelir, gider ve kâr özeti."),
  component: Panel,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function shiftMonth(m: string, d: number) {
  const [y = 2026, mo = 1] = m.split("-").map(Number);
  const dt = new Date(y, mo - 1 + d, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}


function WeatherWidget() {
  const [w, setW] = useState<WeatherData | null>(null);
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => void fetchWeather(pos.coords.latitude, pos.coords.longitude, "Konumum").then(setW).catch(() => {}),
        () => void fetchWeather(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon, DEFAULT_LOCATION.name).then(setW).catch(() => {}),
        { timeout: 4000 }
      );
    } else {
      void fetchWeather(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon, DEFAULT_LOCATION.name).then(setW).catch(() => {});
    }
  }, []);
  if (!w) return null;
  return (
    <Link to="/hava" className="block rounded-2xl overflow-hidden">
      <div className={`bg-gradient-to-br ${w.current.isDay && w.current.weatherCode <= 1 ? "from-sky-400 to-blue-500" : w.current.isDay ? "from-slate-400 to-slate-500" : "from-indigo-900 to-blue-950"} p-4 text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs opacity-75 mb-1">🌍 {w.location}</div>
            <div className="text-4xl font-thin">{w.current.temp}°</div>
            <div className="text-sm mt-1">{w.current.desc}</div>
            <div className="text-xs opacity-70 mt-0.5">↑{w.daily[0].maxTemp}° ↓{w.daily[0].minTemp}°</div>
          </div>
          <div className="text-right">
            <div className="text-5xl">{w.current.icon}</div>
            <div className="text-xs opacity-70 mt-2">💧{w.current.humidity}% 💨{w.current.windSpeed}km/s</div>
          </div>
        </div>
        <div className="mt-3 flex gap-3 overflow-x-auto">
          {w.daily.slice(1, 5).map((d, i) => (
            <div key={i} className="text-center min-w-[52px]">
              <div className="text-[11px] opacity-70">{d.dayName}</div>
              <div className="text-lg">{wmo(d.code).icon}</div>
              <div className="text-xs font-medium">{d.maxTemp}°/{d.minTemp}°</div>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

function Panel() {
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [quickNote, setQuickNote] = useState(() => { try { return localStorage.getItem("panel_note") ?? ""; } catch { return ""; } });
  const saveNote = (v: string) => { setQuickNote(v); try { localStorage.setItem("panel_note", v); } catch {} };
  const txs = useTransactions();
  const exps = useExpenses();
  const customers = useCustomers();

  const data = useMemo(() => {
    const t = txs.data ?? [];
    const e = exps.data ?? [];
    const s = monthSummary(t, e, month);
    const monthDebts = t.filter((x) => x.kind === "debt" && monthKey(x.occurred_on) === month);
    const profit = monthDebts.reduce((acc, x) => acc + profitBreakdown(x.amount, x.material_cost, x.vat_rate).profit, 0);
    const byCat = (Object.keys(EXPENSE_LABELS) as ExpenseCategory[])
      .map((c) => ({ name: EXPENSE_LABELS[c], value: e.filter((x) => x.category === c && monthKey(x.occurred_on) === month).reduce((a, x) => a + x.amount, 0) }))
      .filter((x) => x.value > 0);
    const bars = [-5, -4, -3, -2, -1, 0].map((d) => {
      const m = shiftMonth(month, d);
      const ms = monthSummary(t, e, m);
      return { name: new Date(m + "-01T00:00:00").toLocaleDateString("tr-TR", { month: "short" }), Gelir: ms.income, Gider: ms.expense };
    });
    const overdue = (customers.data ?? [])
      .map((c) => {
        const ct = t.filter((x) => x.customer_id === c.id);
        return { c, overdue: overdueAmount(ct), balance: customerBalance(ct) };
      })
      .filter((x) => x.overdue > 0)
      .sort((a, b) => b.overdue - a.overdue);
    return { s, profit, byCat, bars, overdue };
  }, [txs.data, exps.data, customers.data, month]);

  const label = new Date(month + "-01T00:00:00").toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      {/* Hızlı Not */}
      <div className="rounded-2xl border bg-amber-50 dark:bg-amber-950/20 p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm">📝</span>
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Hızlı Not</span>
        </div>
        <textarea
          value={quickNote}
          onChange={e => saveNote(e.target.value)}
          placeholder="Bugün için notunuzu buraya yazın..."
          className="w-full bg-transparent text-sm resize-none outline-none text-foreground placeholder:text-muted-foreground min-h-[60px]"
          rows={3}
        />
      </div>

      <MaintenanceAlerts />
      <WeatherWidget />
      <div className="flex items-center justify-between">
        <button onClick={() => setMonth(shiftMonth(month, -1))} className="rounded-full p-2 hover:bg-secondary" aria-label="Önceki ay">
          <ChevronLeft />
        </button>
        <h1 className="text-xl font-bold capitalize">{label}</h1>
        <button onClick={() => setMonth(shiftMonth(month, 1))} className="rounded-full p-2 hover:bg-secondary" aria-label="Sonraki ay">
          <ChevronRight />
        </button>
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <div className="text-sm text-muted-foreground">Net (tahsilat − gider)</div>
        <div className={`num mt-1 text-4xl font-bold ${data.s.net < 0 ? "text-destructive" : "text-foreground"}`}>{formatTL(data.s.net)}</div>
        <div className="mt-2 text-xs text-muted-foreground">
          Bu ay yapılan işlerin KDV ve malzeme sonrası kârı: <span className="num text-success">{formatTL(data.profit)}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Gelir" value={data.s.income} tone="text-success" />
        <Stat label="Gider" value={data.s.expense} tone="text-destructive" />
        <Stat label="Alacak" value={data.s.receivable} tone="text-warning" />
      </div>

      {data.overdue.length > 0 && (
        <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="size-4" /> 30 günü geçen alacaklar
          </div>
          {data.overdue.map(({ c, overdue }) => (
            <Link key={c.id} to="/cari/$id" params={{ id: c.id }} className="flex justify-between py-1.5 text-sm">
              <span>{c.name}</span>
              <span className="num font-semibold text-destructive">{formatTL(overdue)}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="rounded-2xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Son 6 ay</h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.bars}>
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: "var(--secondary)" }}
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }}
                formatter={(v: number) => formatTL(v)}
              />
              <Bar dataKey="Gelir" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Gider" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Gider dağılımı</h2>
        {data.byCat.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Bu ay gider yok</p>
        ) : (
          <div className="flex items-center gap-4">
            <div className="size-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.byCat} dataKey="value" innerRadius={38} outerRadius={64} paddingAngle={2} stroke="none">
                    {data.byCat.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} formatter={(v: number) => formatTL(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 space-y-1.5 text-sm">
              {data.byCat.map((c, i) => (
                <li key={c.name} className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  {c.name}
                  <span className="num ml-auto">{formatTL(c.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`num mt-1 truncate text-sm font-semibold ${tone}`}>{formatTL(value)}</div>
    </div>
  );
}
