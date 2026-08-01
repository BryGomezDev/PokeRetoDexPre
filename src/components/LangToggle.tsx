"use client";

import React from "react";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";

export function LangToggle() {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="flex items-center gap-0.5 text-xs font-medium select-none" role="group" aria-label="Language / Idioma">
      {(["es", "en"] as const).map((lang, i) => (
        <React.Fragment key={lang}>
          {i > 0 && <span className="text-gray-700 px-0.5" aria-hidden="true">|</span>}
          <button
            onClick={() => setLanguage(lang)}
            aria-pressed={language === lang}
            className={cn(
              "px-1.5 py-0.5 rounded transition-colors",
              language === lang
                ? "text-white bg-gray-700"
                : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
            )}
          >
            {lang.toUpperCase()}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
