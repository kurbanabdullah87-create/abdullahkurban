import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { HardHat, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeUsername, USERNAME_RE, usernameToEmail } from "@/lib/username";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Giriş — Saha" },
      { name: "description", content: "Kullanıcı adı ve şifrenle Saha'ya giriş yap." },
      { property: "og:title", content: "Giriş — Saha" },
      { property: "og:description", content: "Kullanıcı adı ve şifrenle Saha'ya giriş yap." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/panel" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const u = normalizeUsername(username);
    if (!USERNAME_RE.test(u)) {
      toast.error("Kullanıcı adı 3-24 karakter; harf, rakam, nokta, tire içerebilir.");
      return;
    }
    if (password.length < 6) {
      toast.error("Şifre en az 6 karakter olmalı.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: usernameToEmail(u),
          password,
          options: { data: { username: u, display_name: username.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          const r = await supabase.auth.signInWithPassword({ email: usernameToEmail(u), password });
          if (r.error) throw r.error;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(u), password });
        if (error) throw error;
      }
      navigate({ to: "/panel", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/already registered|already exists/i.test(msg)) toast.error("Bu kullanıcı adı alınmış.");
      else if (/invalid login/i.test(msg)) toast.error("Kullanıcı adı veya şifre hatalı.");
      else toast.error("İşlem başarısız: " + msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <HardHat className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Saha</h1>
            <p className="text-sm text-muted-foreground">Operasyon & Finans</p>
          </div>
        </div>
        <h2 className="mb-6 text-3xl font-bold">{mode === "login" ? "Tekrar hoş geldin" : "Hesap oluştur"}</h2>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="u">Kullanıcı adı</Label>
            <Input id="u" autoCapitalize="none" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className="h-12" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p">Şifre</Label>
            <Input
              id="p"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12"
            />
          </div>
          <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {mode === "login" ? "Giriş yap" : "Kayıt ol"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-6 w-full text-center text-sm text-muted-foreground"
        >
          {mode === "login" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var mı? Giriş yap"}
        </button>
      </div>
    </main>
  );
}
