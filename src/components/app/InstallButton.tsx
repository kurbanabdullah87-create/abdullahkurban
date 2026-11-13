import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function InstallButton() {
  const [event, setEvent] = useState<InstallEvent>();
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const listener = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", listener);
    return () => window.removeEventListener("beforeinstallprompt", listener);
  }, []);
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        className="w-full"
        onClick={async () => {
          if (event) {
            await event.prompt();
            setEvent(undefined);
          } else setHelp(!help);
        }}
      >
        <Download />
        Telefona yükle
      </Button>
      {help && (
        <p className="text-sm text-muted-foreground">
          Yayınlanan bağlantıyı açın. Android: tarayıcı menüsü → Uygulamayı yükle. iPhone: Safari →
          Paylaş → Ana Ekrana Ekle.
        </p>
      )}
    </div>
  );
}
