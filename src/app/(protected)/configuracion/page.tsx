"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { usePokedexContext } from "@/context/PokedexDataContext";
import type { PokemonWithStatus } from "@/hooks/usePokedexData";
import { Navigation } from "@/components/Navigation";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { AVATAR_SLUGS, formatAvatarName } from "@/lib/avatars";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import type { TFn } from "@/context/LanguageContext";
import { APP_VERSION } from "@/lib/constants";

// ─── Export helpers ───────────────────────────────────────────────────────────

function generateExportText(
  pokemon: PokemonWithStatus[],
  t: TFn,
  dateStr: string
): string {
  const missingNational = pokemon
    .filter((p) => p.form_type === null && !p.owned)
    .sort((a, b) => a.sort_order - b.sort_order);

  const missingMega = pokemon
    .filter((p) => p.form_type === "mega" && !p.owned)
    .sort((a, b) => a.sort_order - b.sort_order);

  const missingGmax = pokemon
    .filter((p) => p.form_type === "gmax" && !p.owned)
    .sort((a, b) => a.sort_order - b.sort_order);

  const missingRegional = pokemon
    .filter((p) => p.form_type === "regional" && !p.owned)
    .sort((a, b) => a.sort_order - b.sort_order);

  const totalSpecials = missingMega.length + missingGmax.length + missingRegional.length;

  const lines: string[] = [
    t("configuracion.exportFileTitle"),
    t("configuracion.exportFileGenerated", { date: dateStr }),
    "",
    t("configuracion.exportNationalHeader", { missing: missingNational.length }),
  ];

  for (const p of missingNational) {
    const regionKey = p.region.toLowerCase();
    const regionDisplay = t(`regions.${regionKey}`);
    const regionLabel = regionDisplay === `regions.${regionKey}` ? p.region : regionDisplay;
    lines.push(`#${String(p.pokedex_number).padStart(3, "0")} ${p.name} (${regionLabel})`);
  }

  lines.push("");
  lines.push(t("configuracion.exportSpecialsHeader", { missing: totalSpecials }));

  if (missingMega.length > 0) {
    lines.push(t("configuracion.exportMegaLabel"));
    for (const p of missingMega) lines.push(formatAvatarName(p.name));
  }

  if (missingGmax.length > 0) {
    lines.push(t("configuracion.exportGmaxLabel"));
    for (const p of missingGmax) lines.push(formatAvatarName(p.name));
  }

  if (missingRegional.length > 0) {
    lines.push(t("configuracion.exportRegionalLabel"));
    const REGION_ORDER = ["alola", "galar", "hisui", "paldea"];

    const byRegion: Record<string, typeof missingRegional> = {};
    for (const p of missingRegional) {
      if (!byRegion[p.region]) byRegion[p.region] = [];
      byRegion[p.region].push(p);
    }

    const orderedRegions = [
      ...REGION_ORDER.filter((r) => byRegion[r]),
      ...Object.keys(byRegion).filter((r) => !REGION_ORDER.includes(r)),
    ];

    for (const region of orderedRegions) {
      const regionKey = region.toLowerCase();
      const regionDisplay = t(`regions.${regionKey}`);
      const regionLabel = regionDisplay === `regions.${regionKey}` ? region : regionDisplay;
      lines.push(t("configuracion.exportRegionalSub", { region: regionLabel }));
      for (const p of byRegion[region]) lines.push(`    ${formatAvatarName(p.name)}`);
    }
  }

  return lines.join("\n");
}

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

function DownloadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid ?? null;
  const { language, setLanguage, t } = useLanguage();

  const { pokemon, userProfile, loading: dataLoading } = usePokedexContext();

  // Avatar selector state
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savedAvatarSlug, setSavedAvatarSlug] = useState<string | null>(null);
  const [avatarSaveSuccess, setAvatarSaveSuccess] = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);

  // Sync savedAvatarSlug when profile first loads
  useEffect(() => {
    if (userProfile?.avatar_pokemon_slug && !savedAvatarSlug) {
      setSavedAvatarSlug(userProfile.avatar_pokemon_slug);
    }
  }, [userProfile, savedAvatarSlug]);

  // Build avatar sprite lookup from already-loaded pokemon data
  const avatarData = useMemo(() => {
    const map: Record<string, { name: string; sprite_url: string }> = {};
    for (const p of pokemon) {
      if ((AVATAR_SLUGS as readonly string[]).includes(p.slug)) {
        map[p.slug] = { name: p.name, sprite_url: p.sprite_url };
      }
    }
    return map;
  }, [pokemon]);

  // The slug shown as "current" — local override takes precedence after save
  const currentAvatarSlug = savedAvatarSlug ?? userProfile?.avatar_pokemon_slug ?? null;
  const currentAvatarSprite = currentAvatarSlug
    ? (avatarData[currentAvatarSlug]?.sprite_url ?? null)
    : null;

  async function handleSaveAvatar() {
    if (!pendingAvatar || !uid) return;
    setSavingAvatar(true);
    try {
      await updateDoc(doc(db, "users", uid), { avatar_pokemon_slug: pendingAvatar });
      setSavedAvatarSlug(pendingAvatar);
      setShowAvatarSelector(false);
      setPendingAvatar(null);
      setAvatarSaveSuccess(true);
      setTimeout(() => setAvatarSaveSuccess(false), 3000);
    } catch (err) {
      console.error("[configuracion] Error al guardar avatar:", err);
    } finally {
      setSavingAvatar(false);
    }
  }

  function handleExport() {
    setExporting(true);
    try {
      const date = new Date();
      const dateStr = date.toLocaleDateString(language === "en" ? "en-US" : "es-ES", {
        day: "2-digit", month: "2-digit", year: "numeric",
      });
      const content = generateExportText(pokemon, t, dateStr);
      const isoDate = date.toISOString().slice(0, 10);
      const filenamePart = t("configuracion.exportFilenamePart");
      triggerDownload(content, `pokeretodex-${filenamePart}-${isoDate}.txt`);
    } finally {
      setExporting(false);
    }
  }

  if (authLoading || !user) return <LoadingSpinner message={t("common.verifyingSession")} />;

  return (
    <div className="flex min-h-screen bg-gray-950 text-white">
      <Navigation />

      <main className="flex-1 min-w-0 lg:ml-56 pb-20 lg:pb-0">

        {/* ── Sticky header ─────────────────────────────────────────── */}
        <header className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800 px-4 py-3 flex items-center gap-3">
          <span className="text-base font-bold lg:hidden select-none flex-shrink-0">
            <span className="text-red-500">Poké</span>
            <span className="text-white">RetoDex</span>
          </span>
          <h1 className="hidden lg:block text-lg font-bold text-white">{t("configuracion.title")}</h1>
        </header>

        {/* ── Content — centered card on desktop ────────────────────── */}
        <div className="p-4 lg:flex lg:justify-center">
          <div className="w-full lg:max-w-lg space-y-5 lg:mt-4">

            {/* ── Perfil ──────────────────────────────────────────────── */}
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {t("configuracion.profileSection")}
              </h2>
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">

                {/* Avatar + username */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="relative w-16 h-16 rounded-full bg-gray-800 border-2 border-gray-700 overflow-hidden flex-shrink-0">
                    {currentAvatarSprite ? (
                      <Image
                        src={currentAvatarSprite}
                        alt={userProfile?.username ?? "Avatar"}
                        fill
                        sizes="64px"
                        className="object-contain"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-700 animate-pulse" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-0.5">{t("configuracion.usernameLabel")}</p>
                    <p className="text-lg font-bold text-white truncate">
                      {userProfile?.username ?? (dataLoading ? "…" : "—")}
                    </p>
                    <p className="text-[11px] text-gray-600 mt-0.5">{t("configuracion.usernameNote")}</p>
                  </div>
                </div>

                {/* Change avatar trigger */}
                <div className="border-t border-gray-800 px-5 py-3 flex items-center justify-between gap-3">
                  <div>
                    {avatarSaveSuccess && (
                      <p className="text-green-400 text-xs">{t("configuracion.avatarSaved")}</p>
                    )}
                    {!avatarSaveSuccess && (
                      <p className="text-xs text-gray-500">{t("configuracion.avatarHint")}</p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setShowAvatarSelector((v) => !v);
                      setPendingAvatar(null);
                    }}
                    className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors flex-shrink-0"
                  >
                    {showAvatarSelector ? t("configuracion.cancelAvatar") : t("configuracion.changeAvatar")}
                  </button>
                </div>

                {/* Avatar grid — appears when selector is open */}
                {showAvatarSelector && (
                  <div className="border-t border-gray-800 px-5 pb-5 pt-4">
                    <div
                      className="grid grid-cols-4 sm:grid-cols-5 gap-2"
                      role="radiogroup"
                      aria-label={t("configuracion.avatarSelectorLabel")}
                    >
                      {AVATAR_SLUGS.map((slug) => {
                        const data = avatarData[slug];
                        const isSelected = (pendingAvatar ?? currentAvatarSlug) === slug;
                        return (
                          <button
                            key={slug}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            aria-label={data?.name ? formatAvatarName(data.name) : slug}
                            onClick={() => setPendingAvatar(slug)}
                            className={cn(
                              "flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all duration-150",
                              "bg-gray-800/60 hover:bg-gray-700/80",
                              isSelected
                                ? "border-yellow-400 ring-2 ring-yellow-400/30 scale-105 bg-gray-700"
                                : "border-transparent hover:border-gray-600"
                            )}
                          >
                            <div className="relative w-12 h-12">
                              {data?.sprite_url ? (
                                <Image
                                  src={data.sprite_url}
                                  alt={data.name ?? slug}
                                  fill
                                  sizes="48px"
                                  className="object-contain drop-shadow-sm"
                                  unoptimized
                                />
                              ) : dataLoading ? (
                                <div className="w-full h-full rounded-full bg-gray-700 animate-pulse" />
                              ) : null}
                            </div>
                            <span className="text-gray-400 text-[9px] leading-tight text-center truncate w-full">
                              {data?.name ? formatAvatarName(data.name) : slug}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Save button — only when a new avatar is selected */}
                    {pendingAvatar && pendingAvatar !== currentAvatarSlug && (
                      <button
                        onClick={handleSaveAvatar}
                        disabled={savingAvatar}
                        className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {savingAvatar ? t("configuracion.saving") : t("configuracion.saveAvatar")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* ── Gestión de datos ────────────────────────────────────── */}
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {t("configuracion.dataSection")}
              </h2>
              <div className="bg-gray-900 rounded-xl border border-gray-800 px-5 py-5 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-white">{t("configuracion.exportTitle")}</p>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    {t("configuracion.exportHint")}
                  </p>
                </div>
                <button
                  onClick={handleExport}
                  disabled={exporting || dataLoading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-gray-200 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  <DownloadIcon />
                  {exporting ? t("configuracion.exporting") : t("configuracion.exportButton")}
                </button>
              </div>
            </section>

            {/* ── Aviso Legal + versión ───────────────────────────────── */}
            <div className="flex items-center justify-center gap-2 py-1">
              <Link
                href="/legal"
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                {t("common.legalLink")}
              </Link>
              <span className="text-gray-800 text-xs select-none">·</span>
              <span className="text-xs text-gray-700 select-none tabular-nums">{APP_VERSION}</span>
            </div>

            {/* ── Idioma de la aplicación ──────────────────────────────── */}
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {t("configuracion.languageSection")}
              </h2>
              <div className="bg-gray-900 rounded-xl border border-gray-800 px-5 py-5 space-y-4">
                <p className="text-xs text-gray-400">{t("configuracion.languageHint")}</p>
                <div className="flex gap-2">
                  {(["es", "en"] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setLanguage(lang)}
                      className={cn(
                        "flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-all",
                        language === lang
                          ? "border-red-500 bg-red-500/15 text-red-400"
                          : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-white"
                      )}
                    >
                      {lang === "es" ? t("configuracion.languageEs") : t("configuracion.languageEn")}
                    </button>
                  ))}
                </div>
              </div>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
}
