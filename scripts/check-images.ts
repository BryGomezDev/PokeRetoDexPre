/**
 * scripts/check-images.ts
 *
 * Samples 30 cards from public/catalog/v1/ in three categories:
 *   - es_only  : image exists in 'es' array but NOT in 'en' array (e.g. sm3.5 cards)
 *   - both     : image exists in both 'en' and 'es' arrays (uses EN url for the test)
 *   - en_only  : image exists in 'en' array but NOT in 'es' array
 *
 * For each sampled card, makes HEAD requests to:
 *   {image}/high.webp   and   {image}/high.jpg
 *
 * Rate limit: max 2 requests/second (500 ms minimum gap between requests).
 *
 * Usage:
 *   npx tsx scripts/check-images.ts
 *
 * Requires Node 18+ (built-in fetch). No extra dependencies.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

interface CatalogCard {
  id: string;
  image: string;
}
interface CatalogFile {
  en?: CatalogCard[];
  es?: CatalogCard[];
}
type Category = "es_only" | "both" | "en_only";
interface Sample {
  id: string;
  category: Category;
  imageUrl: string;
}

const CATALOG_DIR = join(process.cwd(), "public/catalog/v1");
const PER_CAT = 10;
const MIN_GAP_MS = 500; // 2 req/sec max

function buildSamples(): Sample[] {
  const files = readdirSync(CATALOG_DIR)
    .filter((f) => /^\d+\.json$/.test(f))
    .sort((a, b) => parseInt(a) - parseInt(b));

  const esOnly: Sample[] = [];
  const both: Sample[] = [];
  const enOnly: Sample[] = [];

  for (const file of files) {
    if (
      esOnly.length >= PER_CAT &&
      both.length >= PER_CAT &&
      enOnly.length >= PER_CAT
    )
      break;

    const raw = readFileSync(join(CATALOG_DIR, file), "utf-8");
    const data = JSON.parse(raw) as CatalogFile;
    const en = (data.en ?? []).filter((c) => c.image);
    const es = (data.es ?? []).filter((c) => c.image);
    const enById = new Map(en.map((c) => [c.id, c.image]));
    const esById = new Map(es.map((c) => [c.id, c.image]));

    for (const [id, img] of esById) {
      if (!enById.has(id) && esOnly.length < PER_CAT)
        esOnly.push({ id, category: "es_only", imageUrl: img });
    }
    for (const [id, imgEn] of enById) {
      if (esById.has(id) && both.length < PER_CAT)
        both.push({ id, category: "both", imageUrl: imgEn });
    }
    for (const [id, img] of enById) {
      if (!esById.has(id) && enOnly.length < PER_CAT)
        enOnly.push({ id, category: "en_only", imageUrl: img });
    }
  }

  return [
    ...esOnly.slice(0, PER_CAT),
    ...both.slice(0, PER_CAT),
    ...enOnly.slice(0, PER_CAT),
  ];
}

async function headReq(url: string): Promise<{ status: number; len: string }> {
  const res = await fetch(url, { method: "HEAD" });
  return {
    status: res.status,
    len: res.headers.get("content-length") ?? "-",
  };
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

async function main() {
  const samples = buildSamples();
  const counts = {
    es_only: samples.filter((s) => s.category === "es_only").length,
    both: samples.filter((s) => s.category === "both").length,
    en_only: samples.filter((s) => s.category === "en_only").length,
  };
  console.log(
    `Muestreo: ${counts.es_only} ES-only | ${counts.both} ambas | ${counts.en_only} EN-only`
  );
  console.log(
    `Total peticiones HEAD: ${samples.length * 2} (high.webp + high.jpg por carta, máx 2/s)\n`
  );

  const header =
    `${"id".padEnd(22)} ${"categoría".padEnd(9)} ${"formato".padEnd(10)} ` +
    `${"status".padEnd(7)} ${"bytes".padEnd(10)} url`;
  console.log(header);
  console.log("-".repeat(100));

  let lastReq = 0;

  for (const { id, category, imageUrl } of samples) {
    for (const fmt of ["high.webp", "high.jpg"] as const) {
      const url = `${imageUrl}/${fmt}`;

      const now = Date.now();
      const wait = MIN_GAP_MS - (now - lastReq);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastReq = Date.now();

      try {
        const { status, len } = await headReq(url);
        console.log(
          `${pad(id, 22)} ${pad(category, 9)} ${pad(fmt, 10)} ` +
            `${pad(String(status), 7)} ${pad(len, 10)} ${url}`
        );
      } catch (e) {
        console.log(
          `${pad(id, 22)} ${pad(category, 9)} ${pad(fmt, 10)} ` +
            `${"ERR".padEnd(7)} ${"".padEnd(10)} ${url} — ${String(e)}`
        );
      }
    }
  }

  console.log("\nListo.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
