import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "./env.js";
import {
  Transaction,
  TransactionInput,
  TransactionUpdate,
  transactionSchema
} from "./schema.js";

loadEnvFile();

const dataFile = resolve(process.env.LEDGER_DATA_FILE || "exports/raw-transactions.json");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const useSupabase = Boolean(supabaseUrl && supabaseKey);

async function ensureDataFile() {
  await mkdir(dirname(dataFile), { recursive: true });
  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeFile(dataFile, "[]\n", "utf8");
  }
}

function makeTransaction(input: TransactionInput): Transaction {
  const now = new Date().toISOString();
  const cleanDate = input.occurred_at.replaceAll("-", "");
  const randomPart = Math.random().toString(36).slice(2, 8);
  return {
    ...input,
    id: `tx_${cleanDate}_${randomPart}`,
    source: "chatgpt",
    created_at: now,
    updated_at: now,
    deleted_at: null,
    deleted_reason: ""
  };
}

function isActive(item: Transaction) {
  return !item.deleted_at;
}

function isLikelyDuplicate(a: Transaction, b: Transaction) {
  return (
    isActive(a) &&
    a.occurred_at === b.occurred_at &&
    a.amount === b.amount &&
    a.currency === b.currency &&
    a.merchant === b.merchant &&
    a.note === b.note
  );
}

function cleanPatch(patch: TransactionUpdate) {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  ) as TransactionUpdate;
}

async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {})
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${detail}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function readTransactionsFromJson(): Promise<Transaction[]> {
  await ensureDataFile();
  const raw = await readFile(dataFile, "utf8");
  const parsed = JSON.parse(raw || "[]");
  return transactionSchema.array().parse(parsed);
}

async function writeTransactionsToJson(transactions: Transaction[]) {
  await ensureDataFile();
  const ordered = [...transactions].sort((a, b) => {
    const byDate = a.occurred_at.localeCompare(b.occurred_at);
    return byDate === 0 ? a.created_at.localeCompare(b.created_at) : byDate;
  });
  await writeFile(dataFile, `${JSON.stringify(ordered, null, 2)}\n`, "utf8");
}

export async function readTransactions(): Promise<Transaction[]> {
  if (!useSupabase) {
    return (await readTransactionsFromJson()).filter(isActive);
  }

  const rows = await supabaseRequest<unknown[]>(
    "transactions?select=*&deleted_at=is.null&order=occurred_at.asc,created_at.asc"
  );
  return transactionSchema.array().parse(rows);
}

export async function writeTransactions(transactions: Transaction[]) {
  if (!useSupabase) {
    return writeTransactionsToJson(transactions);
  }

  await supabaseRequest("transactions", {
    method: "POST",
    body: JSON.stringify(transactions),
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation"
    }
  });
}

export async function addTransaction(input: TransactionInput) {
  const transaction = makeTransaction(input);

  if (!useSupabase) {
    const transactions = await readTransactionsFromJson();
    const likelyDuplicate = transactions.find((item) => isLikelyDuplicate(item, transaction));

    if (likelyDuplicate) {
      return { transaction: likelyDuplicate, duplicate: true };
    }

    transactions.push(transaction);
    await writeTransactionsToJson(transactions);
    return { transaction, duplicate: false };
  }

  const duplicateQuery = new URLSearchParams({
    select: "*",
    occurred_at: `eq.${transaction.occurred_at}`,
    amount: `eq.${transaction.amount}`,
    currency: `eq.${transaction.currency}`,
    merchant: `eq.${transaction.merchant}`,
    note: `eq.${transaction.note}`,
    deleted_at: "is.null",
    limit: "1"
  });
  const duplicates = await supabaseRequest<unknown[]>(`transactions?${duplicateQuery.toString()}`);
  const parsedDuplicates = transactionSchema.array().parse(duplicates);

  if (parsedDuplicates[0]) {
    return { transaction: parsedDuplicates[0], duplicate: true };
  }

  const inserted = await supabaseRequest<unknown[]>("transactions", {
    method: "POST",
    body: JSON.stringify(transaction)
  });
  const [saved] = transactionSchema.array().parse(inserted);
  return { transaction: saved, duplicate: false };
}

export async function updateTransaction(id: string, patch: TransactionUpdate) {
  const now = new Date().toISOString();
  const clean = { ...cleanPatch(patch), updated_at: now };

  if (!useSupabase) {
    const transactions = await readTransactionsFromJson();
    const index = transactions.findIndex((item) => item.id === id && isActive(item));
    if (index === -1) {
      throw new Error(`Transaction ${id} was not found.`);
    }

    transactions[index] = { ...transactions[index], ...clean };
    await writeTransactionsToJson(transactions);
    return transactions[index];
  }

  const query = new URLSearchParams({
    id: `eq.${id}`,
    deleted_at: "is.null"
  });
  const updated = await supabaseRequest<unknown[]>(`transactions?${query.toString()}`, {
    method: "PATCH",
    body: JSON.stringify(clean)
  });
  const [transaction] = transactionSchema.array().parse(updated);
  if (!transaction) {
    throw new Error(`Transaction ${id} was not found.`);
  }
  return transaction;
}

export async function deleteTransaction(id: string, reason = "") {
  const now = new Date().toISOString();

  if (!useSupabase) {
    const transactions = await readTransactionsFromJson();
    const index = transactions.findIndex((item) => item.id === id && isActive(item));
    if (index === -1) {
      throw new Error(`Transaction ${id} was not found.`);
    }

    transactions[index] = {
      ...transactions[index],
      deleted_at: now,
      deleted_reason: reason,
      updated_at: now
    };
    await writeTransactionsToJson(transactions);
    return transactions[index];
  }

  const query = new URLSearchParams({
    id: `eq.${id}`,
    deleted_at: "is.null"
  });
  const deleted = await supabaseRequest<unknown[]>(`transactions?${query.toString()}`, {
    method: "PATCH",
    body: JSON.stringify({
      deleted_at: now,
      deleted_reason: reason,
      updated_at: now
    })
  });
  const [transaction] = transactionSchema.array().parse(deleted);
  if (!transaction) {
    throw new Error(`Transaction ${id} was not found.`);
  }
  return transaction;
}

export async function listTransactions(limit = 20) {
  if (!useSupabase) {
    const transactions = await readTransactionsFromJson();
    return transactions
      .filter(isActive)
      .sort((a, b) => `${b.occurred_at}${b.created_at}`.localeCompare(`${a.occurred_at}${a.created_at}`))
      .slice(0, limit);
  }

  const query = new URLSearchParams({
    select: "*",
    deleted_at: "is.null",
    order: "occurred_at.desc,created_at.desc",
    limit: String(limit)
  });
  const rows = await supabaseRequest<unknown[]>(`transactions?${query.toString()}`);
  return transactionSchema.array().parse(rows);
}

export async function exportTransactions(startDate?: string, endDate?: string) {
  if (!useSupabase) {
    const transactions = await readTransactionsFromJson();
    return transactions.filter((item) => {
      if (!isActive(item)) return false;
      if (startDate && item.occurred_at < startDate) return false;
      if (endDate && item.occurred_at > endDate) return false;
      return true;
    });
  }

  const query = new URLSearchParams({
    select: "*",
    deleted_at: "is.null",
    order: "occurred_at.asc,created_at.asc"
  });
  if (startDate) query.append("occurred_at", `gte.${startDate}`);
  if (endDate) query.append("occurred_at", `lte.${endDate}`);

  const rows = await supabaseRequest<unknown[]>(`transactions?${query.toString()}`);
  return transactionSchema.array().parse(rows);
}
