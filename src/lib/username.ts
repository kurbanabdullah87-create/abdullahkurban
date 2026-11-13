
export const USERNAME_RE = /^[a-z0-9._-]{3,24}$/;

const TR_MAP: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
};

export function normalizeUsername(input: string) {
  return input
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, (c) => TR_MAP[c] ?? c);
}

function getSupabaseEmailDomain() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error("VITE_SUPABASE_URL tanımlanmamış.");
  }

  try {
    return new URL(supabaseUrl).hostname;
  } catch {
    throw new Error("Supabase proje adresi geçersiz.");
  }
}

export function usernameToEmail(username: string) {
  return `${normalizeUsername(username)}@${getSupabaseEmailDomain()}`;
}
