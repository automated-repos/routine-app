"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { addDays, formatDate, todayIn } from "@/lib/dates";
import { PERIOD_LABEL, type Challenge, type Period, type Profile } from "@/lib/types";

interface PendingRow {
  challenge_id: string;
  user_id: string;
  joined_at: string;
  profiles: { display_name: string; avatar_emoji: string } | null;
  challenges: { title: string; bonus_stars: number } | null;
}

type ChallengeWithCount = Challenge & { challenge_participants: { count: number }[] };

const ICONS = ["🏆", "🔥", "📖", "🕌", "🏃", "💧", "🌙", "📚", "🎯", "💪", "🌟", "🤲"];

export default function AdminPage() {
  const { profile, refreshProfile, g } = useAuth();
  const today = todayIn(profile?.timezone ?? "Africa/Cairo");
  const [challenges, setChallenges] = useState<ChallengeWithCount[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    icon: "🏆",
    kind: "auto" as "auto" | "manual",
    habit_period: "" as "" | Period,
    target_count: 20,
    bonus_stars: 25,
    starts_on: today,
    ends_on: addDays(today, 7),
  });

  async function load() {
    const [{ data: cs }, { data: ps }, { data: us }] = await Promise.all([
      supabase.from("challenges").select("*, challenge_participants(count)").order("created_at", { ascending: false }),
      supabase
        .from("challenge_participants")
        .select("challenge_id, user_id, joined_at, profiles(display_name, avatar_emoji), challenges(title, bonus_stars)")
        .eq("status", "pending"),
      supabase.from("profiles").select("*").order("stars", { ascending: false }),
    ]);
    setChallenges((cs ?? []) as ChallengeWithCount[]);
    setPending((ps ?? []) as unknown as PendingRow[]);
    setUsers((us ?? []) as Profile[]);
  }

  useEffect(() => {
    if (profile?.is_admin) load();
  }, [profile?.is_admin]);

  if (!profile?.is_admin) {
    return <p className="card text-center text-muted">الصفحة دي للأدمن بس 🔒</p>;
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("challenges").insert({
      ...form,
      title: form.title.trim(),
      description: form.description.trim() || null,
      habit_period: form.habit_period || null,
    });
    if (error) return setMsg(error.message);
    setMsg("التحدي اتضاف ✓");
    setForm({ ...form, title: "", description: "" });
    load();
  }

  async function remove(c: Challenge) {
    if (!confirm(`مسح تحدي "${c.title}"؟ (النجوم اللي اتصرفت هتفضل)`)) return;
    await supabase.from("challenges").delete().eq("id", c.id);
    load();
  }

  async function review(p: PendingRow, approve: boolean) {
    const { error } = await supabase.rpc("review_challenge", {
      p_challenge_id: p.challenge_id,
      p_user: p.user_id,
      p_approve: approve,
    });
    setMsg(error ? error.message : approve ? "اتوافق واتصرف البونص ✓" : "اترفض");
    load();
  }

  async function grant(u: Profile) {
    const amount = Number(prompt(`كام نجمة لـ ${u.display_name}؟ (${g("اكتبي", "اكتب")} رقم بالسالب للخصم)`, "10"));
    if (!amount) return;
    const note = prompt("السبب؟", "مكافأة") ?? "";
    const { error } = await supabase.rpc("admin_grant_stars", { p_user: u.id, p_amount: amount, p_note: note });
    setMsg(error ? error.message : "تم ✓");
    load();
    if (u.id === profile?.id) refreshProfile();
  }

  async function resetPassword(u: Profile) {
    const pw = prompt(`باسورد جديد لـ ${u.display_name} (@${u.username}) - 6 حروف على الأقل`);
    if (!pw) return;
    const { error } = await supabase.rpc("admin_reset_password", { p_user: u.id, p_password: pw });
    setMsg(error ? error.message : `الباسورد اتغير ✓ ${g("ابعتيه", "ابعته")} لـ ${u.display_name}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">⚙️ لوحة الأدمن</h1>
      {msg && (
        <p className="rounded-xl bg-brand-soft p-3 text-sm text-brand" onClick={() => setMsg("")}>
          {msg}
        </p>
      )}

      {pending.length > 0 && (
        <section>
          <h2 className="section-title">طلبات مستنية موافقة ({pending.length})</h2>
          <div className="space-y-2">
            {pending.map((p) => (
              <div key={p.challenge_id + p.user_id} className="card flex flex-wrap items-center gap-3">
                <span className="text-2xl">{p.profiles?.avatar_emoji}</span>
                <div className="flex-1">
                  <p className="font-bold">{p.profiles?.display_name}</p>
                  <p className="text-sm text-muted">
                    {p.challenges?.title} · {p.challenges?.bonus_stars} ⭐
                  </p>
                </div>
                <button className="btn btn-primary" onClick={() => review(p, true)}>
                  موافقة
                </button>
                <button className="btn btn-danger" onClick={() => review(p, false)}>
                  رفض
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <form onSubmit={create} className="card space-y-4">
        <h2 className="font-extrabold">تحدي جديد</h2>
        <div className="flex gap-2">
          <select className="input w-20 text-xl" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}>
            {ICONS.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
          <input
            className="input flex-1"
            placeholder="اسم التحدي، مثلاً: أسبوع القرآن"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </div>
        <textarea
          className="input"
          rows={2}
          placeholder="وصف (اختياري)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">طريقة التحقق</label>
            <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "auto" | "manual" })}>
              <option value="auto">تلقائي (من سجل العادات)</option>
              <option value="manual">يدوي (أنا أوافق)</option>
            </select>
          </div>
          <div>
            <label className="label">البونص (نجوم)</label>
            <input
              className="input"
              type="number"
              min={0}
              max={1000}
              value={form.bonus_stars}
              onChange={(e) => setForm({ ...form, bonus_stars: Number(e.target.value) })}
            />
          </div>
          {form.kind === "auto" && (
            <>
              <div>
                <label className="label">عدد مرات التنفيذ المطلوبة</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={form.target_count}
                  onChange={(e) => setForm({ ...form, target_count: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">من أنهي عادات</label>
                <select
                  className="input"
                  value={form.habit_period}
                  onChange={(e) => setForm({ ...form, habit_period: e.target.value as "" | Period })}
                >
                  <option value="">أي عادة</option>
                  {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
                    <option key={p} value={p}>
                      العادات ال{PERIOD_LABEL[p]}ة بس
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div>
            <label className="label">من</label>
            <input className="input" type="date" dir="ltr" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} />
          </div>
          <div>
            <label className="label">لحد</label>
            <input
              className="input"
              type="date"
              dir="ltr"
              min={form.starts_on}
              value={form.ends_on}
              onChange={(e) => setForm({ ...form, ends_on: e.target.value })}
            />
          </div>
        </div>
        <button className="btn btn-primary w-full">إضافة التحدي</button>
      </form>

      <section>
        <h2 className="section-title">كل التحديات</h2>
        <div className="space-y-2">
          {challenges.map((c) => (
            <div key={c.id} className="card flex items-center gap-3">
              <span className="text-2xl">{c.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{c.title}</p>
                <p className="text-xs text-muted">
                  {formatDate(c.starts_on)} ← {formatDate(c.ends_on)} · {c.bonus_stars} ⭐ · {c.challenge_participants?.[0]?.count ?? 0} مشترك
                  {c.ends_on < today && " · خلص"}
                </p>
              </div>
              <button className="btn btn-danger" onClick={() => remove(c)}>
                مسح
              </button>
            </div>
          ))}
          {challenges.length === 0 && <p className="card text-center text-muted">مفيش تحديات لسه</p>}
        </div>
      </section>

      <section>
        <h2 className="section-title">المستخدمين ({users.length})</h2>
        <div className="card divide-y divide-line p-0">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-xl">{u.avatar_emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {u.display_name} {u.is_admin && <span className="chip bg-brand-soft text-brand">أدمن</span>}
                </p>
                <p className="text-xs text-muted">
                  <span dir="ltr">@{u.username}</span> · آخر نشاط: {u.last_log_at ? new Date(u.last_log_at).toLocaleDateString("ar-EG") : "لسه"}
                </p>
              </div>
              <span className="font-bold text-star">{u.stars} ⭐</span>
              <button className="btn" onClick={() => grant(u)}>
                ± نجوم
              </button>
              <button className="btn" onClick={() => resetPassword(u)} title="تغيير الباسورد">
                🔑
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
