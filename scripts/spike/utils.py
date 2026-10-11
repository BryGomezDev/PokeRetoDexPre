import os, json, time, requests

CACHE_DIR = os.path.join(os.path.dirname(__file__), "out")
BASE_URL = "https://api.tcgdex.net/v2"
GRAPHQL_URL = f"{BASE_URL}/graphql"
HEADERS = {"User-Agent": "PokeRetoDex-spike"}
DELAY = 0.5  # seconds between requests

os.makedirs(CACHE_DIR, exist_ok=True)

def _cache_path(key: str) -> str:
    safe = key.replace("/", "_").replace("?", "_").replace("=", "_").replace(":", "_")
    return os.path.join(CACHE_DIR, f"{safe}.json")

def cached_get(url: str, cache_key: str) -> dict | list | None:
    path = _cache_path(cache_key)
    if os.path.exists(path):
        try:
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, ValueError):
            os.remove(path)  # corrupt cache — delete and re-fetch

    for attempt in range(3):
        try:
            time.sleep(DELAY)
            r = requests.get(url, headers=HEADERS, timeout=15)
            if r.status_code == 200:
                data = r.json()
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                return data
            elif r.status_code == 404:
                return None  # Not found, don't cache, don't retry
            elif r.status_code in (429, 500, 502, 503):
                wait = 5 * (attempt + 1)
                print(f"  [{r.status_code}] {url} — waiting {wait}s...")
                time.sleep(wait)
            else:
                print(f"  [UNEXPECTED {r.status_code}] {url}")
                return None
        except Exception as e:
            print(f"  [ERROR] {url}: {e}")
            time.sleep(5)

    print(f"  [FAILED after retries] {url}")
    return None

def graphql_query(query: str, cache_key: str) -> dict | None:
    path = _cache_path(f"graphql_{cache_key}")
    if os.path.exists(path):
        try:
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, ValueError):
            os.remove(path)

    time.sleep(DELAY)
    try:
        r = requests.post(GRAPHQL_URL, json={"query": query},
                          headers={**HEADERS, "Content-Type": "application/json"}, timeout=15)
        if r.status_code == 200:
            data = r.json()
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return data
        else:
            print(f"  [GraphQL {r.status_code}] {query[:60]}...")
            return None
    except Exception as e:
        print(f"  [GraphQL ERROR] {e}")
        return None
