"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { PERIOD_LABEL, PRAYER_LABEL, type Habit, type Period, type PrayerName } from "@/lib/types";

const ICONS = ["✅", "📖", "🕌", "🤲", "📿", "🏃", "💧", "🥗", "😴", "📚", "✍️", "🧘", "💪", "🚶", "🧹", "💰", "📵", "❤️", "🌙", "☀️"];

const TEMPLATES: Partial<Habit>[] = [
  { title: "ورد قرآن", icon: "📖", period: "daily", prayer_anchor: "fajr", prayer_offset: "after" },
  { title: "أذكار الصباح", icon: "📿", period: "daily", prayer_anchor: "fajr", prayer_offset: "after" },
  { title: "أذكار المساء", icon: "🤲", period: "daily", prayer_anchor: "asr", prayer_offset: "after" },
  { title: "شرب 8 كوبايات مية", icon: "💧", period: "daily", target_count: 8 },
  { title: "رياضة", icon: "🏃", period: "weekly", target_count: 3 },
  { title: "قراءة كتاب", icon: "📚", period: "monthly", target_count: 1 },
  { title: "صيام الاثنين والخميس", icon: "🌙", period: "weekly", target_count: 2 },
];

type Draft = {
  id?: string;
  title: string;
  icon: string;
  period: Period;
  target_count: number;
  timing: "none" | "prayer" | "time";
  prayer_anchor: PrayerName;
  prayer_offset: "before" | "after";
  preferred_time: string;
};

const EMPTY: Draft = {
  title: "",
  icon: "✅",
  period: "daily",
  target_count: 1,
  timing: "none",
  prayer_anchor: "fajr",
  prayer_offset: "after",
  preferred_time: "08:00",
};

function toDraft(h: Partial<Habit>): Draft {
  return {
    id: h.id,
    title: h.title ?? "",
    icon: h.icon ?? "✅",
    period: h.period ?? "daily",
    target_count: h.target_count ?? 1,
    timing: h.prayer_anchor ? "prayer" : h.preferred_time ? "time" : "none",
    prayer_anchor: h.prayer_anchor ?? "fajr",
    prayer_offset: h.prayer_offset ?? "after",
    preferred_time: h.preferred_time?.slice(0, 5) ?? "08:00",
  };
}

export default function HabitsPage() {
  const { profile, g } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.from("habits").select("*").order("archived").order("sort_order").order("created_at");
    setHabits((data ?? []) as Habit[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setError("");
    const row = {
      title: draft.title.trim(),
      icon: draft.icon,
      period: draft.period,
      target_count: draft.target_count,
      prayer_anchor: draft.timing === "prayer" ? draft.prayer_anchor : null,
      prayer_offset: draft.prayer_offset,
      preferred_time: draft.timing === "time" ? draft.preferred_time : null,
    };
    const { error } = draft.id
      ? await supabase.from("habits").update(row).eq("id", draft.id)
      : await supabase.from("habits").insert(row);
    if (error) return setError(error.message);
    setDraft(null);
    load();
  }

  async function setArchived(h: Habit, archived: boolean) {
    const { error } = await supabase.from("habits").update({ archived }).eq("id", h.id);
    if (error) alert(error.message);
    load();
  }

  async function remove(h: Habit) {
    if (!confirm(`مسح "${h.title}" نهائي؟ هيتمسح سجلها ونجومها كمان. لو ${g("عايزة توقفيها بس استخدمي", "عايز توقفها بس استخدم")} "إيقاف".`)) return;
    await supabase.from("habits").delete().eq("id", h.id);
    load();
  }

  async function move(h: Habit, dir: -1 | 1) {
    const list = habits.filter((x) => !x.archived);
    const idx = list.findIndex((x) => x.id === h.id);
    const other = list[idx + dir];
    if (!other) return;
    const reordered = [...list];
    [reordered[idx], reordered[idx + dir]] = [other, h];
    await Promise.all(reordered.map((x, i) => supabase.from("habits").update({ sort_order: i }).eq("id", x.id)));
    load();
  }

  const active = habits.filter((h) => !h.archived);
  const archived = habits.filter((h) => h.archived);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">عاداتي</h1>
        <button className="btn btn-primary" onClick={() => setDraft({ ...EMPTY })}>
          + عادة جديدة
        </button>
      </div>

      {draft && (
        <form onSubmit={save} className="card space-y-4">
          <h2 className="font-extrabold">{draft.id ? "تعديل العادة" : "عادة جديدة"}</h2>

          {!draft.id && (
            <div>
              <p className="label">أفكار جاهزة</p>
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map((t) => (
                  <button type="button" key={t.title} className="chip bg-line/60 hover:bg-brand-soft" onClick={() => setDraft(toDraft(t))}>
                    {t.icon} {t.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="label">الاسم</label>
            <input
              className="input"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              required
              maxLength={80}
              placeholder="مثلاً: ورد قرآن"
            />
          </div>

          <div>
            <p className="label">الأيقونة</p>
            <div className="flex flex-wrap gap-1">
              {ICONS.map((i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setDraft({ ...draft, icon: i })}
                  className={`h-10 w-10 rounded-lg text-xl ${draft.icon === i ? "bg-brand-soft ring-2 ring-brand" : "hover:bg-line/50"}`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">النوع</label>
              <select className="input" value={draft.period} onChange={(e) => setDraft({ ...draft, period: e.target.value as Period })}>
                {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
                  <option key={p} value={p}>
                    {PERIOD_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">
                كام مرة في {draft.period === "daily" ? "اليوم" : draft.period === "weekly" ? "الأسبوع" : "الشهر"}
              </label>
              <input
                className="input"
                type="number"
                min={1}
                max={31}
                value={draft.target_count}
                onChange={(e) => setDraft({ ...draft, target_count: Math.max(1, Math.min(31, Number(e.target.value) || 1)) })}
              />
            </div>
          </div>

          {draft.period === "daily" && (
            <div>
              <p className="label">الميعاد</p>
              <div className="mb-2 flex gap-2">
                {(
                  [
                    ["none", "أي وقت"],
                    ["prayer", "مع صلاة"],
                    ["time", "ساعة محددة"],
                  ] as const
                ).map(([v, l]) => (
                  <button
                    type="button"
                    key={v}
                    onClick={() => setDraft({ ...draft, timing: v })}
                    className={`btn flex-1 ${draft.timing === v ? "border-brand bg-brand-soft text-brand" : ""}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {draft.timing === "prayer" && (
                <div className="grid grid-cols-2 gap-3">
                  <select
                    className="input"
                    value={draft.prayer_offset}
                    onChange={(e) => setDraft({ ...draft, prayer_offset: e.target.value as "before" | "after" })}
                  >
                    <option value="before">قبل</option>
                    <option value="after">بعد</option>
                  </select>
                  <select
                    className="input"
                    value={draft.prayer_anchor}
                    onChange={(e) => setDraft({ ...draft, prayer_anchor: e.target.value as PrayerName })}
                  >
                    {(Object.keys(PRAYER_LABEL) as PrayerName[]).map((p) => (
                      <option key={p} value={p}>
                        {PRAYER_LABEL[p]}
                      </option>
                    ))}
                  </select>
                  {!profile?.prayer_mode && (
                    <p className="col-span-2 text-xs text-muted">
                      💡 {g("فعّلي", "فعّل")} &quot;ترتيب المهام على الصلاة&quot; من الإعدادات عشان المواعيد تتحسب.
                    </p>
                  )}
                </div>
              )}
              {draft.timing === "time" && (
                <input
                  className="input"
                  type="time"
                  dir="ltr"
                  value={draft.preferred_time}
                  onChange={(e) => setDraft({ ...draft, preferred_time: e.target.value })}
                />
              )}
            </div>
          )}

          {error && <p className="rounded-lg bg-danger-soft p-2 text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1">حفظ</button>
            <button type="button" className="btn" onClick={() => setDraft(null)}>
              إلغاء
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {active.length === 0 && !draft && <p className="card text-center text-muted">مفيش عادات لسه، {g("ابدأي", "ابدأ")} بواحدة 🌱</p>}
        {active.map((h, i) => (
          <HabitRow
            key={h.id}
            habit={h}
            onEdit={() => setDraft(toDraft(h))}
            onArchive={() => setArchived(h, true)}
            onUp={i > 0 ? () => move(h, -1) : undefined}
            onDown={i < active.length - 1 ? () => move(h, 1) : undefined}
          />
        ))}
      </div>

      {archived.length > 0 && (
        <div>
          <button className="text-sm text-muted underline" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? "إخفاء" : "عرض"} العادات المتوقفة ({archived.length})
          </button>
          {showArchived && (
            <div className="mt-2 space-y-2 opacity-70">
              {archived.map((h) => (
                <div key={h.id} className="card flex items-center gap-3">
                  <span className="text-2xl">{h.icon}</span>
                  <span className="flex-1 font-semibold">{h.title}</span>
                  <button className="btn" onClick={() => setArchived(h, false)}>
                    {g("رجّعيها", "رجّعها")}
                  </button>
                  <button className="btn btn-danger" onClick={() => remove(h)}>
                    مسح
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HabitRow({
  habit,
  onEdit,
  onArchive,
  onUp,
  onDown,
}: {
  habit: Habit;
  onEdit: () => void;
  onArchive: () => void;
  onUp?: () => void;
  onDown?: () => void;
}) {
  const timing = habit.prayer_anchor
    ? `${habit.prayer_offset === "before" ? "قبل" : "بعد"} ${PRAYER_LABEL[habit.prayer_anchor]}`
    : habit.preferred_time
      ? habit.preferred_time.slice(0, 5)
      : null;
  return (
    <div className="card flex items-center gap-3">
      <div className="flex flex-col">
        <button className="text-xs text-muted disabled:opacity-20" onClick={onUp} disabled={!onUp} aria-label="لفوق">
          ▲
        </button>
        <button className="text-xs text-muted disabled:opacity-20" onClick={onDown} disabled={!onDown} aria-label="لتحت">
          ▼
        </button>
      </div>
      <span className="text-2xl">{habit.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{habit.title}</p>
        <p className="text-xs text-muted">
          {PERIOD_LABEL[habit.period]} · {habit.target_count} {habit.target_count === 1 ? "مرة" : "مرات"}
          {timing && ` · ${timing}`}
        </p>
      </div>
      <button className="btn" onClick={onEdit}>
        تعديل
      </button>
      <button className="btn" onClick={onArchive} title="إيقاف مؤقت من غير ما يتمسح السجل">
        إيقاف
      </button>
    </div>
  );
}
