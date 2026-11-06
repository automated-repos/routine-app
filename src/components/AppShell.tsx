"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { ReminderScheduler } from "./ReminderScheduler";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

const NAV = [
  { href: "/", label: "النهارده", icon: "☀️" },
  { href: "/habits/", label: "عاداتي", icon: "📋" },
  { href: "/leaderboard/", label: "الشرف", icon: "🏅" },
  { href: "/challenges/", label: "التحديات", icon: "🏆" },
  { href: "/profile/", label: "حسابي", icon: "👤" },
];

const PUBLIC_PATHS = ["/login/"];

function normalize(path: string) {
  return path.endsWith("/") ? path : path + "/";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();
  const pathname = normalize(usePathname());
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (loading) return;
    if (!session && !isPublic) router.replace("/login/");
    if (session && isPublic) router.replace("/");
  }, [loading, session, isPublic, router]);

  if (!isSupabaseConfigured) {
    return (
      <Centered>
        <div className="card max-w-md text-center">
          <p className="text-lg font-bold mb-2">لسه Supabase مش متوصل</p>
          <p className="text-sm text-muted">
            اعمل ملف <code dir="ltr">.env.local</code> فيه <code dir="ltr">NEXT_PUBLIC_SUPABASE_URL</code> و{" "}
            <code dir="ltr">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (بص على <code dir="ltr">.env.example</code>).
          </p>
        </div>
      </Centered>
    );
  }

  if (isPublic) return <>{children}</>;

  if (loading || !session || !profile) {
    return (
      <Centered>
        <div className="animate-pulse text-4xl">🌱</div>
      </Centered>
    );
  }

  return (
    <div className="min-h-dvh pb-24 md:pb-0">
      <Header profile={profile} pathname={pathname} />
      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
      <BottomNav pathname={pathname} />
      <ReminderScheduler />
    </div>
  );
}

function Header({ profile, pathname }: { profile: Profile; pathname: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-extrabold text-brand">
          روتيني 🌱
        </Link>
        <nav className="hidden flex-1 gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                pathname === n.href ? "bg-brand-soft font-bold text-brand" : "text-muted hover:bg-line/50"
              }`}
            >
              {n.label}
            </Link>
          ))}
          {profile.is_admin && (
            <Link
              href="/admin/"
              className={`rounded-lg px-3 py-1.5 text-sm ${
                pathname === "/admin/" ? "bg-brand-soft font-bold text-brand" : "text-muted hover:bg-line/50"
              }`}
            >
              الأدمن
            </Link>
          )}
        </nav>
        <div className="ms-auto flex items-center gap-3 md:ms-0">
          {profile.is_admin && (
            <Link href="/admin/" className="text-sm text-muted md:hidden">
              ⚙️ الأدمن
            </Link>
          )}
          <span className="rounded-full bg-star-soft px-3 py-1 text-sm font-bold text-star" title="نجومك">
            ⭐ {profile.stars}
          </span>
        </div>
      </div>
    </header>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface md:hidden">
      <div className="mx-auto grid max-w-3xl grid-cols-5">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex flex-col items-center gap-0.5 py-2 text-xs ${
              pathname === n.href ? "font-bold text-brand" : "text-muted"
            }`}
          >
            <span className="text-xl">{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center p-6">{children}</div>;
}
