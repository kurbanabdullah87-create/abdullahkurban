import { useEffect, useState } from "react";
import type { Field } from "@/components/app/RecordFields";
import type { Customer } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";

export type Member = { id: string; username: string };

export function useMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  useEffect(() => {
    supabase.from("profiles").select("id,username").then(({ data }) => setMembers(data ?? []));
  }, []);
  return members;
}

/** "İş ekle" formunun alanları; İşler ve Randevu sayfaları ortak kullanır. */
export function jobFields(customers: Customer[], members: Member[]): Field[] {
  return [
    { key: "title", label: "İş adı", required: true },
    { key: "customer_id", label: "Müşteri", options: customers.map((c) => ({ value: c.id, label: c.name })) },
    { key: "owner_id", label: "Görevli", options: members.map((m) => ({ value: m.id, label: m.username })) },
    { key: "date", label: "Randevu tarihi", type: "date", required: true },
    { key: "time", label: "Başlangıç saati (çakışma kontrolü için)", type: "time" },
    { key: "planned_hours", label: "Tahmini süre (saat)", type: "number" },
    { key: "address", label: "İş adresi" },
    { key: "hourly_rate", label: "Saatlik ücret (TL)", type: "number" },
    { key: "price", label: "Sabit iş ücreti (TL)", type: "number" },
    { key: "material_cost", label: "Malzeme maliyeti (TL)", type: "number" },
    {
      key: "vat_rate",
      label: "KDV",
      options: [
        { value: "0", label: "Yok" },
        { value: "10", label: "%10" },
        { value: "20", label: "%20" },
      ],
    },
    { key: "notes", label: "İş notu" },
  ];
}
