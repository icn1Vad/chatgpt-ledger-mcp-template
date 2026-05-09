# ChatGPT 网页端配置清单

这部分需要你在网页上操作。等云端 MCP 服务有 HTTPS 地址后，再执行下面步骤。

## 需要你操作

1. 打开 ChatGPT 网页版。
2. 进入 Settings / Apps & Connectors。
3. 打开 Developer Mode。
4. 创建自定义 Connector。
5. 填入 MCP 服务地址：

```text
https://你的域名或隧道地址/mcp
```

6. 确认 ChatGPT 能看到这些工具：

```text
add_transaction
list_transactions
update_transaction
delete_transaction
export_transactions
monthly_summary
```

7. 在 ChatGPT 里测试：

```text
记一笔，今天咖啡 12.5，示例咖啡店
```

预期结果：ChatGPT 会把自然语言解析成结构化字段，并调用 `add_transaction`。

## 建议固定一个账本 Project

建议新建或固定一个“记账”聊天 / Project，并只在这里报账。这样上下文更稳定，也更容易让模型保持同一套分类习惯。
