import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useCustomers, useExpenses, useTransactions } from "@/lib/data";
import { EXPENSE_LABELS, formatDate, formatTL } from "@/lib/finance";
import {useNavigate} from '@tanstack/react-router';
import {useRecords} from '@/lib/work';

export function GlobalSearch({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (customerId: string) => void }) {
  const customers = useCustomers();
  const txs = useTransactions();
  const expenses = useExpenses();
  const jobs=useRecords('job');const equipment=useRecords('equipment');const navigate=useNavigate();
  const nameOf = (id: string) => customers.data?.find((c) => c.id === id)?.name ?? "";

  const pick = (id: string) => {
    onOpenChange(false);
    onPick(id);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Ara…" />
      <CommandList>
        <CommandEmpty>Sonuç yok</CommandEmpty>
        <CommandGroup heading="İşler">{jobs.data?.map(j=><CommandItem key={j.id} value={`iş ${j.payload.title} ${j.payload.notes}`} onSelect={()=>{onOpenChange(false);navigate({to:'/isler'});}}>{j.payload.title}</CommandItem>)}</CommandGroup>
        <CommandGroup heading="Ekipman">{equipment.data?.map(j=><CommandItem key={j.id} value={`ekipman ${j.payload.name} ${j.payload.code}`} onSelect={()=>{onOpenChange(false);navigate({to:'/ekipman'});}}>{j.payload.name}</CommandItem>)}</CommandGroup>
        <CommandGroup heading="Müşteriler">
          {customers.data?.map((c) => (
            <CommandItem key={c.id} value={`m ${c.name} ${c.phone ?? ""} ${c.address ?? ""}`} onSelect={() => pick(c.id)}>
              {c.name}
              <span className="ml-auto text-xs text-muted-foreground">{c.phone}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="İşlemler">
          {txs.data?.slice(0, 200).map((t) => (
            <CommandItem key={t.id} value={`i ${nameOf(t.customer_id)} ${t.description ?? ""} ${t.amount}`} onSelect={() => pick(t.customer_id)}>
              {nameOf(t.customer_id)} · {t.description || (t.kind === "debt" ? "Borç" : "Tahsilat")}
              <span className="num ml-auto text-xs">{formatTL(t.amount)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Giderler">
          {expenses.data?.slice(0, 200).map((e) => (
            <CommandItem key={e.id} value={`g ${EXPENSE_LABELS[e.category]} ${e.description ?? ""} ${e.amount}`} onSelect={() => onOpenChange(false)}>
              {EXPENSE_LABELS[e.category]} · {e.description || formatDate(e.occurred_on)}
              <span className="num ml-auto text-xs">{formatTL(e.amount)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
