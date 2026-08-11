"use client";

import { useMemo, useState, useRef } from "react";
import { HelpCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePokedexContext } from "@/context/PokedexDataContext";
import { useLanguage } from "@/context/LanguageContext";
import { Navigation } from "@/components/Navigation";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";

const REGIONS = [
  "kanto", "johto", "hoenn", "sinnoh", "unova",
  "kalos", "alola", "galar", "hisui", "paldea",
] as const;

interface BulkCard {
  slug: string;
  pokedex_number: number;
  name: string;
  region: string;
  quantity: number;
}

interface ImportResult {
  exportedBy: string;
  cards: BulkCard[];
}

function getQuantityColor(qty: number): string {
  if (qty >= 10) return "text-emerald-200";
  if (qty >= 5)  return "text-emerald-300";
  if (qty >= 3)  return "text-emerald-400";
  if (qty >= 2)  return "text-emerald-500";
  return "text-emerald-600";
}

function getQuantityColorBlue(qty: number): string {
  if (qty >= 10) return "text-blue-200";
  if (qty >= 5)  return "text-blue-300";
  if (qty >= 3)  return "text-blue-400";
  if (qty >= 2)  return "text-blue-500";
  return "text-blue-600";
}

function DownloadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ── Shared table used for both "my bulk" and "import result" lists ─────────────

interface BulkTableProps {
  cards: (BulkCard & { sort_order?: number })[];
  colorFn: (qty: number) => string;
  rowAccent?: string;
}

function BulkTable({ cards, colorFn, rowAccent }: BulkTableProps) {
  const { t } = useLanguage();

  return (
    <div className={cn("rounded-xl border overflow-hidden", rowAccent ? "border-blue-900/40" : "border-gray-800")}>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className={cn("border-b", rowAccent ? "border-blue-900/40 bg-blue-950/20" : "border-gray-800 bg-gray-900/60")}>
            <th className="hidden sm:table-cell text-left py-2.5 px-4 text-xs font-medium text-gray-500 w-[4.5rem]">
              #
            </th>
            <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">
              {t("bulk.tableHeaderName")}
            </th>
            <th className="hidden sm:table-cell text-left py-2.5 px-4 text-xs font-medium text-gray-500">
              {t("bulk.tableHeaderRegion")}
            </th>
            <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">
              {t("bulk.tableHeaderQty")}
            </th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card, i) => (
            <tr
              key={card.slug}
              className={cn(
                "border-b last:border-b-0 transition-colors",
                rowAccent
                  ? "border-blue-900/30 bg-gray-900 hover:bg-blue-950/20"
                  : cn(
                      "border-gray-800/60 hover:bg-gray-800/40",
                      i % 2 !== 0 ? "bg-gray-900/50" : "bg-gray-900"
                    )
              )}
            >
              {/* # — desktop only */}
              <td className="hidden sm:table-cell py-3 px-4 font-mono text-xs text-gray-600 whitespace-nowrap">
                #{String(card.pokedex_number).padStart(4, "0")}
              </td>

              {/* Name — includes # and region stacked on mobile */}
              <td className="py-3 px-4">
                <span className="sm:hidden block font-mono text-[10px] text-gray-600 leading-none mb-0.5">
                  #{String(card.pokedex_number).padStart(4, "0")}
                </span>
                <span className="font-medium text-white">{card.name}</span>
                <span className="sm:hidden block text-[11px] text-gray-500 mt-0.5">
                  {t("regions." + card.region.toLowerCase())}
                </span>
              </td>

              {/* Region — desktop only */}
              <td className="hidden sm:table-cell py-3 px-4 text-xs text-gray-400">
                {t("regions." + card.region.toLowerCase())}
              </td>

              {/* Quantity — always visible, right-aligned, color-scaled */}
              <td className="py-3 px-4 text-right whitespace-nowrap">
                <span className={cn("text-base font-bold leading-none", colorFn(card.quantity))}>
                  ×{card.quantity}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Info modal ─────────────────────────────────────────────────────────────────

function InfoModal({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="bulk-info-title">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 bg-gray-900 rounded-2xl border border-gray-800 p-6 max-w-sm w-full shadow-2xl">
        <h2 id="bulk-info-title" className="text-base font-bold text-white mb-5">
          {t("bulk.infoTitle")}
        </h2>
        <ol className="space-y-4">
          {([1, 2, 3, 4] as const).map((n) => (
            <li key={n} className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] flex items-center justify-center font-bold mt-0.5">
                {n}
              </span>
              <span className="text-sm text-gray-300 leading-snug">
                {t(`bulk.infoStep${n}`)}
              </span>
            </li>
          ))}
        </ol>
        <button
          onClick={onClose}
          className="mt-6 w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white transition-colors"
        >
          {t("bulk.infoClose")}
        </button>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function BulkPage() {
  const { user, loading: authLoading } = useAuth();
  const { pokemon, userProfile, loading } = usePokedexContext();
  const { t } = useLanguage();
  const [regionFilter, setRegionFilter] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bulkPokemon = useMemo(
    () =>
      pokemon
        .filter((p) => p.owned && p.is_bulk)
        .sort((a, b) => a.sort_order - b.sort_order),
    [pokemon]
  );

  const filteredBulk = useMemo(
    () =>
      regionFilter
        ? bulkPokemon.filter((p) => p.region.toLowerCase() === regionFilter)
        : bulkPokemon,
    [bulkPokemon, regionFilter]
  );

  const totalCopies = useMemo(
    () => bulkPokemon.reduce((sum, p) => sum + p.bulk_quantity, 0),
    [bulkPokemon]
  );

  const activeRegions = useMemo(
    () => REGIONS.filter((r) => bulkPokemon.some((p) => p.region.toLowerCase() === r)),
    [bulkPokemon]
  );

  function handleExport() {
    const data = {
      exported_by: userProfile?.username ?? "unknown",
      exported_at: new Date().toISOString(),
      schema_version: 1,
      cards: bulkPokemon.map((p) => ({
        slug: p.slug,
        pokedex_number: p.pokedex_number,
        name: p.name,
        region: p.region.toLowerCase(),
        quantity: p.bulk_quantity,
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pokeretodex-bulk-${userProfile?.username ?? "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);

        if (typeof raw.schema_version !== "number" || !Array.isArray(raw.cards)) {
          setImportError(t("bulk.importInvalid"));
          setImportResult(null);
          return;
        }

        const matches: BulkCard[] = (raw.cards as BulkCard[])
          .filter((card) => {
            const mine = pokemon.find((p) => p.slug === card.slug);
            return mine && !mine.owned;
          })
          .map((card) => {
            const mine = pokemon.find((p) => p.slug === card.slug)!;
            return {
              slug: card.slug,
              pokedex_number: mine.pokedex_number,
              name: mine.name,
              region: mine.region.toLowerCase(),
              quantity: card.quantity,
            };
          })
          .sort((a, b) => a.pokedex_number - b.pokedex_number);

        setImportResult({ exportedBy: raw.exported_by ?? "Unknown", cards: matches });
        setImportError(null);
      } catch {
        setImportError(t("bulk.importInvalid"));
        setImportResult(null);
      }
    };

    reader.readAsText(file);
    e.target.value = "";
  }

  if (authLoading || !user) return <LoadingSpinner message={t("common.verifyingSession")} />;

  return (
    <div className="flex min-h-screen bg-gray-950 text-white">
      <Navigation />

      <main className="flex-1 min-w-0 lg:ml-56 pb-20 lg:pb-0">

        {/* ── Header ──────────────────────────────────────── */}
        <header className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800 px-4 py-3">
          <h1 className="text-lg font-bold text-white">{t("bulk.title")}</h1>
        </header>

        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-8 h-8 border-4 border-gray-700 border-t-emerald-500 rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">{t("common.loading")}</p>
          </div>
        )}

        {!loading && (
          <div className="p-4 space-y-5 max-w-2xl lg:max-w-3xl mx-auto lg:mx-0">

            {/* ── Total copies counter ─────────────────────── */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-3xl font-bold text-emerald-400">{totalCopies}</p>
              <p className="text-xs text-gray-400 mt-1">{t("bulk.totalCopies")}</p>
            </div>

            {/* ── Actions + info button ────────────────────── */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleExport}
                  disabled={bulkPokemon.length === 0}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    "bg-emerald-600 hover:bg-emerald-700 text-white",
                    "disabled:opacity-40 disabled:pointer-events-none"
                  )}
                >
                  <DownloadIcon />
                  {t("bulk.exportJson")}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700"
                >
                  <UploadIcon />
                  {t("bulk.importJson")}
                </button>
                <button
                  onClick={() => setShowInfo(true)}
                  aria-label={t("bulk.infoTitle")}
                  className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-500 hover:text-gray-200 transition-colors"
                >
                  <HelpCircle size={16} aria-hidden="true" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Summary always visible below buttons */}
              <p className="text-xs text-gray-500 leading-relaxed">
                {t("bulk.infoSummary")}
              </p>
            </div>

            {/* ── Region filter chips ──────────────────────── */}
            {activeRegions.length > 0 && (
              <div className="overflow-x-auto scrollbar-none -mx-4 px-4">
                <div className="flex gap-2" style={{ width: "max-content" }}>
                  <button
                    onClick={() => setRegionFilter(null)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap",
                      regionFilter === null
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                        : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-200"
                    )}
                  >
                    {t("pokedex.all")}
                  </button>
                  {activeRegions.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRegionFilter(regionFilter === r ? null : r)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap",
                        regionFilter === r
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                          : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-200"
                      )}
                    >
                      {t("regions." + r)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Bulk table ───────────────────────────────── */}
            {filteredBulk.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                <p className="text-gray-400 font-medium">{t("bulk.empty")}</p>
                <p className="text-gray-600 text-sm">{t("bulk.emptyHint")}</p>
              </div>
            ) : (
              <BulkTable
                cards={filteredBulk.map((p) => ({
                  slug: p.slug,
                  pokedex_number: p.pokedex_number,
                  name: p.name,
                  region: p.region.toLowerCase(),
                  quantity: p.bulk_quantity,
                  sort_order: p.sort_order,
                }))}
                colorFn={getQuantityColor}
              />
            )}

            {/* ── Import error ─────────────────────────────── */}
            {importError && (
              <div
                className="p-4 bg-red-950/40 border border-red-800/50 rounded-xl text-red-400 text-sm"
                role="alert"
              >
                {importError}
              </div>
            )}

            {/* ── Import result ────────────────────────────── */}
            {importResult && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-white">
                    {importResult.cards.length === 0
                      ? t("bulk.importNoMatch")
                      : t("bulk.importResultTitle", {
                          name: importResult.exportedBy,
                          count: importResult.cards.length,
                        })}
                  </h2>
                  <button
                    onClick={() => setImportResult(null)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
                  >
                    <XIcon />
                    {t("bulk.importClear")}
                  </button>
                </div>

                {importResult.cards.length > 0 && (
                  <BulkTable
                    cards={importResult.cards}
                    colorFn={getQuantityColorBlue}
                    rowAccent="blue"
                  />
                )}
              </div>
            )}

          </div>
        )}
      </main>

      {/* ── Info modal ───────────────────────────────────── */}
      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
    </div>
  );
}
