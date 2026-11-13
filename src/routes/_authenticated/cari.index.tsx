import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronRight, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SwipeRow } from "@/components/app/SwipeRow";
import { CustomerForm } from "@/components/app/forms/CustomerForm";
import { useCustomers, useTransactions, useUndoableDelete } from "@/lib/data";
import { customerBalance, formatTL, overdueAmount } from "@/lib/finance";
import { pageHead } from "@/lib/work";

export const Route = createFileRoute("/_authenticated/cari/")({
  head: () => pageHead("Cari Hesaplar", "Müşteri bakiyeleri ve hesap ekstreleri."),
  component: CariList,
});

function CariList() {
  const customers = useCustomers();
  const txs = useTransactions();
  const del = useUndoableDelete("customers");
  const [open, setOpen] = useState(false);

  const rows = useMemo(
    () =>
      (customers.data ?? []).map((c) => {
        const ct = (txs.data ?? []).filter((t) => t.customer_id === c.id);
        return { c, balance: customerBalance(ct), overdue: overdueAmount(ct) };
      }),
    [customers.data, txs.data],
  );
  const total = rows.reduce((s, r) => s + Math.max(0, r.balance), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cari hesaplar</h1>
          <p className="text-sm text-muted-foreground">
            Toplam alacak <span className="num text-warning">{formatTL(total)}</span>
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <UserPlus /> Müşteri
        </Button>
      </div>
      {customers.isLoading ? null : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Henüz müşteri yok. Sağ alttaki + ile ekleyin.</div>
      ) : (
        <div className="space-y-2">
          {rows.map(({ c, balance, overdue }) => (
            <SwipeRow key={c.id} onDelete={() => del(c.id, `${c.name} silindi`)}>
              <Link to="/cari/$id" params={{ id: c.id }} className="flex items-center gap-3 p-4">
                <div className="flex size-10 items-center justify-center rounded-full bg-secondary font-semibold">{c.name.charAt(0).toLocaleUpperCase("tr-TR")}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{c.phone || c.address || "—"}</div>
                </div>
                <div className="text-right">
                  <div className={`num font-semibold ${balance > 0 ? "text-warning" : balance < 0 ? "text-success" : "text-muted-foreground"}`}>{formatTL(balance)}</div>
                  {overdue > 0 && <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">30+ gün</span>}
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            </SwipeRow>
          ))}
          <p className="pt-1 text-center text-xs text-muted-foreground">Silmek için sola kaydırın</p>
        </div>
      )}
      <CustomerForm open={open} onOpenChange={setOpen} />
    </div>
  );
}
