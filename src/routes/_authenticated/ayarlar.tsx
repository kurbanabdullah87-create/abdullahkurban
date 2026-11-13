import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Save, UserPlus, LogOut, Fingerprint, LockKeyhole, Award } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InstallButton } from "@/components/app/InstallButton";
import { useMe } from "@/hooks/use-me";
import { useRecords, useSaveRecord, pageHead, type Payload } from "@/lib/work";
import { useTemplates, useUpsert, useTransactions } from "@/lib/data";
import { createApprentice } from "@/lib/team.functions";
import { savePin, registerBiometric } from "@/lib/device-lock";
import { supabase } from "@/integrations/supabase/client";
import { todayISO, formatTL } from "@/lib/finance";
import { pendingCount, flushQueue } from "@/lib/offline";
export const Route = createFileRoute("/_authenticated/ayarlar")({
  head: () => pageHead("Ayarlar", "Ekip, mesaj şablonları ve cihaz güvenliği."),
  component: Settings,
});
function Settings() {
  const me = useMe();
  const settings = useRecords("settings");
  const jobs = useRecords("job");
  const txs = useTransactions();
  const templates = useTemplates();
  const updateTemplate = useUpsert("message_templates");
  const save = useSaveRecord("settings");
  const create = createServerFnHook();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState<Payload>({ business: "Saha", target: 0 });
  const [pin, setPin] = useState("");
  const [team, setTeam] = useState({ username: "", password: "", name: "" });
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (settings.data?.[0]) setForm(settings.data[0].payload);
  }, [settings.data]);
  useEffect(() => {
    void pendingCount()
      .then(setCount)
      .catch(() => {});
  }, []);
  const completed = (jobs.data ?? []).filter((j) => j.payload.status === "Tamamlandı").length;
  const income = (txs.data ?? [])
    .filter((t) => t.kind === "payment" && t.occurred_on.startsWith(todayISO().slice(0, 7)))
    .reduce((s, t) => s + t.amount, 0);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Ayarlar</h1>
      <div className="border-b pb-4">
        <p className="font-semibold">
          {me.data?.profile?.display_name || me.data?.profile?.username}
        </p>
        <p className="text-sm text-muted-foreground">{me.data?.isUsta ? "Usta" : "Çırak"}</p>
      </div>
      <InstallButton />
      {me.data?.isUsta && (
        <>
          <section className="space-y-3">
            <h2 className="font-semibold">İşletme</h2>
            <Label htmlFor="business">Makbuz işletme adı</Label>
            <Input
              id="business"
              value={String(form.business ?? "")}
              onChange={(e) => setForm({ ...form, business: e.target.value })}
            />
            {([
              ["address", "Makbuz adresi"],
              ["phone", "İşletme telefonu"],
              ["tax", "Vergi dairesi / numarası"],
              ["iban", "IBAN"],
            ] as const).map(([k, l]) => (
              <div className="space-y-2" key={k}>
                <Label htmlFor={k}>{l}</Label>
                <Input id={k} value={String(form[k] ?? "")} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </div>
            ))}
            <Label htmlFor="target">Aylık ciro hedefi (TL)</Label>
            <Input
              id="target"
              type="number"
              min="0"
              value={String(form.target ?? 0)}
              onChange={(e) => setForm({ ...form, target: Number(e.target.value) })}
            />
            <Button
              disabled={save.isPending}
              onClick={() => save.mutate({ id: settings.data?.[0]?.id, payload: form })}
            >
              <Save />
              Kaydet
            </Button>
          </section>
          <section className="space-y-3 border-t pt-5">
            <h2 className="font-semibold">Çırak / eleman hesabı</h2>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await create({ data: team });
                  setTeam({ username: "", password: "", name: "" });
                  toast.success("Çırak hesabı açıldı");
                  qc.invalidateQueries();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Hesap açılamadı");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Label htmlFor="member-name">Ad Soyad</Label>
              <Input
                id="member-name"
                value={team.name}
                onChange={(e) => setTeam({ ...team, name: e.target.value })}
                required
              />
              <Label htmlFor="member-u">Kullanıcı adı</Label>
              <Input
                id="member-u"
                value={team.username}
                onChange={(e) => setTeam({ ...team, username: e.target.value })}
                required
              />
              <Label htmlFor="member-p">Şifre</Label>
              <Input
                id="member-p"
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={team.password}
                onChange={(e) => setTeam({ ...team, password: e.target.value })}
                required
              />
              <Button disabled={busy}>
                <UserPlus />
                Hesap oluştur
              </Button>
            </form>
          </section>
          <section className="space-y-3 border-t pt-5">
            <h2 className="font-semibold">Mesaj şablonları</h2>
            {templates.data?.map((t) => (
              <TemplateEditor
                key={t.id}
                template={t}
                onSave={(body) => updateTemplate.mutate({ id: t.id, body })}
              />
            ))}
          </section>
          <section className="space-y-3 border-t pt-5">
            <h2 className="font-semibold">Başarılar</h2>
            <div className="flex items-center gap-3">
              <Award className={completed >= 100 ? "text-primary" : "text-muted-foreground"} />
              <div>
                <p>100. İş Tamamlandı</p>
                <p className="text-xs text-muted-foreground">{completed} / 100</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Award
                className={
                  Number(form.target) > 0 && income >= Number(form.target)
                    ? "text-primary"
                    : "text-muted-foreground"
                }
              />
              <div>
                <p>Aylık Ciro Hedefi</p>
                <p className="text-xs text-muted-foreground">
                  {formatTL(income)} / {formatTL(Number(form.target ?? 0))}
                </p>
              </div>
            </div>
          </section>
        </>
      )}
      <section className="space-y-3 border-t pt-5">
        <h2 className="font-semibold">Cihaz kilidi</h2>
        <Label htmlFor="pin">4 haneli PIN</Label>
        <Input
          id="pin"
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={async () => {
              if (!me.data) return;
              try {
                await savePin(me.data.id, pin);
                setPin("");
                toast.success("PIN etkinleştirildi");
                window.dispatchEvent(new Event("saha-lock"));
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "PIN kaydedilemedi");
              }
            }}
          >
            <LockKeyhole />
            PIN etkinleştir
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              if (!me.data) return;
              try {
                await registerBiometric(me.data.id);
                toast.success("Biyometrik cihaz kilidi etkinleştirildi");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Cihaz desteklemiyor");
              }
            }}
          >
            <Fingerprint />
            FaceID / Parmak izi
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (me.data) {
                localStorage.removeItem("saha-lock:" + me.data.id);
                localStorage.removeItem("saha-biometric:" + me.data.id);
                toast.success("Cihaz kilidi kapatıldı");
              }
            }}
          >
            Kilidi kapat
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Cihaz kilidi mevcut oturumu korur; yeni cihazda kullanıcı adı ve şifre gerekir.
        </p>
      </section>
      <section className="space-y-2 border-t pt-5">
        <h2 className="font-semibold">Senkronizasyon</h2>
        <p className="text-sm text-muted-foreground">Bekleyen kayıt: {count}</p>
        <Button
          variant="secondary"
          onClick={async () => {
            await flushQueue();
            setCount(await pendingCount());
            qc.invalidateQueries();
          }}
        >
          Bekleyenleri gönder
        </Button>
      </section>
      <Button
        variant="destructive"
        className="w-full"
        onClick={async () => {
          await supabase.auth.signOut();
          qc.clear();
          navigate({ to: "/auth" });
        }}
      >
        <LogOut />
        Çıkış yap
      </Button>
    </div>
  );
}
function createServerFnHook() {
  return useServerFn(createApprentice);
}
function TemplateEditor({
  template,
  onSave,
}: {
  template: { title: string; body: string };
  onSave: (body: string) => void;
}) {
  const [body, setBody] = useState(template.body);
  return (
    <details className="border-b pb-3">
      <summary className="cursor-pointer text-sm font-medium">{template.title}</summary>
      <Textarea className="my-3" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      <Button variant="secondary" size="sm" onClick={() => onSave(body)}>
        <Save />
        Kaydet
      </Button>
    </details>
  );
}
