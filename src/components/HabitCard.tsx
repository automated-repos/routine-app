"use client";

import { formatTime } from "@/lib/dates";
import type { HabitStatus } from "@/lib/today";
import { PERIOD_LABEL, PRAYER_LABEL } from "@/lib/types";

interface Props {
  item: HabitStatus;
  busy: boolean;
  usePrayer: boolean;
  onLog: () => void;
  onUnlog: () => void;
}

export function HabitCard({ item, busy, usePrayer, onLog, onUnlog }: Props) {
  const { habit, done, complete, time } = item;
  const multi = habit.target_count > 1;
  const overdue = !complete && habit.period === "daily" && time && time < new Date();

  let when = "";
  if (usePrayer && habit.prayer_anchor) {
    when = `${habit.prayer_offset === "before" ? "قبل" : "بعد"} ${PRAYER_LABEL[habit.prayer_anchor]}`;
  } else if (time) {
    when = formatTime(time);
  }

  return (
    <div
      className={`card flex items-center gap-3 transition ${complete ? "border-brand/40 bg-brand-soft/60" : ""} ${
        overdue ? "border-star/50" : ""
      }`}
    >
      <button
        onClick={complete ? onUnlog : onLog}
        disabled={busy}
        aria-label={complete ? "تراجع" : "تم"}
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-2xl transition ${
          complete ? "border-brand bg-brand text-white" : "border-line hover:border-brand"
        } ${busy ? "opacity-50" : ""}`}
      >
        {complete ? "✓" : habit.icon}
      </button>

      <div className="min-w-0 flex-1">
        <p className={`truncate font-bold ${complete ? "text-muted line-through" : ""}`}>{habit.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {habit.period !== "daily" && <span className="chip bg-line/60">{PERIOD_LABEL[habit.period]}</span>}
          {when && <span>🕒 {when}</span>}
          {overdue && <span className="font-semibold text-star">فات وقتها</span>}
        </div>
        {multi && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${Math.min(100, (done / habit.target_count) * 100)}%` }}
            />
          </div>
        )}
      </div>

      {multi && (
        <div className="flex items-center gap-1">
          <button className="btn h-8 w-8 p-0" onClick={onUnlog} disabled={busy || done === 0} aria-label="ناقص">
            −
          </button>
          <span className="w-12 text-center text-sm font-bold tabular-nums">
            {done}/{habit.target_count}
          </span>
          <button className="btn h-8 w-8 p-0" onClick={onLog} disabled={busy || complete} aria-label="زود">
            +
          </button>
        </div>
      )}
    </div>
  );
}
