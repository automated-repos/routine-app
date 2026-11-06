"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import type { LeaderRow } from "@/lib/types";

const BOARDS = [
  { key: "daily", label: "اليومي", unit: "هدف يومي", hint: "عدد الأهداف اليومية اللي اتحققت بالكامل" },
  { key: "weekly", label: "الأسبوعي", unit: "هدف أسبوعي", hint: "عدد الأهداف الأسبوعية اللي اتحققت بالكامل" },
  { key: "monthly", label: "الشهري", unit: "هدف شهري", hint: "عدد الأهداف الشهرية اللي اتحققت بالكامل" },
  { key: "stars", label: "النجوم", unit: "⭐", hint: "مجموع النجوم من العادات والبونص والتحديات" },
] as const;

const RANGES = [
  { key: "week", label: "الأسبوع ده" },
  { key: "month", label: "الشهر ده" },
  { key: "all", label: "من البداية" },
] as const;

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const { profile, g } = useAuth();
  const [board, setBoard] = useState<(typeof BOARDS)[number]["key"]>("daily");
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("month");
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setRows(null);
    supabase.rpc("get_leaderboard", { p_period: board, p_range: range }).then(({ data, error }) => {
      setError(error?.message ?? "");
      setRows((data ?? []) as LeaderRow[]);
    });
  }, [board, range]);

  const current = BOARDS.find((b) => b.key === board)!;
  const myIndex = rows?.findIndex((r) => r.user_id === profile?.id) ?? -1;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">🏅 قائمة الشرف</h1>

      <div className="grid grid-cols-4 gap-1 rounded-xl bg-line/40 p-1 text-sm">
        {BOARDS.map((b) => (
          <button
            key={b.key}
            onClick={() => setBoard(b.key)}
            className={`rounded-lg py-2 font-semibold ${board === b.key ? "bg-surface shadow-sm" : "text-muted"}`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{current.hint}</p>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`chip ${range === r.key ? "bg-brand text-white" : "bg-line/60 text-muted"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-lg bg-danger-soft p-2 text-sm text-danger">{error}</p>}

      {rows === null ? (
        <p className="text-center text-muted">جاري التحميل...</p>
      ) : rows.length === 0 ? (
        <div className="card text-center text-muted">
          <p className="text-4xl">🌱</p>
          <p className="mt-2">لسه محدش دخل القائمة دي، {g("كوني الأولى", "كن الأول")}!</p>
        </div>
      ) : (
        <>
          {/* المراكز الأولى */}
          <div className="grid grid-cols-3 items-end gap-2">
            {[1, 0, 2].map((i) => {
              const r = rows[i];
              if (!r) return <div key={i} />;
              return (
                <div
                  key={r.user_id}
                  className={`card text-center ${i === 0 ? "border-star/50 bg-star-soft pb-6" : ""} ${
                    r.user_id === profile?.id ? "ring-2 ring-brand" : ""
                  }`}
                >
                  <div className="text-3xl">{MEDALS[i]}</div>
                  <div className="text-3xl">{r.avatar_emoji}</div>
                  <div className="truncate font-bold">{r.display_name}</div>
                  <div className="text-sm text-muted">
                    {r.score} {current.unit}
                  </div>
                </div>
              );
            })}
          </div>

          {rows.length > 3 && (
          <div className="card divide-y divide-line p-0">
            {rows.slice(3).map((r, i) => (
              <div
                key={r.user_id}
                className={`flex items-center gap-3 px-4 py-3 ${r.user_id === profile?.id ? "bg-brand-soft" : ""}`}
              >
                <span className="w-6 text-center font-bold text-muted">{i + 4}</span>
                <span className="text-2xl">{r.avatar_emoji}</span>
                <span className="flex-1 truncate font-semibold">{r.display_name}</span>
                <span className="font-bold">
                  {r.score} <span className="text-xs font-normal text-muted">{current.unit}</span>
                </span>
              </div>
            ))}
          </div>
          )}

          {myIndex === -1 && profile?.show_on_leaderboard && (
            <p className="text-center text-sm text-muted">لسه مش في القائمة دي، {g("كمّلي وهتلاقي", "كمّل وهتلاقي")} اسمك هنا 💪</p>
          )}
          {!profile?.show_on_leaderboard && (
            <p className="text-center text-sm text-muted">اسمك مخفي من قائمة الشرف ({g("تقدري تغيري", "تقدر تغير")} ده من الإعدادات)</p>
          )}
        </>
      )}
    </div>
  );
}
