import { useEffect, useRef } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
export function CodeScanner({
  onRead,
  onClose,
}: {
  onRead: (code: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let control: IScannerControls | undefined;
    let stopped = false;
    const reader = new BrowserMultiFormatReader();
    if (video.current)
      reader
        .decodeFromVideoDevice(undefined, video.current, (result) => {
          if (result) {
            control?.stop();
            onRead(result.getText());
          }
        })
        .then((c) => {
          control = c;
          if (stopped) c.stop();
        })
        .catch(() => {
          toast.error("Kamera açılamadı. Kamera iznini kontrol edin.");
          onClose();
        });
    return () => {
      stopped = true;
      control?.stop();
    };
  }, []);
  return (
    <div className="space-y-2">
      <video ref={video} className="aspect-video w-full rounded-md bg-secondary" />
      <Button variant="secondary" onClick={onClose}>
        Kapat
      </Button>
    </div>
  );
}
