import { useEffect, useState } from "react";
import { MessageCircle, MessageSquare } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTemplates } from "@/lib/data";
import { fillTemplate, smsLink, whatsappLink } from "@/lib/templates";
import { cn } from "@/lib/utils";

export function MessageSheet({
  open,
  onOpenChange,
  phone,
  vars,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  phone: string;
  vars: Record<string, string>;
}) {
  const templates = useTemplates();
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setText("");
    }
  }, [open]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerHeader>
          <DrawerTitle>Mesaj gönder</DrawerTitle>
        </DrawerHeader>
        <div className="space-y-4 overflow-y-auto px-4 pb-8">
          <div className="flex flex-wrap gap-2">
            {templates.data?.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setSelected(t.id);
                  setText(fillTemplate(t.body, vars));
                }}
                className={cn("rounded-full border px-3 py-1.5 text-xs font-medium", selected === t.id ? "border-primary bg-accent text-primary" : "bg-secondary")}
              >
                {t.title}
              </button>
            ))}
          </div>
          <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Bir şablon seçin veya yazın" />
          <p className="text-xs text-muted-foreground">Köşeli parantezde kalan alanları göndermeden önce düzenleyin.</p>
          <div className="grid grid-cols-2 gap-3">
            <Button asChild className="h-12" disabled={!text}>
              <a href={whatsappLink(phone, text)} target="_blank" rel="noreferrer">
                <MessageCircle /> WhatsApp
              </a>
            </Button>
            <Button asChild variant="secondary" className="h-12" disabled={!text}>
              <a href={smsLink(phone, text)}>
                <MessageSquare /> SMS
              </a>
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
