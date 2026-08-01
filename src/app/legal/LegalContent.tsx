"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

export function LegalContent() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-gray-950 text-white px-5 py-10 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-8">

        {/* Brand + back */}
        <div className="flex items-center justify-between gap-4">
          <span className="text-xl font-bold select-none">
            <span className="text-red-500">Poké</span>
            <span className="text-white">RetoDex</span>
          </span>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            {t("common.legalBack")}
          </Link>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl px-6 py-8 space-y-5">
          <h1 className="text-lg font-bold text-white">{t("legal.title")}</h1>

          <div className="border-t border-gray-800" />

          <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
            <p>
              <strong className="text-white">PokéRetoDex</strong>{" "}
              {t("legal.p1")}
            </p>
            <p>{t("legal.p2")}</p>
            <p>{t("legal.p3")}</p>
            <p>{t("legal.p4")}</p>
          </div>

          <div className="border-t border-gray-800 pt-4">
            <p className="text-xs text-gray-500">{t("legal.rights")}</p>
          </div>
        </div>

      </div>
    </main>
  );
}
