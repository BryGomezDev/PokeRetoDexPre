"use client";

import { useState, useEffect, useRef } from "react";
import type { MergedCard } from "@/lib/cards";
import type { PokemonWithStatus, CardLanguage } from "@/hooks/usePokedexData";
import type { CardEntry } from "@/lib/cards";
import { useLanguage } from "@/context/LanguageContext";

interface CardDetailModalProps {
  card: MergedCard;
  poke: PokemonWithStatus;
  displayLang: "en" | "es";
  rarityLabel: string;
  onClose: () => void;
  onUpdateEntry: (cardId: string, entry: CardEntry | null) => void;
}

export default function CardDetailModal({
  card,
  poke,
  displayLang,
  rarityLabel,
  onClose,
  onUpdateEntry,
}: CardDetailModalProps) {
  const { t } = useLanguage();
  const panelRef = useRef<HTMLDivElement>(null);

  const [localCopies, setLocalCopies] = useState<number>(
    () => poke.cards[card.id]?.copies ?? 0
  );
  const [localLanguage, setLocalLanguage] = useState<CardLanguage | null>(
    () => poke.cards[card.id]?.language ?? null
  );
  const [imgError, setImgError] = useState(false);

  // Re-sync when the card changes (e.g. user navigates to a different card)
  useEffect(() => {
    setLocalCopies(poke.cards[card.id]?.copies ?? 0);
    setLocalLanguage(poke.cards[card.id]?.language ?? null);
    setImgError(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  // Focus panel on mount for keyboard accessibility
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  // Close on Escape + focus trap (WCAG 2.1.2)
  useEffect(() => {
    const panel = panelRef.current;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Propagate changes to parent (debounced write happens in context)
  useEffect(() => {
    if (localCopies > 0) {
      onUpdateEntry(card.id, { copies: localCopies, language: localLanguage });
    } else {
      onUpdateEntry(card.id, null);
    }
  // Only trigger when copies or language change — card.id is stable while modal is open
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localCopies, localLanguage]);

  function handleDecrement() {
    setLocalCopies((prev) => Math.max(prev - 1, 0));
    // useEffect handles the onUpdateEntry call; also clear stale language when reaching 0
    if (localCopies <= 1) setLocalLanguage(null);
  }

  function handleIncrement() {
    setLocalCopies((prev) => Math.min(prev + 1, 99));
  }

  const displayName =
    displayLang === "es" && card.hasEs && card.nameEs ? card.nameEs : card.name;

  const effectiveImage = card.image || card.imageEs || null;
  const showPlaceholder = !effectiveImage || imgError;
  const imgSrc = effectiveImage ? `${effectiveImage}/high.webp` : "";

  const LANG_OPTIONS: { value: CardLanguage; label: string }[] = [
    { value: "es", label: t("cards.langEs") },
    { value: "en", label: t("cards.langEn") },
    { value: "otros", label: t("cards.langOther") },
  ];

  return (
    // Overlay — click closes, flex-centers panel on desktop
    <div
      role="presentation"
      className="fixed inset-0 z-50 bg-black/60 lg:flex lg:items-center lg:justify-center"
      onClick={onClose}
    >
      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 rounded-t-2xl max-h-[92vh] overflow-y-auto focus:outline-none lg:relative lg:bottom-auto lg:left-auto lg:right-auto lg:rounded-2xl lg:max-w-md lg:max-h-[85vh] lg:w-full"
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 lg:hidden" aria-hidden="true">
          <div className="w-10 h-1 rounded-full bg-gray-600" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-4 pt-3 pb-2 gap-2">
          <div className="min-w-0">
            <h2 id="card-modal-title" className="text-base font-bold text-white leading-tight truncate">
              {displayName}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {card.setName}
              {card.localId ? ` · #${card.localId}` : ""}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{rarityLabel}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* EN fallback badge */}
            {displayLang === "es" && !card.hasEs && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-600/80 text-white leading-none">
                EN
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={t("cards.close")}
              className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {/* Card image */}
        <div className="flex justify-center px-4 py-2">
          <div className="relative aspect-[5/7] max-h-56 w-auto rounded-lg overflow-hidden bg-zinc-800 flex items-center justify-center"
            style={{ height: "14rem", width: "10rem" }}>
            {showPlaceholder ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 border border-dashed border-zinc-700 rounded-lg">
                <span className="text-zinc-500 text-2xl leading-none" aria-hidden="true">⊘</span>
                <span className="text-zinc-400 text-xs font-medium leading-tight text-center line-clamp-2">
                  {card.setName}
                </span>
                <span className="text-zinc-400 text-[10px] leading-tight text-center">
                  {rarityLabel}
                </span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgSrc}
                alt={displayName}
                onError={() => setImgError(true)}
                className="w-full h-full object-contain"
              />
            )}
          </div>
        </div>

        {/* Copy counter */}
        <div className="flex items-center justify-center gap-4 my-4 px-4">
          <button
            type="button"
            onClick={handleDecrement}
            aria-label={t("cards.decreaseCopies")}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-white text-xl font-bold transition-colors active:scale-95"
          >
            −
          </button>
          <output className="text-2xl font-bold w-12 text-center tabular-nums text-white">
            {localCopies > 0 ? localCopies : t("cards.noCopies")}
          </output>
          <button
            type="button"
            onClick={handleIncrement}
            aria-label={t("cards.increaseCopies")}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-white text-xl font-bold transition-colors active:scale-95"
          >
            +
          </button>
        </div>

        {/* Language selector — only visible when copies > 0 */}
        {localCopies > 0 && (
          <div className="px-4 pb-6">
            <fieldset>
              <legend className="text-xs text-gray-400 mb-2">
                {t("cards.languageLabel")}
              </legend>
              <div
                role="group"
                className="flex gap-2 flex-wrap"
              >
                {LANG_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={localLanguage === value}
                    onClick={() =>
                      setLocalLanguage((prev) => (prev === value ? null : value))
                    }
                    className={[
                      "min-w-[44px] min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      localLanguage === value
                        ? "bg-red-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </div>
    </div>
  );
}
