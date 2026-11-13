import { useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Rec {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
}
type Ctor = new () => Rec;

/** Web Speech API ile sesle not: konuşulan Türkçe metni onText ile ekler. */
export function VoiceNoteButton({ onText }: { onText: (text: string) => void }) {
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  const rec = useRef<Rec | null>(null);
  const [on, setOn] = useState(false);
  if (!Ctor) return null;

  function toggle() {
    if (on) return void rec.current?.stop();
    const r = new Ctor!();
    r.lang = "tr-TR";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res?.isFinal && res[0]) onText(res[0].transcript.trim());
      }
    };
    r.onerror = (e) => toast.error(e.error === "not-allowed" ? "Mikrofon izni verilmedi" : "Ses tanıma hatası: " + e.error);
    r.onend = () => setOn(false);
    rec.current = r;
    r.start();
    setOn(true);
  }
  return (
    <Button type="button" variant={on ? "destructive" : "secondary"} className="h-11 w-full" onClick={toggle}>
      {on ? <Square /> : <Mic />}
      {on ? "Dinleniyor… durdurmak için dokun" : "Sesle not ekle"}
    </Button>
  );
}
