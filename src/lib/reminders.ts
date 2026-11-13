
function decodeVapidPublicKey(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function bufferToBase64Url(value: ArrayBuffer | null): string {
  if (!value) throw new Error("Tarayıcı bildirim anahtarını oluşturamadı.");
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/g, "");
}

/** Kullanıcının cihazını Supabase Web Push servisine kaydeder. */
export async function enableAppointmentPush(): Promise<void> {
  if (!notifySupported()) throw new Error("Bu tarayıcı bildirimleri desteklemiyor.");
  if (!("serviceWorker" in navigator)) throw new Error("Bu tarayıcı arka plan bildirimlerini desteklemiyor.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Bildirim izni verilmedi.");

  const registration = await navigator.serviceWorker.ready;
  if (!registration.pushManager) {
    throw new Error("Bu cihazda Push bildirimi desteklenmiyor. iPhone'da uygulamayı Ana Ekran'a ekleyip oradan açın.");
  }

  const { data: keyData, error: keyError } = await supabase.functions.invoke("send-appointment-reminders", {
    body: { action: "public-key" },
  });
  if (keyError) throw keyError;
  const publicKey = typeof keyData?.publicKey === "string" ? keyData.publicKey : "";
  if (!publicKey) throw new Error("Sunucu bildirim anahtarını döndürmedi.");

  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeVapidPublicKey(publicKey),
    }));

  const p256dh = bufferToBase64Url(subscription.getKey("p256dh"));
  const auth = bufferToBase64Url(subscription.getKey("auth"));
  const { error: saveError } = await supabase.functions.invoke("send-appointment-reminders", {
    body: {
      action: "subscribe",
      endpoint: subscription.endpoint,
      p256dh,
      auth,
    },
  });
  if (saveError) throw saveError;
}

import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRecords, type Payload } from "@/lib/work";

export const REMIND_OPTIONS = [
  { value: "0", label: "Tam zamanında" },
  { value: "10", label: "10 dk önce" },
  { value: "30", label: "30 dk önce" },
  { value: "60", label: "1 saat önce" },
  { value: "1440", label: "1 gün önce" },
];

export const apptStart = (p: Payload) => Date.parse(`${p.date}T${p.time || "09:00"}:00`);

export const notifySupported = () => typeof window !== "undefined" && "Notification" in window;

export async function askNotifyPermission() {
  if (!notifySupported()) return "denied" as const;
  return Notification.requestPermission();
}

/** Telefonu titret: uzun-kısa-uzun deseni */
function vibrate(pattern: number[] = [300, 100, 300, 100, 500]) {
  try {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  } catch { /* desteklenmiyor */ }
}

async function show(title: string, body: string, tag: string, urgent = false) {
  if (!notifySupported() || Notification.permission !== "granted") return;
  const opts: NotificationOptions = {
    body,
    tag,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: "/randevu" },
    vibrate: urgent ? [400, 100, 400, 100, 600] : [200, 100, 200],
    requireInteraction: urgent, // acil bildirimlerde ekranda kalır
    silent: false,
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, opts);
      vibrate(opts.vibrate as number[]);
      return;
    }
    vibrate(opts.vibrate as number[]);
    const n = new Notification(title, opts);
    n.onclick = () => { window.focus(); location.assign("/randevu"); };
  } catch { /* bildirim gösterilemedi */ }
}

const seen = (k: string) => { try { return localStorage.getItem(k) === "1"; } catch { return false; } };
const mark = (k: string) => { try { localStorage.setItem(k, "1"); } catch { /* yok say */ } };

/** Uygulama açıkken (veya arka plandayken) 30 sn'de bir randevuları kontrol eder. */
export function useAppointmentReminders(enabled: boolean, onOpen: () => void) {
  const recs = useRecords("appointment");
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const now = Date.now();
      for (const r of recs.data ?? []) {
        if (r.payload.status !== "Bekliyor" || r.payload.archived) continue;
        const start = apptStart(r.payload);
        if (!Number.isFinite(start) || now > start + 2 * 3600_000) continue;
        const lead = Number(r.payload.remind ?? 30) * 60_000;
        const name = String(r.payload.name);
        const at = String(r.payload.time ?? "");
        const stages: [string, boolean, string, string, boolean][] = [
          [`pre:${lead}`, lead > 0 && now >= start - lead && now < start, "⏰ Randevu Yaklaşıyor", `${name} · saat ${at}`, false],
          ["now", now >= start, "🔔 Randevu Zamanı Geldi!", `${name} · işi başlatabilirsiniz`, true],
        ];
        for (const [stage, due, title, body, urgent] of stages) {
          const key = `ap:${r.id}:${r.payload.date}${r.payload.time}:${stage}`;
          if (!due || seen(key)) continue;
          mark(key);
          void show(title, body, key, urgent);
          vibrate(urgent ? [300, 100, 300, 100, 500] : [200, 100, 200]);
          toast(title, {
            description: `${name} · ${at}`,
            duration: urgent ? 20000 : 15000,
            action: { label: "Aç", onClick: onOpen },
          });
        }
      }
    };
    tick();
    const t = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", tick); };
  }, [enabled, recs.data, onOpen]);
}
