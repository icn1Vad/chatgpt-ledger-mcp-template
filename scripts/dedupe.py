from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "exports/raw-transactions.json"


def main() -> None:
    data = json.loads(PATH.read_text(encoding="utf-8") or "[]")
    unique = {}
    for item in data:
        key = item.get("id") or "|".join(
            str(item.get(field, ""))
            for field in ["occurred_at", "amount", "currency", "merchant", "note"]
        )
        unique[key] = item

    rows = sorted(unique.values(), key=lambda item: (item.get("occurred_at", ""), item.get("created_at", "")))
    PATH.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Deduped {len(data)} -> {len(rows)} transactions")


if __name__ == "__main__":
    main()
