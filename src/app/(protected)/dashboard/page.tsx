"use client";

import { useMemo } from "react";
import Image from "next/image";
import { Sparkles, Ticket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { usePokedexContext } from "@/context/PokedexDataContext";
import { Navigation } from "@/components/Navigation";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const REGIONS = [
  "kanto", "johto", "hoenn", "sinnoh", "unova",
  "kalos", "alola", "galar", "hisui", "paldea",
] as const;

const REGIONAL_ORIGINS = ["alola", "galar", "hisui", "paldea"] as const;

// ─── Reusable UI pieces ───────────────────────────────────────────────────────

function ProgressBar({ pct, color = "bg-red-500" }: { pct: number; color?: string }) {
  return (
    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

function StatCard({
  label,
  owned,
  total,
  color = "bg-red-500",
  indent = false,
}: {
  label: string;
  owned: number;
  total: number;
  color?: string;
  indent?: boolean;
}) {
  const pct = total > 0 ? (owned / total) * 100 : 0;
  return (
    <div className={cn("space-y-1.5", indent && "pl-4 border-l border-gray-800")}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-sm font-medium text-gray-300", indent && "text-xs text-gray-400")}>
          {label}
        </span>
        <span className="text-xs text-gray-400 font-mono whitespace-nowrap">
          {owned}/{total}
          {total > 0 && <span className="text-gray-600"> · {pct.toFixed(2)}%</span>}
        </span>
      </div>
      <ProgressBar pct={pct} color={color} />
    </div>
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

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const { pokemon, userProfile, loading: dataLoading, error } = usePokedexContext();

  // ── Derived stats ──────────────────────────────────────────────────────────

  const basePokemon = useMemo(() => pokemon.filter((p) => !p.is_special_form), [pokemon]);

  const nationalOwned = useMemo(() => basePokemon.filter((p) => p.owned).length, [basePokemon]);
  const nationalTotal = basePokemon.length;
  const nationalPct = nationalTotal > 0 ? (nationalOwned / nationalTotal) * 100 : 0;

  const regionStats = useMemo(() => {
    const stats = REGIONS.map((region) => {
      const rp = basePokemon.filter((p) => p.region.toLowerCase() === region);
      const owned = rp.filter((p) => p.owned).length;
      const total = rp.length;
      return { region, owned, total, pct: total > 0 ? owned / total : 0 };
    }).filter((r) => r.total > 0);
    return stats.sort((a, b) => a.pct - b.pct);
  }, [basePokemon]);

  const variantStats = useMemo(() => {
    const owned = pokemon.filter((p) => p.owned);
    return {
      basica: owned.filter((p) => p.variant === "basica").length,
      holo: owned.filter((p) => p.variant === "holo").length,
      alternativa: owned.filter((p) => p.variant === "alternativa").length,
      fullart: owned.filter((p) => p.variant === "fullart").length,
      total: owned.length,
      shiny: owned.filter((p) => p.is_shiny).length,
      promo: owned.filter((p) => p.is_promo).length,
    };
  }, [pokemon]);

  const specialStats = useMemo(() => {
    const specials = pokemon.filter((p) => p.is_special_form);

    const mega = specials.filter((p) => p.form_type === "mega");
    const gmax = specials.filter((p) => p.form_type === "gmax");
    const regional = specials.filter((p) => p.form_type === "regional");

    const regionalByOrigin = REGIONAL_ORIGINS.map((key) => {
      const group = regional.filter((p) => p.region.toLowerCase() === key);
      return { key, owned: group.filter((p) => p.owned).length, total: group.length };
    }).filter((g) => g.total > 0);

    const megaOwned = mega.filter((p) => p.owned).length;
    const gmaxOwned = gmax.filter((p) => p.owned).length;
    const regionalOwned = regional.filter((p) => p.owned).length;
    return {
      mega: { owned: megaOwned, total: mega.length },
      gmax: { owned: gmaxOwned, total: gmax.length },
      regional: { owned: regionalOwned, total: regional.length },
      totalOwned: megaOwned + gmaxOwned + regionalOwned,
      totalTotal: mega.length + gmax.length + regional.length,
      regionalByOrigin,
    };
  }, [pokemon]);

  const avatarSpriteUrl = useMemo(() => {
    if (!userProfile?.avatar_pokemon_slug) return null;
    return pokemon.find((p) => p.slug === userProfile.avatar_pokemon_slug)?.sprite_url ?? null;
  }, [userProfile, pokemon]);

  async function handleSignOut() {
    await signOut(auth);
    document.cookie = "session=; path=/; max-age=0";
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen bg-gray-950 text-white">
      <Navigation />

      <main className="flex-1 min-w-0 lg:ml-56 pb-20 lg:pb-0">

        {/* ── Sticky header ─────────────────────────────────────────────── */}
        <header className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-base font-bold lg:hidden select-none flex-shrink-0">
              <span className="text-red-500">Poké</span>
              <span className="text-white">RetoDex</span>
            </span>
            <h1 className="hidden lg:block text-lg font-bold text-white">Dashboard</h1>
            {!dataLoading && nationalTotal > 0 && (
              <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full font-mono flex-shrink-0">
                {nationalOwned}/{nationalTotal}
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
                <Image src={avatarSpriteUrl} alt={userProfile?.username ?? "Avatar"} fill sizes="32px" className="object-contain" unoptimized />
              ) : (
                <div className="w-full h-full bg-gray-700" />
              )}
            </Link>
            <button onClick={handleSignOut} title={t("common.signOut")} className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-md hover:bg-gray-800">
              <SignOutIcon />
              <span className="sr-only">{t("common.signOut")}</span>
            </button>
          </div>
        </header>

        {/* ── Loading ────────────────────────────────────────────────────── */}
        {dataLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-8 h-8 border-4 border-gray-700 border-t-red-500 rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">{t("dashboard.loading")}</p>
          </div>
        )}

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {!dataLoading && error && (
          <div className="m-4 p-4 bg-red-950/40 border border-red-800/50 rounded-xl text-red-400 text-sm" role="alert">
            {error}
          </div>
        )}

        {/* ── Content ────────────────────────────────────────────────────── */}
        {!dataLoading && !error && (
          <div className="p-4 space-y-6 lg:max-w-4xl">

            {/* ── National Pokédex progress ──────────────────────────── */}
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {t("dashboard.nationalTitle")}
              </h2>
              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <span className="text-4xl font-bold text-white">{nationalOwned}</span>
                    <span className="text-xl text-gray-500">/{nationalTotal}</span>
                  </div>
                  <span className="text-3xl font-bold text-red-500">{nationalPct.toFixed(2)}%</span>
                </div>
                <ProgressBar pct={nationalPct} color="bg-red-500" />
                <p className="text-xs text-gray-500 mt-2">{t("dashboard.nationalNote")}</p>
              </div>
            </section>

            {/* ── Variant counters + Region breakdown — two-col on desktop ── */}
            <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-6 space-y-6 lg:space-y-0">

              {/* Variant counters */}
              <section>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {t("dashboard.variantsTitle")}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "basica", count: variantStats.basica, color: "bg-gray-400" },
                    { key: "holo", count: variantStats.holo, color: "bg-yellow-400" },
                    { key: "alternativa", count: variantStats.alternativa, color: "bg-purple-400" },
                    { key: "fullart", count: variantStats.fullart, color: "bg-pink-400" },
                  ].map(({ key, count, color }) => (
                    <div key={key} className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex flex-col gap-1.5">
                      <span className="text-xs text-gray-400">{t("pokedex.variants." + key)}</span>
                      <span className="text-2xl font-bold text-white">{count}</span>
                      <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", color)}
                          style={{ width: variantStats.total > 0 ? `${Math.round((count / variantStats.total) * 100)}%` : "0%" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Shiny + Promo counters */}
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={12} className="text-yellow-400" aria-hidden="true" />
                      <span className="text-xs text-gray-400">{t("dashboard.shinyTitle")}</span>
                    </div>
                    <span className="text-2xl font-bold text-white">{variantStats.shiny}</span>
                  </div>
                  <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Ticket size={12} className="text-blue-400" aria-hidden="true" />
                      <span className="text-xs text-gray-400">{t("dashboard.promoTitle")}</span>
                    </div>
                    <span className="text-2xl font-bold text-white">{variantStats.promo}</span>
                  </div>
                </div>

                <p className="text-xs text-gray-600 mt-2 px-1">
                  {t("dashboard.variantsTotal", {
                    count: variantStats.total,
                    suffix: variantStats.total !== 1 ? "s" : "",
                  })}
                </p>
              </section>

              {/* Region breakdown */}
              <section>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {t("dashboard.regionTitle")}{" "}
                  <span className="text-gray-700 normal-case font-normal">({t("dashboard.regionNote")})</span>
                </h2>
                <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
                  {regionStats.map(({ region, owned, total, pct }) => (
                    <div key={region} className="px-4 py-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-200">
                          {t("regions." + region)}
                        </span>
                        <span className="text-xs font-mono text-gray-400 whitespace-nowrap">
                          {owned}/{total}
                          <span className="text-gray-600"> · {(pct * 100).toFixed(2)}%</span>
                        </span>
                      </div>
                      <ProgressBar pct={pct * 100} />
                    </div>
                  ))}
                  {regionStats.length === 0 && (
                    <p className="px-4 py-6 text-sm text-gray-500 text-center">{t("dashboard.noData")}</p>
                  )}
                </div>
              </section>
            </div>

            {/* ── Special forms section ───────────────────────────────── */}
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {t("dashboard.specialsTitle")}
              </h2>

                {specialStats.mega.total === 0 &&
                 specialStats.gmax.total === 0 &&
                 specialStats.regional.total === 0 && (
                  <p className="text-xs text-gray-600 mb-3 px-1">
                    {t("dashboard.specialsHint")}
                  </p>
                )}

                <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">

                  <div className="px-4 py-4 space-y-2">
                    <StatCard
                      label={t("dashboard.specialsTotal")}
                      owned={specialStats.totalOwned}
                      total={specialStats.totalTotal}
                      color="bg-violet-500"
                    />
                  </div>

                  <div className="px-4 py-4 space-y-2">
                    <StatCard
                      label={t("dashboard.specialsMega")}
                      owned={specialStats.mega.owned}
                      total={specialStats.mega.total}
                      color="bg-indigo-500"
                    />
                  </div>

                  <div className="px-4 py-4 space-y-2">
                    <StatCard
                      label={t("dashboard.specialsGmax")}
                      owned={specialStats.gmax.owned}
                      total={specialStats.gmax.total}
                      color="bg-yellow-500"
                    />
                  </div>

                  <div className="px-4 py-4 space-y-3">
                    <StatCard
                      label={t("dashboard.specialsRegional")}
                      owned={specialStats.regional.owned}
                      total={specialStats.regional.total}
                      color="bg-emerald-500"
                    />
                    {specialStats.regionalByOrigin.length > 0 && (
                      <div className="space-y-3 pt-1">
                        {specialStats.regionalByOrigin.map(({ key, owned, total }) => (
                          <StatCard
                            key={key}
                            label={t("regions." + key)}
                            owned={owned}
                            total={total}
                            color="bg-emerald-700"
                            indent
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
            </section>

            {/* ── Colección Total ─────────────────────────────────────── */}
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {t("dashboard.collectionTitle")}
              </h2>
              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <span className="text-4xl font-bold text-white">{variantStats.total}</span>
                    <span className="text-xl text-gray-500">/{pokemon.length}</span>
                  </div>
                  <span className="text-3xl font-bold text-violet-400">
                    {pokemon.length > 0 ? ((variantStats.total / pokemon.length) * 100).toFixed(2) : "0.00"}%
                  </span>
                </div>
                <ProgressBar pct={pokemon.length > 0 ? (variantStats.total / pokemon.length) * 100 : 0} color="bg-violet-500" />
                <p className="text-xs text-gray-500 mt-2">{t("dashboard.collectionNote")}</p>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
