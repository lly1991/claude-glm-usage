# GLM Usage Hub - Claude Code Plugin

Monitor your GLM Plan usage directly in Claude Code with a terminal dashboard and HUD status bar integration.

## Features

- **Terminal Dashboard** — Color-coded progress bars for token and MCP usage, model/tool breakdown tables
- **HUD Status Bar** — Real-time usage percentages in the Claude Code status bar (via OMC HUD)
- **Slash Command** — Type `/glm-usage-hub:usage` to instantly view your usage
- **Zero Dependencies** — Single-file ESM scripts, no npm install needed

## Install

```bash
claude plugin install lly1991/claude-glm-usage
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
node skills/usage-skill/scripts/dashboard.mjs

# HUD provider (JSON output for OMC)
node skills/usage-skill/scripts/hud-provider.mjs
```

## OMC HUD Integration

Add to `~/.claude/settings.json` to display usage in the status bar:

```json
{
  "customRateLimitProviders": [
    {
      "name": "glm-usage",
      "command": "node",
      "args": ["path/to/claude-glm-usage/skills/usage-skill/scripts/hud-provider.mjs"]
    }
  ]
}
```

## Plugin Structure

```
claude-glm-usage/
├── .claude-plugin/plugin.json     # Plugin metadata
├── agents/usage-query-agent.md    # Agent definition
├── commands/usage.md              # /usage slash command
├── skills/usage-skill/
│   ├── SKILL.md                   # Skill definition
│   └── scripts/
│       ├── dashboard.mjs          # Terminal dashboard (zero deps)
│       └── hud-provider.mjs       # HUD JSON provider
├── scripts/hud-provider.mjs       # Standalone HUD provider
└── README.md
```

## Supported Platforms

| Platform | Base URL |
|----------|----------|
| ZAI | `api.z.ai` |
| ZHIPU | `open.bigmodel.cn` / `dev.bigmodel.cn` |

## License

MIT
