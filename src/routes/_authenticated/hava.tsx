import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { MapPin, RefreshCw, Droplets, Wind, Eye, Sunrise, Sunset, Thermometer, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { fetchWeather, wmo, DEFAULT_LOCATION, type WeatherData } from "@/lib/weather";
import { pageHead } from "@/lib/work";

export const Route = createFileRoute("/_authenticated/hava")({
  head: () => pageHead("Hava Durumu", "Anlık ve 7 günlük hava durumu tahmini."),
  component: HavaDurumu,
});

function HavaDurumu() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loc, setLoc] = useState(DEFAULT_LOCATION);

  const load = useCallback(async (lat: number, lon: number, name: string) => {
    setLoading(true);
    setError("");
    try {
      const d = await fetchWeather(lat, lon, name);
      setData(d);
    } catch {
      setError("Hava durumu alınamadı. İnternet bağlantısını kontrol edin.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newLoc = { name: "Mevcut Konum", lat: pos.coords.latitude, lon: pos.coords.longitude };
          setLoc(newLoc);
          void load(newLoc.lat, newLoc.lon, newLoc.name);
        },
        () => void load(loc.lat, loc.lon, loc.name),
        { timeout: 5000 }
      );
    } else {
      void load(loc.lat, loc.lon, loc.name);
    }
  }, []);

  const bgGrad = data
    ? data.current.isDay
      ? data.current.weatherCode <= 1
        ? "from-sky-400 via-blue-500 to-blue-600"
        : data.current.weatherCode <= 3
        ? "from-slate-400 via-slate-500 to-slate-600"
        : "from-slate-500 via-slate-600 to-slate-700"
      : "from-indigo-900 via-blue-950 to-slate-900"
    : "from-sky-400 via-blue-500 to-blue-600";

  if (loading) {
    return (
      <div className={`min-h-screen bg-gradient-to-b ${bgGrad} flex items-center justify-center`}>
        <div className="text-center text-white">
          <div className="text-5xl mb-4 animate-pulse">🌤️</div>
          <div className="text-sm opacity-80">Hava durumu yükleniyor...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border bg-destructive/10 p-6 text-center text-sm text-destructive">
        {error || "Veri yok"}
      </div>
    );
  }

  return (
    <div className={`-mx-4 -mt-4 min-h-screen bg-gradient-to-b ${bgGrad}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Link to="/panel" className="rounded-full p-1.5 bg-white/20 text-white">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex-1" />
        <button
          onClick={() => void load(loc.lat, loc.lon, loc.name)}
          className="rounded-full p-1.5 bg-white/20 text-white active:scale-95"
        >
          <RefreshCw className="size-4" />
        </button>
      </div>

      {/* Ana Kart - Google tarzı büyük gösterim */}
      <div className="px-4 pt-2 pb-4 text-white text-center">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <MapPin className="size-4 opacity-80" />
          <span className="text-sm font-medium opacity-90">{data.location}</span>
        </div>
        <div className="text-8xl font-thin mb-1 leading-none">{data.current.temp}°</div>
        <div className="text-xl font-medium mb-1">{data.current.desc}</div>
        <div className="text-sm opacity-80">
          En yüksek: {data.daily[0].maxTemp}° · En düşük: {data.daily[0].minTemp}°
        </div>
      </div>

      {/* Saatlik Tahmin */}
      <div className="mx-4 mb-3 rounded-2xl bg-white/15 backdrop-blur-sm p-3">
        <div className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-3 px-1">
          Saatlik Tahmin
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
          {data.hourly.slice(0, 12).map((h, i) => (
            <div key={i} className="flex flex-col items-center gap-1 min-w-[52px]">
              <span className="text-white/70 text-xs">{i === 0 ? "Şimdi" : h.time}</span>
              <span className="text-lg">{wmo(h.code).icon}</span>
              <span className="text-white font-semibold text-sm">{h.temp}°</span>
              {h.rain > 20 && (
                <span className="text-blue-200 text-[10px]">💧{h.rain}%</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 7 Günlük Tahmin */}
      <div className="mx-4 mb-3 rounded-2xl bg-white/15 backdrop-blur-sm p-3">
        <div className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-3 px-1">
          7 Günlük Tahmin
        </div>
        <div className="space-y-2.5">
          {data.daily.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-white">
              <span className="w-20 text-sm font-medium">{d.dayName}</span>
              <span className="text-lg">{wmo(d.code).icon}</span>
              <span className="text-xs opacity-70 flex-1">{d.desc}</span>
              {d.rain > 0 && <span className="text-blue-200 text-xs">💧{d.rain}mm</span>}
              <span className="text-xs opacity-60 w-6 text-right">{d.minTemp}°</span>
              <div className="w-16 h-1.5 rounded-full bg-white/20 mx-1">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-300 to-orange-300"
                  style={{ width: `${Math.min(100, Math.max(10, ((d.maxTemp - d.minTemp) / 20) * 100))}%` }}
                />
              </div>
              <span className="text-sm font-semibold w-6">{d.maxTemp}°</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detay Kartları */}
      <div className="mx-4 mb-3 grid grid-cols-2 gap-2.5">
        <DetailCard icon={<Droplets className="size-4" />} label="Nem" value={`${data.current.humidity}%`} sub="Bağıl nem" />
        <DetailCard icon={<Wind className="size-4" />} label="Rüzgar" value={`${data.current.windSpeed} km/s`} sub="Rüzgar hızı" />
        <DetailCard icon={<Thermometer className="size-4" />} label="Hissedilen" value={`${data.current.feelsLike}°C`} sub="Apparent temp" />
        <DetailCard icon={<Eye className="size-4" />} label="Görüş" value={`${data.visibility} km`} sub="Görüş mesafesi" />
        <DetailCard icon={<Sunrise className="size-4" />} label="Gün Doğumu" value={data.sunrise} sub="Sabah" />
        <DetailCard icon={<Sunset className="size-4" />} label="Gün Batımı" value={data.sunset} sub="Akşam" />
      </div>

      {/* UV Endeksi */}
      <div className="mx-4 mb-6 rounded-2xl bg-white/15 backdrop-blur-sm p-3">
        <div className="flex items-center gap-2 text-white/70 text-xs font-semibold uppercase tracking-wide mb-2">
          ☀️ UV Endeksi
        </div>
        <div className="flex items-end gap-3">
          <span className="text-white text-3xl font-bold">{data.uvIndex}</span>
          <span className="text-white/80 text-sm pb-1">
            {data.uvIndex <= 2 ? "Düşük" : data.uvIndex <= 5 ? "Orta" : data.uvIndex <= 7 ? "Yüksek" : "Çok Yüksek"}
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-gradient-to-r from-green-400 via-yellow-400 via-orange-400 to-red-500">
          <div className="h-full w-2 rounded-full bg-white shadow" style={{ marginLeft: `${Math.min(90, data.uvIndex * 9)}%` }} />
        </div>
      </div>

      <div className="pb-32" />
    </div>
  );
}

function DetailCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-white/15 backdrop-blur-sm p-3 text-white">
      <div className="flex items-center gap-1.5 text-white/70 text-xs mb-2">
        {icon}
        <span className="uppercase tracking-wide font-semibold">{label}</span>
      </div>
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-xs opacity-60 mt-0.5">{sub}</div>
    </div>
  );
}
