export const APP_VERSION = "1.1.2";

// Bump this number manually ONLY when the /pokemon population script is re-run
// and the base data changes (new Pokémon, fixed sprites, etc.). Incrementing
// this value changes the sessionStorage key, automatically invalidating the
// old cache on the next page load. Independent of APP_VERSION on purpose —
// a UI release should not force all users to re-read 1215 Firestore documents.
export const POKEMON_DATA_VERSION = 1;

// Bump this number ONLY when the TCGdex catalog is regenerated and the card
// data changes (new sets, rarity mapping update, new languages). Independent
// of APP_VERSION and POKEMON_DATA_VERSION on purpose.
// The version is used in the catalog URL path: public/catalog/v{N}/{lang}/{dexId}.json
export const TCGDEX_CATALOG_VERSION = 1;
