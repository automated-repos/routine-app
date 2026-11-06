"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { addDays, currentStreak, longestStreak, periodStart, todayIn } from "@/lib/dates";

interface StarRow {
  id: string;
  amount: number;
  reason: "completion" | "period_bonus" | "challenge" | "admin";
  note: string | null;
  created_at: string;
}

const REASON: Record<StarRow["reason"], string> = {
  completion: "تنفيذ عادة",
  period_bonus: "بونص تحقيق هدف",
  challenge: "بونص تحدي",
  admin: "من الأدمن",
};

const WEEKS = 16;

export default function ProfilePage() {
  const { profile, signOut, g } = useAuth();
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [total, setTotal] = useState(0);
  const [challengesWon, setChallengesWon] = useState(0);
  const [history, setHistory] = useState<StarRow[]>([]);

  const today = todayIn(profile?.timezone ?? "Africa/Cairo");
  // بداية الخريطة: أول سبت قبل 16 أسبوع
  const gridStart = periodStart("weekly", addDays(today, -(WEEKS - 1) * 7));

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [{ data: logs }, { count }, { count: won }, { data: stars }] = await Promise.all([
        supabase.rpc("my_activity", { p_from: addDays(today, -900) }),
        supabase.from("habit_logs").select("id", { count: "exact", head: true }),
        supabase
          .from("challenge_participants")
          .select("challenge_id", { count: "exact", head: true })
          .eq("user_id", profile.id)
          .eq("status", "completed"),
        supabase.from("stars_ledger").select("id, amount, reason, note, created_at").eq("user_id", profile.id).neq("reason", "completion").order("created_at", { ascending: false }).limit(15),
      ]);
      const m = new Map<string, number>();
      for (const r of (logs ?? []) as { log_date: string; n: number }[]) m.set(r.log_date, Number(r.n));
      setCounts(m);
      setTotal(count ?? 0);
      setChallengesWon(won ?? 0);
      setHistory((stars ?? []) as StarRow[]);
    })();
  }, [profile, today]);

  if (!profile) return null;

  const days = new Set(counts.keys());
  const streak = currentStreak(days, today);
  const best = longestStreak(days);
  const max = Math.max(1, ...counts.values());

  const badges = [
    { icon: "🌱", title: "البداية", desc: "أول تسجيل", ok: total >= 1 },
    { icon: "🔥", title: "أسبوع متواصل", desc: "7 أيام ورا بعض", ok: best >= 7 },
    { icon: "💎", title: "شهر متواصل", desc: "30 يوم ورا بعض", ok: best >= 30 },
    { icon: "💯", title: "100 إنجاز", desc: "100 تسجيل", ok: total >= 100 },
    { icon: "⭐", title: g("جامعة النجوم", "جامع النجوم"), desc: "100 نجمة", ok: profile.stars >= 100 },
    { icon: "🌟", title: g("نجمة لامعة", "نجم لامع"), desc: "500 نجمة", ok: profile.stars >= 500 },
    { icon: "🏆", title: g("بطلة التحديات", "بطل التحديات"), desc: g("كسبتي تحدي", "كسبت تحدي"), ok: challengesWon >= 1 },
    { icon: "👑", title: "أسطورة", desc: "5 تحديات", ok: challengesWon >= 5 },
  ];

  return (
    <div className="space-y-6">
      <div className="card flex items-center gap-4">
        <span className="text-5xl">{profile.avatar_emoji}</span>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold">{profile.display_name}</h1>
          {profile.username && (
            <p className="text-sm text-muted" dir="ltr">
              @{profile.username}
            </p>
          )}
          <p className="text-sm text-muted">عضو من {new Date(profile.created_at).toLocaleDateString("ar-EG", { month: "long", year: "numeric" })}</p>
        </div>
        <Link href="/settings/" className="btn">
          ⚙️ الإعدادات
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat icon="⭐" value={profile.stars} label="نجمة" />
        <Stat icon="🔥" value={streak} label="أيام متتالية" />
        <Stat icon="🏔️" value={best} label="أطول سلسلة" />
        <Stat icon="✅" value={total} label="إنجاز" />
      </div>

      <section>
        <h2 className="section-title">نشاطك آخر {WEEKS} أسبوع</h2>
        <div className="card overflow-x-auto">
          <div className="grid w-max grid-flow-col grid-rows-7 gap-1" dir="ltr">
            {Array.from({ length: WEEKS * 7 }, (_, i) => {
              const d = addDays(gridStart, i);
              if (d > today) return <div key={d} className="h-4 w-4" />;
              const c = counts.get(d) ?? 0;
              const level = c === 0 ? 0 : Math.ceil((c / max) * 4);
              return (
                <div
                  key={d}
                  title={`${d}: ${c}`}
                  className="h-4 w-4 rounded-sm"
                  style={{
                    background: level === 0 ? "var(--line)" : `color-mix(in srgb, var(--brand) ${level * 25}%, var(--surface))`,
                  }}
                />
              );
            })}
          </div>
        </div>
      </section>

      <section>
        <h2 className="section-title">الشارات</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {badges.map((b) => (
            <div key={b.title} className={`card text-center ${b.ok ? "" : "opacity-40 grayscale"}`}>
              <div className="text-3xl">{b.icon}</div>
              <div className="text-sm font-bold">{b.title}</div>
              <div className="text-xs text-muted">{b.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {history.length > 0 && (
        <section>
          <h2 className="section-title">آخر البونصات</h2>
          <div className="card divide-y divide-line p-0">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="flex-1">
                  {REASON[h.reason]}
                  {h.note && <span className="text-muted"> · {h.note}</span>}
                </span>
                <span className={`font-bold ${h.amount < 0 ? "text-danger" : "text-star"}`}>
                  {h.amount > 0 ? "+" : ""}
                  {h.amount} ⭐
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <button className="btn w-full" onClick={signOut}>
        تسجيل خروج
      </button>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <div className="card text-center">
      <div className="text-2xl">{icon}</div>
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
