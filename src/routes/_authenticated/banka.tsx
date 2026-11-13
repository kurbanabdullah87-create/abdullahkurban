import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Building2, Plus, ArrowUpRight, ArrowDownLeft, CreditCard, Landmark,
  TrendingUp, Eye, EyeOff, ChevronRight, Wallet, PiggyBank, ArrowRightLeft,
  FileText, Download, Calendar, Filter, Search, CheckCircle2, Clock, XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { pageHead } from "@/lib/work";
import { formatTL, todayISO } from "@/lib/finance";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/banka")({
  head: () => pageHead("Banka", "Banka hesapları ve finansal işlemler."),
  component: Banka,
});

type AccountType = "vadesiz" | "vadeli" | "kredi" | "yatirim";
type TxType = "havale" | "eft" | "pos" | "atm" | "faiz" | "maas" | "fatura" | "diger";

interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  iban: string;
  accountNo: string;
  type: AccountType;
  balance: number;
  currency: string;
  color: string;
  limit?: number; // kredi kartı limiti
  interestRate?: number; // faiz oranı
}

interface BankTx {
  id: string;
  accountId: string;
  date: string;
  desc: string;
  amount: number;
  type: TxType;
  direction: "in" | "out";
  balance: number;
  reference: string;
  status: "completed" | "pending" | "failed";
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  vadesiz: "Vadesiz Hesap",
  vadeli: "Vadeli Hesap",
  kredi: "Kredi Kartı",
  yatirim: "Yatırım Hesabı",
};

const TX_LABELS: Record<TxType, string> = {
  havale: "Havale", eft: "EFT", pos: "POS", atm: "ATM",
  faiz: "Faiz Geliri", maas: "Maaş", fatura: "Fatura Ödemesi", diger: "Diğer",
};

const BANK_COLORS = ["#1e40af","#166534","#92400e","#7c3aed","#be123c","#0369a1"];

function genRef() { return "REF" + Math.random().toString(36).slice(2,10).toUpperCase(); }

const DEMO_ACCOUNTS: BankAccount[] = [
  { id: "acc1", bankName: "Ziraat Bankası", accountName: "Vadesiz TL", iban: "TR33 0001 0017 4538 0756 5000 01", accountNo: "7453807565", type: "vadesiz", balance: 48250.75, currency: "TL", color: "#166534" },
  { id: "acc2", bankName: "Halkbank", accountName: "İşletme Hesabı", iban: "TR76 0001 2009 4520 0058 0000 01", accountNo: "9452000580", type: "vadesiz", balance: 23100.00, currency: "TL", color: "#1e40af" },
  { id: "acc3", bankName: "Ziraat Bankası", accountName: "Kredi Kartı", iban: "", accountNo: "5411 ****  **** 2341", type: "kredi", balance: -4320.50, currency: "TL", color: "#be123c", limit: 25000 },
];

const DEMO_TXS: BankTx[] = [
  { id: "t1", accountId: "acc1", date: todayISO(), desc: "İnek Süt Sağma Makinesi Alımı - Taksit 1/9", amount: 3450.00, type: "havale", direction: "out", balance: 48250.75, reference: genRef(), status: "completed" },
  { id: "t2", accountId: "acc1", date: todayISO(), desc: "Müşteri Tahsilatı - Ahmet Yılmaz", amount: 7500.00, type: "havale", direction: "in", balance: 51700.75, reference: genRef(), status: "completed" },
  { id: "t3", accountId: "acc1", date: todayISO(), desc: "Elektrik Faturası", amount: 890.50, type: "fatura", direction: "out", balance: 44200.75, reference: genRef(), status: "completed" },
  { id: "t4", accountId: "acc2", date: todayISO(), desc: "EFT - Tedarikçi Ödemesi", amount: 12000.00, type: "eft", direction: "out", balance: 23100.00, reference: genRef(), status: "completed" },
  { id: "t5", accountId: "acc2", date: todayISO(), desc: "Çalışan Maaşı - Mehmet", amount: 15000.00, type: "maas", direction: "out", balance: 35100.00, reference: genRef(), status: "pending" },
];

function Banka() {
  const [accounts, setAccounts] = useState<BankAccount[]>(DEMO_ACCOUNTS);
  const [txs, setTxs] = useState<BankTx[]>(DEMO_TXS);
  const [selectedAcc, setSelectedAcc] = useState<string | null>(null);
  const [showBalances, setShowBalances] = useState(true);
  const [addAccOpen, setAddAccOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(false);
  const [tab, setTab] = useState<"hesaplar" | "islemler" | "transfer">("hesaplar");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("tümü");

  const [accForm, setAccForm] = useState<Partial<BankAccount>>({});
  const [txForm, setTxForm] = useState<Partial<BankTx> & { accountId: string }>({ accountId: accounts[0]?.id ?? "", direction: "out" as const });
  const [transferForm, setTransferForm] = useState({ fromId: "", toId: "", amount: "", desc: "" });

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const totalPositive = accounts.filter(a => a.balance > 0).reduce((s, a) => s + a.balance, 0);
  const totalNegative = accounts.filter(a => a.balance < 0).reduce((s, a) => s + Math.abs(a.balance), 0);

  const selectedAccount = accounts.find(a => a.id === selectedAcc);
  const filteredTxs = useMemo(() => {
    let list = txs.filter(t => selectedAcc ? t.accountId === selectedAcc : true);
    if (search) list = list.filter(t => t.desc.toLowerCase().includes(search.toLowerCase()) || t.reference.includes(search));
    if (filterType !== "tümü") list = list.filter(t => t.direction === filterType || t.type === filterType || t.status === filterType);
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [txs, selectedAcc, search, filterType]);

  function addAccount() {
    if (!accForm.bankName || !accForm.accountName) return toast.error("Banka adı ve hesap adı zorunludur");
    const newAcc: BankAccount = {
      id: crypto.randomUUID(),
      bankName: accForm.bankName ?? "",
      accountName: accForm.accountName ?? "",
      iban: accForm.iban ?? "",
      accountNo: accForm.accountNo ?? "",
      type: (accForm.type as AccountType) ?? "vadesiz",
      balance: Number(accForm.balance ?? 0),
      currency: accForm.currency ?? "TL",
      color: BANK_COLORS[accounts.length % BANK_COLORS.length],
      limit: accForm.limit,
      interestRate: accForm.interestRate,
    };
    setAccounts(prev => [...prev, newAcc]);
    setAccForm({});
    setAddAccOpen(false);
    toast.success("Hesap eklendi");
  }

  function addTx() {
    if (!txForm.desc || !txForm.amount || !txForm.accountId) return toast.error("Zorunlu alanları doldurun");
    const acc = accounts.find(a => a.id === txForm.accountId);
    if (!acc) return;
    const amount = Number(txForm.amount);
    const newBalance = txForm.direction === "in" ? acc.balance + amount : acc.balance - amount;
    const newTx: BankTx = {
      id: crypto.randomUUID(),
      accountId: txForm.accountId,
      date: (txForm.date as string) ?? todayISO(),
      desc: txForm.desc ?? "",
      amount,
      type: (txForm.type as TxType) ?? "diger",
      direction: txForm.direction as "in" | "out",
      balance: newBalance,
      reference: genRef(),
      status: "completed",
    };
    setTxs(prev => [newTx, ...prev]);
    setAccounts(prev => prev.map(a => a.id === acc.id ? { ...a, balance: newBalance } : a));
    setTxForm({ accountId: accounts[0]?.id ?? "", direction: "out" });
    setTxOpen(false);
    toast.success("İşlem eklendi");
  }

  function doTransfer() {
    const { fromId, toId, amount, desc } = transferForm;
    if (!fromId || !toId || !amount) return toast.error("Zorunlu alanları doldurun");
    if (fromId === toId) return toast.error("Aynı hesaba transfer yapılamaz");
    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) return toast.error("Geçerli tutar girin");
    const from = accounts.find(a => a.id === fromId);
    const to = accounts.find(a => a.id === toId);
    if (!from || !to) return;
    setAccounts(prev => prev.map(a => {
      if (a.id === fromId) return { ...a, balance: a.balance - amt };
      if (a.id === toId) return { ...a, balance: a.balance + amt };
      return a;
    }));
    const ref = genRef();
    const today = todayISO();
    setTxs(prev => [
      { id: crypto.randomUUID(), accountId: fromId, date: today, desc: `Transfer → ${to.accountName}: ${desc || ""}`, amount: amt, type: "havale", direction: "out", balance: from.balance - amt, reference: ref, status: "completed" },
      { id: crypto.randomUUID(), accountId: toId, date: today, desc: `Transfer ← ${from.accountName}: ${desc || ""}`, amount: amt, type: "havale", direction: "in", balance: to.balance + amt, reference: ref, status: "completed" },
      ...prev,
    ]);
    setTransferForm({ fromId: "", toId: "", amount: "", desc: "" });
    setTransferOpen(false);
    toast.success("Transfer tamamlandı");
  }

  return (
    <div className="space-y-4">
      {/* Üst özet */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-5 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Landmark className="size-5 opacity-80" />
            <span className="text-sm font-medium opacity-80">Toplam Varlık</span>
          </div>
          <button onClick={() => setShowBalances(v => !v)} className="opacity-60 hover:opacity-100">
            {showBalances ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </button>
        </div>
        <div className="text-3xl font-bold mb-1">
          {showBalances ? formatTL(totalBalance) : "••••••"}
        </div>
        <div className="flex gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1 text-green-300">
            <TrendingUp className="size-3" />
            <span>{showBalances ? formatTL(totalPositive) : "••••"}</span>
          </div>
          <div className="flex items-center gap-1 text-red-300">
            <CreditCard className="size-3" />
            <span>{showBalances ? formatTL(totalNegative) : "••••"} borç</span>
          </div>
        </div>
      </div>

      {/* Hızlı Eylemler */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: Plus, label: "Hesap Ekle", onClick: () => setAddAccOpen(true) },
          { icon: ArrowRightLeft, label: "Transfer", onClick: () => setTransferOpen(true) },
          { icon: ArrowUpRight, label: "Çıkış", onClick: () => { setTxOpen(true); setTxForm(f => ({ ...f, direction: "out" })); } },
          { icon: ArrowDownLeft, label: "Giriş", onClick: () => { setTxOpen(true); setTxForm(f => ({ ...f, direction: "in" })); } },
        ].map(({ icon: Icon, label, onClick }) => (
          <button key={label} onClick={onClick} className="flex flex-col items-center gap-1.5 rounded-2xl border bg-card p-3 active:scale-95 transition-transform">
            <div className="rounded-full bg-primary/10 p-2.5">
              <Icon className="size-4 text-primary" />
            </div>
            <span className="text-[11px] text-muted-foreground">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Seçici */}
      <div className="flex gap-1 rounded-xl bg-secondary p-1">
        {(["hesaplar", "islemler"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${tab === t ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>
            {t === "hesaplar" ? "Hesaplar" : "İşlemler"}
          </button>
        ))}
      </div>

      {tab === "hesaplar" && (
        <div className="space-y-3">
          {accounts.map(acc => (
            <button key={acc.id} onClick={() => { setSelectedAcc(acc.id === selectedAcc ? null : acc.id); setTab("islemler"); }}
              className="w-full text-left rounded-2xl border bg-card p-4 active:scale-[0.98] transition-transform">
              <div className="flex items-start gap-3">
                <div className="rounded-xl p-2.5 mt-0.5" style={{ background: acc.color + "22" }}>
                  {acc.type === "kredi" ? <CreditCard className="size-5" style={{ color: acc.color }} /> :
                   acc.type === "yatirim" ? <TrendingUp className="size-5" style={{ color: acc.color }} /> :
                   acc.type === "vadeli" ? <PiggyBank className="size-5" style={{ color: acc.color }} /> :
                   <Wallet className="size-5" style={{ color: acc.color }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{acc.bankName}</span>
                    <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-secondary text-muted-foreground">{ACCOUNT_TYPE_LABELS[acc.type]}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{acc.accountName}</div>
                  {acc.iban && <div className="text-[10px] text-muted-foreground font-mono mt-1 opacity-60">{acc.iban}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-bold num ${acc.balance < 0 ? "text-destructive" : "text-foreground"}`}>
                    {showBalances ? formatTL(acc.balance) : "••••"}
                  </div>
                  {acc.type === "kredi" && acc.limit && (
                    <div className="text-[10px] text-muted-foreground">Limit: {formatTL(acc.limit)}</div>
                  )}
                  {acc.interestRate && (
                    <div className="text-[10px] text-green-600">%{acc.interestRate} faiz</div>
                  )}
                  <ChevronRight className="size-3 text-muted-foreground ml-auto mt-1" />
                </div>
              </div>
              {acc.type === "kredi" && acc.limit && (
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Kullanılan</span>
                    <span>{Math.round((Math.abs(acc.balance) / acc.limit) * 100)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-destructive" style={{ width: `${Math.min(100, (Math.abs(acc.balance) / acc.limit) * 100)}%` }} />
                  </div>
                </div>
              )}
            </button>
          ))}
          {accounts.length === 0 && (
            <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
              Henüz hesap yok. "Hesap Ekle" ile başlayın.
            </div>
          )}
        </div>
      )}

      {tab === "islemler" && (
        <div className="space-y-3">
          {selectedAccount && (
            <div className="flex items-center gap-2 rounded-xl bg-secondary p-2.5 text-sm">
              <div className="size-2 rounded-full" style={{ background: selectedAccount.color }} />
              <span className="font-medium">{selectedAccount.bankName} · {selectedAccount.accountName}</span>
              <button onClick={() => setSelectedAcc(null)} className="ml-auto text-xs text-muted-foreground">Tümü</button>
            </div>
          )}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="İşlem ara..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-28">
                <Filter className="size-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tümü">Tümü</SelectItem>
                <SelectItem value="in">Giriş</SelectItem>
                <SelectItem value="out">Çıkış</SelectItem>
                <SelectItem value="pending">Bekleyen</SelectItem>
                {Object.entries(TX_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {filteredTxs.length === 0 ? (
            <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
              İşlem bulunamadı
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTxs.map(tx => {
                const acc = accounts.find(a => a.id === tx.accountId);
                return (
                  <div key={tx.id} className="rounded-2xl border bg-card p-3.5">
                    <div className="flex items-start gap-3">
                      <div className={`rounded-xl p-2 ${tx.direction === "in" ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                        {tx.direction === "in"
                          ? <ArrowDownLeft className="size-4 text-green-600 dark:text-green-400" />
                          : <ArrowUpRight className="size-4 text-red-600 dark:text-red-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium leading-tight">{tx.desc}</div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                          <span className="text-xs text-muted-foreground">{tx.date}</span>
                          <span className="text-xs rounded-full px-1.5 py-0.5 bg-secondary text-muted-foreground">{TX_LABELS[tx.type]}</span>
                          {acc && <span className="text-[10px] text-muted-foreground opacity-70">{acc.bankName}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] font-mono text-muted-foreground opacity-50">{tx.reference}</span>
                          {tx.status === "completed" ? <CheckCircle2 className="size-3 text-green-500" /> :
                           tx.status === "pending" ? <Clock className="size-3 text-yellow-500" /> :
                           <XCircle className="size-3 text-red-500" />}
                          <span className="text-[10px] text-muted-foreground capitalize">{tx.status === "completed" ? "Tamamlandı" : tx.status === "pending" ? "Bekliyor" : "Başarısız"}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`num font-bold text-sm ${tx.direction === "in" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {tx.direction === "in" ? "+" : "-"}{formatTL(tx.amount)}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Bakiye: {formatTL(tx.balance)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Hesap Ekleme Diyalogu */}
      <Dialog open={addAccOpen} onOpenChange={setAddAccOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Yeni Banka Hesabı</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Banka Adı *</Label><Input placeholder="Ziraat Bankası" value={accForm.bankName ?? ""} onChange={e => setAccForm(f => ({ ...f, bankName: e.target.value }))} /></div>
            <div><Label>Hesap Adı *</Label><Input placeholder="Vadesiz TL Hesabı" value={accForm.accountName ?? ""} onChange={e => setAccForm(f => ({ ...f, accountName: e.target.value }))} /></div>
            <div><Label>Hesap Türü</Label>
              <Select value={accForm.type ?? "vadesiz"} onValueChange={v => setAccForm(f => ({ ...f, type: v as AccountType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>IBAN</Label><Input placeholder="TR00 0000 0000 0000 0000 0000 00" value={accForm.iban ?? ""} onChange={e => setAccForm(f => ({ ...f, iban: e.target.value }))} /></div>
            <div><Label>Hesap No</Label><Input value={accForm.accountNo ?? ""} onChange={e => setAccForm(f => ({ ...f, accountNo: e.target.value }))} /></div>
            <div><Label>Mevcut Bakiye (TL)</Label><Input type="number" placeholder="0.00" value={accForm.balance ?? ""} onChange={e => setAccForm(f => ({ ...f, balance: Number(e.target.value) }))} /></div>
            {(accForm.type === "kredi") && <div><Label>Kredi Limiti</Label><Input type="number" value={accForm.limit ?? ""} onChange={e => setAccForm(f => ({ ...f, limit: Number(e.target.value) }))} /></div>}
            {(accForm.type === "vadeli" || accForm.type === "yatirim") && <div><Label>Faiz Oranı (%)</Label><Input type="number" step="0.01" value={accForm.interestRate ?? ""} onChange={e => setAccForm(f => ({ ...f, interestRate: Number(e.target.value) }))} /></div>}
            <Button className="w-full" onClick={addAccount}>Hesabı Ekle</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Diyalogu */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Hesaplar Arası Transfer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Kaynak Hesap *</Label>
              <Select value={transferForm.fromId} onValueChange={v => setTransferForm(f => ({ ...f, fromId: v }))}>
                <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.bankName} · {a.accountName} · {formatTL(a.balance)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Hedef Hesap *</Label>
              <Select value={transferForm.toId} onValueChange={v => setTransferForm(f => ({ ...f, toId: v }))}>
                <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.bankName} · {a.accountName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tutar (TL) *</Label><Input type="number" placeholder="0.00" value={transferForm.amount} onChange={e => setTransferForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div><Label>Açıklama</Label><Input placeholder="İsteğe bağlı" value={transferForm.desc} onChange={e => setTransferForm(f => ({ ...f, desc: e.target.value }))} /></div>
            <Button className="w-full" onClick={doTransfer}>Transferi Gerçekleştir</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* İşlem Ekleme Diyalogu */}
      <Dialog open={txOpen} onOpenChange={setTxOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{txForm.direction === "in" ? "Para Girişi" : "Para Çıkışı"} Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Hesap *</Label>
              <Select value={txForm.accountId} onValueChange={v => setTxForm(f => ({ ...f, accountId: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.bankName} · {a.accountName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setTxForm(f => ({ ...f, direction: "in" }))} className={`flex-1 rounded-xl border p-2.5 text-sm font-medium transition-colors ${txForm.direction === "in" ? "bg-green-100 border-green-500 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-card"}`}>
                <ArrowDownLeft className="size-4 mx-auto mb-1" /> Giriş
              </button>
              <button onClick={() => setTxForm(f => ({ ...f, direction: "out" }))} className={`flex-1 rounded-xl border p-2.5 text-sm font-medium transition-colors ${txForm.direction === "out" ? "bg-red-100 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-card"}`}>
                <ArrowUpRight className="size-4 mx-auto mb-1" /> Çıkış
              </button>
            </div>
            <div><Label>Açıklama *</Label><Input placeholder="İşlem açıklaması" value={(txForm.desc as string) ?? ""} onChange={e => setTxForm(f => ({ ...f, desc: e.target.value }))} /></div>
            <div><Label>Tutar (TL) *</Label><Input type="number" placeholder="0.00" value={(txForm.amount as unknown as string) ?? ""} onChange={e => setTxForm(f => ({ ...f, amount: Number(e.target.value) as unknown as never }))} /></div>
            <div><Label>İşlem Tipi</Label>
              <Select value={txForm.type ?? "diger"} onValueChange={v => setTxForm(f => ({ ...f, type: v as TxType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TX_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tarih</Label><Input type="date" value={(txForm.date as string) ?? todayISO()} onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))} /></div>
            <Button className="w-full" onClick={addTx}>İşlemi Kaydet</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
