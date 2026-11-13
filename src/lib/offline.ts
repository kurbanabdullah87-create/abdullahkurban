import { get, set } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Pending = {
  id: string;
  user: string;
  table: string;
  action: "insert" | "update" | "delete";
  row: Record<string, unknown>;
};
let flushing = false;
let queueChain: Promise<unknown> = Promise.resolve();
async function userId() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Oturum gerekli");
  return data.session.user.id;
}
export async function cachedRead<T>(key: string, read: () => Promise<T>): Promise<T> {
  const uid = await userId();
  const cache = "cache:" + uid + ":" + key;
  try {
    if (!navigator.onLine) throw new Error("offline");
    const data = await read();
    await set(cache, data);
    return data;
  } catch (e) {
    if (navigator.onLine) throw e;
    const saved = await get<T>(cache);
    if (saved !== undefined) return saved;
    return [] as unknown as T;
  }
}
async function execute(p: Pending) {
  const db = supabase.from(p.table as "work_records");
  const r =
    p.action === "delete"
      ? await db.delete().eq("id", String(p.row["id"]))
      : p.action === "update"
        ? await db
            .update(p.row as never)
            .eq("id", String(p.row["id"]))
            .select("id")
        : await db.upsert(p.row as never, { onConflict: "id" }).select("id");
  if (r.error) throw new Error(r.error.message);
  if (p.action !== "delete" && !r.data?.length)
    throw new Error("Kayıt güncellenemedi; erişiminizi kontrol edin.");
}
export async function persistWrite(
  table: string,
  action: Pending["action"],
  row: Record<string, unknown>,
) {
  const user = await userId();
  const item: Pending = {
    id: crypto.randomUUID(),
    user,
    table,
    action,
    row: { ...row, id: row["id"] ?? crypto.randomUUID() },
  };
  if (navigator.onLine) {
    try {
      await execute(item);
      return;
    } catch (e) {
      if (navigator.onLine) throw e;
    }
  }
  const result = queueChain.then(async () => {
    const all = (await get<Pending[]>("saha-queue")) ?? [];
    await set("saha-queue", [...all, item]);
    // Update cached rows so queued records remain visible offline.
    const key = table === "work_records" ? "work:" + String(row["kind"]) : table;
    const cache = "cache:" + user + ":" + key;
    const rows = (await get<Record<string, unknown>[]>(cache)) ?? [];
    const existing = rows.find((r) => r["id"] === item.row["id"]);
    const next =
      action === "delete"
        ? rows.filter((r) => r["id"] !== item.row["id"])
        : [
            {
              ...existing,
              ...item.row,
              created_at: existing?.["created_at"] ?? new Date().toISOString(),
            },
            ...rows.filter((r) => r["id"] !== item.row["id"]),
          ];
    await set(cache, next);
    window.dispatchEvent(new Event("saha-queue"));
    toast("Çevrimdışı kaydedildi; bağlantı gelince gönderilecek.");
  });
  queueChain = result.catch(() => {});
  await result;
}
export async function flushQueue() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    const user = await userId();
    await queueChain;
    const pending = (await get<Pending[]>("saha-queue")) ?? [];
    for (const item of pending.filter((p) => p.user === user)) {
      await execute(item);
      const change = queueChain.then(async () => {
        const current = (await get<Pending[]>("saha-queue")) ?? [];
        await set(
          "saha-queue",
          current.filter((p) => p.id !== item.id),
        );
      });
      queueChain = change.catch(() => {});
      await change;
    }
    window.dispatchEvent(new Event("saha-synced"));
  } catch (e) {
    toast.error("Bekleyen kayıtlar gönderilemedi; kayıtlar cihazda korunuyor.");
  } finally {
    flushing = false;
  }
}
export async function pendingCount() {
  const user = await userId();
  return ((await get<Pending[]>("saha-queue")) ?? []).filter((p) => p.user === user).length;
}
