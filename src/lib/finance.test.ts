import { describe, it, expect } from "vitest";
import { customerBalance, profitBreakdown, overdueAmount, monthSummary, type Tx } from "./finance";
import { fillTemplate, normalizePhone } from "./templates";
import { usernameToEmail } from "./username";

const tx = (p: Partial<Tx>): Tx => ({
  id: Math.random().toString(),
  customer_id: "c",
  kind: "debt",
  amount: 0,
  material_cost: 0,
  vat_rate: 0,
  occurred_on: "2026-01-01",
  ...p,
});

describe("finance rules", () => {
  it("5000 borç - 2000 nakit = 3000 kalan", () => {
    expect(customerBalance([tx({ kind: "debt", amount: 5000 }), tx({ kind: "payment", amount: 2000 })])).toBe(3000);
  });

  it("KDV %20 dahil 12000 TL, 3000 malzeme -> 2000 KDV, 7000 kâr", () => {
    expect(profitBreakdown(12000, 3000, 20)).toEqual({ vat: 2000, netOfVat: 10000, material: 3000, profit: 7000 });
  });

  it("KDV %10 dahil 1100 TL -> 100 KDV", () => {
    expect(profitBreakdown(1100, 0, 10).vat).toBe(100);
  });

  it("30 günü geçen ödenmemiş borç gecikmiş sayılır, 30 gün dahil değil", () => {
    const today = new Date("2026-03-01T12:00:00");
    const txs = [
      tx({ kind: "debt", amount: 1000, occurred_on: "2026-01-01" }),
      tx({ kind: "debt", amount: 500, occurred_on: "2026-01-30" }), // exactly 30 days
    ];
    expect(overdueAmount(txs, today)).toBe(1000);
  });

  it("ödemeler önce en eski borcu kapatır", () => {
    const today = new Date("2026-03-01T12:00:00");
    const txs = [
      tx({ kind: "debt", amount: 1000, occurred_on: "2026-01-01" }),
      tx({ kind: "payment", amount: 1000, occurred_on: "2026-02-25" }),
      tx({ kind: "debt", amount: 800, occurred_on: "2026-02-20" }),
    ];
    expect(overdueAmount(txs, today)).toBe(0);
  });

  it("aylık net = tahsilat - gider", () => {
    const s = monthSummary(
      [tx({ kind: "payment", amount: 3000, occurred_on: "2026-05-04" })],
      [{ id: "e", category: "yakit", amount: 500, occurred_on: "2026-05-10" }],
      "2026-05",
    );
    expect(s.net).toBe(2500);
  });
});

describe("templates & auth", () => {
  it("şablon değişkenleri dolar", () => {
    expect(fillTemplate("Merhaba [Müşteri Adı], kalan [Kalan Tutar] TL", { "Müşteri Adı": "Ali", "Kalan Tutar": "3.000" })).toBe(
      "Merhaba Ali, kalan 3.000 TL",
    );
  });
  it("telefon 0 ile başlarsa 90 eklenir", () => {
    expect(normalizePhone("0532 111 22 33")).toBe("905321112233");
  });
  it("kullanıcı adı Türkçe karakterden arındırılır", () => {
    expect(usernameToEmail("Şükrü")).toBe("sukru@saha.local");
  });
});
