"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { notFound } from "next/navigation";
import { usePokedexContext } from "@/context/PokedexDataContext";
import { useLanguage } from "@/context/LanguageContext";
import CardThumbnail, { type CatalogCard, type MergedCard } from "@/components/CardThumbnail";

// ─── types ──────────────────────────────────────────────────────────────────

type RarityEntry = { tcgdex: string; es: string | null; wikidex: boolean; cards: number };

interface CatalogData {
  en: CatalogCard[];
  es: CatalogCard[];
}

type StatusFilter = "all" | "owned" | "missing";

const STATUS_KEYS = {
  all: "cards.statusAll",
  owned: "cards.statusOwned",
  missing: "cards.statusMissing",
} as const;

// ─── merge helper ────────────────────────────────────────────────────────────

function mergeCards(data: CatalogData): MergedCard[] {
  const esMap = new Map(data.es.map((c) => [c.id, c]));
  return data.en.map((c) => {
    const esCard = esMap.get(c.id);
    return { ...c, nameEs: esCard?.name ?? null, hasEs: !!esCard };
  });
}

// ─── Suspense shell ──────────────────────────────────────────────────────────

export default function PokemonCardsPage({ params }: { params: { dexId: string } }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-gray-950">
          <div className="w-8 h-8 border-4 border-gray-700 border-t-red-500 rounded-full animate-spin" />
        </div>
      }
    >
      <CardsContent params={params} />
    </Suspense>
  );
}

// ─── main content ────────────────────────────────────────────────────────────

function CardsContent({ params }: { params: { dexId: string } }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { pokemon, loading: ctxLoading } = usePokedexContext();
  const { language, t } = useLanguage();

  // dexId validation
  const dexId = parseInt(params.dexId, 10);
  const validDexId = !isNaN(dexId) && dexId >= 1 && dexId <= 1025;

  // Find base species from context
  const poke = useMemo(
    () =>
      validDexId
        ? pokemon.find((p) => p.pokedex_number === dexId && p.form_type === null) ?? null
        : null,
    [pokemon, dexId, validDexId]
  );

  // Catalog fetch state — retryCount lets the user retry without changing dexId
  const [retryCount, setRetryCount] = useState(0);
  const [catalogData, setCatalogData] = useState<MergedCard[] | null>(null);
  const [rarityMap, setRarityMap] = useState<Record<string, { es: string | null }>>({});
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    if (!validDexId) return;
    let cancelled = false;
    setFetchLoading(true);
    setFetchError(false);
    Promise.all([
      fetch(`/catalog/v1/${dexId}.json`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<CatalogData>; }),
      fetch(`/catalog/v1/rarities.json`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<RarityEntry[]>; }),
    ])
      .then(([catalogRaw, raritiesRaw]) => {
        if (!cancelled) {
          setCatalogData(mergeCards(catalogRaw));
          setRarityMap(Object.fromEntries(raritiesRaw.map((e) => [e.tcgdex, { es: e.es }])));
          setFetchLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetchError(true);
          setFetchLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [dexId, validDexId, retryCount]);

  function labelForRarity(rarity: string, lang: "es" | "en"): string {
    if (rarity === "None") return lang === "es" ? t("cards.rarityNone") : "No rarity";
    const entry = rarityMap[rarity];
    if (lang === "es" && entry?.es) return entry.es;
    return rarity;
  }

  // Filter state from URL
  const statusFilter = (searchParams.get("status") as StatusFilter | null) ?? "all";
  const setFilter = searchParams.get("set") ?? "";
  const rarityFilter = searchParams.get("rarity") ?? "";
  // Display language: URL param > app language
  const displayLang = (searchParams.get("lang") as "en" | "es" | null) ?? language;

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function clearFilters() {
    router.replace(pathname, { scroll: false });
  }

  // Derive available filter options from catalog (preserving catalog order)
  const availableSets = useMemo(() => {
    if (!catalogData) return [];
    const seen = new Set<string>();
    const order: string[] = [];
    for (const c of catalogData) {
      if (!seen.has(c.setName)) { seen.add(c.setName); order.push(c.setName); }
    }
    return order;
  }, [catalogData]);

  const availableRarities = useMemo(() => {
    if (!catalogData) return [];
    const seen = new Set<string>();
    const order: string[] = [];
    for (const c of catalogData) {
      if (!seen.has(c.rarity)) { seen.add(c.rarity); order.push(c.rarity); }
    }
    return order;
  }, [catalogData]);

  // Filtered cards
  const filteredCards = useMemo(() => {
    if (!catalogData) return [];
    return catalogData.filter((c) => {
      const owned = poke ? Object.hasOwn(poke.cards, c.id) : false;
      if (statusFilter === "owned" && !owned) return false;
      if (statusFilter === "missing" && owned) return false;
      if (setFilter && c.setName !== setFilter) return false;
      if (rarityFilter && c.rarity !== rarityFilter) return false;
      return true;
    });
  }, [catalogData, poke, statusFilter, setFilter, rarityFilter]);

  const totalCards = catalogData?.length ?? 0;
  const shownCards = filteredCards.length;
  const hasActiveFilters = statusFilter !== "all" || setFilter !== "" || rarityFilter !== "";

  // Route guard
  if (!ctxLoading && !validDexId) notFound();

  // ─── loading ───────────────────────────────────────────────────────────────
  if (ctxLoading || fetchLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <header className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white transition-colors text-sm flex-shrink-0"
            aria-label={t("cards.back")}
          >
            {t("cards.back")}
          </button>
          <div className="w-10 h-10 rounded-full bg-gray-800 animate-pulse flex-shrink-0" />
          <div className="h-4 w-32 bg-gray-800 rounded animate-pulse" />
        </header>
        <main className="p-4" aria-busy="true" aria-label={t("cards.loading")}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[5/7] rounded-lg bg-gray-800/60 animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  // ─── error ─────────────────────────────────────────────────────────────────
  if (fetchError) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-gray-400 text-center" role="alert">{t("cards.error")}</p>
        <button
          onClick={() => setRetryCount((n) => n + 1)}
          className="text-sm text-red-400 hover:text-red-300 underline"
        >
          {t("cards.errorRetry")}
        </button>
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-400 underline">
          {t("cards.back")}
        </button>
      </div>
    );
  }

  // ─── Pokémon not in context ────────────────────────────────────────────────
  if (!poke) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-gray-400 text-center">Pokémon #{dexId} — {t("cards.noCards")}</p>
        <button onClick={() => router.back()} className="text-sm text-red-400 hover:text-red-300 underline">
          {t("cards.back")}
        </button>
      </div>
    );
  }

  // ─── no cards in catalog (would be empty) ──────────────────────────────────
  if (totalCards === 0) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <PageHeader poke={poke} onBack={() => router.back()} backLabel={t("cards.back")} />
        <main className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-4">
          <p className="text-gray-400 text-center">{t("cards.noCards")}</p>
          <button onClick={() => router.back()} className="text-sm text-red-400 hover:text-red-300 underline">
            {t("cards.back")}
          </button>
        </main>
      </div>
    );
  }

  // ─── main render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PageHeader poke={poke} onBack={() => router.back()} backLabel={t("cards.back")} />

      {/* Filter bar */}
      <div className="sticky top-[73px] z-20 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800">
        <div className="px-3 py-2 flex flex-wrap gap-2 items-center">

          {/* Status — radio group */}
          <fieldset className="flex gap-1">
            <legend className="sr-only">{t("cards.statusAll")}</legend>
            {(["all", "owned", "missing"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={statusFilter === s}
                onClick={() => setParam("status", s === "all" ? "" : s)}
                className={[
                  "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                  statusFilter === s
                    ? "bg-red-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700",
                ].join(" ")}
              >
                {t(STATUS_KEYS[s])}
              </button>
            ))}
          </fieldset>

          {/* Set filter */}
          <select
            aria-label={t("cards.filterSet")}
            value={setFilter}
            onChange={(e) => setParam("set", e.target.value)}
            className="text-xs bg-gray-800 text-gray-300 rounded-full px-2.5 py-1 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500 max-w-[150px] truncate"
          >
            <option value="">{t("cards.allSets")}</option>
            {availableSets.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Rarity filter */}
          <select
            aria-label={t("cards.filterRarity")}
            value={rarityFilter}
            onChange={(e) => setParam("rarity", e.target.value)}
            className="text-xs bg-gray-800 text-gray-300 rounded-full px-2.5 py-1 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500 max-w-[150px] truncate"
          >
            <option value="">{t("cards.allRarities")}</option>
            {(() => {
              const usedLabels = new Set<string>();
              return availableRarities.map((r) => {
                let label = labelForRarity(r, displayLang);
                if (usedLabels.has(label)) label = r; // fallback al literal de la API si la etiqueta traducida ya fue usada
                usedLabels.add(label);
                return <option key={r} value={r}>{label}</option>;
              });
            })()}
          </select>

          {/* Display language toggle */}
          <div className="flex gap-1 ml-auto" role="group" aria-label={t("cards.filterLang")}>
            {(["es", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={displayLang === l}
                onClick={() => setParam("lang", l === language ? "" : l)}
                className={[
                  "px-2 py-1 rounded text-[11px] font-bold transition-colors",
                  displayLang === l
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700",
                ].join(" ")}
              >
                {l === "es" ? t("cards.filterLangEs") : t("cards.filterLangEn")}
              </button>
            ))}
          </div>
        </div>

        {/* Counter + clear */}
        <div className="px-3 pb-2 flex items-center gap-2">
          <span className="text-xs text-gray-400" aria-live="polite" aria-atomic="true">
            {shownCards < totalCards
              ? t("cards.counter")
                  .replace("{shown}", String(shownCards))
                  .replace("{total}", String(totalCards))
              : t("cards.counterAll").replace("{total}", String(totalCards))}
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-[11px] text-red-400 hover:text-red-300 underline"
            >
              {t("cards.clearFilters")}
            </button>
          )}
        </div>
      </div>

      {/* Card grid */}
      <main className="p-3 pb-8">
        {filteredCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-2">
            <p className="text-gray-400 font-medium">{t("cards.emptyTitle")}</p>
            <p className="text-gray-600 text-sm text-center">{t("cards.emptyHint")}</p>
          </div>
        ) : (
          <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
            role="list"
            aria-label={poke.name}
          >
            {filteredCards.map((card) => {
              const isOwned = poke ? Object.hasOwn(poke.cards, card.id) : false;
              return (
                <div key={card.id} role="listitem">
                  <CardThumbnail
                    card={card}
                    isOwned={isOwned}
                    displayLang={displayLang}
                    rarityLabel={labelForRarity(card.rarity, displayLang)}
                    ownedAltLabel={t("cards.ownedAlt")}
                    fallbackBadgeLabel={t("cards.fallbackLangBadge")}
                    noImageAltLabel={t("cards.noImageAlt")}
                  />
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────

interface PageHeaderProps {
  poke: { name: string; pokedex_number: number; types: string[] };
  onBack: () => void;
  backLabel: string;
}

function PageHeader({ poke, onBack, backLabel }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800 px-4 py-3 flex items-center gap-3">
      <button
        onClick={onBack}
        className="text-gray-400 hover:text-white transition-colors text-sm flex-shrink-0"
        aria-label={backLabel}
      >
        {backLabel}
      </button>
      <div className="relative w-10 h-10 flex-shrink-0">
        <Image
          src={`/sprites/${poke.pokedex_number}.png`}
          alt={poke.name}
          fill
          sizes="40px"
          className="object-contain"
          unoptimized
        />
      </div>
      <div className="min-w-0">
        <h1 className="text-base font-bold leading-tight truncate">{poke.name}</h1>
        <p className="text-xs text-gray-400 font-mono">
          #{String(poke.pokedex_number).padStart(4, "0")} · {poke.types.join(" / ")}
        </p>
      </div>
    </header>
  );
}
