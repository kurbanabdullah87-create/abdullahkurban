import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { MapPin, RefreshCw, Droplets, Wind, Eye, Sunrise, Sunset, Thermometer, ArrowLeft, Search, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { fetchWeather, wmo, DEFAULT_LOCATION, type WeatherData } from "@/lib/weather";
import { pageHead } from "@/lib/work";

export const Route = createFileRoute("/_authenticated/hava")({
  head: () => pageHead("Hava Durumu", "Anlık ve 7 günlük hava durumu tahmini."),
  component: HavaDurumu,
});

// Open-Meteo geocoding API - ücretsiz, Türkiye il/ilçe arama
async function searchLocation(query: string): Promise<{ name: string; lat: number; lon: number; region: string }[]> {
  if (!query.trim()) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=tr&country_code=TR`;
  try {
    const r = await fetch(url);
    const d = await r.json();
    return (d.results ?? []).map((x: { name: string; latitude: number; longitude: number; admin1?: string; admin2?: string }) => ({
      name: [x.name, x.admin2, x.admin1].filter(Boolean).join(", "),
      lat: x.latitude,
      lon: x.longitude,
      region: x.admin1 ?? "",
    }));
  } catch {
    return [];
  }
}

const LOC_KEY = "saha_weather_loc";

function HavaDurumu() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loc, setLoc] = useState(DEFAULT_LOCATION);
  // Arama
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<{ name: string; lat: number; lon: number; region: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Kayıtlı konumu yükle (hafıza)
  useEffect(() => {
    const saved = localStorage.getItem(LOC_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.lat && parsed.lon && parsed.name) {
          setLoc(parsed);
          void load(parsed.lat, parsed.lon, parsed.name);
          return;
        }
      } catch { /* ignore */ }
    }
    // Kayıtlı yoksa konuma bak
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

  // Arama debounce
  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults([]); return; }
    if (searchRef.current) clearTimeout(searchRef.current);
    setSearchLoading(true);
    searchRef.current = setTimeout(async () => {
      const results = await searchLocation(searchQ);
      setSearchResults(results);
      setSearchLoading(false);
    }, 400);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [searchQ]);

  function selectLocation(r: { name: string; lat: number; lon: number }) {
    const newLoc = { name: r.name, lat: r.lat, lon: r.lon };
    setLoc(newLoc);
    localStorage.setItem(LOC_KEY, JSON.stringify(newLoc));
    setSearchQ("");
    setSearchResults([]);
    setShowSearch(false);
    void load(r.lat, r.lon, r.name);
  }

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
        {/* Arama Kutusu */}
        <div className="flex-1 relative">
          {showSearch ? (
            <div className="flex items-center gap-2 rounded-full bg-white/25 backdrop-blur-sm px-3 py-1.5">
              <Search className="size-4 text-white/70 shrink-0" />
              <input
                autoFocus
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="İl veya ilçe ara..."
                className="flex-1 bg-transparent text-white placeholder:text-white/60 text-sm outline-none"
              />
              <button onClick={() => { setShowSearch(false); setSearchQ(""); setSearchResults([]); }} className="text-white/70">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              className="w-full flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-white/80 text-sm"
            >
              <Search className="size-4" />
              <span className="truncate">{loc.name}</span>
            </button>
          )}
          {/* Arama sonuçları */}
          {showSearch && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-2xl bg-white/95 backdrop-blur-sm shadow-xl overflow-hidden z-50">
              {searchLoading && (
                <div className="px-4 py-2 text-xs text-gray-500">Aranıyor...</div>
              )}
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => selectLocation(r)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 flex items-center gap-2"
                >
                  <MapPin className="size-3.5 text-blue-500 shrink-0" />
                  <span className="text-sm text-gray-800">{r.name}</span>
                </button>
              ))}
            </div>
          )}
          {showSearch && searchQ && searchResults.length === 0 && !searchLoading && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-2xl bg-white/95 p-3 shadow-xl z-50">
              <p className="text-xs text-gray-500 text-center">Sonuç bulunamadı</p>
            </div>
          )}
        </div>
        <button
          onClick={() => void load(loc.lat, loc.lon, loc.name)}
          className="rounded-full p-1.5 bg-white/20 text-white active:scale-95"
        >
          <RefreshCw className="size-4" />
        </button>
      </div>

      {/* Ana Kart */}
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
