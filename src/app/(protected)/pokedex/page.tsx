"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Sparkles, Ticket } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { usePokedexContext } from "@/context/PokedexDataContext";
import type { Variant, CardLanguage } from "@/hooks/usePokedexData";
import { Navigation } from "@/components/Navigation";
import { PokemonCard } from "@/components/PokemonCard";
import { PokemonModal } from "@/components/PokemonModal";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const REGIONS = [
  "kanto", "johto", "hoenn", "sinnoh", "unova",
  "kalos", "alola", "galar", "hisui", "paldea",
] as const;

const ALL_TYPES = [
  "normal", "fire", "water", "grass", "electric", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy",
] as const;

const VARIANT_KEYS = ["basica", "holo", "alternativa", "fullart"] as const;
const LANGUAGE_KEYS = ["es", "en", "zh", "ko", "ja", "otros"] as const;

const CHEVRON_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")";

const SELECT_CLASS =
  "bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 " +
  "focus:outline-none focus:border-red-500/60 cursor-pointer whitespace-nowrap flex-shrink-0 " +
  "appearance-none pr-7";

const SELECT_STYLE: React.CSSProperties = {
  backgroundImage: CHEVRON_SVG,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 8px center",
};

// ─── Small SVG icons ──────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PokedexPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const {
    pokemon,
    userProfile,
    loading: dataLoading,
    error,
    updatePokemonStatus,
    updateSpecialFlag,
    updateBulkStatus,
  } = usePokedexContext();

  const [search, setSearch] = useState("");
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState("");
  const [ownership, setOwnership] = useState<"all" | "owned" | "missing">("all");
  const [variantFilter, setVariantFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [shinyFilter, setShinyFilter] = useState(false);
  const [promoFilter, setPromoFilter] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  // Derived from live pokemon array so the modal always sees up-to-date is_shiny/is_promo
  const selectedPokemon = useMemo(
    () => (selectedSlug ? pokemon.find((p) => p.slug === selectedSlug) ?? null : null),
    [selectedSlug, pokemon]
  );

  const hasActiveFilters =
    !!search || !!activeRegion || !!selectedType || ownership !== "all" || !!variantFilter || !!languageFilter || !!categoryFilter || shinyFilter || promoFilter;

  function clearFilters() {
    setSearch("");
    setActiveRegion(null);
    setSelectedType("");
    setOwnership("all");
    setVariantFilter("");
    setLanguageFilter("");
    setCategoryFilter("");
    setShinyFilter(false);
    setPromoFilter(false);
  }

  const basePokemon = useMemo(
    () => pokemon.filter((p) => !p.is_special_form),
    [pokemon]
  );

  const regionProgress = useMemo(
    () =>
      REGIONS.map((region) => {
        const rp = basePokemon.filter((p) => p.region.toLowerCase() === region);
        return { region, owned: rp.filter((p) => p.owned).length, total: rp.length };
      }).filter((r) => r.total > 0),
    [basePokemon]
  );

  const totalProgress = useMemo(() => {
    const owned = basePokemon.filter((p) => p.owned).length;
    return { owned, total: basePokemon.length };
  }, [basePokemon]);

  const specialProgress = useMemo(() => {
    const specials = pokemon.filter((p) => p.is_special_form);
    return { owned: specials.filter((p) => p.owned).length, total: specials.length };
  }, [pokemon]);

  const filteredPokemon = useMemo(
    () =>
      pokemon.filter((p) => {
        if (activeRegion && p.region.toLowerCase() !== activeRegion) return false;
        if (selectedType && !p.types.map((typ) => typ.toLowerCase()).includes(selectedType)) return false;
        if (ownership === "owned" && !p.owned) return false;
        if (ownership === "missing" && p.owned) return false;
        if (variantFilter && p.variant !== variantFilter) return false;
        if (languageFilter && p.language !== languageFilter) return false;
        if (categoryFilter === "nacional" && p.form_type !== null) return false;
        if (categoryFilter === "mega" && p.form_type !== "mega") return false;
        if (categoryFilter === "gmax" && p.form_type !== "gmax") return false;
        if (categoryFilter === "regional" && p.form_type !== "regional") return false;
        if (shinyFilter && !p.is_shiny) return false;
        if (promoFilter && !p.is_promo) return false;
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          if (!String(p.pokedex_number).includes(q) && !p.name.toLowerCase().includes(q)) return false;
        }
        return true;
      }),
    [pokemon, activeRegion, selectedType, ownership, variantFilter, languageFilter, categoryFilter, shinyFilter, promoFilter, search]
  );

  const avatarSpriteUrl = useMemo(() => {
    if (!userProfile?.avatar_pokemon_slug) return null;
    return pokemon.find((p) => p.slug === userProfile.avatar_pokemon_slug)?.sprite_url ?? null;
  }, [userProfile, pokemon]);

  const handleModalClose = useCallback(() => setSelectedSlug(null), []);

  const handleModalSave = useCallback(
    async (owned: boolean, variant: Variant | null, language: CardLanguage | null) => {
      if (!selectedPokemon) return;
      await updatePokemonStatus(selectedPokemon.slug, owned, variant, language);
    },
    [selectedPokemon, updatePokemonStatus]
  );

  async function handleSignOut() {
    await signOut(auth);
    document.cookie = "session=; path=/; max-age=0";
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen bg-gray-950 text-white">
      <Navigation />

      {/* Main content area — offset by sidebar on desktop */}
      <main className="flex-1 min-w-0 lg:ml-56 pb-20 lg:pb-0">

        {/* ── Sticky header ───────────────────────────────────────── */}
        <header className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-base font-bold lg:hidden select-none flex-shrink-0">
              <span className="text-red-500">Poké</span>
              <span className="text-white">RetoDex</span>
            </span>
            <h1 className="hidden lg:block text-lg font-bold text-white">Pokédex</h1>
            {!dataLoading && totalProgress.total > 0 && (
              <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full font-mono flex-shrink-0">
                {totalProgress.owned}/{totalProgress.total}
              </span>
            )}
            {!dataLoading && specialProgress.total > 0 && (
              <span className="text-xs text-purple-300 bg-purple-900/40 border border-purple-800/40 px-2 py-0.5 rounded-full font-mono flex-shrink-0">
                {t("pokedex.specialBadge")}&nbsp;{specialProgress.owned}/{specialProgress.total}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {userProfile && (
              <span className="hidden sm:block text-sm text-gray-300 truncate max-w-[120px]">
                {userProfile.username}
              </span>
            )}
            <Link
              href="/configuracion"
              title={t("configuracion.title")}
              className="block relative w-8 h-8 rounded-full bg-gray-800 border border-gray-700 overflow-hidden hover:border-red-500/60 transition-colors flex-shrink-0"
            >
              {avatarSpriteUrl ? (
                <Image
                  src={avatarSpriteUrl}
                  alt={userProfile?.username ?? "Avatar"}
                  fill
                  sizes="32px"
                  className="object-contain"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full bg-gray-700" />
              )}
            </Link>
            <button
              onClick={handleSignOut}
              title={t("common.signOut")}
              className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-md hover:bg-gray-800"
            >
              <SignOutIcon />
              <span className="sr-only">{t("common.signOut")}</span>
            </button>
          </div>
        </header>

        {/* ── Loading ──────────────────────────────────────────────── */}
        {dataLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-8 h-8 border-4 border-gray-700 border-t-red-500 rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">{t("pokedex.loading")}</p>
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────────── */}
        {!dataLoading && error && (
          <div className="m-4 p-4 bg-red-950/40 border border-red-800/50 rounded-xl text-red-400 text-sm" role="alert">
            {error}
          </div>
        )}

        {/* ── Content ──────────────────────────────────────────────── */}
        {!dataLoading && !error && (
          <>
            {/* Region progress chips — horizontal scroll */}
            <div className="overflow-x-auto scrollbar-none border-b border-gray-800">
              <div className="flex gap-2 px-4 py-3" style={{ width: "max-content" }}>

                {/* "All" chip */}
                <button
                  onClick={() => setActiveRegion(null)}
                  className={cn(
                    "flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-colors min-w-[86px]",
                    activeRegion === null
                      ? "border-red-500 bg-red-500/10 text-red-400"
                      : "border-gray-700 bg-gray-800/60 text-gray-300 hover:border-gray-600"
                  )}
                >
                  <span className="text-xs font-semibold leading-none">{t("pokedex.all")}</span>
                  <span className="text-[10px] text-gray-400 mt-0.5">
                    {totalProgress.owned}/{totalProgress.total}
                  </span>
                  <div className="w-full h-1 bg-gray-700 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full"
                      style={{
                        width: totalProgress.total > 0
                          ? `${Math.round((totalProgress.owned / totalProgress.total) * 100)}%`
                          : "0%",
                      }}
                    />
                  </div>
                </button>

                {regionProgress.map(({ region, owned, total }) => {
                  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
                  const isActive = activeRegion === region;
                  return (
                    <button
                      key={region}
                      onClick={() => setActiveRegion(isActive ? null : region)}
                      className={cn(
                        "flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-colors min-w-[86px]",
                        isActive
                          ? "border-red-500 bg-red-500/10 text-red-400"
                          : "border-gray-700 bg-gray-800/60 text-gray-300 hover:border-gray-600"
                      )}
                    >
                      <span className="text-xs font-semibold leading-none">
                        {t("regions." + region)}
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.5">
                        {owned}/{total} · {pct}%
                      </span>
                      <div className="w-full h-1 bg-gray-700 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", isActive ? "bg-red-400" : "bg-red-600")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search + filter bar */}
            <div className="px-4 py-3 space-y-2.5 border-b border-gray-800">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                  <SearchIcon />
                </span>
                <input
                  type="search"
                  placeholder={t("pokedex.searchPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20"
                />
              </div>

              {/* Filters — scrollable on mobile, wraps on desktop */}
              <div className="flex gap-2 overflow-x-auto scrollbar-none lg:flex-wrap">
                {/* Ownership toggle */}
                <div className="flex rounded-lg overflow-hidden border border-gray-700 flex-shrink-0">
                  {(["all", "owned", "missing"] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setOwnership(opt)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                        ownership === opt
                          ? "bg-red-500 text-white"
                          : "bg-gray-800 text-gray-400 hover:text-gray-200"
                      )}
                    >
                      {opt === "all"
                        ? t("pokedex.filterAll")
                        : opt === "owned"
                        ? t("pokedex.filterOwned")
                        : t("pokedex.filterMissing")}
                    </button>
                  ))}
                </div>

                <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className={SELECT_CLASS} style={SELECT_STYLE}>
                  <option value="">{t("pokedex.filterType")}</option>
                  {ALL_TYPES.map((typ) => <option key={typ} value={typ}>{t("pokedex.types." + typ)}</option>)}
                </select>

                <select value={variantFilter} onChange={(e) => setVariantFilter(e.target.value)} className={SELECT_CLASS} style={SELECT_STYLE}>
                  <option value="">{t("pokedex.filterVariant")}</option>
                  {VARIANT_KEYS.map((v) => <option key={v} value={v}>{t("pokedex.variants." + v)}</option>)}
                </select>

                <select value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)} className={SELECT_CLASS} style={SELECT_STYLE}>
                  <option value="">{t("pokedex.filterLanguage")}</option>
                  {LANGUAGE_KEYS.map((v) => <option key={v} value={v}>{t("pokedex.languages." + v)}</option>)}
                </select>

                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={SELECT_CLASS} style={SELECT_STYLE}>
                  <option value="">{t("pokedex.filterCategory")}</option>
                  <option value="nacional">{t("pokedex.categoryNational")}</option>
                  <option value="mega">{t("pokedex.categoryMega")}</option>
                  <option value="gmax">{t("pokedex.categoryGmax")}</option>
                  <option value="regional">{t("pokedex.categoryRegional")}</option>
                </select>

                <button
                  onClick={() => setShinyFilter(!shinyFilter)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap flex-shrink-0",
                    shinyFilter
                      ? "bg-yellow-400/15 border-yellow-500 text-yellow-400"
                      : "border-gray-700 bg-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-600"
                  )}
                >
                  <Sparkles size={12} />
                  {t("pokedex.filterShiny")}
                </button>

                <button
                  onClick={() => setPromoFilter(!promoFilter)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap flex-shrink-0",
                    promoFilter
                      ? "bg-blue-400/15 border-blue-500 text-blue-400"
                      : "border-gray-700 bg-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-600"
                  )}
                >
                  <Ticket size={12} />
                  {t("pokedex.filterPromo")}
                </button>

                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg bg-gray-800 hover:border-gray-600 transition-colors whitespace-nowrap flex-shrink-0"
                  >
                    <XIcon />
                    {t("pokedex.clearFilters")}
                  </button>
                )}
              </div>
            </div>

            {/* Results count */}
            <p className="px-4 pt-2.5 pb-1 text-xs text-gray-500">
              {filteredPokemon.length === pokemon.length
                ? t("pokedex.resultsAll", { count: pokemon.length })
                : t("pokedex.resultsFiltered", { filtered: filteredPokemon.length, total: pokemon.length })}
            </p>

            {/* Empty state */}
            {filteredPokemon.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-4">
                <span className="text-5xl" aria-hidden="true">🔍</span>
                <p className="text-gray-300 font-medium">{t("pokedex.emptyTitle")}</p>
                <p className="text-gray-500 text-sm">{t("pokedex.emptyHint")}</p>
                <button
                  onClick={clearFilters}
                  className="mt-1 text-xs text-red-400 hover:text-red-300 underline underline-offset-2"
                >
                  {t("pokedex.clearFiltersLink")}
                </button>
              </div>
            ) : (
              /* Pokémon grid — 3 cols mobile → 8 cols 2xl */
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-1.5 p-4 pt-2">
                {filteredPokemon.map((p) => (
                  <PokemonCard
                    key={p.slug}
                    pokemon={p}
                    onClick={() => setSelectedSlug(p.slug)}

                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Detail modal — portal handled by fixed positioning */}
      {selectedPokemon && (
        <PokemonModal
          pokemon={selectedPokemon}
          onClose={handleModalClose}
          onSave={handleModalSave}
          onToggleShiny={() => updateSpecialFlag(selectedPokemon.slug, "is_shiny", !selectedPokemon.is_shiny)}
          onTogglePromo={() => updateSpecialFlag(selectedPokemon.slug, "is_promo", !selectedPokemon.is_promo)}
          onToggleBulk={() => updateBulkStatus(selectedPokemon.slug, !selectedPokemon.is_bulk, selectedPokemon.is_bulk ? 0 : 1)}
          onUpdateBulkQuantity={(qty) => updateBulkStatus(selectedPokemon.slug, true, qty)}
        />
      )}
    </div>
  );
}
