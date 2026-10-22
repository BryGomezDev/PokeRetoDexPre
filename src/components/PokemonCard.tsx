"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Sparkles, Ticket, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import type { PokemonWithStatus } from "@/hooks/usePokedexData";

interface PokemonCardProps {
  pokemon: PokemonWithStatus;
  onEditCollection: () => void;
  onToggleFavorite: () => void;
}

function getCardStyle(pokemon: PokemonWithStatus): React.CSSProperties {
  if (!pokemon.owned) return {};
  switch (pokemon.variant) {
    case "holo":
      return { boxShadow: "0 0 10px rgba(251,191,36,0.45), inset 0 0 4px rgba(251,191,36,0.1)" };
    case "alternativa":
      return { border: "2px solid transparent", background: "linear-gradient(#18181b, #18181b) padding-box, linear-gradient(135deg, #ec4899, #8b5cf6, #3b82f6) border-box" };
    case "fullart":
      return { border: "2px solid transparent", background: "linear-gradient(#18181b, #18181b) padding-box, linear-gradient(135deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #ef4444) border-box" };
    default: return {};
  }
}

function getBorderClass(pokemon: PokemonWithStatus): string {
  if (!pokemon.owned) return "border-gray-800";
  switch (pokemon.variant) {
    case "basica":      return "border-gray-500";
    case "holo":        return "border-yellow-400";
    case "alternativa": return "";
    case "fullart":     return "";
    default:            return "border-gray-500";
  }
}

export function PokemonCard({ pokemon, onEditCollection, onToggleFavorite }: PokemonCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const router = useRouter();
  const cardButtonRef = useRef<HTMLButtonElement>(null);
  const { t } = useLanguage();

  const usesGradientBorder =
    pokemon.owned && (pokemon.variant === "alternativa" || pokemon.variant === "fullart");

  return (
    <div
      className="relative"
      tabIndex={0}
      onBlur={(e) => {
        // Close menu only when focus leaves the entire component
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setMenuOpen(false);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && menuOpen) {
          e.preventDefault();
          setMenuOpen(false);
          cardButtonRef.current?.focus();
        }
      }}
    >
      <button
        ref={cardButtonRef}
        onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
        title={`${pokemon.name} (#${pokemon.pokedex_number})`}
        aria-label={`${pokemon.name} #${pokemon.pokedex_number}${pokemon.owned ? ` — ${t("pokedex.owned")}` : ""}`}
        className={cn(
          "relative flex flex-col items-center gap-1 p-1.5 sm:p-2 rounded-xl bg-gray-900 w-full",
          "hover:scale-105 active:scale-95 transition-transform duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60",
          !usesGradientBorder && "border-2",
          !usesGradientBorder && getBorderClass(pokemon),
        )}
        style={getCardStyle(pokemon)}
      >
        {/* Favorite icon — top-left */}
        {pokemon.favorite && (
          <div className="absolute top-0.5 left-0.5 pointer-events-none" aria-hidden="true">
            <Heart size={10} className="text-pink-500 fill-pink-500" />
          </div>
        )}

        {/* Sprite */}
        <div className="relative w-12 h-12 sm:w-14 sm:h-14">
          {!imgError ? (
            <Image
              src={`/sprites/${pokemon.pokedex_number}.png`}
              alt={pokemon.name}
              fill
              sizes="56px"
              className="object-contain drop-shadow-sm"
              unoptimized
              onError={() => setImgError(true)}
              style={!pokemon.owned ? { filter: "brightness(0) invert(1) opacity(0.35)" } : undefined}
            />
          ) : (
            <div
              className="w-full h-full rounded-full bg-gray-600"
              style={!pokemon.owned ? { opacity: 0.35 } : undefined}
            />
          )}

        </div>

        <span className="text-[9px] sm:text-[10px] text-gray-500 font-mono leading-none">
          #{String(pokemon.pokedex_number).padStart(4, "0")}
        </span>
        <span className="text-[9px] sm:text-[10px] font-medium text-center leading-tight line-clamp-2 w-full px-0.5">
          {pokemon.name}
        </span>

        {/* Visual indicators — top-right corner */}
        {pokemon.owned && (
          <div className="absolute top-0 right-0 flex flex-col">
            <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center pointer-events-none" aria-hidden="true">
              <Sparkles size={13} className={cn(pokemon.is_shiny ? "text-yellow-400" : "text-gray-600")} />
            </div>
            <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center pointer-events-none" aria-hidden="true">
              <Ticket size={13} className={cn(pokemon.is_promo ? "text-blue-400" : "text-gray-600")} />
            </div>
          </div>
        )}
      </button>

      {/* Context menu */}
      {menuOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-gray-800 border border-gray-700 rounded-lg p-1 shadow-xl min-w-max">
          <button
            className="w-full text-left text-xs px-3 py-2 rounded hover:bg-gray-700 text-gray-200"
            onClick={() => { setMenuOpen(false); router.push(`/pokedex/${pokemon.pokedex_number}`); }}
          >
            {t("pokedex.contextMenuViewCards")}
          </button>
          <button
            className="w-full text-left text-xs px-3 py-2 rounded hover:bg-gray-700 text-gray-200"
            onClick={() => { setMenuOpen(false); onToggleFavorite(); }}
          >
            {pokemon.favorite ? t("pokedex.contextMenuUnfavorite") : t("pokedex.contextMenuFavorite")}
          </button>
          <button
            className="w-full text-left text-xs px-3 py-2 rounded hover:bg-gray-700 text-gray-200"
            onClick={() => { setMenuOpen(false); onEditCollection(); }}
          >
            {t("pokedex.contextMenuEditCollection")}
          </button>
        </div>
      )}
    </div>
  );
}
