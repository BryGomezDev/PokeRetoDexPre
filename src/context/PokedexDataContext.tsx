"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "./AuthContext";
import { useLanguage } from "./LanguageContext";
import type { FormType, PokemonDoc, PokemonWithStatus, UserProfile, Variant, CardLanguage } from "@/hooks/usePokedexData";
import { POKEMON_DATA_VERSION } from "@/lib/constants";

// Key changes with POKEMON_DATA_VERSION, automatically invalidating stale caches
// when the /pokemon population script is re-run with new data.
const POKEMON_CACHE_KEY = `pokedex_pokemon_cache_v${POKEMON_DATA_VERSION}`;

interface PokedexDataContextValue {
  pokemon: PokemonWithStatus[];
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  updatePokemonStatus: (
    slug: string,
    owned: boolean,
    variant: Variant | null,
    language: CardLanguage | null
  ) => Promise<void>;
  updateSpecialFlag: (
    slug: string,
    field: "is_shiny" | "is_promo",
    value: boolean
  ) => Promise<void>;
  updateBulkStatus: (
    slug: string,
    isBulk: boolean,
    quantity: number
  ) => Promise<void>;
}

const PokedexDataContext = createContext<PokedexDataContextValue>({
  pokemon: [],
  userProfile: null,
  loading: true,
  error: null,
  updatePokemonStatus: async () => {},
  updateSpecialFlag: async () => {},
  updateBulkStatus: async () => {},
});

export function PokedexDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { syncFromFirestore } = useLanguage();
  const uid = user?.uid ?? null;

  const [pokemon, setPokemon] = useState<PokemonWithStatus[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setPokemon([]);
      setUserProfile(null);
      setLoading(true);
      setError(null);
      return;
    }
    const uidValue = uid;

    // Persistent listener on /users/{uid} — replaces the one-time getDoc.
    // Handles the initial profile read and detects document deletion while the session is active.
    const unsubscribeUserDoc = onSnapshot(
      doc(db, "users", uidValue),
      (snap) => {
        if (!snap.exists()) {
          // Forced logout: document deleted while Auth session is still valid.
          // State is cleared before signOut to avoid components reading stale data
          // during the transition window between signOut and the Auth guard redirect.
          // The session cookie must be cleared here — the middleware uses it (not Firebase
          // Auth state) to gate protected routes. Without this, window.location.href to
          // /login triggers a middleware redirect back to /pokedex (cookie still "1"),
          // leaving the app stuck on the "Verificando sesión..." spinner forever.
          setPokemon([]);
          setUserProfile(null);
          setLoading(true);
          document.cookie = "session=; path=/; max-age=0";
          signOut(auth).catch(console.error);
          window.location.href = "/login?reason=account_not_found";
          return;
        }
        const d = snap.data();
        setUserProfile({
          username: d.username ?? "Entrenador",
          avatar_pokemon_slug: d.avatar_pokemon_slug ?? "pikachu",
        });
        // Single Firestore read shared with LanguageContext — no duplicate getDoc
        const lang = d.app_language;
        if (lang === "en" || lang === "es") {
          syncFromFirestore(lang);
        }
      },
      (err) => {
        console.error("[PokedexDataContext] userDoc listener:", err);
      }
    );

    async function load() {
      try {
        setLoading(true);
        setError(null);

        // --- 1. Try to read /pokemon raw data from sessionStorage cache ---
        // Cache is keyed by POKEMON_DATA_VERSION so bumping the constant
        // automatically invalidates it without any extra cleanup logic.
        let rawPokemon: PokemonDoc[] | null = null;
        try {
          const cached = sessionStorage.getItem(POKEMON_CACHE_KEY);
          if (cached) rawPokemon = JSON.parse(cached) as PokemonDoc[];
        } catch {
          // sessionStorage unavailable (private browsing, browser policy)
          // or JSON corrupted — fall through to Firestore read below.
        }

        // --- 2. Fetch in parallel: always /collection (user data, never cached);
        //        only /pokemon if cache missed ---
        const [pokemonSnapOrNull, collectionSnap] = await Promise.all([
          rawPokemon
            ? Promise.resolve(null)
            : getDocs(query(collection(db, "pokemon"), orderBy("sort_order"))),
          getDocs(collection(db, "users", uidValue, "collection")),
        ]);

        // --- 3. On cache miss: extract raw fields and persist to sessionStorage ---
        if (!rawPokemon) {
          // pokemonSnapOrNull is guaranteed non-null when rawPokemon is null
          rawPokemon = pokemonSnapOrNull!.docs.map((d) => {
            const data = d.data();
            return {
              slug: d.id,
              pokedex_number: data.pokedex_number ?? 0,
              form_index: data.form_index ?? 0,
              sort_order: data.sort_order ?? 0,
              name: data.name ?? d.id,
              region: data.region ?? "unknown",
              types: data.types ?? [],
              sprite_url: data.sprite_url ?? "",
              is_special_form: data.is_special_form ?? false,
              form_type: (data.form_type as FormType) ?? null,
            };
          });
          try {
            sessionStorage.setItem(POKEMON_CACHE_KEY, JSON.stringify(rawPokemon));
          } catch {
            // setItem failed (quota, disabled) — data is in memory for this
            // session; next F5 will re-read from Firestore. No-op.
          }
        }

        // --- 4. Build user collection map from always-fresh Firestore read ---
        const collectionMap = new Map<
          string,
          { owned: boolean; variant: Variant | null; language: CardLanguage | null; is_shiny: boolean; is_promo: boolean; is_bulk: boolean; bulk_quantity: number }
        >();
        collectionSnap.forEach((d) => {
          const data = d.data();
          collectionMap.set(d.id, {
            owned: data.owned ?? false,
            variant: (data.variant as Variant) ?? null,
            language: (data.language as CardLanguage) ?? null,
            is_shiny: data.is_shiny ?? false,
            is_promo: data.is_promo ?? false,
            is_bulk: data.is_bulk ?? false,
            bulk_quantity: data.bulk_quantity ?? 0,
          });
        });

        // --- 5. Merge cached/fetched raw pokemon with fresh user collection ---
        const combined: PokemonWithStatus[] = rawPokemon.map((p) => {
          const entry = collectionMap.get(p.slug);
          return {
            ...p,
            owned: entry?.owned ?? false,
            variant: entry?.variant ?? null,
            language: entry?.language ?? null,
            is_shiny: entry?.is_shiny ?? false,
            is_promo: entry?.is_promo ?? false,
            is_bulk: entry?.is_bulk ?? false,
            bulk_quantity: entry?.bulk_quantity ?? 0,
          };
        });

        setPokemon(combined);
      } catch (err) {
        console.error("[PokedexDataContext]", err);
        setError("No se pudo cargar la Pokédex. Comprueba tu conexión.");
      } finally {
        setLoading(false);
      }
    }

    load();

    return () => {
      unsubscribeUserDoc();
    };
  }, [uid, syncFromFirestore]);

  const updatePokemonStatus = useCallback(
    async (slug: string, owned: boolean, variant: Variant | null, language: CardLanguage | null) => {
      if (!uid) return;
      const safeVariant = owned ? variant : null;
      const safeLanguage = owned ? language : null;

      setPokemon((prev) =>
        prev.map((p) =>
          p.slug === slug
            ? {
                ...p,
                owned,
                variant: safeVariant,
                language: safeLanguage,
                is_shiny: owned ? p.is_shiny : false,
                is_promo: owned ? p.is_promo : false,
                is_bulk: owned ? p.is_bulk : false,
                bulk_quantity: owned ? p.bulk_quantity : 0,
              }
            : p
        )
      );

      const update: Record<string, unknown> = {
        owned,
        variant: safeVariant,
        language: safeLanguage,
        updated_at: serverTimestamp(),
      };
      if (!owned) {
        update.is_shiny = false;
        update.is_promo = false;
        update.is_bulk = false;
        update.bulk_quantity = 0;
      }

      await setDoc(doc(db, "users", uid, "collection", slug), update, { merge: true });
    },
    [uid]
  );

  const updateSpecialFlag = useCallback(
    async (slug: string, field: "is_shiny" | "is_promo", value: boolean) => {
      if (!uid) return;
      setPokemon((prev) =>
        prev.map((p) => (p.slug === slug ? { ...p, [field]: value } : p))
      );
      await setDoc(
        doc(db, "users", uid, "collection", slug),
        { [field]: value, updated_at: serverTimestamp() },
        { merge: true }
      );
    },
    [uid]
  );

  const updateBulkStatus = useCallback(
    async (slug: string, isBulk: boolean, quantity: number) => {
      if (!uid) return;
      setPokemon((prev) =>
        prev.map((p) =>
          p.slug === slug ? { ...p, is_bulk: isBulk, bulk_quantity: quantity } : p
        )
      );
      await setDoc(
        doc(db, "users", uid, "collection", slug),
        { is_bulk: isBulk, bulk_quantity: quantity, updated_at: serverTimestamp() },
        { merge: true }
      );
    },
    [uid]
  );

  return (
    <PokedexDataContext.Provider value={{ pokemon, userProfile, loading, error, updatePokemonStatus, updateSpecialFlag, updateBulkStatus }}>
      {children}
    </PokedexDataContext.Provider>
  );
}

export function usePokedexContext(): PokedexDataContextValue {
  return useContext(PokedexDataContext);
}
