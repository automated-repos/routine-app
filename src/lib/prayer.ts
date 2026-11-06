import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from "adhan";
import type { Habit, PrayerName, Profile } from "./types";

export const CALC_METHODS: { value: keyof typeof CalculationMethod; label: string }[] = [
  { value: "Egyptian", label: "الهيئة المصرية العامة للمساحة" },
  { value: "UmmAlQura", label: "أم القرى (السعودية)" },
  { value: "MuslimWorldLeague", label: "رابطة العالم الإسلامي" },
  { value: "Dubai", label: "دبي" },
  { value: "Kuwait", label: "الكويت" },
  { value: "Qatar", label: "قطر" },
  { value: "Karachi", label: "كراتشي" },
  { value: "Turkey", label: "تركيا" },
  { value: "NorthAmerica", label: "أمريكا الشمالية (ISNA)" },
];

export const PRAYER_ORDER: PrayerName[] = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

export type DayPrayerTimes = Record<PrayerName, Date>;

export function getPrayerTimes(profile: Profile, date: Date = new Date()): DayPrayerTimes | null {
  if (profile.latitude == null || profile.longitude == null) return null;
  const method = (CalculationMethod as unknown as Record<string, () => ReturnType<typeof CalculationMethod.Egyptian>>)[
    profile.calc_method
  ];
  const params = (method ?? CalculationMethod.Egyptian)();
  params.madhab = profile.madhab === "hanafi" ? Madhab.Hanafi : Madhab.Shafi;
  const t = new PrayerTimes(new Coordinates(profile.latitude, profile.longitude), date, params);
  return { fajr: t.fajr, sunrise: t.sunrise, dhuhr: t.dhuhr, asr: t.asr, maghrib: t.maghrib, isha: t.isha };
}

// الوقت المتوقع للمهمة النهارده (أو null لو مالهاش وقت)
export function habitTime(habit: Habit, times: DayPrayerTimes | null, usePrayer: boolean): Date | null {
  if (usePrayer && times && habit.prayer_anchor) {
    const base = times[habit.prayer_anchor];
    // قبل الصلاة بـ 15 دقيقة / بعدها بـ 15 دقيقة عشان الترتيب
    return new Date(base.getTime() + (habit.prayer_offset === "before" ? -15 : 15) * 60000);
  }
  if (habit.preferred_time) {
    const [h, m] = habit.preferred_time.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }
  return null;
}

// الصلاة اللي الوقت ده تابع لها (عشان نجمع المهام حوالين الصلوات)
export function prayerSlotFor(time: Date, times: DayPrayerTimes): PrayerName {
  let slot: PrayerName = "isha";
  if (time < times.fajr) return "isha";
  for (const p of PRAYER_ORDER) {
    if (time >= new Date(times[p].getTime() - 20 * 60000)) slot = p;
  }
  return slot;
}
