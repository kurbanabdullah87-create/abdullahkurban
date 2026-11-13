import { useEffect, useState } from "react";
import { LockKeyhole, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verifyPin, verifyBiometric } from "@/lib/device-lock";
import { supabase } from "@/integrations/supabase/client";
export function DeviceLock({ user }: { user: string }) {
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [bio, setBio] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [until, setUntil] = useState(0);
  useEffect(() => {
    function enable() {
      setBio(Boolean(localStorage.getItem("saha-biometric:" + user)));
      setLocked(
        Boolean(
          localStorage.getItem("saha-lock:" + user) ||
          localStorage.getItem("saha-biometric:" + user),
        ),
      );
    }
    enable();
    const lock = () => enable();
    let hiddenAt = 0;
    function visibility() {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 60000) enable();
    }
    window.addEventListener("saha-lock", lock);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("saha-lock", lock);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [user]);
  if (!locked) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-6">
      <form
        className="w-full max-w-xs space-y-5 text-center"
        onSubmit={async (e) => {
          e.preventDefault();
          if (Date.now() < until) {
            setError("Bir dakika sonra tekrar deneyin.");
            return;
          }
          if (await verifyPin(user, pin)) {
            setLocked(false);
            setPin("");
            setAttempts(0);
          } else {
            setError("PIN hatalı");
            setAttempts(attempts + 1);
            if (attempts >= 4) {
              setUntil(Date.now() + 60000);
              setAttempts(0);
            }
          }
        }}
      >
        <LockKeyhole className="mx-auto size-10 text-primary" />
        <h2 className="text-2xl font-bold">Saha kilitli</h2>
        <Input
          aria-label="Kilit PIN kodu"
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoFocus
        />
        <p className="text-destructive text-sm">{error}</p>
        <Button type="submit" className="w-full">
          Kilidi aç
        </Button>
        {bio && (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={async () => {
              try {
                if (await verifyBiometric(user)) setLocked(false);
              } catch {
                setError("Cihaz doğrulaması tamamlanmadı");
              }
            }}
          >
            <Fingerprint />
            Parmak izi / FaceID
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={() => void supabase.auth.signOut()}>
          Hesaptan çık
        </Button>
      </form>
    </div>
  );
}
