from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
FIELDS = [
    "id",
    "occurred_at",
    "amount",
    "currency",
    "type",
    "category",
    "merchant",
    "account",
    "payment_method",
    "note",
    "raw_text",
    "source",
    "created_at",
    "updated_at",
]


def normalize_transaction(item: dict[str, Any]) -> dict[str, Any]:
    return {field: item.get(field, "") for field in FIELDS}


def load_json(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8") or "[]")
    if isinstance(data, dict) and "transactions" in data:
        data = data["transactions"]
    if not isinstance(data, list):
        raise ValueError(f"{path} must contain a list of transactions")
    return [normalize_transaction(item) for item in data]


def dedupe(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: dict[str, dict[str, Any]] = {}
    for item in items:
        key = item.get("id") or "|".join(
            str(item.get(field, ""))
            for field in ["occurred_at", "amount", "currency", "merchant", "note"]
        )
        seen[key] = item
    return sorted(seen.values(), key=lambda row: (row["occurred_at"], row["created_at"], row["id"]))


def write_csv(path: Path, items: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(items)


def write_markdown(path: Path, items: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# 本地账本",
        "",
        "| 日期 | 类型 | 分类 | 金额 | 币种 | 商家 | 备注 |",
        "| --- | --- | --- | ---: | --- | --- | --- |",
    ]
    for item in items:
        amount = float(item["amount"] or 0)
        lines.append(
            f"| {item['occurred_at']} | {item['type']} | {item['category']} | "
            f"{amount:.2f} | {item['currency']} | {item['merchant']} | {item['note']} |"
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_json(path: Path, items: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync cloud ledger export into local files.")
    parser.add_argument("--source", default="exports/raw-transactions.json", help="JSON export path")
    args = parser.parse_args()

    source = ROOT / args.source
    items = dedupe(load_json(source))

    write_json(ROOT / "exports/raw-transactions.json", items)
    write_csv(ROOT / "data/transactions.csv", items)
    write_markdown(ROOT / "data/ledger.md", items)

    print(f"Synced {len(items)} transactions")


if __name__ == "__main__":
    main()
