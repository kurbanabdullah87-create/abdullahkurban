import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Pencil,
  Plus,
  Banknote,
  Download,
  MessageCircle,
  ArrowLeft,
  Phone,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CustomerForm } from "@/components/app/forms/CustomerForm";
import { TransactionForm } from "@/components/app/forms/TransactionForm";
import { MessageSheet } from "@/components/app/MessageSheet";
import { useCustomers, useTransactions } from "@/lib/data";
import { customerBalance, formatDate, formatTL, todayISO, type Tx } from "@/lib/finance";
import { buildReceipt, shareOrDownload } from "@/lib/receipt";
import { pageHead, useRecords } from "@/lib/work";
import { buildStatementText } from "@/lib/statement";
import { whatsappLink } from "@/lib/templates";
export const Route = createFileRoute("/_authenticated/cari/$id")({
  head: () => pageHead("Müşteri Ekstresi", "Müşteri hesabı, parçalı tahsilatlar ve makbuzlar."),
  component: CustomerDetail,
});
function CustomerDetail() {
  const { id } = Route.useParams();
  const customers = useCustomers();
  const txs = useTransactions();
  const settings = useRecords("settings");
  const c = customers.data?.find((c) => c.id === id);
  const rows = (txs.data ?? []).filter((t) => t.customer_id === id);
  const balance = customerBalance(rows);
  const [edit, setEdit] = useState(false);
  const [kind, setKind] = useState<"debt" | "payment">("debt");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(false);
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  async function receipt(tx: Tx) {
    if (!c) return;
    setBusy(true);
    try {
      setFile(
        await buildReceipt({
          business: String(settings.data?.[0]?.payload.business ?? "Saha"),
          profile: settings.data?.[0]?.payload,
          customer: c,
          tx,
          balance,
        }),
      );
      toast.success("Makbuz hazır");
    } catch {
      toast.error("Makbuz oluşturulamadı");
    } finally {
      setBusy(false);
    }
  }
  if (!c)
    return (
      <p className="py-8 text-muted-foreground">
        {customers.isLoading ? "Yükleniyor…" : "Müşteri bulunamadı."}
      </p>
    );
  const last = rows[0];
  const vars = {
    "Müşteri Adı": c.name,
    Tarih: formatDate(last?.occurred_on ?? todayISO()),
    "Kalan Tutar": formatTL(balance),
    "Toplam Tutar": formatTL(
      rows.filter((t) => t.kind === "debt").reduce((s, t) => s + t.amount, 0),
    ),
    "Ödenen Tutar": formatTL(last?.kind === "payment" ? last.amount : 0),
    "İş Türü": last?.description ?? "",
    "İş Detayı": last?.description ?? "",
    "Malzeme Tutarı": formatTL(last?.material_cost ?? 0),
    "İşçilik Tutarı": formatTL((last?.amount ?? 0) - (last?.material_cost ?? 0)),
  };
  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/cari">
          <ArrowLeft />
          Cari hesaplar
        </Link>
      </Button>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold">{c.name}</h1>
          <p className="text-sm text-muted-foreground">{"★".repeat(c.rating ?? 0)}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Müşteriyi düzenle"
          onClick={() => setEdit(true)}
        >
          <Pencil />
        </Button>
      </div>
      <p className="break-words text-sm text-muted-foreground">{c.address}</p>
      <p className="text-sm">{c.notes}</p>
      <div className="flex flex-wrap gap-2">
        {c.phone && (
          <>
            <Button asChild variant="outline" size="sm">
              <a href={`tel:${c.phone}`}>
                <Phone />
                {c.phone}
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={whatsappLink(c.phone, buildStatementText({ customer: c, txs: rows, profile: settings.data?.[0]?.payload }))} target="_blank" rel="noreferrer">
                <MessageCircle />
                Ekstreyi WhatsApp'a gönder
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMessage(true)}>
              <MessageCircle />
              Mesaj gönder
            </Button>
          </>
        )}
        {c.address && (
          <Button asChild variant="outline" size="sm">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MapPin />
              Adres
            </a>
          </Button>
        )}
      </div>
      <div className="border-y py-5">
        <p className="text-sm text-muted-foreground">Kalan bakiye</p>
        <p className="num text-3xl text-warning">{formatTL(balance)}</p>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => {
            setKind("debt");
            setOpen(true);
          }}
        >
          <Plus />
          Borç
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setKind("payment");
            setOpen(true);
          }}
        >
          <Banknote />
          Tahsilat
        </Button>
      </div>
      {file && (
        <Button className="w-full" onClick={() => void shareOrDownload(file)}>
          <Download />
          Makbuzu indir / paylaş
        </Button>
      )}
      <h2 className="font-semibold">Hesap ekstresi</h2>
      {rows.map((t) => (
        <div className="flex items-center gap-3 border-b py-3" key={t.id}>
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm">
              {t.description || (t.kind === "debt" ? "İş ücreti" : "Tahsilat")}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDate(t.occurred_on)} · {t.method ?? "Borç"}
            </p>
          </div>
          <span className={`num text-sm ${t.kind === "debt" ? "text-warning" : "text-success"}`}>
            {t.kind === "debt" ? "+" : "−"}
            {formatTL(t.amount)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            title="Makbuz oluştur"
            aria-label="Makbuz oluştur"
            disabled={busy}
            onClick={() => void receipt(t)}
          >
            <Download />
          </Button>
        </div>
      ))}
      {!rows.length && <p className="text-muted-foreground">Henüz işlem yok.</p>}
      <CustomerForm open={edit} onOpenChange={setEdit} customer={c} />
      <TransactionForm open={open} onOpenChange={setOpen} customerId={id} defaultKind={kind} />
      <MessageSheet open={message} onOpenChange={setMessage} phone={c.phone ?? ""} vars={vars} />
    </div>
  );
}
