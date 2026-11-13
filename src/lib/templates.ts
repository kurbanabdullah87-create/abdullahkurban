export const TEMPLATE_VARS = [
  "Müşteri Adı",
  "Tarih",
  "İş Türü",
  "İş Detayı",
  "Avans Tutarı",
  "Malzeme Tutarı",
  "İşçilik Tutarı",
  "Toplam Tutar",
  "Kalan Tutar",
  "Ödenen Tutar",
  "Süre",
] as const;

export const DEFAULT_TEMPLATES: { title: string; body: string }[] = [
  { title: "Randevu Onayı", body: "Merhaba [Müşteri Adı], [Tarih] tarihli [İş Türü] işiniz planlanmıştır." },
  { title: "Yoldayım", body: "Merhaba [Müşteri Adı], adresinize doğru yola çıktım." },
  { title: "Malzeme Avansı", body: "[İş Türü] işine ait malzeme tedariği için [Avans Tutarı] TL ön ödeme rica olunur." },
  {
    title: "İş Sonu Özeti",
    body: "Yapılan İş: [İş Detayı]. Malzeme: [Malzeme Tutarı] TL. İşçilik: [İşçilik Tutarı] TL. Toplam Tutar: [Toplam Tutar] TL. Hayırlı olsun.",
  },
  {
    title: "Tahsilat Hatırlatma (Nazik)",
    body: "Merhaba [Müşteri Adı], [Tarih] tarihli işlemimizden [Kalan Tutar] TL bakiyeniz bulunmaktadır. Müsait olduğunuzda ödemenizi rica ederim.",
  },
  {
    title: "Tahsilat Hatırlatma (Standart)",
    body: "Sayın [Müşteri Adı], [Tarih] tarihli işlemimizden [Kalan Tutar] TL bakiyeniz bulunmaktadır. Ödemenizi bekliyoruz.",
  },
  {
    title: "Parçalı Ödeme Teşekkürü",
    body: "Yaptığınız [Ödenen Tutar] TL ödeme işlenmiştir. Kalan bakiye: [Kalan Tutar] TL. Teşekkürler.",
  },
  {
    title: "Bakım Zamanı Geldi",
    body: "Merhaba [Müşteri Adı], en son yaptığımız [İş Türü] üzerinden [Süre] geçti. Verimlilik için yeni bakım zamanı gelmiştir.",
  },
  { title: "Bayram Kutlaması", body: "Merhaba [Müşteri Adı], bayramınızı en içten dileklerimle kutlar, sağlıklı günler dilerim." },
  { title: "Yeni Yıl Kutlaması", body: "Merhaba [Müşteri Adı], yeni yılınız kutlu olsun. Sağlık ve bereket dolu bir yıl dilerim." },
];

/** Replaces [Var] placeholders. Unknown/empty variables are left as-is so the user notices. */
export function fillTemplate(body: string, vars: Partial<Record<string, string>>) {
  return body.replace(/\[([^\]]+)\]/g, (m, key: string) => {
    const v = vars[key.trim()];
    return v !== undefined && v !== "" ? v : m;
  });
}

export function normalizePhone(phone: string) {
  let p = phone.replace(/\D/g, "");
  if (p.startsWith("0")) p = "90" + p.slice(1);
  else if (p.length === 10) p = "90" + p;
  return p;
}

export function whatsappLink(phone: string, text: string) {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(text)}`;
}

export function smsLink(phone: string, text: string) {
  return `sms:+${normalizePhone(phone)}?body=${encodeURIComponent(text)}`;
}
