/**
 * Test de lógica de filtros de cartas para Pokémon #25 (Pikachu).
 * Ejecutar con: npx tsx scripts/test-card-filter.ts
 */
// [Dato] el script reimplementaba mergeCards y filter — ahora importa la lógica real

import assert from "node:assert";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeCards, filterCards, applyCardEntry } from "../src/lib/cards.ts";
import type { CardEntry } from "../src/lib/cards.ts";

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

// ─── C: applyCardEntry ────────────────────────────────────────────────────────
const emptyCards: Record<string, CardEntry> = {};

// C1: añadir carta (ID sin punto)
const after1 = applyCardEntry(emptyCards, "base1-4", { copies: 1, language: null });
assert.strictEqual(after1["base1-4"]?.copies, 1, "C1: añadir carta — copies debe ser 1");

// C2: aumentar copias
const after2 = applyCardEntry(after1, "base1-4", { copies: 3, language: null });
assert.strictEqual(after2["base1-4"]?.copies, 3, "C2: aumentar copias — copies debe ser 3");

// C3: disminuir a 0 → eliminar entrada
const after3 = applyCardEntry(after2, "base1-4", null);
assert.strictEqual(Object.keys(after3).length, 0, "C3: eliminar entrada — mapa debe quedar vacío");

// C4: ID con punto — clave se preserva exactamente
const after4 = applyCardEntry({}, "sv03.5-001", { copies: 1, language: "es" });
assert.ok("sv03.5-001" in after4, 'C4: ID con punto — clave "sv03.5-001" debe existir en el mapa');
assert.strictEqual(after4["sv03.5-001"]?.language, "es", "C4: language debe ser es");

// C5: cambiar idioma
const after5 = applyCardEntry({ "base1-4": { copies: 2, language: null } }, "base1-4", { copies: 2, language: "en" });
assert.strictEqual(after5["base1-4"]?.language, "en", "C5: cambiar idioma — debe ser en");

// C6: idioma "otros"
const after6 = applyCardEntry({}, "base1-4", { copies: 1, language: "otros" });
assert.strictEqual(after6["base1-4"]?.language, "otros", 'C6: language "otros" se guarda correctamente');

// C7: eliminar entrada con ID con punto
const after7 = applyCardEntry({ "sv03.5-001": { copies: 1, language: "en" } }, "sv03.5-001", null);
assert.strictEqual(Object.keys(after7).length, 0, "C7: eliminar ID con punto — mapa debe quedar vacío");

console.log('✓ applyCardEntry: añadir, aumentar, eliminar, ID con punto, cambiar idioma, "otros", eliminar con punto');

// ─── D: deriveOwned — lógica de propiedad derivada desde el mapa de cartas ───
// Replica la fórmula del optimistic update en PokedexDataContext.updateCardEntry.
function deriveOwned(
  newCards: Record<string, CardEntry>,
  currentOwned: boolean,
  currentHasCatalogCards: boolean
): boolean {
  return Object.keys(newCards).length > 0 || (currentOwned && !currentHasCatalogCards);
}

// D1: sin cartas, no poseído → false
assert.strictEqual(deriveOwned({}, false, false), false, "D1: sin cartas, no poseído → false");

// D2: primera carta añadida → true
assert.strictEqual(
  deriveOwned({ "c1": { copies: 1, language: null } }, false, false),
  true,
  "D2: primera carta añadida → owned = true"
);

// D3: owned legacy (sin catalog cards) + eliminar carta inexistente → sigue owned
assert.strictEqual(deriveOwned({}, true, false), true, "D3: owned legacy sin catalog → true preservado");

// D4: última carta eliminada (tenía catalog cards) → false
assert.strictEqual(deriveOwned({}, true, true), false, "D4: última carta quitada → owned = false");

// D5: ciclo añadir→quitar dentro de la misma ventana de debounce, pokémon legacy owned
// legacyOwned se captura UNA vez del snapshot de rollback (ownedWas=true, hasCatalogCardsWas=false)
// y se usa como constante cerrada durante todo el debounce.
const afterAdd5 = applyCardEntry({}, "sv03.5-001", { copies: 1, language: "es" });
assert.strictEqual(
  deriveOwned(afterAdd5, true, false),
  true,
  "D5a: add card to legacy-owned → owned = true"
);
const afterRemove5 = applyCardEntry(afterAdd5, "sv03.5-001", null);
assert.strictEqual(
  deriveOwned(afterRemove5, true, false),
  true,
  "D5b: remove card from legacy-owned → owned preserved (legacyOwned flag = true)"
);
assert.strictEqual(Object.keys(afterRemove5).length, 0, "D5c: cards map empty after remove");

console.log("✓ deriveOwned: primera carta, quitar última, legacy owned, ciclo add→remove legacy");

// ─── Output ──────────────────────────────────────────────────────────────────
console.log(`✓ owned: ${filteredOwned.length}/5`);
console.log(`✓ missing: ${filteredMissing.length}/${mergedCards.length - 5}`);
console.log(`✓ sin cartas marcadas: owned=0, missing=${missingWhenNone.length}`);
console.log(`✓ ID desconocido: owned=0`);
console.log("✓ all checks passed");
