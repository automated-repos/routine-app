import { createClient } from "@supabase/supabase-js";

// بنشيل المسافات وعلامات التنصيص لو اتنسخت بالغلط مع القيمة
function clean(v: string | undefined) {
  return (v || "").trim().replace(/^["']|["']$/g, "").trim();
}

const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, "");
const anonKey = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function isValidUrl(v: string) {
  try {
    return ["https:", "http:"].includes(new URL(v).protocol);
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = Boolean(isValidUrl(url) && anonKey);

// المفتاح السري ممنوع في المتصفح، Supabase بيرفضه
function legacyRole(key: string): string | null {
  // المفاتيح القديمة JWT، والدور مكتوب جواها
  if (!key.startsWith("eyJ")) return null;
  try {
    const payload = key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)).role ?? null;
  } catch {
    return null;
  }
}
export const isSecretKey = anonKey.startsWith("sb_secret_") || legacyRole(anonKey) === "service_role";

// يحوّل أخطاء Supabase التقنية لرسالة مفهومة
export function friendlyError(message: string): string {
  if (/invalid api key|no api key|secret api key|apikey/i.test(message))
    return "مفتاح Supabase في إعدادات الموقع غلط. لازم يكون الـ publishable / anon key، وبعد تعديله يتعمل deploy تاني.";
  if (/failed to fetch|network|load failed/i.test(message)) return "مش قادرين نوصل للسيرفر. اتأكد من النت وجرب تاني.";
  return message;
}

// المفتاح ده public عادي، الحماية كلها من RLS في قاعدة البيانات
export const supabase = createClient(isSupabaseConfigured ? url : "http://localhost:54321", anonKey || "missing-key", {
  auth: { persistSession: true, autoRefreshToken: true },
});
