import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  ShoppingCart, Plus, Trash2, Calendar, CreditCard,
  CheckCircle2, Clock, AlertCircle, FileText, Building2, Landmark
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { pageHead } from "@/lib/work";
import { formatTL, formatDate, todayISO } from "@/lib/finance";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/alim")({
  head: () => pageHead("Alım Defteri", "Makine ve ekipman alım takibi, taksit planı."),
  component: AlimDefteri,
});

type PaymentMethod = "nakit" | "kredi" | "taksit" | "leasing";
type InstallmentStatus = "odendi" | "bekliyor" | "gecikti";

interface Purchase {
  id: string;
  name: string;
  description: string;
  totalAmount: number;
  paidAmount: number;
  date: string;
  method: PaymentMethod;
  installments: number;
  paidInstallments: number;
  monthlyAmount: number;
  bank: string;
  iban: string;
  accountName: string;
  accountHolder: string;
  supplier: string;
  notes: string;
  payments: { date: string; amount: number; status: InstallmentStatus; note: string }[];
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  nakit: "Nakit", kredi: "Kredi Kartı", taksit: "Taksit", leasing: "Leasing",
};

const DEMO: Purchase[] = [
  {
    id: "p1",
    name: "İnek Süt Sağma Makinesi",
    description: "Yeni alınan süt sağma makinesi - 2 başlıklı",
    totalAmount: 31050,
    paidAmount: 3450,
    date: todayISO(),
    method: "taksit",
    installments: 9,
    paidInstallments: 1,
    monthlyAmount: 3450,
    bank: "Ziraat Bankası",
    iban: "TR33 0001 0017 4538 0756 5000 01",
    accountName: "Vadesiz TL",
    accountHolder: "Salih Kurban",
    supplier: "Tarım Makine Ltd.",
    notes: "Salih Kurban Ziraat Bankası Hesabından",
    payments: Array.from({ length: 9 }, (_, i) => ({
      date: new Date(new Date().setMonth(new Date().getMonth() + i)).toISOString().slice(0, 10),
      amount: 3450,
      status: (i === 0 ? "odendi" : "bekliyor") as InstallmentStatus,
      note: i === 0 ? "İlk taksit ödendi" : "",
    })),
  },
];

function AlimDefteri() {
  const [items, setItems] = useState<Purchase[]>(DEMO);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Purchase | null>(null);
  const [form, setForm] = useState<Partial<Purchase>>({ method: "taksit", installments: 1 });
  const [tab, setTab] = useState<"liste" | "detay">("liste");

  const totalDebt = useMemo(() => items.reduce((s, i) => s + (i.totalAmount - i.paidAmount), 0), [items]);

  function save() {
    if (!form.name || !form.totalAmount) return toast.error("Ad ve tutar zorunludur");
    const total = Number(form.totalAmount);
    const inst = Number(form.installments ?? 1);
    const monthly = form.method === "taksit" ? Math.ceil(total / inst) : total;
    const payments = form.method === "taksit"
      ? Array.from({ length: inst }, (_, i) => ({
          date: new Date(new Date().setMonth(new Date().getMonth() + i)).toISOString().slice(0, 10),
          amount: i === inst - 1 ? total - monthly * (inst - 1) : monthly,
          status: "bekliyor" as InstallmentStatus,
          note: "",
        }))
      : [{ date: form.date ?? todayISO(), amount: total, status: "bekliyor" as InstallmentStatus, note: "" }];
    const item: Purchase = {
      id: crypto.randomUUID(),
      name: form.name ?? "",
      description: form.description ?? "",
      totalAmount: total,
      paidAmount: 0,
      date: form.date ?? todayISO(),
      method: form.method as PaymentMethod ?? "nakit",
      installments: inst,
      paidInstallments: 0,
      monthlyAmount: monthly,
      bank: form.bank ?? "",
      iban: form.iban ?? "",
      accountName: form.accountName ?? "",
      accountHolder: form.accountHolder ?? "",
      supplier: form.supplier ?? "",
      notes: form.notes ?? "",
      payments,
    };
    setItems(prev => [item, ...prev]);
    setForm({ method: "taksit", installments: 1 });
    setOpen(false);
    toast.success("Alım kaydedildi");
  }

  function payInstallment(purchaseId: string, idx: number) {
    setItems(prev => prev.map(p => {
      if (p.id !== purchaseId) return p;
      const payments = p.payments.map((pay, i) => i === idx ? { ...pay, status: "odendi" as InstallmentStatus } : pay);
      const paidAmount = payments.filter(x => x.status === "odendi").reduce((s, x) => s + x.amount, 0);
      const paidInstallments = payments.filter(x => x.status === "odendi").length;
      return { ...p, payments, paidAmount, paidInstallments };
    }));
    toast.success("Taksit ödendi olarak işaretlendi");
  }

  if (tab === "detay" && selected) {
    const p = items.find(i => i.id === selected.id) ?? selected;
    const progress = p.totalAmount > 0 ? (p.paidAmount / p.totalAmount) * 100 : 0;
    return (
      <div className="space-y-4">
        <button onClick={() => setTab("liste")} className="flex items-center gap-2 text-sm text-muted-foreground">
          ← Listeye Dön
        </button>
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-start gap-3 mb-4">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <ShoppingCart className="size-5 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-lg">{p.name}</h2>
              {p.description && <p className="text-sm text-muted-foreground mt-0.5">{p.description}</p>}
              {p.supplier && <p className="text-xs text-muted-foreground">Tedarikçi: {p.supplier}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatBox label="Toplam Tutar" value={formatTL(p.totalAmount)} />
            <StatBox label="Ödenen" value={formatTL(p.paidAmount)} color="text-green-600" />
            <StatBox label="Kalan Borç" value={formatTL(p.totalAmount - p.paidAmount)} color="text-destructive" />
            <StatBox label="Aylık Taksit" value={p.method === "taksit" ? formatTL(p.monthlyAmount) : "Peşin"} />
          </div>
          <div className="mb-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Ödeme İlerlemesi</span>
              <span>{p.paidInstallments}/{p.installments} taksit · %{Math.round(progress)}</span>
            </div>
            <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
          {p.iban && (
            <div className="rounded-xl bg-secondary p-3 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
                <Landmark className="size-3.5" /> BANKA BİLGİLERİ
              </div>
              <div className="text-sm font-medium">{p.bank}</div>
              {p.accountHolder && <div className="text-xs text-muted-foreground">Hesap Sahibi: {p.accountHolder}</div>}
              {p.accountName && <div className="text-xs text-muted-foreground">Hesap: {p.accountName}</div>}
              <div className="font-mono text-xs mt-1 bg-background rounded-lg p-2 tracking-wider">{p.iban}</div>
            </div>
          )}
          {p.notes && <div className="mt-3 text-xs text-muted-foreground italic">{p.notes}</div>}
        </div>

        {/* Taksit Planı */}
        {p.payments.length > 0 && (
          <div className="rounded-2xl border bg-card p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Calendar className="size-4" /> Taksit Planı
            </h3>
            <div className="space-y-2.5">
              {p.payments.map((pay, i) => (
                <div key={i} className={`flex items-center gap-3 rounded-xl p-3 border ${pay.status === "odendi" ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" : pay.status === "gecikti" ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800" : "bg-card"}`}>
                  <div className="flex items-center justify-center rounded-full size-7 text-xs font-bold bg-secondary">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{formatDate(pay.date)}</div>
                    {pay.note && <div className="text-xs text-muted-foreground">{pay.note}</div>}
                  </div>
                  <div className="text-sm font-bold num">{formatTL(pay.amount)}</div>
                  {pay.status === "odendi"
                    ? <CheckCircle2 className="size-4 text-green-500" />
                    : pay.status === "gecikti"
                    ? <AlertCircle className="size-4 text-red-500" />
                    : (
                      <button onClick={() => payInstallment(p.id, i)} className="text-xs rounded-lg bg-primary text-primary-foreground px-2.5 py-1 active:scale-95">
                        Öde
                      </button>
                    )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Alım Defteri</h1>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4 mr-1" /> Yeni Alım</Button>
      </div>

      {items.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 p-4 text-white">
          <div className="text-sm opacity-80 mb-1">Toplam Kalan Borç</div>
          <div className="text-3xl font-bold num">{formatTL(totalDebt)}</div>
          <div className="text-xs opacity-70 mt-1">{items.length} alım kaydı</div>
        </div>
      )}

      <div className="space-y-3">
        {items.map(item => {
          const progress = item.totalAmount > 0 ? (item.paidAmount / item.totalAmount) * 100 : 0;
          const remaining = item.totalAmount - item.paidAmount;
          return (
            <button key={item.id} onClick={() => { setSelected(item); setTab("detay"); }}
              className="w-full text-left rounded-2xl border bg-card p-4 active:scale-[0.98] transition-transform">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-orange-100 dark:bg-orange-900/30 p-2.5">
                  <ShoppingCart className="size-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{item.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{formatDate(item.date)} · {METHOD_LABELS[item.method]}</div>
                  {item.bank && <div className="text-xs text-muted-foreground opacity-70">{item.bank}</div>}
                  <div className="mt-2.5">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{item.paidInstallments}/{item.installments} ödendi</span>
                      <span>%{Math.round(progress)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">Toplam</div>
                  <div className="font-bold num text-sm">{formatTL(item.totalAmount)}</div>
                  {remaining > 0 && <div className="text-xs text-destructive num mt-0.5">Kalan: {formatTL(remaining)}</div>}
                </div>
              </div>
            </button>
          );
        })}
        {items.length === 0 && (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            Henüz alım kaydı yok.
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Yeni Alım Kaydı</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Ürün / Makine Adı *</Label><Input placeholder="İnek Süt Sağma Makinesi" value={form.name ?? ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Açıklama</Label><Textarea placeholder="Detaylı açıklama..." rows={2} value={form.description ?? ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>Tedarikçi / Satıcı</Label><Input placeholder="Tarım Makine Ltd." value={form.supplier ?? ""} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} /></div>
            <div><Label>Alım Tarihi</Label><Input type="date" value={form.date ?? todayISO()} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><Label>Toplam Tutar (TL) *</Label><Input type="number" placeholder="0.00" value={form.totalAmount ?? ""} onChange={e => setForm(f => ({ ...f, totalAmount: Number(e.target.value) }))} /></div>
            <div><Label>Ödeme Yöntemi</Label>
              <Select value={form.method ?? "taksit"} onValueChange={v => setForm(f => ({ ...f, method: v as PaymentMethod }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {(form.method === "taksit" || form.method === "leasing") && (
              <div><Label>Taksit Sayısı</Label><Input type="number" min={1} max={120} value={form.installments ?? 1} onChange={e => setForm(f => ({ ...f, installments: Number(e.target.value) }))} /></div>
            )}
            <div className="border-t pt-3">
              <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><Landmark className="size-3.5" /> BANKA BİLGİLERİ</div>
              <div className="space-y-2">
                <div><Label>Banka</Label><Input placeholder="Ziraat Bankası" value={form.bank ?? ""} onChange={e => setForm(f => ({ ...f, bank: e.target.value }))} /></div>
                <div><Label>Hesap Sahibi</Label><Input placeholder="Salih Kurban" value={form.accountHolder ?? ""} onChange={e => setForm(f => ({ ...f, accountHolder: e.target.value }))} /></div>
                <div><Label>Hesap Adı</Label><Input placeholder="Vadesiz TL" value={form.accountName ?? ""} onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))} /></div>
                <div><Label>IBAN</Label><Input placeholder="TR00 0000 ..." value={form.iban ?? ""} onChange={e => setForm(f => ({ ...f, iban: e.target.value }))} /></div>
              </div>
            </div>
            <div><Label>Notlar</Label><Textarea rows={2} placeholder="Ek notlar..." value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <Button className="w-full" onClick={save}>Kaydet</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatBox({ label, value, color = "text-foreground" }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl bg-secondary p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-bold num mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}
