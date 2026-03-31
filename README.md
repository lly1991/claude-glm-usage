# GLM Usage Hub - Claude Code Plugin

Monitor your GLM Plan usage directly in Claude Code with a terminal dashboard and HUD status bar integration.

## Features

- **Terminal Dashboard** — Color-coded progress bars for token and MCP usage, model/tool breakdown tables
- **HUD Status Bar** — Real-time usage percentages in the Claude Code status bar (via OMC HUD)
- **Slash Command** — Type `/glm-usage-hub:usage` to instantly view your usage
- **Zero Dependencies** — Single-file ESM scripts, no npm install needed

## Install

Add this repo as a marketplace in `~/.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "claude-glm-usage": {
      "source": { "source": "github", "repo": "lly1991/claude-glm-usage" }
    }
  }
}
```

Then install:

```bash
claude plugin install glm-usage-hub@claude-glm-usage
```

## Requirements

Set these environment variables (typically already configured for GLM Plan users):

```bash
export ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic"
export ANTHROPIC_AUTH_TOKEN="your-token-here"
```

## Usage

### Slash Command

Type in Claude Code:

```
/glm-usage-hub:usage
```

### Direct Script

```bash
# Terminal dashboard
node plugins/glm-usage-hub/skills/usage-skill/scripts/dashboard.mjs

# HUD provider (JSON output for OMC)
node plugins/glm-usage-hub/skills/usage-skill/scripts/hud-provider.mjs
```

## OMC HUD Integration

Add to `~/.claude/settings.json` to display usage in the status bar:

```json
{
  "omcHud": {
    "rateLimitsProvider": {
      "type": "custom",
      "command": "node path/to/claude-glm-usage/plugins/glm-usage-hub/skills/usage-skill/scripts/hud-provider.mjs",
      "timeoutMs": 5000
    }
  }
}
```

## Plugin Structure

```
claude-glm-usage/
├── plugins/
│   └── glm-usage-hub/
│       ├── .claude-plugin/plugin.json
│       ├── agents/usage-query-agent.md
│       ├── commands/usage.md
│       ├── skills/usage-skill/
│       │   ├── SKILL.md
│       │   └── scripts/
│       │       ├── dashboard.mjs      # Terminal dashboard (zero deps)
│       │       └── hud-provider.mjs   # HUD JSON provider
│       └── scripts/hud-provider.mjs   # Standalone HUD provider
├── README.md
└── LICENSE
```

## Supported Platforms

| Platform | Base URL |
|----------|----------|
| ZAI | `api.z.ai` |
| ZHIPU | `open.bigmodel.cn` / `dev.bigmodel.cn` |

## License

MIT
