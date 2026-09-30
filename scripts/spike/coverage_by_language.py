"""
coverage_by_language.py — language coverage matrix
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from utils import cached_get, BASE_URL

LANGUAGES = ["en", "es", "fr", "de", "it", "pt-br", "pt-pt", "nl", "pl", "ru", "ja", "ko", "zh-tw", "zh-cn", "id", "th"]

def main():
    results = []

    for lang in LANGUAGES:
        print(f"  Checking {lang}...")

        # sets
        sets_data = cached_get(f"{BASE_URL}/{lang}/sets", f"{lang}_sets")
        sets_count = len(sets_data) if sets_data else 0
        sets_status = "200" if sets_data is not None else "404"

        # cards index
        cards_data = cached_get(f"{BASE_URL}/{lang}/cards", f"{lang}_cards_index")
        cards_count = len(cards_data) if cards_data else 0
        cards_status = "200" if cards_data is not None else "404"

        notes = []
        if cards_count > 0:
            notes.append("data confirmed")
        elif sets_count > 0:
            notes.append("sets only")
        else:
            notes.append("not available")

        # extra check for ko and zh-cn
        if lang in ("ko", "zh-cn") and sets_count > 0 and sets_data:
            first_set_id = sets_data[0].get("id", "")
            if first_set_id:
                set_detail = cached_get(f"{BASE_URL}/{lang}/sets/{first_set_id}", f"{lang}_set_detail_{first_set_id}")
                if set_detail:
                    card_list = set_detail.get("cards", [])
                    if card_list:
                        first_card_id = card_list[0].get("id", "")
                        if first_card_id:
                            card_detail = cached_get(f"{BASE_URL}/{lang}/cards/{first_card_id}", f"{lang}_card_sample_{first_card_id}")
                            if card_detail and card_detail.get("name"):
                                notes.append(f"card name confirmed: {card_detail['name']}")
                            elif card_detail:
                                notes.append("card detail exists but no name")

        results.append({
            "lang": lang,
            "sets": sets_count,
            "cards": cards_count,
            "status": f"sets:{sets_status}/cards:{cards_status}",
            "notes": "; ".join(notes),
        })

    print()
    print("=" * 80)
    print("LANGUAGE COVERAGE TABLE")
    print("=" * 80)
    print(f"{'language':<10} {'sets':>6} {'cards':>7} {'status':<22} notes")
    print("-" * 80)
    total_sets = 0
    total_cards = 0
    for r in results:
        print(f"{r['lang']:<10} {r['sets']:>6} {r['cards']:>7} {r['status']:<22} {r['notes']}")
        total_sets += r["sets"]
        total_cards += r["cards"]

    print("-" * 80)
    print(f"  Total sets across all languages (with overlap): {total_sets}")
    print(f"  Total cards across all languages (with overlap): {total_cards}")
    print()
    langs_with_cards = [r["lang"] for r in results if r["cards"] > 0]
    print(f"  Languages with card data: {langs_with_cards}")

if __name__ == "__main__":
    main()
