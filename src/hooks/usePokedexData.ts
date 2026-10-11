"use client";

import { useState, useEffect, useCallback } from "react";
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

export type FormType = "mega" | "gmax" | "regional" | null;

export interface PokemonDoc {
  slug: string;
  pokedex_number: number;
  form_index: number;
  sort_order: number;
  name: string;
  region: string;
  types: string[];
  sprite_url: string;
  is_special_form: boolean;
  form_type: FormType;
}

export type Variant = "basica" | "holo" | "alternativa" | "fullart";
export type CardLanguage = "es" | "en" | "zh" | "ko" | "ja" | "otros";

export interface CardEntry {
  copies: number;
  language: CardLanguage | null;
}

export interface PokemonWithStatus extends PokemonDoc {
  owned: boolean;
  variant: Variant | null;
  language: CardLanguage | null;
  is_shiny: boolean;
  is_promo: boolean;
  is_bulk: boolean;
  bulk_quantity: number;
  favorite: boolean;
  cards: Record<string, CardEntry>;
  hasCatalogCards: boolean;
}

export function toDisplayState(data: Record<string, unknown>): {
  owned: boolean; variant: Variant | null; language: CardLanguage | null;
  is_shiny: boolean; is_promo: boolean; is_bulk: boolean; bulk_quantity: number;
  favorite: boolean; cards: Record<string, CardEntry>; hasCatalogCards: boolean;
} {
  const cards = (data.cards ?? {}) as Record<string, CardEntry>;
  const hasCatalogCards = Object.keys(cards).length > 0;
  return {
    owned: hasCatalogCards || ((data.owned as boolean) ?? false),
    variant: (data.variant as Variant) ?? null,
    language: (data.language as CardLanguage) ?? null,
    is_shiny: (data.is_shiny as boolean) ?? false,
    is_promo: (data.is_promo as boolean) ?? false,
    is_bulk: (data.is_bulk as boolean) ?? false,
    bulk_quantity: (data.bulk_quantity as number) ?? 0,
    favorite: (data.favorite as boolean) ?? false,
    cards,
    hasCatalogCards,
  };
}

export interface UserProfile {
  username: string;
  avatar_pokemon_slug: string;
}

interface UsePokedexDataResult {
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

export function usePokedexData(uid: string | null): UsePokedexDataResult {
  const [pokemon, setPokemon] = useState<PokemonWithStatus[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
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
        }

        const collectionMap = new Map<string, ReturnType<typeof toDisplayState>>();
        collectionSnap.forEach((d) => {
          collectionMap.set(d.id, toDisplayState(d.data() as Record<string, unknown>));
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
            form_type: (data.form_type as FormType) ?? null,
            owned: entry?.owned ?? false,
            variant: entry?.variant ?? null,
            language: entry?.language ?? null,
            is_shiny: entry?.is_shiny ?? false,
            is_promo: entry?.is_promo ?? false,
            is_bulk: entry?.is_bulk ?? false,
            bulk_quantity: entry?.bulk_quantity ?? 0,
            favorite: entry?.favorite ?? false,
            cards: entry?.cards ?? {},
            hasCatalogCards: entry?.hasCatalogCards ?? false,
          };
        });

        setPokemon(combined);
      } catch (err) {
        console.error("[usePokedexData]", err);
        setError("No se pudo cargar la Pokédex. Comprueba tu conexión.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [uid]);

  const updatePokemonStatus = useCallback(
    async (
      slug: string,
      owned: boolean,
      variant: Variant | null,
      language: CardLanguage | null
    ) => {
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

      await setDoc(
        doc(db, "users", uid, "collection", slug),
        update,
        { merge: true }
      );
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

  return { pokemon, userProfile, loading, error, updatePokemonStatus, updateSpecialFlag };
}
