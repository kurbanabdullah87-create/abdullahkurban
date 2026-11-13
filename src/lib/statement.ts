import { customerBalance, formatDate, formatTL, type Tx } from "@/lib/finance";
import type { Customer } from "@/lib/data";
import type { Payload } from "@/lib/work";

const s = (v: unknown) => (v == null ? "" : String(v));

/** WhatsApp için resmi cari hesap ekstresi (kalın yazı için *…* kullanır). */
export function buildStatementText(opts: { customer: Customer; txs: Tx[]; profile?: Payload | undefined; limit?: number }) {
  const { customer, txs, profile } = opts;
  const business = s(profile?.business) || "Saha";
  const sorted = [...txs].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
  const debt = txs.filter((t) => t.kind === "debt").reduce((a, t) => a + t.amount, 0);
  const paid = txs.filter((t) => t.kind === "payment").reduce((a, t) => a + t.amount, 0);
  const balance = customerBalance(txs);
  const lines = sorted.slice(0, opts.limit ?? 10).map(
    (t) => `• ${formatDate(t.occurred_on)} · ${t.kind === "debt" ? "Borç" : "Tahsilat"} · ${t.description?.trim() || (t.kind === "debt" ? "Hizmet bedeli" : "Ödeme")} · ${formatTL(t.amount)}`,
  );
  return [
    `Sayın ${customer.name},`,
    "",
    `${business} cari hesap ekstreniz ${formatDate(new Date().toISOString().slice(0, 10))} tarihi itibarıyla aşağıda bilgilerinize sunulmuştur.`,
    "",
    `*HESAP HAREKETLERİ* (son ${lines.length})`,
    ...lines,
    "",
    `Toplam Borçlandırma: ${formatTL(debt)}`,
    `Toplam Tahsilat: ${formatTL(paid)}`,
    `*GÜNCEL BAKİYE: ${formatTL(balance)}*`,
    ...(balance > 0 && profile?.iban ? ["", "*Ödeme Bilgileri*", `IBAN: ${s(profile.iban)}`, `Alıcı: ${business}`, "Açıklama kısmına adınızı yazmanızı rica ederiz."] : []),
    "",
    "Bilgilerinize sunar, iyi çalışmalar dileriz.",
    "Saygılarımızla,",
    `${business}${profile?.phone ? " · " + s(profile.phone) : ""}`,
  ].join("\n");
}

/** Randevudan bir gün önce müşteriye gönderilecek resmi hatırlatma taslağı. */
export function appointmentReminderText(profile: Payload | undefined, a: Payload) {
  const business = s(profile?.business) || "Saha";
  return [
    `Sayın ${s(a.name)},`,
    "",
    `${business} olarak, *${formatDate(s(a.date))}* tarihinde saat *${s(a.time)}* için planlanan${a.title ? ` "${s(a.title)}"` : ""} randevunuzu hatırlatmak isteriz.`,
    "",
    "Randevuya katılamayacak olmanız hâlinde, yeniden planlama yapabilmemiz için lütfen önceden bilgi veriniz.",
    "",
    "Saygılarımızla,",
    `${business}${profile?.phone ? " · " + s(profile.phone) : ""}`,
  ].join("\n");
}
