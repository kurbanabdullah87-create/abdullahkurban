import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeUsername, USERNAME_RE, usernameToEmail } from "@/lib/username";
export const createApprentice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ username: z.string(), password: z.string().min(6), name: z.string().min(1) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: master, error } = await context.supabase.rpc("is_team_usta");
    if (error || !master) throw new Error("Yalnızca Usta ekleyebilir.");
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("team_id")
      .eq("id", context.userId)
      .single();
    if (!profile) throw new Error("Ekip bulunamadı");
    const username = normalizeUsername(data.username);
    if (!USERNAME_RE.test(username)) throw new Error("Kullanıcı adı geçersiz");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: usernameToEmail(username),
      password: data.password,
      email_confirm: true,
      user_metadata: { username, display_name: data.name },
    });
    if (createError || !created.user) throw new Error(createError?.message ?? "Hesap açılamadı");
    try {
      const a = await supabaseAdmin
        .from("profiles")
        .update({ team_id: profile.team_id })
        .eq("id", created.user.id);
      if (a.error) throw a.error;
      const b = await supabaseAdmin
        .from("user_roles")
        .update({ role: "cirak" })
        .eq("user_id", created.user.id);
      if (b.error) throw b.error;
    } catch (e) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error("Çırak eklenemedi");
    }
    return { id: created.user.id };
  });
