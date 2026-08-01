"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Sparkles, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PokemonWithStatus, Variant, CardLanguage } from "@/hooks/usePokedexData";
import { useLanguage } from "@/context/LanguageContext";

const TYPE_COLORS: Record<string, string> = {
  normal: "bg-gray-500",
  fire: "bg-orange-500",
  water: "bg-blue-500",
  grass: "bg-green-500",
  electric: "bg-yellow-400 text-gray-900",
  ice: "bg-cyan-400 text-gray-900",
  fighting: "bg-red-700",
  poison: "bg-purple-500",
  ground: "bg-yellow-600",
  flying: "bg-indigo-400",
  psychic: "bg-pink-500",
  bug: "bg-lime-500 text-gray-900",
  rock: "bg-yellow-700",
  ghost: "bg-purple-700",
  dragon: "bg-indigo-600",
  dark: "bg-gray-700",
  steel: "bg-gray-400 text-gray-900",
  fairy: "bg-pink-300 text-gray-900",
};

const VARIANT_VALUES: Variant[] = ["basica", "holo", "alternativa", "fullart"];
const LANGUAGE_VALUES: CardLanguage[] = ["es", "en", "zh", "ko", "ja", "otros"];

interface PokemonModalProps {
  pokemon: PokemonWithStatus;
  onClose: () => void;
  onSave: (owned: boolean, variant: Variant | null, language: CardLanguage | null) => Promise<void>;
  onToggleShiny: () => Promise<void>;
  onTogglePromo: () => Promise<void>;
}

export function PokemonModal({ pokemon, onClose, onSave, onToggleShiny, onTogglePromo }: PokemonModalProps) {
  const { t } = useLanguage();
  const [owned, setOwned] = useState(pokemon.owned);
  const [variant, setVariant] = useState<Variant | null>(pokemon.variant);
  const [language, setLanguage] = useState<CardLanguage | null>(pokemon.language);
  const [saving, setSaving] = useState(false);

  // Sync state when a different Pokémon is opened
  useEffect(() => {
    setOwned(pokemon.owned);
    setVariant(pokemon.variant);
    setLanguage(pokemon.language);
  }, [pokemon.slug, pokemon.owned, pokemon.variant, pokemon.language]);

  // Close on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  function handleToggleOwned() {
    const next = !owned;
    setOwned(next);
    if (!next) {
      setVariant(null);
      setLanguage(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(owned, owned ? variant : null, owned ? language : null);
    } finally {
      setSaving(false);
    }
    onClose();
  }

  const regionDisplay = pokemon.region
    ? t("regions." + pokemon.region.toLowerCase())
    : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end lg:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={t("modal.ariaLabel", { name: pokemon.name })}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — bottom-sheet on mobile, centered modal on desktop */}
      <div
        className={cn(
          "relative z-10 w-full bg-gray-900 overflow-y-auto",
          "max-h-[92vh]",
          "rounded-t-2xl",
          "lg:rounded-2xl lg:max-w-md lg:max-h-[85vh]"
        )}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 lg:hidden" aria-hidden="true">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-4 pb-2 gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative w-20 h-20 flex-shrink-0">
              {pokemon.sprite_url ? (
                <Image
                  src={pokemon.sprite_url}
                  alt={pokemon.name}
                  fill
                  sizes="80px"
                  className="object-contain drop-shadow-md"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full rounded-full bg-gray-800" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400 font-mono">
                #{String(pokemon.pokedex_number).padStart(4, "0")}
              </p>
              <h2 className="text-xl font-bold text-white leading-tight truncate">
                {pokemon.name}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">{regionDisplay}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {pokemon.types.map((type) => {
                  const lower = type.toLowerCase();
                  return (
                    <span
                      key={type}
                      className={cn(
                        "text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full text-white",
                        TYPE_COLORS[lower] ?? "bg-gray-600"
                      )}
                    >
                      {type}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label={t("modal.close")}
            className="flex-shrink-0 text-gray-500 hover:text-white transition-colors p-1 rounded-md hover:bg-gray-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-6 space-y-5">
          <div className="border-t border-gray-800" />

          {/* Owned toggle */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">{t("modal.ownedTitle")}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {owned ? t("modal.ownedYes") : t("modal.ownedNo")}
              </p>
            </div>
            <button
              role="switch"
              aria-checked={owned}
              onClick={handleToggleOwned}
              className={cn(
                "relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 overflow-hidden",
                owned ? "bg-red-500" : "bg-gray-700 hover:bg-gray-600"
              )}
            >
              {/* left-0.5 fixes the base position explicitly so translate-x is predictable across browsers */}
              <span
                className={cn(
                  "absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200",
                  owned ? "translate-x-5" : "translate-x-0"
                )}
              />
              <span className="sr-only">
                {owned ? t("modal.switchOn") : t("modal.switchOff")}
              </span>
            </button>
          </div>

          {/* Shiny / Promo — interactive toggles, save immediately to Firestore */}
          {owned && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-gray-400 font-medium">Shiny / Promo</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleShiny}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 transition-all duration-150",
                    pokemon.is_shiny
                      ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                      : "border-gray-700 bg-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300"
                  )}
                >
                  <Sparkles size={14} aria-hidden="true" />
                  <span className="text-xs font-medium">Shiny</span>
                </button>
                <button
                  type="button"
                  onClick={onTogglePromo}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 transition-all duration-150",
                    pokemon.is_promo
                      ? "border-blue-400 bg-blue-400/10 text-blue-400"
                      : "border-gray-700 bg-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300"
                  )}
                >
                  <Ticket size={14} aria-hidden="true" />
                  <span className="text-xs font-medium">Promo</span>
                </button>
              </div>
            </div>
          )}

          {/* Variant + Language selectors — only when owned */}
          {owned && (
            <>
              {/* Variant: 2×2 grid (mandatory per spec) */}
              <div>
                <p className="text-sm font-semibold text-white mb-2.5">{t("modal.variantTitle")}</p>
                <div className="grid grid-cols-2 gap-2">
                  {VARIANT_VALUES.map((value) => (
                    <button
                      key={value}
                      onClick={() => setVariant(value)}
                      className={cn(
                        "py-2.5 px-3 rounded-lg text-sm font-medium border-2 transition-all duration-150",
                        variant === value
                          ? "border-red-500 bg-red-500/15 text-red-400"
                          : "border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600 hover:text-white"
                      )}
                    >
                      {t("pokedex.variants." + value)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language: 3-column grid */}
              <div>
                <p className="text-sm font-semibold text-white mb-2.5">{t("modal.languageTitle")}</p>
                <div className="grid grid-cols-3 gap-2">
                  {LANGUAGE_VALUES.map((value) => (
                    <button
                      key={value}
                      onClick={() => setLanguage(value)}
                      className={cn(
                        "py-2 px-2 rounded-lg text-xs font-medium border-2 transition-all duration-150",
                        language === value
                          ? "border-red-500 bg-red-500/15 text-red-400"
                          : "border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600 hover:text-white"
                      )}
                    >
                      {t("pokedex.languages." + value)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || (owned && variant === null)}
            className={cn(
              "w-full py-3 rounded-xl text-sm font-semibold transition-colors mt-2",
              "bg-red-500 hover:bg-red-600 active:bg-red-700 text-white",
              "disabled:opacity-50 disabled:pointer-events-none"
            )}
          >
            {saving ? t("modal.saving") : t("modal.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
