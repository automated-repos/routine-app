"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { pickGender } from "./AuthProvider";
import { daysLeftInPeriod, formatTime } from "@/lib/dates";
import { overdue, upcoming, type TodayData } from "@/lib/today";
import { PRAYER_LABEL, type Profile } from "@/lib/types";

type Tone = "info" | "warn" | "good" | "star";

interface Notice {
  key: string;
  tone: Tone;
  icon: string;
  text: React.ReactNode;
  href?: string;
}

const TONE: Record<Tone, string> = {
  info: "bg-surface border-line",
  warn: "bg-star-soft border-star/30",
  good: "bg-brand-soft border-brand/30",
  star: "bg-star-soft border-star/30",
};

export function Notices({ profile, data }: { profile: Profile; data: TodayData }) {
  const [newChallenges, setNewChallenges] = useState(0);
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem("dismissed-notices") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    let q = supabase.from("challenges").select("id", { count: "exact", head: true }).gte("ends_on", data.today);
    if (profile.last_seen_challenges_at) q = q.gt("created_at", profile.last_seen_challenges_at);
    q.then(({ count }) => setNewChallenges(count ?? 0));
  }, [profile.last_seen_challenges_at, data.today]);

  function dismiss(key: string) {
    const next = [...dismissed, key];
    setDismissed(next);
    sessionStorage.setItem("dismissed-notices", JSON.stringify(next));
  }

  const g = (female: string, male: string) => pickGender(profile.gender, female, male);
  const notices: Notice[] = [];
  const now = new Date();

  // 0) الحسابات القديمة اللي من غير نوع
  if (!profile.gender) {
    notices.push({
      key: "no-gender",
      tone: "info",
      icon: "👤",
      text: "حدد النوع (ذكر / أنثى) من الإعدادات عشان التطبيق يكلمك صح.",
      href: "/settings/",
    });
  }

  // 1) بقاله فترة مش شغال
  if (data.items.length > 0) {
    const last = profile.last_log_at ? new Date(profile.last_log_at) : null;
    const days = last ? Math.floor((now.getTime() - last.getTime()) / 86400000) : null;
    if (days !== null && days >= profile.inactivity_days) {
      notices.push({
        key: "inactive",
        tone: "warn",
        icon: "💭",
        text: `بقالك ${days} أيام ${g("مسجلتيش", "مسجلتش")} أي حاجة. مش لازم ${g("تعملي", "تعمل")} كله، ${g("ابدأي", "ابدأ")} بعادة واحدة صغيرة النهارده 💪`,
      });
    } else if (!last) {
      notices.push({ key: "first", tone: "good", icon: "🚀", text: `يلا نبدأ! ${g("سجلي", "سجل")} أول عادة النهارده و${g("خدي", "خد")} أول نجمة ⭐` });
    }
  }

  // 2) المهمة الجاية
  const next = upcoming(data.items, now)[0];
  if (next) {
    const when =
      data.usePrayer && next.habit.prayer_anchor
        ? `${next.habit.prayer_offset === "before" ? "قبل" : "بعد"} ${PRAYER_LABEL[next.habit.prayer_anchor]} (${formatTime(next.time!)})`
        : formatTime(next.time!);
    notices.push({
      key: "next-" + next.habit.id,
      tone: "info",
      icon: "⏭️",
      text: (
        <>
          المهمة الجاية: <b>{next.habit.title}</b> · {when}
        </>
      ),
    });
  }

  // 3) مهام فات وقتها
  const late = overdue(data.items, now);
  if (late.length) {
    notices.push({
      key: "late-" + late.length,
      tone: "warn",
      icon: "⏰",
      text: `عندك ${late.length} ${late.length === 1 ? "مهمة" : "مهام"} فات ميعادها ولسه متعملتش، لسه ${g("تقدري تلحقيها", "تقدر تلحقها")}.`,
    });
  }

  // 4) خلصت كل اليومي
  const daily = data.items.filter((i) => i.habit.period === "daily");
  if (daily.length && daily.every((i) => i.complete)) {
    notices.push({ key: "all-done", tone: "good", icon: "🎉", text: `${g("خلصتي", "خلصت")} كل عادات النهارده! ما شاء الله 👏` });
  }

  // 5) الأسبوع أو الشهر قرب يخلص والهدف لسه
  for (const i of data.items) {
    if (i.complete || i.habit.period === "daily") continue;
    const left = daysLeftInPeriod(i.habit.period, data.today);
    const threshold = i.habit.period === "weekly" ? 2 : 5;
    if (left <= threshold) {
      const remaining = i.habit.target_count - i.done;
      notices.push({
        key: "ending-" + i.habit.id,
        tone: "warn",
        icon: "📆",
        text: `فاضل ${left} ${left === 1 ? "يوم" : "أيام"} على نهاية ${i.habit.period === "weekly" ? "الأسبوع" : "الشهر"}، وفاضلك ${remaining} في "${i.habit.title}".`,
      });
    }
  }

  // 6) تحديات جديدة
  if (newChallenges > 0) {
    notices.push({
      key: "challenges-" + newChallenges,
      tone: "star",
      icon: "🏆",
      text: `فيه ${newChallenges} ${newChallenges === 1 ? "تحدي جديد" : "تحديات جديدة"}! ${g("اشتركي وخدي", "اشترك وخد")} بونص نجوم.`,
      href: "/challenges/",
    });
  }

  // 7) وضع الصلاة متفعل من غير موقع
  if (profile.prayer_mode && (profile.latitude == null || profile.longitude == null)) {
    notices.push({
      key: "no-location",
      tone: "info",
      icon: "📍",
      text: `${g("فعّلتي", "فعّلت")} ترتيب المهام على الصلاة بس لسه ${g("محددتيش", "محددتش")} موقعك.`,
      href: "/settings/",
    });
  }

  const visible = notices.filter((n) => !dismissed.includes(n.key));
  if (!visible.length) return null;

  return (
    <div className="space-y-2">
      {visible.map((n) => {
        const body = (
          <div className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${TONE[n.tone]}`}>
            <span className="text-lg leading-none">{n.icon}</span>
            <div className="flex-1">{n.text}</div>
            <button
              onClick={(e) => {
                e.preventDefault();
                dismiss(n.key);
              }}
              className="text-muted hover:text-text"
              aria-label="إخفاء"
            >
              ✕
            </button>
          </div>
        );
        return n.href ? (
          <Link key={n.key} href={n.href} className="block">
            {body}
          </Link>
        ) : (
          <div key={n.key}>{body}</div>
        );
      })}
    </div>
  );
}
