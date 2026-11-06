"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { formatDate, todayIn, daysBetween } from "@/lib/dates";
import { PERIOD_LABEL, type Challenge, type Participation } from "@/lib/types";

const STATUS: Record<Participation["status"], { label: string; cls: string }> = {
  joined: { label: "مشتركة", cls: "bg-brand-soft text-brand" },
  pending: { label: "مستني موافقة الأدمن", cls: "bg-star-soft text-star" },
  completed: { label: "اتحقق ✓", cls: "bg-brand text-white" },
  rejected: { label: "اترفض", cls: "bg-danger-soft text-danger" },
};

export default function ChallengesPage() {
  const { profile, refreshProfile, g } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [mine, setMine] = useState<Record<string, Participation>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const today = todayIn(profile?.timezone ?? "Africa/Cairo");

  const load = useCallback(async () => {
    const [{ data: cs }, { data: ps }] = await Promise.all([
      supabase.from("challenges").select("*").order("ends_on", { ascending: false }),
      supabase.from("challenge_participants").select("*").eq("user_id", profile!.id),
    ]);
    const list = (cs ?? []) as Challenge[];
    setChallenges(list);
    const map: Record<string, Participation> = {};
    for (const p of (ps ?? []) as Participation[]) map[p.challenge_id] = p;
    setMine(map);

    const prog: Record<string, number> = {};
    await Promise.all(
      list
        .filter((c) => map[c.id] && c.kind === "auto")
        .map(async (c) => {
          const { data } = await supabase.rpc("challenge_progress", { p_challenge_id: c.id });
          prog[c.id] = (data as number) ?? 0;
        }),
    );
    setProgress(prog);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    load();
    // علامة إن المستخدم شاف التحديات الجديدة
    supabase.from("profiles").update({ last_seen_challenges_at: new Date().toISOString() }).eq("id", profile.id).then(() => refreshProfile());
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function join(c: Challenge) {
    setBusy(c.id);
    const { error } = await supabase.rpc("join_challenge", { p_challenge_id: c.id });
    setMsg(error ? error.message : `${g("اشتركتي", "اشتركت")} في "${c.title}" 💪`);
    await load();
    setBusy(null);
  }

  async function claim(c: Challenge) {
    setBusy(c.id);
    const { data, error } = await supabase.rpc("claim_challenge", { p_challenge_id: c.id });
    if (error) setMsg(error.message);
    else if (data?.status === "completed") setMsg(`مبروك! ${g("خدتي", "خدت")} ${data.bonus} ⭐ بونص 🎉`);
    else if (data?.status === "pending") setMsg("اتبعت للأدمن يراجعه ✨");
    else setMsg(data?.message ?? "");
    await Promise.all([load(), refreshProfile()]);
    setBusy(null);
  }

  const active = challenges.filter((c) => c.ends_on >= today && c.starts_on <= today);
  const upcoming = challenges.filter((c) => c.starts_on > today);
  const past = challenges.filter((c) => c.ends_on < today);

  const render = (c: Challenge) => {
    const p = mine[c.id];
    const done = progress[c.id] ?? 0;
    const isActive = c.ends_on >= today && c.starts_on <= today;
    const reached = c.kind === "auto" && done >= c.target_count;
    const daysLeft = daysBetween(today, c.ends_on);

    return (
      <div key={c.id} className={`card space-y-3 ${p?.status === "completed" ? "border-brand/40" : ""}`}>
        <div className="flex items-start gap-3">
          <span className="text-4xl">{c.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-extrabold">{c.title}</h3>
              {p && <span className={`chip ${STATUS[p.status].cls}`}>{p.status === "joined" ? g("مشتركة", "مشترك") : STATUS[p.status].label}</span>}
            </div>
            {c.description && <p className="mt-1 text-sm text-muted">{c.description}</p>}
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
              <span className="chip bg-star-soft text-star">🎁 {c.bonus_stars} ⭐</span>
              <span>
                📅 {formatDate(c.starts_on)} ← {formatDate(c.ends_on)}
              </span>
              {isActive && <span>⏳ فاضل {daysLeft === 0 ? "النهارده بس" : `${daysLeft} يوم`}</span>}
            </div>
            <p className="mt-1 text-xs text-muted">
              {c.kind === "auto"
                ? `الهدف: ${g("تسجلي", "تسجل")} ${c.target_count} مرة ${c.habit_period ? `من العادات ال${PERIOD_LABEL[c.habit_period]}ة` : "من أي عادة"} خلال فترة التحدي`
                : `الأدمن بيراجع ويوافق بعد ما ${g("تطلبي", "تطلب")} البونص`}
            </p>
          </div>
        </div>

        {p && c.kind === "auto" && p.status !== "completed" && (
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span>التقدم</span>
              <span className="font-bold">
                {Math.min(done, c.target_count)}/{c.target_count}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (done / c.target_count) * 100)}%` }} />
            </div>
          </div>
        )}

        {!p && isActive && (
          <button className="btn btn-primary w-full" disabled={busy === c.id} onClick={() => join(c)}>
            {g("اشتركي", "اشترك")} في التحدي
          </button>
        )}
        {p && (p.status === "joined" || p.status === "rejected") && (c.kind === "manual" ? isActive : true) && (
          <button
            className="btn btn-primary w-full"
            disabled={busy === c.id || (c.kind === "auto" && !reached)}
            onClick={() => claim(c)}
          >
            {c.kind === "manual" ? `خلصته! ${g("اطلبي", "اطلب")} البونص` : reached ? `${g("استلمي", "استلم")} البونص 🎁` : g("كمّلي عشان تاخدي البونص", "كمّل عشان تاخد البونص")}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">🏆 التحديات</h1>
      {msg && (
        <p className="rounded-xl bg-brand-soft p-3 text-sm text-brand" onClick={() => setMsg("")}>
          {msg}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="section-title">شغالة دلوقتي</h2>
        {active.length ? active.map(render) : <p className="card text-center text-muted">مفيش تحديات شغالة دلوقتي</p>}
      </section>

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="section-title">قريباً</h2>
          {upcoming.map(render)}
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-3 opacity-80">
          <h2 className="section-title">خلصت</h2>
          {past.slice(0, 10).map(render)}
        </section>
      )}
    </div>
  );
}
