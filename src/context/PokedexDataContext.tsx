"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteField,
  FieldPath,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "./AuthContext";
import { useLanguage } from "./LanguageContext";
import type { FormType, PokemonDoc, PokemonWithStatus, UserProfile, Variant, CardLanguage } from "@/hooks/usePokedexData";
import { toDisplayState } from "@/hooks/usePokedexData";
import { POKEMON_DATA_VERSION } from "@/lib/constants";
import { applyCardEntry, type CardEntry } from "@/lib/cards";

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
  updateFavorite: (slug: string, value: boolean) => Promise<void>;
  updateCardEntry: (slug: string, cardId: string, entry: CardEntry | null) => void;
}

const PokedexDataContext = createContext<PokedexDataContextValue>({
  pokemon: [],
  userProfile: null,
  loading: true,
  error: null,
  updatePokemonStatus: async () => {},
  updateSpecialFlag: async () => {},
  updateBulkStatus: async () => {},
  updateFavorite: async () => {},
  updateCardEntry: () => {},
});

export function PokedexDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { syncFromFirestore } = useLanguage();
  const uid = user?.uid ?? null;

  const [pokemon, setPokemon] = useState<PokemonWithStatus[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs for updateCardEntry debounce + rollback
  const pokemonRef = useRef<PokemonWithStatus[]>([]);
  const cardTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const cardRollbackRef = useRef<Map<string, { cards: Record<string, CardEntry>; ownedWas: boolean; hasCatalogCardsWas: boolean }>>(new Map());
  const pendingCardsRef = useRef<Map<string, Record<string, CardEntry>>>(new Map());

  // Keep pokemonRef in sync with state (no render side-effect)
  useEffect(() => { pokemonRef.current = pokemon; }, [pokemon]);

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
        const collectionMap = new Map<string, ReturnType<typeof toDisplayState>>();
        collectionSnap.forEach((d) => {
          collectionMap.set(d.id, toDisplayState(d.data() as Record<string, unknown>));
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
            favorite: entry?.favorite ?? false,
            cards: entry?.cards ?? {},
            hasCatalogCards: entry?.hasCatalogCards ?? false,
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

  const updateFavorite = useCallback(
    async (slug: string, value: boolean) => {
      if (!uid) return;
      setPokemon((prev) =>
        prev.map((p) => (p.slug === slug ? { ...p, favorite: value } : p))
      );
      await setDoc(
        doc(db, "users", uid, "collection", slug),
        { favorite: value, updated_at: serverTimestamp() },
        { merge: true }
      );
    },
    [uid]
  );

  const updateCardEntry = useCallback(
    (slug: string, cardId: string, entry: CardEntry | null) => {
      if (!uid) return;

      // Base state: pending ref has priority over react state (handles rapid-fire clicks)
      const baseCards =
        pendingCardsRef.current.get(slug) ??
        pokemonRef.current.find((p) => p.slug === slug)?.cards ??
        {};

      // Save rollback only at the start of the debounce window
      if (!cardTimerRef.current.has(slug)) {
        const current = pokemonRef.current.find((p) => p.slug === slug);
        cardRollbackRef.current.set(slug, {
          cards: { ...baseCards },
          ownedWas: current?.owned ?? false,
          hasCatalogCardsWas: current?.hasCatalogCards ?? false,
        });
      }

      // Snapshot legacy-owned state before setPokemon (avoids stale closure inside callback).
      // legacyOwned = true only when pokemon was owned via old modal (owned=true, hasCatalogCards=false).
      const rollbackSnapshot = cardRollbackRef.current.get(slug)!;
      const legacyOwned = rollbackSnapshot.ownedWas && !rollbackSnapshot.hasCatalogCardsWas;

      const newCards = applyCardEntry(baseCards, cardId, entry);

      // Update pending state synchronously (for the next rapid click)
      pendingCardsRef.current.set(slug, newCards);

      // Optimistic UI update — `owned` derived from cards count to stay in sync with silueta.
      // Preserves legacy `owned` (set via old modal, no catalog cards) by checking legacyOwned.
      setPokemon((prev) =>
        prev.map((p) =>
          p.slug === slug
            ? {
                ...p,
                cards: newCards,
                hasCatalogCards: Object.keys(newCards).length > 0,
                owned: Object.keys(newCards).length > 0 || legacyOwned,
              }
            : p
        )
      );

      // Debounce Firestore write 500ms
      const existing = cardTimerRef.current.get(slug);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(async () => {
        const cardsToWrite = pendingCardsRef.current.get(slug);
        const rollback = cardRollbackRef.current.get(slug);
        cardTimerRef.current.delete(slug);
        pendingCardsRef.current.delete(slug);
        cardRollbackRef.current.delete(slug);

        if (!cardsToWrite || !uid) return;

        const rollbackCards = rollback?.cards ?? {};
        const docRef = doc(db, "users", uid, "collection", slug);

        // Per-key FieldPath writes to avoid setDoc(merge:true) preserving deleted card keys.
        // Emulator Test D confirmed: setDoc(merge:true) with partial cards map keeps absent keys.
        const writeArgs: (FieldPath | string | unknown)[] = [];
        for (const [id, e] of Object.entries(cardsToWrite)) {
          writeArgs.push(new FieldPath("cards", id), e);
        }
        for (const id of Object.keys(rollbackCards)) {
          if (!(id in cardsToWrite)) {
            writeArgs.push(new FieldPath("cards", id), deleteField());
          }
        }
        writeArgs.push("updated_at", serverTimestamp());

        function doRollback() {
          if (rollback !== undefined) {
            setPokemon((prev) =>
              prev.map((p) =>
                p.slug === slug
                  ? {
                      ...p,
                      cards: rollback.cards,
                      hasCatalogCards: Object.keys(rollback.cards).length > 0,
                      owned: rollback.ownedWas,
                    }
                  : p
              )
            );
          }
          setError("No se pudo guardar la carta. Comprueba tu conexión.");
          setTimeout(() => setError(null), 4000);
        }

        try {
          await updateDoc(
            docRef,
            writeArgs[0] as string | FieldPath,
            writeArgs[1],
            ...writeArgs.slice(2)
          );
        } catch (err) {
          if ((err as { code?: string }).code === "not-found") {
            // First card for this pokemon — document doesn't exist yet.
            if (Object.keys(cardsToWrite).length === 0) return;
            try {
              await setDoc(docRef, { cards: cardsToWrite, updated_at: serverTimestamp() }, { merge: true });
            } catch {
              doRollback();
            }
          } else {
            console.error("[updateCardEntry]", err);
            doRollback();
          }
        }
      }, 500);

      cardTimerRef.current.set(slug, timer);
    },
    [uid]
  );

  return (
    <PokedexDataContext.Provider value={{ pokemon, userProfile, loading, error, updatePokemonStatus, updateSpecialFlag, updateBulkStatus, updateFavorite, updateCardEntry }}>
      {children}
    </PokedexDataContext.Provider>
  );
}

export function usePokedexContext(): PokedexDataContextValue {
  return useContext(PokedexDataContext);
}
