import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExpenseForm } from "@/components/app/forms/ExpenseForm";
import { SwipeRow } from "@/components/app/SwipeRow";
import { useExpenses, useUndoableDelete } from "@/lib/data";
import { EXPENSE_LABELS, formatDate, formatTL, todayISO } from "@/lib/finance";
import { pageHead } from "@/lib/work";

export const Route = createFileRoute("/_authenticated/giderler")({
  head: () => pageHead("Giderler", "Yakıt, yemek, hırdavat ve vergi giderleri."),
  component: Expenses,
});

function Expenses() {
  const exps = useExpenses();
  const del = useUndoableDelete("expenses");
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(todayISO().slice(0, 7));

  const rows = (exps.data ?? []).filter((e) => e.occurred_on.startsWith(month));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Giderler</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus />
          Gider
        </Button>
      </div>
      <input
        aria-label="Gider ayı"
        type="month"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        className="rounded-md border bg-secondary p-2"
      />
      <p className="num text-2xl text-destructive">
        {formatTL(rows.reduce((s, e) => s + e.amount, 0))}
      </p>
      {exps.error && <p className="text-destructive">Giderler yüklenemedi.</p>}
      {rows.map((e) => (
        <SwipeRow key={e.id} onDelete={() => del(e.id)}>
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{EXPENSE_LABELS[e.category]}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(e.occurred_on)} · {e.description}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="num text-destructive">{formatTL(e.amount)}</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 h-8 px-2"
                onClick={() => del(e.id)}
              >
                Sil
              </Button>
            </div>
          </div>
        </SwipeRow>
      ))}
      {!rows.length && !exps.isLoading && (
        <p className="py-8 text-center text-muted-foreground">Bu ay gider yok.</p>
      )}
      <ExpenseForm open={open} onOpenChange={setOpen} />
    </div>
  );
}
