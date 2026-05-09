import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { z } from "zod";
import {
  transactionInputSchema,
  transactionSchema,
  transactionUpdateSchema
} from "./schema.js";
import {
  addTransaction,
  deleteTransaction,
  exportTransactions,
  listTransactions,
  readTransactions,
  updateTransaction
} from "./store.js";
import { summarizeMonth } from "./summary.js";

const port = Number(process.env.PORT || 3210);

function createLedgerServer() {
  const server = new McpServer({
    name: "chatgpt-ledger-mcp-template",
    version: "0.2.0"
  });

  server.registerTool(
    "add_transaction",
    {
      title: "新增一笔账目",
      description: "把用户主动告诉 ChatGPT 的一笔收入、支出或转账写入个人账本。",
      inputSchema: transactionInputSchema.shape,
      outputSchema: {
        transaction: transactionSchema,
        duplicate: z.boolean()
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false
      }
    },
    async (input) => {
      const result = await addTransaction(input);
      const label = result.transaction.merchant || result.transaction.note || "未命名账目";
      return {
        structuredContent: result,
        content: [
          {
            type: "text",
            text: result.duplicate
              ? `这笔账可能已经存在：${result.transaction.amount} ${result.transaction.currency}，${label}`
              : `已记录：${result.transaction.amount} ${result.transaction.currency}，${label}`
          }
        ]
      };
    }
  );

  server.registerTool(
    "update_transaction",
    {
      title: "修改一笔账目",
      description: "按账目 id 修改日期、金额、分类、商家、备注等字段。",
      inputSchema: {
        id: z.string(),
        ...transactionUpdateSchema.shape
      },
      outputSchema: {
        transaction: transactionSchema
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false
      }
    },
    async ({ id, ...patch }) => {
      const transaction = await updateTransaction(id, patch);
      return {
        structuredContent: { transaction },
        content: [
          {
            type: "text",
            text: `已修改：${transaction.amount} ${transaction.currency}，${transaction.merchant || transaction.note || transaction.id}`
          }
        ]
      };
    }
  );

  server.registerTool(
    "delete_transaction",
    {
      title: "删除一笔账目",
      description: "按账目 id 软删除一笔账，数据库中保留删除标记以便审计和恢复。",
      inputSchema: {
        id: z.string(),
        reason: z.string().default("")
      },
      outputSchema: {
        transaction: transactionSchema
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: true
      }
    },
    async ({ id, reason }) => {
      const transaction = await deleteTransaction(id, reason);
      return {
        structuredContent: { transaction },
        content: [
          {
            type: "text",
            text: `已删除：${transaction.amount} ${transaction.currency}，${transaction.merchant || transaction.note || transaction.id}`
          }
        ]
      };
    }
  );

  server.registerTool(
    "list_transactions",
    {
      title: "查询最近账目",
      description: "列出最近记录的账目。",
      inputSchema: {
        limit: z.number().int().min(1).max(100).default(20)
      },
      outputSchema: {
        transactions: z.array(transactionSchema)
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ limit }) => {
      const transactions = await listTransactions(limit);
      const structuredContent = { transactions };
      return {
        structuredContent,
        content: [{ type: "text", text: JSON.stringify(structuredContent) }]
      };
    }
  );

  server.registerTool(
    "export_transactions",
    {
      title: "导出账目",
      description: "导出指定日期范围内的账目，供 Codex 本地同步到 CSV、Excel 和 Markdown。",
      inputSchema: {
        start_date: z.string().optional(),
        end_date: z.string().optional()
      },
      outputSchema: {
        transactions: z.array(transactionSchema)
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ start_date, end_date }) => {
      const transactions = await exportTransactions(start_date, end_date);
      const structuredContent = { transactions };
      return {
        structuredContent,
        content: [{ type: "text", text: JSON.stringify(structuredContent) }]
      };
    }
  );

  server.registerTool(
    "monthly_summary",
    {
      title: "月度账本汇总",
      description: "按月份汇总收入、支出、分类金额和账目数量。",
      inputSchema: {
        month: z.string().describe("YYYY-MM")
      },
      outputSchema: {
        month: z.string(),
        total_expense: z.number(),
        total_income: z.number(),
        transaction_count: z.number(),
        by_category: z.record(z.string(), z.number())
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ month }) => {
      const summary = summarizeMonth(await readTransactions(), month);
      return {
        structuredContent: summary,
        content: [{ type: "text", text: JSON.stringify(summary) }]
      };
    }
  );

  return server;
}

const transports = new Map<string, StreamableHTTPServerTransport>();
const servers = new Map<string, McpServer>();

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://localhost:${port}`);

    if (url.pathname === "/health") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (url.pathname !== "/mcp") {
      response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ message: "Not found" }));
      return;
    }

    const sessionId = request.headers["mcp-session-id"];
    let transport = typeof sessionId === "string" ? transports.get(sessionId) : undefined;

    if (!transport) {
      const server = createLedgerServer();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports.set(id, transport as StreamableHTTPServerTransport);
          servers.set(id, server);
        }
      });

      transport.onclose = () => {
        if (transport?.sessionId) {
          transports.delete(transport.sessionId);
          servers.delete(transport.sessionId);
        }
      };

      await server.connect(transport);
    }

    await transport.handleRequest(request, response);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ message: "Internal server error", detail }));
  }
}).listen(port, () => {
  console.log(`Ledger MCP server listening on http://localhost:${port}/mcp`);
});
