import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cachedRead } from "@/lib/offline";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    networkMode: "always",
    queryFn: () => cachedRead("me", async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      const isUsta = (roles ?? []).some((r) => r.role === "usta");
      return { id: u.user.id, profile, isUsta };
    }),
    staleTime: 60_000,
  });
}
