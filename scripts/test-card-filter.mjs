/**
 * Test de lógica de filtros de cartas para Pokémon #25 (Pikachu).
 * Ejecutar con: node scripts/test-card-filter.mjs
 */

import assert from "node:assert";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalogPath = resolve(__dirname, "../public/catalog/v1/25.json");

// ─── 1. Leer catálogo ────────────────────────────────────────────────────────

const data = JSON.parse(readFileSync(catalogPath, "utf-8"));

// ─── 2. mergeCards (misma lógica que page.tsx) ───────────────────────────────

function mergeCards(data) {
  const esMap = new Map(data.es.map((c) => [c.id, c]));
  return data.en.map((c) => {
    const esCard = esMap.get(c.id);
    return { ...c, nameEs: esCard?.name ?? null, hasEs: !!esCard };
  });
}

const mergedCards = mergeCards(data);
assert.ok(mergedCards.length > 0, "mergedCards no debe estar vacío");

// ─── 3. Mock de cartas poseídas: los primeros 5 ids ─────────────────────────

const ownedIds = new Set(mergedCards.slice(0, 5).map((c) => c.id));
assert.strictEqual(ownedIds.size, 5, "deben ser exactamente 5 ids únicos");

// ─── 4. Aplicar filtros (misma lógica que filteredCards en page.tsx) ─────────

const filteredOwned = mergedCards.filter((c) => ownedIds.has(c.id));
const filteredMissing = mergedCards.filter((c) => !ownedIds.has(c.id));

// ─── 5. Contadores (misma lógica que counterAll / counterShown) ──────────────

const counterAll = mergedCards.length;
const counterShownOwned = filteredOwned.length;   // cuando statusFilter = "owned"
const counterShownMissing = filteredMissing.length; // cuando statusFilter = "missing"

// ─── 6. Asserts ──────────────────────────────────────────────────────────────

assert.strictEqual(
  filteredOwned.length,
  5,
  `filteredOwned debería tener 5 cartas, tiene ${filteredOwned.length}`
);

assert.strictEqual(
  filteredMissing.length,
  mergedCards.length - 5,
  `filteredMissing debería tener ${mergedCards.length - 5} cartas, tiene ${filteredMissing.length}`
);

assert.strictEqual(
  filteredOwned.length + filteredMissing.length,
  mergedCards.length,
  "owned + missing debe sumar el total (sin pérdida)"
);

assert.strictEqual(
  counterAll,
  mergedCards.length,
  "counterAll debe ser igual al total de mergedCards"
);

assert.ok(
  counterShownOwned < counterAll,
  `counterShownOwned (${counterShownOwned}) debe ser menor que counterAll (${counterAll})`
);

assert.ok(
  counterShownMissing < counterAll,
  `counterShownMissing (${counterShownMissing}) debe ser menor que counterAll (${counterAll})`
);

// ─── 7. Output ───────────────────────────────────────────────────────────────

console.log(`✓ owned filter: ${filteredOwned.length}/${filteredOwned.length}`);
console.log(`✓ missing filter: ${filteredMissing.length}/${mergedCards.length - 5}`);
console.log(`✓ counter: shown ${counterShownOwned} / total ${counterAll}`);
console.log("✓ all checks passed");
