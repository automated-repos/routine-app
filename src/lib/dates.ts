import type { Period } from "./types";

// "YYYY-MM-DD" لتاريخ النهارده حسب توقيت المستخدم
export function todayIn(timeZone: string, at: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone }).format(at);
  } catch {
    return new Intl.DateTimeFormat("en-CA").format(at);
  }
}

function parse(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: string, n: number): string {
  const x = parse(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fmt(x);
}

// نفس منطق period_start في قاعدة البيانات: الأسبوع بيبدأ السبت
export function periodStart(period: Period, d: string): string {
  const x = parse(d);
  if (period === "weekly") {
    const back = (x.getUTCDay() + 1) % 7;
    x.setUTCDate(x.getUTCDate() - back);
  } else if (period === "monthly") {
    x.setUTCDate(1);
  }
  return fmt(x);
}

// عدد الأيام الباقية في الفترة بما فيها النهارده
export function daysLeftInPeriod(period: Period, d: string): number {
  if (period === "daily") return 1;
  const start = parse(periodStart(period, d));
  const end = new Date(start);
  if (period === "weekly") end.setUTCDate(end.getUTCDate() + 7);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return Math.round((end.getTime() - parse(d).getTime()) / 86400000);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);
}

export function formatTime(d: Date, timeZone?: string): string {
  return d.toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit", timeZone });
}

export function formatDate(d: string): string {
  return parse(d).toLocaleDateString("ar-EG", { day: "numeric", month: "long", timeZone: "UTC" });
}

// أيام متتالية فيها نشاط، منتهية بالنهارده أو امبارح
export function currentStreak(activeDays: Set<string>, today: string): number {
  let day = activeDays.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (activeDays.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export function longestStreak(activeDays: Set<string>): number {
  const sorted = [...activeDays].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
