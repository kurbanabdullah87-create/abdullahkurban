import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Expense, Tx } from "@/lib/finance";
import { DEFAULT_TEMPLATES } from "@/lib/templates";
import { haptic } from "@/lib/haptic";
import { cachedRead, persistWrite } from "@/lib/offline";

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  rating: number | null;
  notes: string | null;
  created_at: string;
}

export interface Template {
  id: string;
  title: string;
  body: string;
}

function check<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export const useCustomers = () =>
  useQuery({
    queryKey: ["customers"],
    networkMode: "always",
    queryFn: () => cachedRead("customers", async () => check(await supabase.from("customers").select("*").order("name")) as Customer[]),
  });

export const useTransactions = () =>
  useQuery({
    queryKey: ["transactions"],
    networkMode: "always",
    queryFn: () => cachedRead("transactions", async () => {
      const rows = check(
        await supabase.from("transactions").select("*").order("occurred_on", { ascending: false }).order("created_at", { ascending: false }),
      );
      return rows.map((r) => ({ ...r, amount: Number(r.amount), material_cost: Number(r.material_cost) })) as Tx[];
    }),
  });

export const useExpenses = () =>
  useQuery({
    queryKey: ["expenses"],
    networkMode: "always",
    queryFn: () => cachedRead("expenses", async () => {
      const rows = check(await supabase.from("expenses").select("*").order("occurred_on", { ascending: false }));
      return rows.map((r) => ({ ...r, amount: Number(r.amount) })) as Expense[];
    }),
  });

export const useTemplates = () =>
  useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      let rows = check(await supabase.from("message_templates").select("id,title,body").order("created_at"));
      if (rows.length === 0) {
        rows = check(await supabase.from("message_templates").insert(DEFAULT_TEMPLATES).select("id,title,body"));
      }
      return rows as Template[];
    },
  });

type Table = "customers" | "transactions" | "expenses" | "message_templates";
const KEY: Record<Table, string> = {
  customers: "customers",
  transactions: "transactions",
  expenses: "expenses",
  message_templates: "templates",
};

export function useUpsert(table: Table) {
  const qc = useQueryClient();
  return useMutation({
    networkMode: "always",
    mutationFn: async (row: Record<string, unknown>) => {
      const { id, ...rest } = row;
      await persistWrite(table, id ? "update" : "insert", { ...rest, id: id ?? crypto.randomUUID() });
    },
    onSuccess: () => {
      haptic();
      qc.invalidateQueries({ queryKey: [KEY[table]] });
      if (table === "customers") qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Kaydedildi");
    },
    onError: (e: Error) => toast.error("Kaydedilemedi: " + e.message),
  });
}

type DeleteTarget = Table | "equipment" | "shopping";
/** Removes from view immediately, commits delete after 5s unless "Geri Al" is pressed. */
export function useUndoableDelete(target: DeleteTarget) {
  const qc = useQueryClient();
  // Ekipman ve alınacaklar work_records tablosunda "kind" olarak saklanır.
  const isWork = target === "equipment" || target === "shopping";
  const table = isWork ? "work_records" : target;
  return (id: string, label = "Kayıt silindi") => {
    haptic([10, 30, 10]);
    const key = isWork ? ["work", target] : [KEY[target]];
    const prev = qc.getQueryData<{ id: string }[]>(key);
    qc.setQueryData<{ id: string }[]>(key, (old) => old?.filter((r) => r.id !== id));
    let undone = false;
    const timer = setTimeout(async () => {
      if (undone) return;
      let error: { message: string } | null = null;
      try { await persistWrite(table, "delete", isWork ? { id, kind: target } : { id }); } catch (e) { error = { message: e instanceof Error ? e.message : "Silinemedi" }; }
      if (error) {
        toast.error("Silinemedi: " + error.message);
        if (prev) qc.setQueryData(key, prev);
      }
      qc.invalidateQueries({ queryKey: key });
      if (target === "customers") qc.invalidateQueries({ queryKey: ["transactions"] });
    }, 5000);
    toast(label, {
      duration: 5000,
      action: {
        label: "Geri Al",
        onClick: () => {
          undone = true;
          clearTimeout(timer);
          if (prev) qc.setQueryData(key, prev);
          haptic();
        },
      },
    });
  };
}
