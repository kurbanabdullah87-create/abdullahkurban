import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Payload } from "@/lib/work";
export interface Field {
  key: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
}
export function RecordFields({
  fields,
  value,
  onChange,
}: {
  fields: Field[];
  value: Payload;
  onChange: (p: Payload) => void;
}) {
  return (
    <>
      {fields.map((f) => (
        <div className="space-y-2" key={f.key}>
          <Label htmlFor={f.key}>{f.label}</Label>
          {f.options ? (
            <select
              id={f.key}
              required={f.required}
              className="h-11 w-full rounded-md border bg-secondary px-3 text-sm"
              value={String(value[f.key] ?? "")}
              onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
            >
              <option value="">Seçin</option>
              {f.options.map((o) => (
                <option value={o.value} key={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id={f.key}
              required={f.required}
              type={f.type ?? "text"}
              step={f.type === "number" ? "any" : undefined}
              min={f.type === "number" ? 0 : undefined}
              value={String(value[f.key] ?? "")}
              onChange={(e) =>
                onChange({
                  ...value,
                  [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value,
                })
              }
            />
          )}
        </div>
      ))}
    </>
  );
}
