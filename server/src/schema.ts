import { z } from "zod";

export const transactionInputSchema = z.object({
  occurred_at: z.string().describe("Transaction date in YYYY-MM-DD format."),
  amount: z.number().positive(),
  currency: z.string().default("CNY"),
  type: z.enum(["expense", "income", "transfer"]).default("expense"),
  category: z.string().default("未分类"),
  merchant: z.string().default(""),
  account: z.string().default(""),
  payment_method: z.string().default(""),
  note: z.string().default(""),
  raw_text: z.string().default("")
});

export const transactionUpdateSchema = transactionInputSchema.partial();

export const transactionSchema = transactionInputSchema.extend({
  id: z.string(),
  source: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable().optional(),
  deleted_reason: z.string().nullable().optional()
});

export type TransactionInput = z.infer<typeof transactionInputSchema>;
export type TransactionUpdate = z.infer<typeof transactionUpdateSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
