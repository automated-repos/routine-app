// Supabase بيحتاج إيميل، فبنحوّل اسم المستخدم لإيميل داخلي محدش بيشوفه ولا بيتبعتله حاجة
const DOMAIN = process.env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN || "routine.local";

export const USERNAME_RULE = /^[a-z0-9_.]{3,20}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${DOMAIN}`;
}
