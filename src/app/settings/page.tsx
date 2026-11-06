"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { formatTime } from "@/lib/dates";
import { CALC_METHODS, getPrayerTimes, PRAYER_ORDER } from "@/lib/prayer";
import { PRAYER_LABEL, type Profile } from "@/lib/types";

const AVATARS = ["🌱", "🌸", "🌙", "⭐", "🦋", "🐝", "🌻", "🍀", "🔥", "💎", "🦁", "🐢", "🕊️", "🌊", "🏔️", "📚"];

const TIMEZONES = [
  "Africa/Cairo",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Asia/Kuwait",
  "Asia/Qatar",
  "Asia/Amman",
  "Africa/Casablanca",
  "Africa/Tunis",
  "Africa/Algiers",
  "Europe/Istanbul",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
];

type Form = Pick<
  Profile,
  | "display_name"
  | "gender"
  | "avatar_emoji"
  | "show_on_leaderboard"
  | "timezone"
  | "prayer_mode"
  | "latitude"
  | "longitude"
  | "city_name"
  | "calc_method"
  | "madhab"
  | "inactivity_days"
>;

export default function SettingsPage() {
  const { profile, refreshProfile, g } = useAuth();
  const [form, setForm] = useState<Form | null>(() => {
    if (!profile) return null;
    const { display_name, gender, avatar_emoji, show_on_leaderboard, timezone, prayer_mode, latitude, longitude, city_name, calc_method, madhab, inactivity_days } = profile;
    return { display_name, gender, avatar_emoji, show_on_leaderboard, timezone, prayer_mode, latitude, longitude, city_name, calc_method, madhab, inactivity_days };
  });
  const [status, setStatus] = useState("");
  const [locating, setLocating] = useState(false);
  const [notifPerm, setNotifPerm] = useState<string>(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  if (!profile || !form) return null;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });

  function locate() {
    if (!navigator.geolocation) return setStatus("المتصفح مش بيدعم تحديد الموقع");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) =>
          f && {
            ...f,
            latitude: Number(pos.coords.latitude.toFixed(4)),
            longitude: Number(pos.coords.longitude.toFixed(4)),
            city_name: f.city_name || "موقعي الحالي",
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || f.timezone,
          },
        );
        setLocating(false);
      },
      () => {
        setStatus(`مقدرناش نحدد الموقع، ${g("اسمحي بالإذن أو اكتبي", "اسمح بالإذن أو اكتب")} الإحداثيات بإيدك`);
        setLocating(false);
      },
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus("");
    const { error } = await supabase
      .from("profiles")
      .update({ ...form, display_name: form!.display_name.trim() || "مستخدم" })
      .eq("id", profile!.id);
    if (error) return setStatus(error.message);
    await refreshProfile();
    setStatus("اتحفظ ✓");
  }

  async function askNotifications() {
    const p = await Notification.requestPermission();
    setNotifPerm(p);
  }

  const preview = form.prayer_mode ? getPrayerTimes({ ...profile, ...form }) : null;

  return (
    <form onSubmit={save} className="space-y-6">
      <h1 className="text-2xl font-extrabold">⚙️ الإعدادات</h1>

      <section className="card space-y-4">
        <h2 className="font-extrabold">حسابي</h2>
        <div>
          <label className="label">الاسم</label>
          <input className="input" value={form.display_name} maxLength={40} onChange={(e) => set("display_name", e.target.value)} />
        </div>
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
                onClick={() => set("gender", v)}
                className={`btn ${form.gender === v ? "border-brand bg-brand-soft text-brand" : ""}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="label">الصورة</p>
          <div className="flex flex-wrap gap-1">
            {AVATARS.map((a) => (
              <button
                type="button"
                key={a}
                onClick={() => set("avatar_emoji", a)}
                className={`h-10 w-10 rounded-lg text-xl ${form.avatar_emoji === a ? "bg-brand-soft ring-2 ring-brand" : "hover:bg-line/50"}`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <Toggle label="أظهر في قائمة الشرف" checked={form.show_on_leaderboard} onChange={(v) => set("show_on_leaderboard", v)} />
        <div>
          <label className="label">المنطقة الزمنية</label>
          <select className="input" dir="ltr" value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
            {[...new Set([form.timezone, ...TIMEZONES])].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-extrabold">🕌 ترتيب المهام على مواعيد الصلاة</h2>
        <Toggle label="رتّب مهامي حوالين الصلوات" checked={form.prayer_mode} onChange={(v) => set("prayer_mode", v)} />

        {form.prayer_mode && (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <button type="button" className="btn" onClick={locate} disabled={locating}>
                📍 {locating ? "بنحدد..." : g("حددي موقعي", "حدد موقعي")}
              </button>
              <div className="flex-1">
                <label className="label">اسم المدينة</label>
                <input className="input" value={form.city_name ?? ""} onChange={(e) => set("city_name", e.target.value)} placeholder="القاهرة" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">خط العرض</label>
                <input
                  className="input"
                  dir="ltr"
                  type="number"
                  step="any"
                  value={form.latitude ?? ""}
                  onChange={(e) => set("latitude", e.target.value === "" ? null : Number(e.target.value))}
                  placeholder="30.0444"
                />
              </div>
              <div>
                <label className="label">خط الطول</label>
                <input
                  className="input"
                  dir="ltr"
                  type="number"
                  step="any"
                  value={form.longitude ?? ""}
                  onChange={(e) => set("longitude", e.target.value === "" ? null : Number(e.target.value))}
                  placeholder="31.2357"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">طريقة الحساب</label>
                <select className="input" value={form.calc_method} onChange={(e) => set("calc_method", e.target.value)}>
                  {CALC_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">حساب العصر</label>
                <select className="input" value={form.madhab} onChange={(e) => set("madhab", e.target.value as Form["madhab"])}>
                  <option value="shafi">الجمهور (شافعي/مالكي/حنبلي)</option>
                  <option value="hanafi">حنفي</option>
                </select>
              </div>
            </div>
            {preview && (
              <div className="grid grid-cols-3 gap-1 text-center text-xs sm:grid-cols-6">
                {PRAYER_ORDER.map((p) => (
                  <div key={p} className="rounded-lg bg-brand-soft py-1.5">
                    <div className="text-muted">{PRAYER_LABEL[p]}</div>
                    <div className="font-bold">{formatTime(preview[p])}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="card space-y-4">
        <h2 className="font-extrabold">🔔 التنبيهات</h2>
        <div>
          <label className="label">نبهني لو مسجلتش حاجة بقالي</label>
          <select className="input" value={form.inactivity_days} onChange={(e) => set("inactivity_days", Number(e.target.value))}>
            {[1, 2, 3, 5, 7, 14].map((d) => (
              <option key={d} value={d}>
                {d} {d === 1 ? "يوم" : d <= 10 ? "أيام" : "يوم"}
              </option>
            ))}
          </select>
        </div>
        <div className="rounded-xl bg-line/30 p-3 text-sm">
          <p className="mb-2">التنبيهات بتظهر جوه التطبيق. وطول ما التطبيق مفتوح {g("تقدري كمان تاخدي", "تقدر كمان تاخد")} إشعار من المتصفح لما ييجي ميعاد مهمة.</p>
          {notifPerm === "granted" && <p className="font-semibold text-brand">✓ إشعارات المتصفح متفعلة</p>}
          {notifPerm === "default" && (
            <button type="button" className="btn" onClick={askNotifications}>
              {g("فعّلي", "فعّل")} إشعارات المتصفح
            </button>
          )}
          {notifPerm === "denied" && <p className="text-muted">الإشعارات مقفولة من إعدادات المتصفح.</p>}
          {notifPerm === "unsupported" && <p className="text-muted">المتصفح ده مش بيدعم الإشعارات.</p>}
        </div>
      </section>

      <div className="sticky bottom-20 flex items-center gap-3 md:bottom-4">
        <button className="btn btn-primary flex-1 shadow-lg">حفظ الإعدادات</button>
        {status && <span className="rounded-lg bg-surface px-3 py-2 text-sm shadow">{status}</span>}
      </div>
    </form>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-sm font-semibold">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 rounded-full transition ${checked ? "bg-brand" : "bg-line"}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "start-6" : "start-1"}`} />
      </button>
    </label>
  );
}
