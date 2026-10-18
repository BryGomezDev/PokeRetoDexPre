// src/lib/cards.ts

export interface CatalogCard {
  id: string;
  localId: string;
  name: string;
  setId: string;
  setName: string;
  rarity: string;
  image: string;
  variants: Record<string, boolean>;
}

export interface MergedCard extends CatalogCard {
  nameEs: string | null;
  hasEs: boolean;
  imageEs: string | null;
}

export function mergeCards(data: { en: CatalogCard[]; es: CatalogCard[] }): MergedCard[] {
  const esMap = new Map(data.es.map((c) => [c.id, c]));
  return data.en.map((c) => {
    const esCard = esMap.get(c.id);
    return {
      ...c,
      nameEs: esCard?.name ?? null,
      hasEs: !!esCard,
      imageEs: esCard?.image || null,
    };
  });
}

export function filterCards(
  cards: MergedCard[],
  isOwned: (id: string) => boolean,
  statusFilter: "all" | "owned" | "missing",
  setFilter: string,
  rarityFilter: string
): MergedCard[] {
  return cards.filter((c) => {
    const owned = isOwned(c.id);
    if (statusFilter === "owned" && !owned) return false;
    if (statusFilter === "missing" && owned) return false;
    if (setFilter && c.setName !== setFilter) return false;
    if (rarityFilter && c.rarity !== rarityFilter) return false;
    return true;
  });
}

export interface CardEntry {
  copies: number;
  language: "es" | "en" | "zh" | "ko" | "ja" | "otros" | null;
}

export function applyCardEntry(
  cards: Record<string, CardEntry>,
  cardId: string,
  entry: CardEntry | null
): Record<string, CardEntry> {
  const next = { ...cards };
  if (entry === null) {
    delete next[cardId];
  } else {
    next[cardId] = entry;
  }
  return next;
}
