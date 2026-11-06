"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { friendlyError, supabase, withTimeout } from "@/lib/supabase";
import type { Gender, Profile } from "@/lib/types";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** رسالة خطأ لو الجلسة أو الحساب متحملوش */
  error: string | null;
  retry: () => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  /** يختار الكلمة حسب نوع المستخدم: g("أضيفي", "أضيف") */
  g: (female: string, male: string) => string;
}

export function pickGender(gender: Gender | null | undefined, female: string, male: string) {
  return gender === "female" ? female : male;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    try {
      const { data, error } = await withTimeout(supabase.from("profiles").select("*").eq("id", userId).maybeSingle());
      if (error) throw error;
      if (!data) {
        setError("الحساب ده ملوش بيانات في قاعدة البيانات. سجّل خروج واعمل حساب جديد، أو بلّغ الأدمن.");
      } else {
        setError(null);
      }
      setProfile(data as Profile | null);
    } catch (e) {
      setError(friendlyError((e as Error).message ?? String(e)));
    }
  }, []);

  useEffect(() => {
    let done = false;
    // لو السيرفر مردش خالص، منفضلش نحمّل على طول
    const timeout = setTimeout(() => {
      if (!done) {
        setError("السيرفر مش بيرد. اتأكد من النت وجرب تاني.");
        setLoading(false);
      }
    }, 15000);

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        setSession(data.session);
        await loadProfile(data.session?.user.id);
      } catch (e) {
        setError(friendlyError((e as Error).message ?? String(e)));
      } finally {
        done = true;
        clearTimeout(timeout);
        setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // مينفعش نستدعي supabase جوه الـ callback مباشرة
      setTimeout(() => loadProfile(s?.user.id), 0);
    });
    return () => {
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, [loadProfile, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setAttempt((a) => a + 1);
  }, []);

  const refreshProfile = useCallback(() => loadProfile(session?.user.id), [loadProfile, session]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // حتى لو السيرفر مردش، نمسح الجلسة من الجهاز
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    }
    setSession(null);
    setProfile(null);
    setError(null);
  }, []);

  const gender = profile?.gender;
  const g = useCallback((female: string, male: string) => pickGender(gender, female, male), [gender]);

  return (
    <AuthContext.Provider value={{ session, profile, loading, error, retry, refreshProfile, signOut, g }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
