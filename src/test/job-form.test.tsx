import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { JobFormBody } from "@/components/app/JobFormBody";
import type { Payload, WorkRecord } from "@/lib/work";

const eq = (id: string, name: string, seconds: number): WorkRecord => ({
  id, owner_id: "u", team_id: "t", kind: "equipment", created_at: "",
  payload: { name, maintenance_hours: 100, seconds, last_service_seconds: 0 },
});
const job = (id: string, payload: Payload): WorkRecord => ({ id, owner_id: "u", team_id: "t", kind: "job", created_at: "", payload });

function Harness({ jobs = [], initial = {} }: { jobs?: WorkRecord[]; initial?: Payload }) {
  const [form, setForm] = useState<Payload>({ title: "", date: "2026-11-14", ...initial });
  return <JobFormBody form={form} onChange={setForm} customers={[]} members={[]} equipment={[eq("m1", "Motopomp", 105 * 3600), eq("m2", "Jeneratör", 10 * 3600)]} jobs={jobs} />;
}

describe("İş formu: önce makine", () => {
  it("makine seçilmeden iş bilgileri açılmaz", () => {
    render(<Harness />);
    expect(screen.getByText(/makine seçildikten sonra açılır/i)).toBeTruthy();
    expect(screen.queryByLabelText("İş adı")).toBeNull();
  });
  it("Makinesiz iş seçilince form açılır", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("radio", { name: "Makinesiz iş" }));
    expect(screen.getByLabelText("İş adı")).toBeTruthy();
  });
  it("bakımı geçen makine seçilince kırmızı uyarı çıkar", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("radio", { name: /Motopomp/ }));
    expect(screen.getByLabelText("İş adı")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/Bakım zamanı geçti/);
  });
  it("aynı makine çakışan işte varsa çakışma uyarısı çıkar", () => {
    const other = job("j1", { title: "Kuyu işi", equipment_id: "m2", date: "2026-11-14", status: "Bekliyor" });
    render(<Harness jobs={[other]} initial={{ equipment_id: "m2", no_machine: false }} />);
    expect(screen.getByText(/Çakışma/).textContent).toMatch(/Kuyu işi/);
  });
});
