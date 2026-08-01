"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./AuthContext";
import { useLanguage } from "./LanguageContext";
import type { FormType, PokemonWithStatus, UserProfile, Variant, CardLanguage } from "@/hooks/usePokedexData";

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
}

const PokedexDataContext = createContext<PokedexDataContextValue>({
  pokemon: [],
  userProfile: null,
  loading: true,
  error: null,
  updatePokemonStatus: async () => {},
  updateSpecialFlag: async () => {},
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

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [pokemonSnap, collectionSnap, userDocSnap] = await Promise.all([
          getDocs(query(collection(db, "pokemon"), orderBy("sort_order"))),
          getDocs(collection(db, "users", uidValue, "collection")),
          getDoc(doc(db, "users", uidValue)),
        ]);

        if (userDocSnap.exists()) {
          const d = userDocSnap.data();
          setUserProfile({
            username: d.username ?? "Entrenador",
            avatar_pokemon_slug: d.avatar_pokemon_slug ?? "pikachu",
          });
          // Single Firestore read shared with LanguageContext — no duplicate getDoc
          const lang = d.app_language;
          if (lang === "en" || lang === "es") {
            syncFromFirestore(lang);
          }
        }

        const collectionMap = new Map<
          string,
          { owned: boolean; variant: Variant | null; language: CardLanguage | null; is_shiny: boolean; is_promo: boolean }
        >();
        collectionSnap.forEach((d) => {
          const data = d.data();
          collectionMap.set(d.id, {
            owned: data.owned ?? false,
            variant: (data.variant as Variant) ?? null,
            language: (data.language as CardLanguage) ?? null,
            is_shiny: data.is_shiny ?? false,
            is_promo: data.is_promo ?? false,
          });
        });

        const combined: PokemonWithStatus[] = pokemonSnap.docs.map((d) => {
          const data = d.data();
          const entry = collectionMap.get(d.id);
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
            owned: entry?.owned ?? false,
            variant: entry?.variant ?? null,
            language: entry?.language ?? null,
            is_shiny: entry?.is_shiny ?? false,
            is_promo: entry?.is_promo ?? false,
            form_type: (data.form_type as FormType) ?? null,
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

  return (
    <PokedexDataContext.Provider value={{ pokemon, userProfile, loading, error, updatePokemonStatus, updateSpecialFlag }}>
      {children}
    </PokedexDataContext.Provider>
  );
}

export function usePokedexContext(): PokedexDataContextValue {
  return useContext(PokedexDataContext);
}
