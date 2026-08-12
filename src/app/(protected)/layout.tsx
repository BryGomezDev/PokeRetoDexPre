"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { PokedexDataProvider } from "@/context/PokedexDataContext";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  // When Firebase resolves auth state to "no user" but the session cookie still
  // exists (stale cookie from a previous session or failed logout), the middleware
  // lets the request through but there is no active Firebase session. Without this
  // effect the spinner would hang forever because !user stays true indefinitely.
  useEffect(() => {
    if (!authLoading && !user) {
      document.cookie = "session=; path=/; max-age=0";
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) return <LoadingSpinner message={t("common.verifyingSession")} />;

  return <PokedexDataProvider>{children}</PokedexDataProvider>;
}
