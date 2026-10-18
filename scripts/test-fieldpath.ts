/**
 * Firestore FieldPath behavior test — emulator required.
 *
 * Setup:
 *   1. firebase emulators:start --only firestore   (port 8080)
 *   2. npx tsx scripts/test-fieldpath.ts
 *
 * Tests A–H prove the FieldPath vs setDoc(merge) behavior for card IDs
 * that contain dots (e.g. "sv03.5-001") and for concurrent-key safety.
 */

import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteField,
  FieldPath,
  type Firestore,
} from "firebase/firestore";

// ── emulator config ─────────────────────────────────────────────────────────
const EMULATOR_HOST = "127.0.0.1";
const EMULATOR_PORT = 8080;
const PROJECT_ID    = "demo-test"; // demo- prefix prevents any accidental real-Firebase traffic

// ── helpers ──────────────────────────────────────────────────────────────────
let app: FirebaseApp;
let db: Firestore;

function init() {
  app = initializeApp({ projectId: PROJECT_ID }, "fieldpath-test");
  db  = getFirestore(app);
  connectFirestoreEmulator(db, EMULATOR_HOST, EMULATOR_PORT);
}

async function cleanup() {
  await deleteApp(app);
}

function docRef(id: string) {
  return doc(db, "test_col", id);
}

function pass(label: string, msg: string) {
  console.log(`  ✅ PASS  ${label}: ${msg}`);
}

function fail(label: string, msg: string) {
  console.log(`  ❌ FAIL  ${label}: ${msg}`);
}

function label(dato: unknown): string {
  return `[Dato] ${JSON.stringify(dato)}`;
}

// ── tests ────────────────────────────────────────────────────────────────────

async function testA(db: Firestore) {
  console.log("\n── Test A: Add card with dotted ID via FieldPath ──────────────────");
  const ref = docRef("testA");
  // ensure doc does not exist before test
  await setDoc(ref, { cards: {} });

  await updateDoc(ref, new FieldPath("cards", "sv03.5-001"), { copies: 1, language: "es" });

  const snap = await getDoc(ref);
  const data = snap.data() as Record<string, unknown>;
  const cards = data.cards as Record<string, unknown>;

  console.log("  Read-back:", label(cards));

  const entry = cards["sv03.5-001"] as { copies: number; language: string } | undefined;
  if (entry?.copies === 1 && entry?.language === "es") {
    pass("A", `cards["sv03.5-001"] = ${label(entry)}`);
  } else {
    fail("A", `Expected {copies:1, language:"es"}, got ${label(entry)}`);
  }

  // Also confirm dot was NOT interpreted as a nested path
  const dotInterpreted = (data as Record<string, unknown>)["sv03"] as unknown;
  if (dotInterpreted === undefined) {
    pass("A-dot", "No nested 'sv03' key — dot treated as literal ✓");
  } else {
    fail("A-dot", `Found unexpected nested key 'sv03': ${label(dotInterpreted)}`);
  }
}

async function testB(db: Firestore) {
  console.log("\n── Test B: Update copies of dotted-ID card ────────────────────────");
  const ref = docRef("testB");
  await setDoc(ref, { cards: {} });
  // Set up initial state
  await updateDoc(ref, new FieldPath("cards", "sv03.5-001"), { copies: 1, language: "es" });

  // Update to copies: 2
  await updateDoc(ref, new FieldPath("cards", "sv03.5-001"), { copies: 2, language: "es" });

  const snap = await getDoc(ref);
  const cards = (snap.data() as Record<string, unknown>).cards as Record<string, unknown>;
  console.log("  Read-back:", label(cards));

  const entry = cards["sv03.5-001"] as { copies: number; language: string } | undefined;
  if (entry?.copies === 2) {
    pass("B", `copies updated to 2, language preserved: ${label(entry)}`);
  } else {
    fail("B", `Expected copies 2, got ${label(entry)}`);
  }
}

async function testC(db: Firestore) {
  console.log("\n── Test C: Delete dotted-ID card via FieldPath + deleteField ───────");
  const ref = docRef("testC");
  await setDoc(ref, { cards: {} });
  await updateDoc(ref, new FieldPath("cards", "sv03.5-001"), { copies: 1, language: "es" });

  // Delete the key
  await updateDoc(ref, new FieldPath("cards", "sv03.5-001"), deleteField());

  const snap = await getDoc(ref);
  const cards = (snap.data() as Record<string, unknown>).cards as Record<string, unknown> | undefined;
  console.log("  Read-back cards field:", label(cards));

  const entry = cards?.["sv03.5-001"];
  if (entry === undefined) {
    pass("C", `cards["sv03.5-001"] is absent — deleted cleanly. cards field = ${label(cards)}`);
  } else {
    fail("C", `Expected key to be gone, found: ${label(entry)}`);
  }
}

async function testD(db: Firestore) {
  console.log("\n── Test D: setDoc(merge:true) PRESERVES sibling keys in map ────────");
  const ref = docRef("testD");
  // Start: two keys
  await setDoc(ref, { cards: { id1: { copies: 1 }, id2: { copies: 2 } } });

  // Write only id1 via setDoc merge — does id2 survive?
  await setDoc(ref, { cards: { id1: { copies: 3 } } }, { merge: true });

  const snap = await getDoc(ref);
  const cards = (snap.data() as Record<string, unknown>).cards as Record<string, unknown>;
  console.log("  Read-back:", label(cards));

  const id1 = cards["id1"] as { copies: number } | undefined;
  const id2 = cards["id2"] as { copies: number } | undefined;

  // [Dato] Verified behavior: setDoc(merge:true) merges at document level and
  // PRESERVES sibling keys inside a map value — id2 survives.
  // Consequence: setDoc(merge) cannot delete absent card keys;
  // per-key FieldPath + deleteField() is required for deletion.
  if (id2 !== undefined) {
    pass("D", `id2 SURVIVED (${label(id2)}) — setDoc(merge:true) preserves sibling map keys. FieldPath+deleteField() required to delete cards.`);
  } else {
    fail("D", `id2 was wiped — unexpected. setDoc(merge:true) replaced the entire 'cards' map. Full: ${label(cards)}`);
  }

  if (id1?.copies === 3) {
    pass("D-update", `id1 updated to copies:3 as expected.`);
  } else {
    fail("D-update", `Expected id1.copies=3, got ${label(id1)}`);
  }
}

async function testE(db: Firestore) {
  console.log("\n── Test E: updateDoc(FieldPath) does NOT affect sibling keys ───────");
  const ref = docRef("testE");
  // Start: two keys
  await setDoc(ref, { cards: { id1: { copies: 1 }, id2: { copies: 2 } } });

  // Update only id1 via FieldPath
  await updateDoc(ref, new FieldPath("cards", "id1"), { copies: 3 });

  const snap = await getDoc(ref);
  const cards = (snap.data() as Record<string, unknown>).cards as Record<string, unknown>;
  console.log("  Read-back:", label(cards));

  const id1 = cards["id1"] as { copies: number } | undefined;
  const id2 = cards["id2"] as { copies: number } | undefined;

  if (id1?.copies === 3 && id2?.copies === 2) {
    pass("E", `id1 updated to 3, id2 untouched at 2. FieldPath is safe for siblings. Full: ${label(cards)}`);
  } else {
    fail("E", `Expected id1=3 id2=2, got ${label(cards)}`);
  }
}

async function testF(db: Firestore) {
  console.log("\n── Test F: Delete one key, sibling survives ───────────────────────");
  const ref = docRef("testF");
  await setDoc(ref, { cards: { c1: { copies: 1 }, c2: { copies: 2 } } });

  await updateDoc(ref, new FieldPath("cards", "c1"), deleteField());

  const snap = await getDoc(ref);
  const cards = (snap.data() as Record<string, unknown>).cards as Record<string, unknown>;
  console.log("  Read-back:", label(cards));

  const c1 = cards["c1"];
  const c2 = cards["c2"] as { copies: number } | undefined;

  if (c1 === undefined && c2?.copies === 2) {
    pass("F", `c1 deleted, c2 intact (${label(c2)}). FieldPath delete is surgical.`);
  } else {
    fail("F", `Expected c1 absent + c2=2, got ${label(cards)}`);
  }
}

async function testG(db: Firestore) {
  console.log("\n── Test G: Delete last key — what happens to the map field? ────────");
  const ref = docRef("testG");
  await setDoc(ref, { cards: { c1: { copies: 1 } } });

  await updateDoc(ref, new FieldPath("cards", "c1"), deleteField());

  const snap = await getDoc(ref);
  const data = snap.data() as Record<string, unknown>;
  const cards = data.cards;
  console.log("  Read-back full doc:", label(data));

  if (cards === undefined) {
    pass("G", "'cards' field is ABSENT after last key deleted — map field itself removed by Firestore.");
  } else if (typeof cards === "object" && Object.keys(cards as object).length === 0) {
    pass("G", `'cards' field is an EMPTY MAP {} — Firestore kept the field. Value: ${label(cards)}`);
  } else {
    fail("G", `Unexpected state: ${label(cards)}`);
  }
}

async function testH(db: Firestore) {
  console.log("\n── Test H: updateDoc on non-existent document ─────────────────────");
  const ref = doc(db, "test_col", "testH_nonexistent_" + Date.now());
  // This doc must not exist
  const pre = await getDoc(ref);
  if (pre.exists()) {
    console.log("  [skip] doc accidentally exists, skipping H");
    return;
  }

  try {
    await updateDoc(ref, new FieldPath("cards", "sv03.5-001"), { copies: 1, language: "es" });
    fail("H", "No error thrown — updateDoc on missing doc SUCCEEDED (unexpected in Firestore v9+)");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string }).code ?? "unknown";
    pass("H", `Error thrown as expected. code=${code}, message="${message}". Must handle this case with setDoc or existence check before updateDoc.`);
  }
}

async function testI(db: Firestore) {
  console.log("\n── Test I: First card with dotted ID in non-existent doc via setDoc ─");
  const ref = doc(db, "test_col", "testI_" + Date.now());
  // Doc must not exist — fresh timestamped ID guarantees this

  await setDoc(ref, { cards: { "sv03.5-001": { copies: 1, language: "es" } }, updated_at: null }, { merge: true });

  const snap = await getDoc(ref);
  const data = snap.data() as Record<string, unknown>;
  const cards = data.cards as Record<string, unknown>;
  console.log("  Read-back:", label(cards));

  const entry = cards["sv03.5-001"] as { copies: number; language: string } | undefined;
  if (entry?.copies === 1 && entry?.language === "es") {
    pass("I", `cards["sv03.5-001"] = ${label(entry)} — literal dotted key stored via setDoc.`);
  } else {
    fail("I", `Expected {copies:1, language:"es"}, got ${label(entry)}`);
  }

  // Dot must NOT be interpreted as a nested path separator in the map value
  const nestedSv03 = data["sv03"] as unknown;
  if (nestedSv03 === undefined) {
    pass("I-dot", "No nested 'sv03' key — dot in map value treated as literal ✓");
  } else {
    fail("I-dot", `Unexpected nested key 'sv03': ${label(nestedSv03)}`);
  }
}

// ── runner ────────────────────────────────────────────────────────────────────
async function run() {
  console.log("=== Firestore FieldPath Emulator Tests ===");
  console.log(`Connecting to emulator at ${EMULATOR_HOST}:${EMULATOR_PORT}`);

  init();

  try {
    await testA(db);
    await testB(db);
    await testC(db);
    await testD(db);
    await testE(db);
    await testF(db);
    await testG(db);
    await testH(db);
    await testI(db);
  } finally {
    await cleanup();
    console.log("\n=== Done ===");
  }
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
