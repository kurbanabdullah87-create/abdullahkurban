export type TxKind = "debt" | "payment";

export interface Tx {
  id: string;
  customer_id: string;
  kind: TxKind;
  amount: number;
  material_cost: number;
  vat_rate: number;
  occurred_on: string; // YYYY-MM-DD
  description?: string | null;
  method?: string | null;
}

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  occurred_on: string;
  description?: string | null;
}

export type ExpenseCategory = "yakit" | "yemek" | "hirdavat" | "vergi" | "diger";

export const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  yakit: "Yakıt",
  yemek: "Yemek",
  hirdavat: "Hırdavat",
  vergi: "Vergi",
  diger: "Diğer",
};

export const OVERDUE_DAYS = 30;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Remaining balance = total debts - total payments. */
export function customerBalance(txs: Pick<Tx, "kind" | "amount">[]): number {
  return round2(
    txs.reduce((s, t) => s + (t.kind === "debt" ? Number(t.amount) : -Number(t.amount)), 0),
  );
}

/**
 * Splits a VAT-inclusive job price into VAT, material and net profit.
 * total is gross (KDV dahil). vatRate in percent (0, 10, 20).
 */
export function profitBreakdown(total: number, materialCost: number, vatRate: number) {
  const net = total / (1 + vatRate / 100);
  const vat = round2(total - net);
  const profit = round2(net - materialCost);
  return { vat, netOfVat: round2(net), material: round2(materialCost), profit };
}

function daysBetween(a: string, b: Date) {
  const d = new Date(a + "T00:00:00");
  return Math.floor((b.getTime() - d.getTime()) / 86_400_000);
}

/**
 * FIFO: payments settle oldest debts first. Returns unpaid portion of debts
 * older than OVERDUE_DAYS.
 */
export function overdueAmount(txs: Tx[], today: Date = new Date()): number {
  const sorted = [...txs].sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
  let paid = sorted.filter((t) => t.kind === "payment").reduce((s, t) => s + Number(t.amount), 0);
  let overdue = 0;
  for (const t of sorted) {
    if (t.kind !== "debt") continue;
    const covered = Math.min(paid, Number(t.amount));
    paid -= covered;
    const open = Number(t.amount) - covered;
    if (open > 0 && daysBetween(t.occurred_on, today) > OVERDUE_DAYS) overdue += open;
  }
  return round2(overdue);
}

export function monthKey(date: string) {
  return date.slice(0, 7);
}

export function monthSummary(txs: Tx[], expenses: Expense[], month: string) {
  const income = txs
    .filter((t) => t.kind === "payment" && monthKey(t.occurred_on) === month)
    .reduce((s, t) => s + Number(t.amount), 0);
  const expense = expenses
    .filter((e) => monthKey(e.occurred_on) === month)
    .reduce((s, e) => s + Number(e.amount), 0);
  const receivable = Math.max(0, customerBalance(txs));
  return {
    income: round2(income),
    expense: round2(expense),
    receivable: round2(receivable),
    net: round2(income - expense),
  };
}

export function formatTL(n: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("tr-TR");
}

export function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
