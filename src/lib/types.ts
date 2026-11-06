export type Gender = "male" | "female";
export type Period = "daily" | "weekly" | "monthly";
export type PrayerName = "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";

export interface Profile {
  id: string;
  username: string | null;
  gender: Gender | null;
  display_name: string;
  avatar_emoji: string;
  is_admin: boolean;
  stars: number;
  show_on_leaderboard: boolean;
  timezone: string;
  prayer_mode: boolean;
  latitude: number | null;
  longitude: number | null;
  city_name: string | null;
  calc_method: string;
  madhab: "shafi" | "hanafi";
  inactivity_days: number;
  last_log_at: string | null;
  last_seen_challenges_at: string | null;
  created_at: string;
}

export interface Habit {
  id: string;
  user_id: string;
  title: string;
  icon: string;
  period: Period;
  target_count: number;
  prayer_anchor: PrayerName | null;
  prayer_offset: "before" | "after";
  preferred_time: string | null; // "HH:MM:SS"
  archived: boolean;
  sort_order: number;
  created_at: string;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  log_date: string;
  period_start: string;
  created_at: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  kind: "auto" | "manual";
  habit_period: Period | null;
  target_count: number;
  bonus_stars: number;
  starts_on: string;
  ends_on: string;
  created_at: string;
}

export interface Participation {
  challenge_id: string;
  user_id: string;
  status: "joined" | "pending" | "completed" | "rejected";
  joined_at: string;
  completed_at: string | null;
}

export interface LeaderRow {
  user_id: string;
  display_name: string;
  avatar_emoji: string;
  score: number;
}

export const PERIOD_LABEL: Record<Period, string> = {
  daily: "يومي",
  weekly: "أسبوعي",
  monthly: "شهري",
};

export const PRAYER_LABEL: Record<PrayerName, string> = {
  fajr: "الفجر",
  sunrise: "الشروق",
  dhuhr: "الظهر",
  asr: "العصر",
  maghrib: "المغرب",
  isha: "العشاء",
};
