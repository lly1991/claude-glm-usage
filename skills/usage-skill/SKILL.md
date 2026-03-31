---
name: usage-skill
description: Run the usage query script to retrieve account usage information for GLM Coding Plan
---

## Instructions

1. Run the dashboard script to fetch and display GLM Plan usage data:

```bash
node "{{skill_dir}}/scripts/dashboard.mjs"
```

2. The script will output a formatted terminal dashboard with:
   - Token usage progress bar (5h window)
   - MCP usage progress bar (monthly)
   - Model usage table (24h)
   - Tool usage table (24h)

3. If the script fails, check that the following environment variables are set:
   - `ANTHROPIC_AUTH_TOKEN` - API authentication token
   - `ANTHROPIC_BASE_URL` - API base URL (e.g., `https://api.z.ai/api/anthropic`)
