export const AVATAR_SLUGS = [
  "pikachu", "charizard", "mewtwo", "gengar", "eevee",
  "snorlax", "lucario", "gardevoir", "blaziken",
  "umbreon", "sylveon", "greninja", "garchomp", "rayquaza",
  "tyranitar", "dragonite", "absol", "zoroark", "decidueye",
] as const;

export type AvatarSlug = typeof AVATAR_SLUGS[number];

export function formatAvatarName(name: string): string {
  return name.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
