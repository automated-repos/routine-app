import { friendlyError, supabase } from "./supabase";
import { periodStart, todayIn } from "./dates";
import { getPrayerTimes, habitTime, type DayPrayerTimes } from "./prayer";
import type { Habit, HabitLog, Profile } from "./types";

export interface HabitStatus {
  habit: Habit;
  done: number; // عدد مرات التنفيذ في الفترة الحالية
  complete: boolean;
  time: Date | null; // الوقت المتوقع النهارده
}

export interface TodayData {
  today: string;
  times: DayPrayerTimes | null;
  usePrayer: boolean;
  items: HabitStatus[];
}

export async function loadToday(profile: Profile): Promise<TodayData> {
  const today = todayIn(profile.timezone);
  const starts = [today, periodStart("weekly", today), periodStart("monthly", today)];

  const [{ data: habits, error: e1 }, { data: logs, error: e2 }] = await Promise.all([
    supabase.from("habits").select("*").eq("archived", false).order("sort_order").order("created_at"),
    supabase.from("habit_logs").select("id, habit_id, log_date, period_start, created_at").in("period_start", starts),
  ]);

  if (e1 || e2) throw new Error(friendlyError((e1 ?? e2)!.message));

  const times = getPrayerTimes(profile);
  const usePrayer = profile.prayer_mode && times != null;

  const items = ((habits ?? []) as Habit[]).map((habit) => {
    const start = periodStart(habit.period, today);
    const done = ((logs ?? []) as HabitLog[]).filter((l) => l.habit_id === habit.id && l.period_start === start).length;
    return { habit, done, complete: done >= habit.target_count, time: habitTime(habit, times, usePrayer) };
  });

  return { today, times, usePrayer, items };
}

// المهام اليومية اللي لسه متعملتش وليها وقت جاي النهارده
export function upcoming(items: HabitStatus[], now = new Date()): HabitStatus[] {
  return items
    .filter((i) => i.habit.period === "daily" && !i.complete && i.time && i.time > now)
    .sort((a, b) => a.time!.getTime() - b.time!.getTime());
}

export function overdue(items: HabitStatus[], now = new Date()): HabitStatus[] {
  return items.filter((i) => i.habit.period === "daily" && !i.complete && i.time && i.time <= now);
}
