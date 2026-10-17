// Static rarity map from public/catalog/v1/rarities.json
// wikidex:true → has an official Spanish name; wikidex:false → no ES equivalent, show TCGdex name.
// Update only when the catalog ETL script is re-run (same lifecycle as POKEMON_DATA_VERSION).
export const RARITIES: Record<string, { es: string | null; wikidex: boolean }> = {
  "Common":                    { es: "Común",                      wikidex: true  },
  "Rare":                      { es: "Rara",                       wikidex: true  },
  "Uncommon":                  { es: "Infrecuente",                wikidex: true  },
  "Ultra Rare":                { es: "Rara Ultra",                 wikidex: true  },
  "Promo":                     { es: "Promo",                      wikidex: true  },
  "Holo Rare":                 { es: "Rara Holo",                  wikidex: true  },
  "Illustration rare":         { es: "Rara Ilustración",           wikidex: true  },
  "None":                      { es: null,                         wikidex: false },
  "Secret Rare":               { es: "Rara Secreta",               wikidex: true  },
  "Double rare":               { es: "Rara Doble",                 wikidex: true  },
  "Shiny rare":                { es: null,                         wikidex: false },
  "Holo Rare V":               { es: "Rara Holo V",                wikidex: true  },
  "Special illustration rare": { es: "Rara Ilustración Especial",  wikidex: true  },
  "Rare Holo":                 { es: "Rara Holo",                  wikidex: true  },
  "Holo Rare VMAX":            { es: "Rara Holo VMAX",             wikidex: true  },
  "Rare Holo LV.X":            { es: "Rara Holo Niv.X",            wikidex: true  },
  "Hyper rare":                { es: "Rara Híper",                 wikidex: true  },
  "Holo Rare VSTAR":           { es: "Rara Holo V-ASTRO",          wikidex: true  },
  "LEGEND":                    { es: "Rara LEYENDA",               wikidex: true  },
  "Pikachu Rare":              { es: "Pikachu",                    wikidex: true  },
  "Rare PRIME":                { es: "Rara Prime",                 wikidex: true  },
  "Classic Collection":        { es: null,                         wikidex: false },
  "Radiant Rare":              { es: "Rara Radiante",              wikidex: true  },
  "Shiny Ultra Rare":          { es: null,                         wikidex: false },
  "Shiny rare V":              { es: null,                         wikidex: false },
  "Amazing Rare":              { es: "Rara Increíble",             wikidex: true  },
  "Mega Hyper Rare":           { es: "Rara Híper Mega",            wikidex: true  },
  "Shiny rare VMAX":           { es: null,                         wikidex: false },
  "Mega Attack Rare":          { es: "Rara Ataque Mega",           wikidex: true  },
  "Black White Rare":          { es: "Rara ACE",                   wikidex: true  },
  "RGB Rare":                  { es: null,                         wikidex: false },
  "Futuristic Rare":           { es: "Rara Futurista",             wikidex: true  },
};

export function getRarityLabel(rarity: string, lang: "es" | "en"): string {
  if (rarity === "None") return lang === "es" ? "Sin rareza" : "No rarity";
  const info = RARITIES[rarity];
  if (!info) return rarity;
  if (lang === "es" && info.wikidex && info.es) return info.es;
  return rarity;
}
