import Image from "next/image";
import { Sparkles, Ticket, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PokemonWithStatus } from "@/hooks/usePokedexData";

interface PokemonCardProps {
  pokemon: PokemonWithStatus;
  onClick: () => void;
}

function getCardStyle(pokemon: PokemonWithStatus): React.CSSProperties {
  if (!pokemon.owned) return {};

  switch (pokemon.variant) {
    case "holo":
      return {
        boxShadow: "0 0 10px rgba(251,191,36,0.45), inset 0 0 4px rgba(251,191,36,0.1)",
      };
    case "alternativa":
      return {
        border: "2px solid transparent",
        background:
          "linear-gradient(#18181b, #18181b) padding-box, linear-gradient(135deg, #ec4899, #8b5cf6, #3b82f6) border-box",
      };
    case "fullart":
      return {
        border: "2px solid transparent",
        background:
          "linear-gradient(#18181b, #18181b) padding-box, linear-gradient(135deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #ef4444) border-box",
      };
    default:
      return {};
  }
}

function getBorderClass(pokemon: PokemonWithStatus): string {
  if (!pokemon.owned) return "border-gray-800";
  switch (pokemon.variant) {
    case "basica":      return "border-gray-500";
    case "holo":        return "border-yellow-400";
    case "alternativa": return ""; // handled by style
    case "fullart":     return ""; // handled by style
    default:            return "border-gray-500";
  }
}

export function PokemonCard({ pokemon, onClick }: PokemonCardProps) {
  const usesGradientBorder =
    pokemon.owned &&
    (pokemon.variant === "alternativa" || pokemon.variant === "fullart");

  return (
    <button
      onClick={onClick}
      title={`${pokemon.name} (#${pokemon.pokedex_number})`}
      className={cn(
        "relative flex flex-col items-center gap-1 p-1.5 sm:p-2 rounded-xl bg-gray-900 w-full",
        "hover:scale-105 active:scale-95 transition-transform duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60",
        !usesGradientBorder && "border-2",
        !usesGradientBorder && getBorderClass(pokemon),
        !pokemon.owned && "grayscale opacity-50"
      )}
      style={getCardStyle(pokemon)}
    >
      <div className="relative w-12 h-12 sm:w-14 sm:h-14">
        {pokemon.sprite_url ? (
          <Image
            src={pokemon.sprite_url}
            alt={pokemon.name}
            fill
            sizes="56px"
            className="object-contain drop-shadow-sm"
            unoptimized
          />
        ) : (
          <div className="w-full h-full rounded-full bg-gray-800" />
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
          {/* Shiny / Promo: decorative read-only, clicks pass through to card */}
          <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center pointer-events-none" aria-hidden="true">
            <Sparkles size={13} className={cn(pokemon.is_shiny ? "text-yellow-400" : "text-gray-600")} />
          </div>
          <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center pointer-events-none" aria-hidden="true">
            <Ticket size={13} className={cn(pokemon.is_promo ? "text-blue-400" : "text-gray-600")} />
          </div>
          {/* Bulk: decorative read-only, clicks pass through to card */}
          <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center relative pointer-events-none" aria-hidden="true">
            <Layers size={13} className={cn(pokemon.is_bulk ? "text-emerald-400" : "text-gray-600")} />
            {pokemon.is_bulk && pokemon.bulk_quantity > 0 && (
              <span className="absolute bottom-0.5 right-0.5 text-[7px] font-bold text-emerald-400 leading-none">
                {pokemon.bulk_quantity}
              </span>
            )}
          </div>
        </div>
      )}
    </button>
  );
}
