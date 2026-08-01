"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./AuthContext";
import { es } from "@/lib/i18n/es";
import { en } from "@/lib/i18n/en";

type Language = "es" | "en";
type TFn = (key: string, vars?: Record<string, string | number>) => string;

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  syncFromFirestore: (lang: Language) => void;
  t: TFn;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "es",
  setLanguage: () => {},
  syncFromFirestore: () => {},
  t: (key) => key,
});

function resolve(obj: unknown, parts: string[]): string | undefined {
  let cur = obj;
  for (const part of parts) {
    if (cur !== null && typeof cur === "object" && part in (cur as object)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // Always start with the default so server and client produce the same initial HTML.
  // The real preference is applied client-side only, after hydration.
  const [language, setLanguageState] = useState<Language>("es");

  // Read localStorage after hydration — safe, no server/client mismatch
  useEffect(() => {
    const saved = localStorage.getItem("app_language");
    if (saved === "en") setLanguageState("en");
  }, []);

  // Update <html lang> attribute on language change
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  // Called by PokedexDataProvider after reading the user doc — no write-back to Firestore.
  const syncFromFirestore = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("app_language", lang);
  }, []);

  const setLanguage = useCallback(
    (lang: Language) => {
      setLanguageState(lang);
      localStorage.setItem("app_language", lang);
      if (user?.uid) {
        updateDoc(doc(db, "users", user.uid), { app_language: lang }).catch((err) =>
          console.error("[LanguageContext] save:", err)
        );
      }
    },
    [user?.uid]
  );

  const t = useCallback<TFn>(
    (key, vars) => {
      const parts = key.split(".");
      const dict = language === "en" ? en : es;
      let result = resolve(dict, parts);
      if (result === undefined && language !== "es") {
        result = resolve(es, parts);
      }
      if (result === undefined) return key;
      if (vars) {
        return result.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
      }
      return result;
    },
    [language]
  );

  const value = useMemo(
    () => ({ language, setLanguage, syncFromFirestore, t }),
    [language, setLanguage, syncFromFirestore, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}

export type { Language, TFn };
