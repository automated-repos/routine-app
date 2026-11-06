"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { HabitCard } from "@/components/HabitCard";
import { Notices } from "@/components/Notices";
import { supabase } from "@/lib/supabase";
import { addDays, currentStreak, formatTime } from "@/lib/dates";
import { PRAYER_ORDER, prayerSlotFor } from "@/lib/prayer";
import { loadToday, type HabitStatus, type TodayData } from "@/lib/today";
import { PRAYER_LABEL } from "@/lib/types";

export default function TodayPage() {
  const { profile, refreshProfile, g } = useAuth();
  const [data, setData] = useState<TodayData | null>(null);
  const [streak, setStreak] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    if (!profile) return;
    const d = await loadToday(profile);
    setData(d);
    const { data: days } = await supabase.rpc("my_activity", { p_from: addDays(d.today, -400) });
    setStreak(currentStreak(new Set(((days ?? []) as { log_date: string }[]).map((r) => r.log_date)), d.today));
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function act(item: HabitStatus, fn: "log_habit" | "unlog_habit") {
    setBusyId(item.habit.id);
    const { data: res, error } = await supabase.rpc(fn, { p_habit_id: item.habit.id });
    if (error) flash(error.message);
    else if (fn === "log_habit" && res?.ok) flash(res.completed ? `${g("أحسنتِ", "أحسنت")}! هدف متحقق 🎉 +نجوم` : "+1 ⭐");
    else if (res && res.ok === false && res.message) flash(res.message);
    await Promise.all([load(), refreshProfile()]);
    setBusyId(null);
  }

  if (!profile || !data) return <p className="text-center text-muted">جاري التحميل...</p>;

  const daily = data.items.filter((i) => i.habit.period === "daily");
  const weekly = data.items.filter((i) => i.habit.period === "weekly");
  const monthly = data.items.filter((i) => i.habit.period === "monthly");
  const doneCount = daily.filter((i) => i.complete).length;
  const pct = daily.length ? Math.round((doneCount / daily.length) * 100) : 0;

  const card = (i: HabitStatus) => (
    <HabitCard
      key={i.habit.id}
      item={i}
      usePrayer={data.usePrayer}
      busy={busyId === i.habit.id}
      onLog={() => act(i, "log_habit")}
      onUnlog={() => act(i, "unlog_habit")}
    />
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="card bg-gradient-to-l from-brand-soft to-surface">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted">
              {new Date().toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" })}
              {" · "}
              {new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { day: "numeric", month: "long" }).format(new Date())}
            </p>
            <h1 className="text-2xl font-extrabold">
              أهلاً {profile.display_name} {profile.avatar_emoji}
            </h1>
          </div>
          <div className="text-center">
            <div className="text-2xl">🔥</div>
            <div className="text-sm font-bold">{streak} يوم</div>
          </div>
        </div>
        {daily.length > 0 && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-sm">
              <span>إنجاز النهارده</span>
              <span className="font-bold">
                {doneCount}/{daily.length}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </section>

      <Notices profile={profile} data={data} />

      {data.usePrayer && data.times && (
        <div className="grid grid-cols-6 gap-1 text-center text-xs">
          {PRAYER_ORDER.map((p) => (
            <div key={p} className="rounded-xl bg-surface py-2 shadow-sm">
              <div className="text-muted">{PRAYER_LABEL[p]}</div>
              <div className="font-bold">{formatTime(data.times![p])}</div>
            </div>
          ))}
        </div>
      )}

      {data.items.length === 0 && (
        <div className="card text-center">
          <p className="mb-3 text-4xl">📝</p>
          <p className="mb-4 font-bold">لسه {g("مضفتيش", "مضفتش")} أي عادة</p>
          <Link href="/habits/" className="btn btn-primary">
            {g("أضيفي", "أضيف")} أول عادة
          </Link>
        </div>
      )}

      {data.usePrayer && data.times ? (
        <>
          {PRAYER_ORDER.map((p) => {
            const list = daily
              .filter((i) => i.time && prayerSlotFor(i.time, data.times!) === p)
              .sort((a, b) => a.time!.getTime() - b.time!.getTime());
            if (!list.length) return null;
            return (
              <Section key={p} title={`${PRAYER_LABEL[p]}`} hint={formatTime(data.times![p])}>
                {list.map(card)}
              </Section>
            );
          })}
          <Section title="في أي وقت النهارده">{daily.filter((i) => !i.time).map(card)}</Section>
        </>
      ) : (
        <>
          <Section title="بمواعيد">
            {daily
              .filter((i) => i.time)
              .sort((a, b) => a.time!.getTime() - b.time!.getTime())
              .map(card)}
          </Section>
          <Section title="في أي وقت النهارده">{daily.filter((i) => !i.time).map(card)}</Section>
        </>
      )}

      <Section title="أهداف الأسبوع">{weekly.map(card)}</Section>
      <Section title="أهداف الشهر">{monthly.map(card)}</Section>

      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-30 flex justify-center md:bottom-8">
          <div className="rounded-full bg-text px-5 py-2 text-sm font-bold text-bg shadow-lg">{toast}</div>
        </div>
      )}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode[] }) {
  if (!children.length) return null;
  return (
    <section>
      <h2 className="section-title flex items-baseline gap-2">
        {title}
        {hint && <span className="text-sm font-normal text-muted">{hint}</span>}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
