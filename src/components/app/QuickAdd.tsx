import { useState } from "react";
import { UserPlus, Receipt, HandCoins } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { CustomerForm } from "./forms/CustomerForm";
import { ExpenseForm } from "./forms/ExpenseForm";
import { TransactionForm } from "./forms/TransactionForm";

type Kind = null | "customer" | "expense" | "tx";

export function QuickAdd({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [kind, setKind] = useState<Kind>(null);
  const items = [
    { k: "tx" as const, label: "Borç / Tahsilat", icon: HandCoins },
    { k: "customer" as const, label: "Yeni müşteri", icon: UserPlus },
    { k: "expense" as const, label: "Gider ekle", icon: Receipt },
  ];
  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Hızlı ekle</DrawerTitle>
          </DrawerHeader>
          <div className="grid grid-cols-3 gap-3 px-4 pb-8">
            {items.map((i) => (
              <button
                key={i.k}
                onClick={() => {
                  onOpenChange(false);
                  setKind(i.k);
                }}
                className="flex flex-col items-center gap-2 rounded-2xl bg-secondary p-4 text-sm font-medium active:scale-95"
              >
                <i.icon className="size-6 text-primary" />
                {i.label}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
      <CustomerForm open={kind === "customer"} onOpenChange={(o) => !o && setKind(null)} />
      <ExpenseForm open={kind === "expense"} onOpenChange={(o) => !o && setKind(null)} />
      <TransactionForm open={kind === "tx"} onOpenChange={(o) => !o && setKind(null)} />
    </>
  );
}
