import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Saha — Operasyon ve Finans Yönetimi" },
      { name: "description", content: "Saha ustaları için cari, tahsilat, gider ve makbuz uygulaması." },
      { property: "og:title", content: "Saha — Operasyon ve Finans Yönetimi" },
      { property: "og:description", content: "Saha ustaları için cari, tahsilat, gider ve makbuz uygulaması." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/panel" : "/auth" });
  },
});
