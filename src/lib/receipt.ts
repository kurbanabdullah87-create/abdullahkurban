import type { Customer } from "@/lib/data";
import { formatDate, formatTL, profitBreakdown, type Tx } from "@/lib/finance";

let fontCache: { regular: string; bold: string } | null = null;

async function toBase64(url: string) {
  const buf = await (await fetch(url)).arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

const ONES = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];
function trWords(n: number): string {
  if (n === 0) return "sıfır";
  const grp = (x: number) => {
    const h = Math.floor(x / 100), t = Math.floor((x % 100) / 10), o = x % 10;
    return [h ? (h > 1 ? ONES[h] + " " : "") + "yüz" : "", TENS[t], ONES[o]].filter(Boolean).join(" ");
  };
  const m = Math.floor(n / 1_000_000), th = Math.floor((n % 1_000_000) / 1000), r = n % 1000;
  return [m ? grp(m) + " milyon" : "", th ? (th === 1 ? "" : grp(th) + " ") + "bin" : "", r ? grp(r) : ""].filter(Boolean).join(" ");
}
export function amountInWords(v: number) {
  const lira = Math.floor(v), kurus = Math.round((v - lira) * 100);
  const cap = (x: string) => x.split(" ").map((w) => w.charAt(0).toLocaleUpperCase("tr-TR") + w.slice(1)).join(" ");
  return `Yalnız ${cap(trWords(lira))} Türk Lirası${kurus ? " " + cap(trWords(kurus)) + " Kuruştur" : "dır"}.`;
}

export interface BusinessProfile {
  business?: string | number | boolean | null;
  address?: string | number | boolean | null;
  phone?: string | number | boolean | null;
  tax?: string | number | boolean | null;
  iban?: string | number | boolean | null;
  taxNo?: string | number | boolean | null;
  mersis?: string | number | boolean | null;
  website?: string | number | boolean | null;
  email?: string | number | boolean | null;
}

function qrPlaceholder(text: string): string {
  // Simple visual QR placeholder (not real QR, just decorative grid)
  return text; // We'll handle it with pdf drawing
}

/** Gelişmiş resmi A4 makbuz */
export async function buildReceipt(opts: {
  business?: string;
  profile?: BusinessProfile;
  customer: Customer;
  tx: Tx;
  balance: number;
  serialNo?: string;
}) {
  const { customer, tx, balance } = opts;
  const prof = opts.profile ?? {};
  const business = String(prof.business ?? opts.business ?? "Saha");
  const { jsPDF } = await import("jspdf");
  if (!fontCache) {
    const [regular, bold] = await Promise.all([toBase64("/fonts/DejaVuSans.ttf"), toBase64("/fonts/DejaVuSans-Bold.ttf")]);
    fontCache = { regular, bold };
  }
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS("DejaVu.ttf", fontCache.regular);
  doc.addFont("DejaVu.ttf", "DejaVu", "normal");
  doc.addFileToVFS("DejaVu-Bold.ttf", fontCache.bold);
  doc.addFont("DejaVu-Bold.ttf", "DejaVu", "bold");

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 15;
  const isDebt = tx.kind === "debt";
  const no = opts.serialNo ?? `MKB-${tx.occurred_on.slice(0, 4)}-${tx.id.slice(0, 6).toUpperCase()}`;
  const NAVY: [number, number, number] = [15, 30, 55];
  const GOLD: [number, number, number] = [180, 140, 50];
  const GREY: [number, number, number] = [100, 100, 100];
  const LGREY: [number, number, number] = [245, 246, 248];

  const font = (bold = false, size = 9, color: [number, number, number] = [30, 30, 30]) => {
    doc.setFont("DejaVu", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  // ── Dekoratif sol çizgi ──
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, 4, H, "F");

  // ── Başlık Bandı ──
  doc.setFillColor(...NAVY);
  doc.rect(4, 0, W - 4, 42, "F");

  // İşletme Adı
  font(true, 20, [255, 255, 255]);
  doc.text(business, M + 4, 16);

  // Makbuz tipi büyük yazı
  font(true, 13, GOLD as [number,number,number]);
  doc.text(isDebt ? "İŞ / HİZMET MAKBUZU" : "TAHSİLAT MAKBUZU", W - M, 12, { align: "right" });

  // Meta bilgiler
  font(false, 8, [190, 200, 215]);
  const metaLines: string[] = [];
  if (prof.address) metaLines.push(String(prof.address));
  if (prof.phone) metaLines.push(`Tel: ${prof.phone}`);
  if (prof.email) metaLines.push(String(prof.email));
  if (prof.tax) metaLines.push(`Vergi: ${prof.tax}`);
  if (prof.taxNo) metaLines.push(`VKN: ${prof.taxNo}`);
  if (prof.mersis) metaLines.push(`MERSİS: ${prof.mersis}`);
  metaLines.forEach((l, i) => doc.text(l, M + 4, 24 + i * 4.2));

  // Makbuz no ve tarih (sağ)
  font(false, 8.5, [190, 200, 215]);
  doc.text(`Makbuz No: ${no}`, W - M, 20, { align: "right" });
  doc.text(`Düzenleme Tarihi: ${formatDate(tx.occurred_on)}`, W - M, 25, { align: "right" });
  doc.text(`Düzenleme Saati: ${new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`, W - M, 30, { align: "right" });
  font(false, 7.5, [160, 170, 190]);
  doc.text("Bu belge elektronik ortamda oluşturulmuştur.", W - M, 36, { align: "right" });

  // ── Müşteri Bölümü ──
  let y = 52;
  doc.setFillColor(...LGREY);
  doc.setDrawColor(220, 224, 232);
  doc.roundedRect(M, y, W - 2 * M, 34, 2.5, 2.5, "FD");

  font(true, 7, GREY);
  doc.text("FATURA / MAKBUZ KESİLEN", M + 5, y + 6.5);
  doc.setDrawColor(...GOLD);
  doc.line(M + 5, y + 7.5, M + 50, y + 7.5);

  font(true, 13);
  doc.text(customer.name, M + 5, y + 15);
  font(false, 9, GREY);
  if (customer.phone) doc.text(`Tel: ${customer.phone}`, M + 5, y + 21.5);
  if (customer.address) {
    const addrLines = doc.splitTextToSize(customer.address, W - 2 * M - 10) as string[];
    doc.text(addrLines.slice(0, 1) as string[], M + 5, y + 27.5);
  }

  // ── Kalem Tablosu ──
  y += 44;
  // Tablo başlık
  doc.setFillColor(...NAVY);
  doc.rect(M, y, W - 2 * M, 9, "F");
  font(true, 8.5, [255, 255, 255]);
  doc.text("NO", M + 4, y + 6);
  doc.text("AÇIKLAMA / HİZMET", M + 15, y + 6);
  doc.text("KDV%", W - M - 48, y + 6, { align: "right" });
  doc.text("TUTAR", W - M - 3, y + 6, { align: "right" });
  y += 9;

  let rowIdx = 0;
  const row = (no: string, label: string, vatPct: string, value: string, shade = false, bold = false) => {
    if (shade) { doc.setFillColor(...LGREY); doc.rect(M, y, W - 2 * M, 8, "F"); }
    font(bold, 8.5, [30, 30, 30]);
    doc.text(no, M + 4, y + 5.5);
    doc.text(label, M + 15, y + 5.5);
    font(false, 8.5, GREY);
    doc.text(vatPct, W - M - 48, y + 5.5, { align: "right" });
    font(bold, 9);
    doc.text(value, W - M - 3, y + 5.5, { align: "right" });
    doc.setDrawColor(220, 224, 232);
    doc.line(M, y + 8, W - M, y + 8);
    y += 8;
    rowIdx++;
  };

  let total = tx.amount;
  if (isDebt) {
    const pb = profitBreakdown(tx.amount, tx.material_cost, tx.vat_rate);
    const desc = tx.description?.trim() || "Hizmet bedeli";
    const lines = doc.splitTextToSize(desc, W - 2 * M - 70) as string[];
    // İlk satırı yaz
    doc.setFillColor(255, 255, 255);
    font(false, 9.5);
    doc.text(`${rowIdx + 1}`, M + 4, y + 5.5);
    doc.text(lines[0] ?? "", M + 15, y + 5.5);
    if (lines.length > 1) {
      lines.slice(1).forEach((l, i) => doc.text(l, M + 15, y + 5.5 + (i + 1) * 5));
    }
    doc.setDrawColor(220, 224, 232);
    doc.line(M, y + 8 + (lines.length - 1) * 5, W - M, y + 8 + (lines.length - 1) * 5);
    y += 8 + (lines.length - 1) * 5;
    rowIdx++;

    if (tx.material_cost > 0) row("", "  Malzeme Bedeli", "", formatTL(tx.material_cost), true);
    row("", "  İşçilik / Hizmet Bedeli", tx.vat_rate > 0 ? `%${tx.vat_rate}` : "—", formatTL(Math.max(0, pb.netOfVat - tx.material_cost)), false);
    row("", "  Ara Toplam (KDV Hariç)", "", formatTL(pb.netOfVat), true);
    if (tx.vat_rate > 0) row("", `  KDV (%${tx.vat_rate})`, `%${tx.vat_rate}`, formatTL(pb.vat), false);
    total = tx.amount;
  } else {
    row("1", tx.description?.trim() || "Tahsilat / Ödeme", "", formatTL(tx.amount));
    if (tx.method) row("", `  Ödeme Yöntemi: ${tx.method}`, "", "", true);
  }

  // ── Genel Toplam Bandı ──
  y += 5;
  doc.setFillColor(...NAVY);
  doc.rect(W - M - 90, y, 90, 13, "F");
  doc.setFillColor(...GOLD);
  doc.rect(W - M - 90, y, 3, 13, "F");
  font(true, 9, [255, 255, 255]);
  doc.text(isDebt ? "GENEL TOPLAM (KDV Dahil)" : "TAHSİL EDİLEN TOPLAM", W - M - 87, y + 5);
  font(true, 11, GOLD as [number,number,number]);
  doc.text(formatTL(total), W - M - 3, y + 9, { align: "right" });

  font(false, 8.5, GREY);
  doc.text(doc.splitTextToSize(amountInWords(total), W - 2 * M - 95) as string[], M, y + 6);
  y += 22;

  // ── Cari Hesap Özeti ──
  font(true, 7.5, GREY);
  doc.text("CARİ HESAP ÖZETİ", M, y);
  y += 3;
  doc.setFillColor(...LGREY);
  doc.setDrawColor(220, 224, 232);
  doc.roundedRect(M, y, W - 2 * M, 20, 2, 2, "FD");
  font(false, 9);
  doc.text(isDebt ? "Bu işlemle hesaba yüklenen borç tutarı" : "Bu işlemle hesaptan mahsup edilen ödeme", M + 4, y + 7);
  doc.text(formatTL(tx.amount), W - M - 4, y + 7, { align: "right" });
  doc.setDrawColor(220, 224, 232);
  doc.line(M + 4, y + 11, W - M - 4, y + 11);
  font(true, 10.5, balance > 0 ? [160, 30, 30] : [25, 110, 55]);
  doc.text(balance > 0 ? "Hesap Bakiyesi (Borç)" : "Hesap Bakiyesi (Alacak)", M + 4, y + 17.5);
  doc.text(formatTL(Math.abs(balance)), W - M - 4, y + 17.5, { align: "right" });
  y += 30;

  // ── Ödeme Bilgisi ──
  if ((prof.iban || (isDebt && balance > 0))) {
    font(true, 7.5, GREY);
    doc.text("ÖDEME BİLGİSİ", M, y);
    y += 3;
    doc.setFillColor(240, 245, 255);
    doc.setDrawColor(180, 195, 230);
    doc.roundedRect(M, y, W - 2 * M, 22, 2, 2, "FD");
    if (prof.iban) {
      font(false, 8.5);
      doc.text(`IBAN:`, M + 4, y + 7);
      font(true, 9);
      doc.text(String(prof.iban), M + 20, y + 7);
      font(false, 8.5);
      doc.text(`Alıcı: ${business}`, M + 4, y + 13);
      if (prof.website) doc.text(`Web: ${prof.website}`, M + 4, y + 18.5);
    }
    y += 30;
  }

  // ── İmza Alanları ──
  const sigY = Math.max(y + 8, H - 55);
  doc.setDrawColor(180, 180, 190);
  // Sol imza
  doc.rect(M, sigY, 70, 25, "S");
  font(true, 7.5, GREY);
  doc.text(isDebt ? "TESLİM EDEN / DÜZENLEYEN" : "TAHSİL EDEN", M + 35, sigY + 20, { align: "center" });
  font(false, 8);
  doc.text(business, M + 35, sigY + 24.5, { align: "center" });
  // Sağ imza
  doc.rect(W - M - 70, sigY, 70, 25, "S");
  font(true, 7.5, GREY);
  doc.text(isDebt ? "TESLİM ALAN / ONAYLAYAN" : "ÖDEYEN", W - M - 35, sigY + 20, { align: "center" });
  font(false, 8);
  doc.text(customer.name, W - M - 35, sigY + 24.5, { align: "center" });

  // ── Alt Bilgi ──
  doc.setFillColor(...NAVY);
  doc.rect(0, H - 15, W, 15, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, H - 15, 4, 15, "F");
  font(false, 7.5, [160, 170, 190]);
  doc.text("Bu belge bilgi amaçlı makbuzdur; resmi fatura/fiş yerine geçmez. · 6698 sayılı KVKK kapsamında kişisel veriler korunmaktadır.", W / 2, H - 9, { align: "center" });
  font(false, 7, [130, 140, 160]);
  doc.text(`${business}  ·  ${no}  ·  Teşekkür ederiz`, W / 2, H - 4.5, { align: "center" });

  const blob = doc.output("blob");
  return new File([blob], `makbuz-${no}.pdf`, { type: "application/pdf" });
}

export async function shareOrDownload(file: File) {
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: file.name });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
