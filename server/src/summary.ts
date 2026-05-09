import { Transaction } from "./schema.js";

export function summarizeMonth(transactions: Transaction[], month: string) {
  const items = transactions.filter((item) => item.occurred_at.startsWith(month));
  const expenseItems = items.filter((item) => item.type === "expense");
  const incomeItems = items.filter((item) => item.type === "income");

  const byCategory = new Map<string, number>();
  for (const item of expenseItems) {
    byCategory.set(item.category, (byCategory.get(item.category) || 0) + item.amount);
  }

  return {
    month,
    total_expense: round(expenseItems.reduce((sum, item) => sum + item.amount, 0)),
    total_income: round(incomeItems.reduce((sum, item) => sum + item.amount, 0)),
    transaction_count: items.length,
    by_category: Object.fromEntries(
      [...byCategory.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([category, amount]) => [category, round(amount)])
    )
  };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
