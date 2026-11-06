"use client";

import { useState } from "react";
import { friendlyError, supabase, withTimeout } from "@/lib/supabase";
import { normalizeUsername, USERNAME_RULE, usernameToEmail } from "@/lib/username";

function translateError(message: string): string {
  if (message === "Invalid login credentials") return "اسم المستخدم أو الباسورد غلط";
  if (/already registered|already exists/i.test(message)) return "اسم المستخدم ده محجوز، جرب اسم تاني";
  if (/Email not confirmed/i.test(message)) return "الحساب مستني تأكيد. لازم الأدمن يقفل Confirm email من إعدادات Supabase.";
  if (/Password should be/i.test(message)) return "الباسورد لازم يكون 6 حروف أو أرقام على الأقل";
  if (/invalid/i.test(message) && /email/i.test(message)) return "حصلت مشكلة في إنشاء الحساب، بلّغ الأدمن.";
  return friendlyError(message);
}

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const u = normalizeUsername(username);
    if (!USERNAME_RULE.test(u)) {
      return setError("اسم المستخدم من 3 لـ 20 حرف إنجليزي صغير أو أرقام أو _ أو . (من غير مسافات)");
    }
    if (mode === "signup" && !gender) return setError("اختار ذكر أو أنثى");
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await withTimeout(supabase.auth.signInWithPassword({ email: usernameToEmail(u), password }));
        if (error) setError(translateError(error.message));
      } else {
        const { data, error } = await withTimeout(supabase.auth.signUp({
          email: usernameToEmail(u),
          password,
          options: { data: { username: u, display_name: name.trim() || u, gender } },
        }));
        if (error) setError(translateError(error.message));
        else if (!data.session) setError(translateError("Email not confirmed"));
      }
    } catch (e) {
      setError(translateError((e as Error).message ?? String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-5xl">🌱</div>
          <h1 className="mt-2 text-2xl font-extrabold">روتيني</h1>
          <p className="text-sm text-muted">عادات صغيرة كل يوم = فرق كبير</p>
        </div>

        <div className="mb-4 grid grid-cols-2 rounded-xl bg-line/40 p-1 text-sm">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError("");
              }}
              className={`rounded-lg py-1.5 font-semibold ${mode === m ? "bg-surface shadow-sm" : "text-muted"}`}
            >
              {m === "login" ? "تسجيل دخول" : "حساب جديد"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">اسم المستخدم</label>
            <input
              className="input"
              dir="ltr"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="mona_99"
              required
            />
            {mode === "signup" && <p className="mt-1 text-xs text-muted">حروف إنجليزي صغيرة وأرقام و _ أو . (من 3 لـ 20)</p>}
          </div>
          {mode === "signup" && (
            <div>
              <label className="label">الاسم</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="منى" />
            </div>
          )}
          {mode === "signup" && (
            <div>
              <p className="label">النوع</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["male", "👨 ذكر"],
                    ["female", "👩 أنثى"],
                  ] as const
                ).map(([v, l]) => (
                  <button
                    type="button"
                    key={v}
                    onClick={() => setGender(v)}
                    className={`btn ${gender === v ? "border-brand bg-brand-soft text-brand" : ""}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="label">الباسورد</label>
            <input
              className="input"
              dir="ltr"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="rounded-lg bg-danger-soft p-2 text-sm text-danger">{error}</p>}
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? "..." : mode === "login" ? "دخول" : "إنشاء حساب"}
          </button>
          {mode === "login" && <p className="text-center text-xs text-muted">نسيت الباسورد؟ كلّم الأدمن يغيرهولك.</p>}
        </form>
      </div>
    </div>
  );
}
