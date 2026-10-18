"use client";

import { useState } from "react";
import type { MergedCard } from "@/lib/cards";

interface CardThumbnailProps {
  card: MergedCard;
  isOwned: boolean;
  displayLang: "en" | "es";
  rarityLabel: string;
  ownedAltLabel: string;
  fallbackBadgeLabel: string;
  noImageAltLabel: string;
  onClick?: () => void;
}

export default function CardThumbnail({
  card,
  isOwned,
  displayLang,
  rarityLabel,
  ownedAltLabel,
  fallbackBadgeLabel,
  noImageAltLabel,
  onClick,
}: CardThumbnailProps) {
  const [imgError, setImgError] = useState(false);

  const showPlaceholder = !card.image || imgError;
  const imgSrc = card.image ? `${card.image}/low.webp` : "";

  const displayName = displayLang === "es" && card.hasEs && card.nameEs
    ? card.nameEs
    : card.name;
  const isEnFallback = displayLang === "es" && !card.hasEs;

  // Include owned state in aria-label so screen readers announce it (WCAG 1.3.1)
  const altText = isOwned
    ? `${displayName} - ${card.setName} - ${rarityLabel} — ${ownedAltLabel}`
    : `${displayName} - ${card.setName} - ${rarityLabel}`;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={altText}
      className={[
        "relative group w-full text-left rounded-lg overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950",
        onClick ? "cursor-pointer" : "cursor-default",
      ].join(" ")}
    >
      {/* Card image container — aspect 5:7 (63mm × 88mm physical TCG ratio) */}
      <div className="relative aspect-[5/7] w-full rounded-lg overflow-hidden bg-zinc-800">
        {showPlaceholder ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2">
            <span className="text-zinc-500 text-xs font-medium leading-tight text-center line-clamp-2">
              {card.setName}
            </span>
            <span className="text-zinc-600 text-[10px] leading-tight text-center">
              {rarityLabel}
            </span>
            {!card.image && (
              <span className="sr-only">{noImageAltLabel}</span>
            )}
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={altText}
            loading="lazy"
            onError={() => setImgError(true)}
            className={[
              "w-full h-full object-cover transition-all duration-200",
              isOwned ? "" : "opacity-50 grayscale",
            ].join(" ")}
          />
        )}

        {/* Non-color owned indicator (WCAG 1.4.1) — checkmark badge; aria-hidden because owned state is already in the button aria-label */}
        {isOwned && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-md"
          >
            ✓
          </span>
        )}

        {/* EN fallback badge — shown when app lang is ES but card has no ES data */}
        {isEnFallback && (
          <span className="absolute top-1 left-1 px-1 py-0.5 rounded text-[9px] font-bold bg-blue-600/80 text-white leading-none">
            {fallbackBadgeLabel}
          </span>
        )}
      </div>

      {/* Card label below image */}
      <div className="mt-1 px-0.5">
        <p className="text-[10px] text-gray-300 leading-tight truncate">{displayName}</p>
        <p className="text-[9px] text-gray-500 leading-tight truncate">{rarityLabel}</p>
      </div>
    </button>
  );
}
