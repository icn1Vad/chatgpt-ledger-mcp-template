# Cloud Deployment

This template is designed for a simple hosted Node MCP server plus Supabase storage.

## Recommended Platform

Render is recommended for the first version:

- Easy GitHub integration
- HTTPS URL included
- Simple environment variable UI
- Good fit for a long-running MCP HTTP endpoint

Railway is also a good alternative. Fly.io is better when you want Docker, multi-region deployment, or more infrastructure control.

## Render Settings

Create a new Web Service.

```text
Runtime: Node
Build Command: npm install && npm run build
Start Command: npm run start
```

If this project is in a monorepo, set Root Directory to the folder containing `package.json`.

Environment variables:

```text
NODE_VERSION=22
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

Render sets `PORT` automatically.

## Verify Deployment

Health check:

```text
https://your-render-service.onrender.com/health
```

Expected response:

```json
{"status":"ok"}
```

MCP endpoint:

```text
https://your-render-service.onrender.com/mcp
```

Use this URL in ChatGPT Connector setup.
