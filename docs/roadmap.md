# Roadmap and Extension Ideas

This file collects recommended extensions for the ChatGPT Ledger MCP template.

## Highest Priority

### 1. Restore Soft-Deleted Transactions

Current deletion is soft deletion through:

```text
deleted_at
deleted_reason
```

Add:

```text
restore_transaction
```

Use case:

```text
恢复刚才误删的那笔账
```

### 2. Cloud-to-Local Sync

Current local scripts can process local JSON exports. A better version should pull from:

```text
export_transactions
```

or directly from Supabase REST.

Outputs:

```text
data/transactions.csv
data/ledger.md
reports/YYYY-MM.md
```

### 3. Better Update/Delete UX

Recommended flow:

```text
User: 把刚才那笔咖啡改成示例咖啡店
Assistant: list_transactions
Assistant: 找到候选账目，请确认
User: 确认
Assistant: update_transaction
```

Avoid modifying or deleting if the target is ambiguous.

## Valuable Features

### 4. Category Rules and Merchant Aliases

Use `config/categories.yml` to map merchants and keywords:

```text
咖啡店 / 奶茶 / 餐厅 -> 餐饮
打车 / 地铁 / 公交 -> 交通
书 / 课程 / 考试 -> 学习
```

The server can normalize category before insertion.

### 5. Enhanced Monthly Reports

Add:

- top 5 merchants
- top 5 categories
- daily average spend
- largest transaction
- comparison with last month
- unusual spend notes

### 6. Natural-Language Query Tool

Add:

```text
query_transactions
```

Examples:

```text
查询 5 月餐饮
查询本周交通
查询某个商家的消费
查询大于 100 元的支出
```

### 7. Budget Tracking

Add:

```text
set_budget
check_budget
```

Examples:

```text
设置餐饮月预算 1500
看看本月餐饮预算用了多少
```

### 8. Recurring Transactions

Support rent, subscriptions, phone bills, memberships, and recurring transfers.

Possible table:

```text
recurring_transactions
```

### 9. Account and Payment Method Analytics

If the user manually provides payment method or account, reports can summarize:

```text
Alipay
WeChat Pay
Bank card
Credit card
Cash
```

Do not automatically read payment streams in the template.

### 10. Web Dashboard

A read-only dashboard could show:

- current month spend
- category chart
- recent transactions
- search and filter
- soft-deleted records and restore action

## Security Improvements

### 11. App-Level Token

The public MCP endpoint should eventually require a token.

Possible environment variable:

```text
LEDGER_API_TOKEN
```

If ChatGPT Connector supports custom headers, require:

```text
Authorization: Bearer <token>
```

### 12. Stricter RLS

For multi-user use, add:

```text
user_id
```

and enforce per-user RLS policies.

## Suggested Development Order

```text
restore_transaction
-> cloud-to-local sync
-> category rules
-> enhanced monthly reports
-> query_transactions
-> web dashboard
-> app-level token
-> multi-user support
```
