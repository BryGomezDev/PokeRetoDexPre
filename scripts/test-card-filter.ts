/**
 * Test de lógica de filtros de cartas para Pokémon #25 (Pikachu).
 * Ejecutar con: npx tsx scripts/test-card-filter.ts
 */
// [Dato] el script reimplementaba mergeCards y filter — ahora importa la lógica real

import assert from "node:assert";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeCards, filterCards } from "../src/lib/cards.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalogPath = resolve(__dirname, "../public/catalog/v1/25.json");

const data = JSON.parse(readFileSync(catalogPath, "utf-8"));
const mergedCards = mergeCards(data);
assert.ok(mergedCards.length > 0, "mergedCards no debe estar vacío");

// ─── owned parcial (primeros 5) ──────────────────────────────────────────────
const ownedIds = new Set(mergedCards.slice(0, 5).map((c) => c.id));
const isOwned = (id: string) => ownedIds.has(id);

const filteredOwned = filterCards(mergedCards, isOwned, "owned", "", "");
const filteredMissing = filterCards(mergedCards, isOwned, "missing", "", "");

assert.strictEqual(filteredOwned.length, 5, `owned: expected 5, got ${filteredOwned.length}`);
assert.strictEqual(filteredMissing.length, mergedCards.length - 5, `missing mismatch`);
assert.strictEqual(filteredOwned.length + filteredMissing.length, mergedCards.length, "owned + missing != total");

// ─── A: usuario sin cartas marcadas ─────────────────────────────────────────
const noCards = (_id: string) => false;
const ownedWhenNone = filterCards(mergedCards, noCards, "owned", "", "");
assert.strictEqual(ownedWhenNone.length, 0, "sin cartas: owned debe ser vacío");
const missingWhenNone = filterCards(mergedCards, noCards, "missing", "", "");
assert.strictEqual(missingWhenNone.length, mergedCards.length, "sin cartas: missing debe ser el total");

// ─── B: ID desconocido en el mapa ───────────────────────────────────────────
const fakeOwned = (id: string) => id === "fake-id-not-in-catalog";
const ownedWithFakeId = filterCards(mergedCards, fakeOwned, "owned", "", "");
assert.strictEqual(ownedWithFakeId.length, 0, "ID desconocido no debe aparecer como owned");

// ─── Output ──────────────────────────────────────────────────────────────────
console.log(`✓ owned: ${filteredOwned.length}/5`);
console.log(`✓ missing: ${filteredMissing.length}/${mergedCards.length - 5}`);
console.log(`✓ sin cartas marcadas: owned=0, missing=${missingWhenNone.length}`);
console.log(`✓ ID desconocido: owned=0`);
console.log("✓ all checks passed");
