import type { Payload } from "@/lib/work";

export interface Coords { lat: number; lng: number }

export function getPosition(timeoutMs = 10_000): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Konum desteklenmiyor"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }),
      (e) => reject(new Error(e.code === 1 ? "Konum izni verilmedi" : "Konum alınamadı")),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}

export function coordsOf(p: Payload): Coords | null {
  if (p.lat == null || p.lng == null || p.lat === "" || p.lng === "") return null;
  const lat = Number(p.lat), lng = Number(p.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export const googleRoute = (c: Coords) => `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}&travelmode=driving`;
export const yandexRoute = (c: Coords) => `https://yandex.com.tr/maps/?rtext=~${c.lat},${c.lng}&rtt=auto`;
