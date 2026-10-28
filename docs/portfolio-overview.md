# Ledger MCP workflow overview

The template connects natural-language transaction requests, an MCP tool surface, structured persistence, and local exports. It records transactions supplied by the user; it does not connect to payment accounts.

| Workflow | Public tool |
| --- | --- |
| Add a record | `add_transaction` |
| Inspect recent records | `list_transactions` |
| Correct a record | `update_transaction` |
| Remove a record from normal results | `delete_transaction` (soft deletion) |
| Summarize a month | `monthly_summary` |
| Export a date range | `export_transactions` |

The original README explains the Supabase schema, deployment, and CSV / Markdown reporting scripts. Use fictional records when demonstrating the template. A health endpoint confirms server reachability; it does not establish that authorization or isolation is correct.

## Verification

`npm run build` compiles the TypeScript source. For an integration check, use an isolated test store, add a fictional transaction, list it, edit it, soft-delete it, and check the export behavior. Do not use a personal financial ledger as a public demonstration dataset.

The portfolio update changes documentation only; no live database operations are performed.
