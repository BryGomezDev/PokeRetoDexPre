"use client";

import { useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { usePokedexContext } from "@/context/PokedexDataContext";

// Next.js App Router page: params.dexId is the segment from the URL
export default function PokemonCardsPage({ params }: { params: { dexId: string } }) {
  const router = useRouter();
  const { pokemon, loading } = usePokedexContext();

  const dexId = parseInt(params.dexId, 10);
  const validDexId = !isNaN(dexId) && dexId >= 1 && dexId <= 1025;

  const poke = useMemo(
    () => (validDexId ? pokemon.find((p) => p.pokedex_number === dexId && p.form_type === null) ?? null : null),
    [pokemon, dexId, validDexId]
  );

  if (!loading && !validDexId) notFound();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="w-8 h-8 border-4 border-gray-700 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!poke) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white gap-4">
        <p className="text-gray-400">Pokémon #{dexId} no encontrado.</p>
        <button onClick={() => router.back()} className="text-sm text-red-400 hover:text-red-300 underline">
          ← Volver
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          ←
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

      {/* Cards skeleton — Phase A placeholder */}
      <main className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[5/7] rounded-lg bg-gray-800/60 animate-pulse"
            />
          ))}
        </div>
        <p className="text-center text-gray-500 text-sm mt-8">
          Catálogo de cartas — próximamente (Fase B)
        </p>
      </main>
    </div>
  );
}
