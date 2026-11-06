"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { loadToday, upcoming } from "@/lib/today";

// طول ما التطبيق مفتوح: لما ييجي ميعاد مهمة يظهر تنبيه
// (إشعار من المتصفح لو المستخدم سمح، وإلا رسالة جوه الصفحة)
export function ReminderScheduler() {
  const { profile } = useAuth();
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!profile) return;
    let timers: ReturnType<typeof setTimeout>[] = [];

    async function schedule() {
      timers.forEach(clearTimeout);
      timers = [];
      const data = await loadToday(profile!);
      const now = Date.now();
      for (const item of upcoming(data.items)) {
        const delay = item.time!.getTime() - now;
        if (delay > 6 * 3600000) continue;
        timers.push(
          setTimeout(() => {
            const text = `${item.habit.icon} حان وقت: ${item.habit.title}`;
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification("روتيني", { body: text });
            }
            setMessage(text);
          }, delay),
        );
      }
    }

    schedule();
    const refresh = setInterval(schedule, 15 * 60000);
    return () => {
      clearInterval(refresh);
      timers.forEach(clearTimeout);
    };
  }, [profile]);

  if (!message) return null;
  return (
    <div className="fixed inset-x-0 top-16 z-40 flex justify-center px-4">
      <div className="card flex items-center gap-3 border-brand shadow-lg">
        <span className="font-bold">{message}</span>
        <button className="btn" onClick={() => setMessage("")}>
          تمام
        </button>
      </div>
    </div>
  );
}
