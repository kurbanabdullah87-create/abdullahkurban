// Hava durumu - Open-Meteo API (ücretsiz, kayıt gerektirmez)
export interface WeatherData {
  location: string;
  lat: number;
  lon: number;
  current: {
    temp: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    weatherCode: number;
    desc: string;
    icon: string;
    isDay: boolean;
  };
  hourly: { time: string; temp: number; code: number; rain: number }[];
  daily: {
    date: string;
    dayName: string;
    maxTemp: number;
    minTemp: number;
    code: number;
    desc: string;
    rain: number;
  }[];
  sunrise: string;
  sunset: string;
  uvIndex: number;
  visibility: number;
}

export const WMO: Record<number, { desc: string; icon: string }> = {
  0:  { desc: "Açık", icon: "☀️" },
  1:  { desc: "Az Bulutlu", icon: "🌤️" },
  2:  { desc: "Parçalı Bulutlu", icon: "⛅" },
  3:  { desc: "Bulutlu", icon: "☁️" },
  45: { desc: "Sisli", icon: "🌫️" },
  48: { desc: "Dondurucu Sis", icon: "🌫️" },
  51: { desc: "Hafif Çisenti", icon: "🌦️" },
  53: { desc: "Orta Çisenti", icon: "🌦️" },
  55: { desc: "Yoğun Çisenti", icon: "🌧️" },
  61: { desc: "Hafif Yağmur", icon: "🌧️" },
  63: { desc: "Orta Yağmur", icon: "🌧️" },
  65: { desc: "Şiddetli Yağmur", icon: "🌧️" },
  71: { desc: "Hafif Kar", icon: "🌨️" },
  73: { desc: "Orta Kar", icon: "❄️" },
  75: { desc: "Yoğun Kar", icon: "❄️" },
  80: { desc: "Sağanak", icon: "🌦️" },
  81: { desc: "Orta Sağanak", icon: "🌧️" },
  82: { desc: "Şiddetli Sağanak", icon: "⛈️" },
  85: { desc: "Kar Sağanağı", icon: "🌨️" },
  95: { desc: "Fırtına", icon: "⛈️" },
  96: { desc: "Dolu Fırtınası", icon: "⛈️" },
  99: { desc: "Şiddetli Fırtına", icon: "⛈️" },
};

export function wmo(code: number) {
  return WMO[code] ?? { desc: "Bilinmiyor", icon: "🌡️" };
}

const DAYS = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];

export async function fetchWeather(lat: number, lon: number, locationName: string): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset,uv_index_max,visibility_mean&timezone=auto&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Hava durumu alınamadı");
  const d = await res.json();
  const c = d.current;
  const ci = wmo(c.weather_code);
  const nowH = new Date().getHours();
  const hourly = (d.hourly.time as string[]).slice(nowH, nowH + 24).map((t: string, i: number) => ({
    time: new Date(t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
    temp: Math.round(d.hourly.temperature_2m[nowH + i]),
    code: d.hourly.weather_code[nowH + i],
    rain: d.hourly.precipitation_probability[nowH + i] ?? 0,
  }));
  const daily = (d.daily.time as string[]).map((t: string, i: number) => {
    const date = new Date(t + "T12:00:00");
    return {
      date: t,
      dayName: i === 0 ? "Bugün" : i === 1 ? "Yarın" : DAYS[date.getDay()],
      maxTemp: Math.round(d.daily.temperature_2m_max[i]),
      minTemp: Math.round(d.daily.temperature_2m_min[i]),
      code: d.daily.weather_code[i],
      desc: wmo(d.daily.weather_code[i]).desc,
      rain: Math.round(d.daily.precipitation_sum[i] ?? 0),
    };
  });
  return {
    location: locationName,
    lat, lon,
    current: {
      temp: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      humidity: c.relative_humidity_2m,
      windSpeed: Math.round(c.wind_speed_10m),
      weatherCode: c.weather_code,
      desc: ci.desc,
      icon: ci.icon,
      isDay: c.is_day === 1,
    },
    hourly,
    daily,
    sunrise: new Date(d.daily.sunrise[0]).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
    sunset: new Date(d.daily.sunset[0]).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
    uvIndex: Math.round(d.daily.uv_index_max[0] ?? 0),
    visibility: Math.round((d.daily.visibility_mean?.[0] ?? 10000) / 1000),
  };
}

// Giresun Eynesil varsayılan konum
export const DEFAULT_LOCATION = { name: "Eynesil, Giresun", lat: 40.9757, lon: 38.7764 };
