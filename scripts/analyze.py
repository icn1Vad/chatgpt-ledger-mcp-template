from __future__ import annotations

import csv
from collections import defaultdict
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_rows() -> list[dict[str, str]]:
    path = ROOT / "data/transactions.csv"
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def money(value: float) -> str:
    return f"{value:.2f}"


def build_month_report(month: str, rows: list[dict[str, str]]) -> str:
    month_rows = [row for row in rows if row["occurred_at"].startswith(month)]
    expenses = [row for row in month_rows if row["type"] == "expense"]
    income = [row for row in month_rows if row["type"] == "income"]

    by_category: dict[str, float] = defaultdict(float)
    for row in expenses:
        by_category[row["category"] or "未分类"] += float(row["amount"] or 0)

    lines = [
        f"# {month} 账本月报",
        "",
        f"- 账目数量：{len(month_rows)}",
        f"- 总支出：{money(sum(float(row['amount'] or 0) for row in expenses))} CNY",
        f"- 总收入：{money(sum(float(row['amount'] or 0) for row in income))} CNY",
        "",
        "## 分类支出",
        "",
        "| 分类 | 金额 |",
        "| --- | ---: |",
    ]

    for category, amount in sorted(by_category.items(), key=lambda item: item[1], reverse=True):
        lines.append(f"| {category} | {money(amount)} |")

    lines.extend(["", "## 明细", "", "| 日期 | 分类 | 金额 | 商家 | 备注 |", "| --- | --- | ---: | --- | --- |"])
    for row in month_rows:
        lines.append(
            f"| {row['occurred_at']} | {row['category']} | {money(float(row['amount'] or 0))} | "
            f"{row['merchant']} | {row['note']} |"
        )

    return "\n".join(lines) + "\n"


def main() -> None:
    rows = load_rows()
    if not rows:
        print("No transactions to analyze")
        return

    months = sorted({row["occurred_at"][:7] for row in rows if row.get("occurred_at")})
    reports_dir = ROOT / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    for month in months:
        report = build_month_report(month, rows)
        (reports_dir / f"{month}.md").write_text(report, encoding="utf-8")

    latest = months[-1] if months else date.today().strftime("%Y-%m")
    print(f"Generated {len(months)} report(s), latest: reports/{latest}.md")


if __name__ == "__main__":
    main()
