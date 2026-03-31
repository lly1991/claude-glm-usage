#!/usr/bin/env node
/**
 * GLM Usage Hub - Zero-dependency Terminal Dashboard
 *
 * Merged from TypeScript sources into a single ESM script.
 * Uses only Node.js built-in modules (https, process).
 * ANSI escape sequences replace chalk for colors.
 *
 * Usage: node dashboard.mjs
 * Requires: ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL env vars
 */

import https from 'https';

// ─── ANSI Colors (replaces chalk) ──────────────────────────────

const ESC = '\x1b[';
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const DIM = `${ESC}2m`;

function hex(hexStr) {
  const h = hexStr.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return (text) => `${ESC}38;2;${r};${g};${b}m${text}${RESET}`;
}

const COLORS = {
  low:      hex('#22c55e'),
  medium:   hex('#eab308'),
  high:     hex('#f97316'),
  critical: hex('#ef4444'),
  dim:      (t) => `${DIM}${t}${RESET}`,
  bold:     (t) => `${BOLD}${t}${RESET}`,
  gray:     hex('#6b7280'),
  cyan:     hex('#06b6d4'),
  magenta:  hex('#a855f7'),
};

// ─── Box-drawing characters ────────────────────────────────────

const BOX = {
  tl: '╔', tr: '╗', bl: '╚', br: '╝',
  h: '═', v: '║',
  lt: '╠', rt: '╣', tt: '╦', bt: '╩',
};

const BAR = { full: '█', empty: '░', track: '─' };

// ─── Formatting utilities ──────────────────────────────────────

function formatNumber(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function formatPercent(p) {
  return `${Math.max(0, Math.min(100, p)).toFixed(1)}%`;
}

function formatResetTime(date) {
  if (!date) return '--';
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return 'already reset';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `resets in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainMins = minutes % 60;
  if (hours < 24) return `resets in ${hours}h ${remainMins}m`;
  const days = Math.floor(hours / 24);
  return `resets in ${days}d`;
}

function getUsageLevel(percent) {
  if (percent >= 90) return 'critical';
  if (percent >= 75) return 'high';
  if (percent >= 50) return 'medium';
  return 'low';
}

function getTerminalWidth() {
  return process.stdout.columns || 80;
}

function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*m/g, '').replace(/\x1B\][^\x07]*\x07/g, '');
}

function padOrTruncate(str, width) {
  const visible = stripAnsi(str);
  if (visible.length > width) {
    let vis = 0;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '\x1B') {
        const semi = str.indexOf('m', i);
        if (semi !== -1) { i = semi; continue; }
      }
      vis++;
      if (vis > width) return str.slice(0, i);
    }
    return str;
  }
  return str + ' '.repeat(width - visible.length);
}

function truncateWithEllipsis(str, maxLen) {
  if (str.length <= maxLen) return str;
  if (maxLen <= 3) return str.slice(0, maxLen);
  return str.slice(0, maxLen - 1) + '…';
}

// ─── API Client ────────────────────────────────────────────────

function detectConfig() {
  const baseUrl = process.env.ANTHROPIC_BASE_URL || '';
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN || '';

  if (!authToken) {
    throw new Error('ANTHROPIC_AUTH_TOKEN is not set.');
  }
  if (!baseUrl) {
    throw new Error('ANTHROPIC_BASE_URL is not set.');
  }

  const parsed = new URL(baseUrl);
  const baseDomain = `${parsed.protocol}//${parsed.host}`;

  let platform;
  if (baseUrl.includes('api.z.ai')) {
    platform = 'ZAI';
  } else if (baseUrl.includes('open.bigmodel.cn') || baseUrl.includes('dev.bigmodel.cn')) {
    platform = 'ZHIPU';
  } else {
    throw new Error(`Unrecognized ANTHROPIC_BASE_URL: ${baseUrl}`);
  }

  return { baseUrl, authToken, platform, baseDomain };
}

function formatDateTime(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

function getTimeWindow() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, now.getHours(), 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 59, 59, 999);
  return { startTime: formatDateTime(start), endTime: formatDateTime(end) };
}

function httpsGet(url, authToken, label) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: 443,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          'Authorization': authToken,
          'Accept-Language': 'en-US,en',
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`[${label}] HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
            return;
          }
          try {
            const json = JSON.parse(data);
            resolve(json.data ?? json);
          } catch {
            reject(new Error(`[${label}] Failed to parse response: ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`[${label}] Request timed out`)); });
    req.end();
  });
}

async function fetchModelUsage(config) {
  const { startTime, endTime } = getTimeWindow();
  const url = `${config.baseDomain}/api/monitor/usage/model-usage?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`;
  const raw = await httpsGet(url, config.authToken, 'Model Usage');
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => ({
    model: String(item.model || item.modelName || 'unknown'),
    inputTokens: Number(item.inputTokens || item.input_tokens || 0),
    outputTokens: Number(item.outputTokens || item.output_tokens || 0),
    totalTokens: Number(item.totalTokens || item.total_tokens || 0),
    requestCount: Number(item.requestCount || item.request_count || 0),
  }));
}

async function fetchToolUsage(config) {
  const { startTime, endTime } = getTimeWindow();
  const url = `${config.baseDomain}/api/monitor/usage/tool-usage?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`;
  const raw = await httpsGet(url, config.authToken, 'Tool Usage');
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => ({
    tool: String(item.tool || item.toolName || 'unknown'),
    callCount: Number(item.callCount || item.call_count || 0),
  }));
}

async function fetchQuotaLimit(config) {
  const url = `${config.baseDomain}/api/monitor/usage/quota/limit`;
  const raw = await httpsGet(url, config.authToken, 'Quota Limit');
  if (!raw?.limits || !Array.isArray(raw.limits)) return [];

  return raw.limits.map((item) => {
    const type = String(item.type || '');

    if (type === 'TOKENS_LIMIT') {
      return {
        label: 'Token Usage (5h)',
        percentage: Number(item.percentage || 0),
        unit: 'tokens',
        resetTime: item.nextResetTime ? new Date(Number(item.nextResetTime)) : undefined,
      };
    }

    if (type === 'TIME_LIMIT') {
      return {
        label: 'MCP Usage (Monthly)',
        percentage: Number(item.percentage || 0),
        currentUsage: Number(item.currentValue || 0),
        total: Number(item.usage || 0),
        unit: 'minutes',
        resetTime: item.nextResetTime ? new Date(Number(item.nextResetTime)) : undefined,
      };
    }

    return {
      label: type,
      percentage: Number(item.percentage || 0),
      resetTime: item.nextResetTime ? new Date(Number(item.nextResetTime)) : undefined,
    };
  });
}

async function fetchAllUsage() {
  const config = detectConfig();

  const [quotas, modelUsage, toolUsage] = await Promise.all([
    fetchQuotaLimit(config).catch((err) => {
      console.error(`Warning: Quota fetch failed: ${err.message}`);
      return [];
    }),
    fetchModelUsage(config).catch((err) => {
      console.error(`Warning: Model usage fetch failed: ${err.message}`);
      return [];
    }),
    fetchToolUsage(config).catch((err) => {
      console.error(`Warning: Tool usage fetch failed: ${err.message}`);
      return [];
    }),
  ]);

  return { platform: config.platform, timestamp: new Date(), quotas, modelUsage, toolUsage };
}

// ─── Renderer ──────────────────────────────────────────────────

function getColorForPercent(percent) {
  const level = getUsageLevel(percent);
  return COLORS[level];
}

function progressBar(percent, width, showPercent = true) {
  const pct = Math.max(0, Math.min(100, percent));
  const colorFn = getColorForPercent(pct);
  const labelWidth = showPercent ? 7 : 0;
  const barWidth = Math.max(4, width - labelWidth - 2);
  const filledWidth = Math.round((pct / 100) * barWidth);
  const filled = BAR.full.repeat(filledWidth);
  const empty = BAR.empty.repeat(barWidth - filledWidth);
  const bar = colorFn(filled) + COLORS.dim(empty);
  const label = showPercent ? colorFn(COLORS.bold(` ${formatPercent(pct)} `)) : '';
  return `[${bar}]${label}`;
}

function renderQuotaBar(quota, width) {
  const colorFn = getColorForPercent(quota.percentage);
  const icon = getUsageLevel(quota.percentage) === 'critical' ? '⚠' : '●';
  const labelText = `${icon} ${quota.label}`;
  const label = colorFn(labelText);

  let suffix = '';
  if (quota.currentUsage !== undefined && quota.total !== undefined) {
    suffix = ` (${formatNumber(quota.currentUsage)}/${formatNumber(quota.total)})`;
  }
  const resetText = quota.resetTime ? ` ${formatResetTime(quota.resetTime)}` : '';
  const fullSuffix = suffix + resetText;

  const labelVisLen = labelText.length;
  const suffixVisLen = fullSuffix.length;
  const barWidth = Math.max(10, width - labelVisLen - suffixVisLen - 4);
  const bar = progressBar(quota.percentage, barWidth);
  const detail = suffix ? COLORS.gray(suffix) : '';
  const reset = resetText ? COLORS.dim(resetText) : '';

  return `${label}  ${bar}${detail}${reset}`;
}

function renderTable(headers, rows, colWidths) {
  const result = [];
  const headerLine = headers.map((h, i) => COLORS.bold(padOrTruncate(h, colWidths[i] || 10))).join('  ');
  result.push(headerLine);
  const sepLine = colWidths.map(w => COLORS.dim(BAR.track.repeat(w))).join('  ');
  result.push(sepLine);
  for (const row of rows) {
    const dataLine = row.map((cell, i) => padOrTruncate(cell, colWidths[i] || 10)).join('  ');
    result.push(dataLine);
  }
  return result;
}

function renderModelUsage(models, width) {
  if (models.length === 0) return [COLORS.gray('  No model usage data available')];
  const sorted = [...models].sort((a, b) => b.totalTokens - a.totalTokens).slice(0, 8);
  const headers = ['Model', 'Input', 'Output', 'Total', 'Reqs'];
  const colWidths = [Math.min(24, width - 36), 8, 8, 8, 6];
  const rows = sorted.map(m => [
    truncateWithEllipsis(m.model, colWidths[0]),
    formatNumber(m.inputTokens),
    formatNumber(m.outputTokens),
    formatNumber(m.totalTokens),
    String(m.requestCount),
  ]);
  return renderTable(headers, rows, colWidths);
}

function renderToolUsage(tools, width) {
  if (tools.length === 0) return [COLORS.gray('  No tool usage data available')];
  const sorted = [...tools].sort((a, b) => b.callCount - a.callCount).slice(0, 8);
  const headers = ['Tool', 'Calls'];
  const colWidths = [Math.min(30, width - 12), 8];
  const rows = sorted.map(t => [
    truncateWithEllipsis(t.tool, colWidths[0]),
    String(t.callCount),
  ]);
  return renderTable(headers, rows, colWidths);
}

function render(data, options) {
  const width = options?.width || Math.min(100, getTerminalWidth());
  const innerWidth = width - 4;
  const lines = [];

  // Header
  const titleText = '  GLM Usage Hub  ';
  const platformTag = data.platform === 'ZAI'
    ? COLORS.bold(COLORS.cyan(' ZAI '))
    : COLORS.bold(COLORS.magenta(' ZHIPU '));
  const headerContent = `${COLORS.bold(titleText)}${platformTag}`;
  const headerPad = innerWidth - stripAnsi(headerContent).length;

  lines.push(`${BOX.tl}${BOX.h.repeat(innerWidth)}${BOX.tr}`);
  lines.push(`${BOX.v}${headerContent}${' '.repeat(Math.max(0, headerPad))}${BOX.v}`);
  lines.push(`${BOX.lt}${BOX.h}${BOX.h.repeat(innerWidth - 2)}${BOX.h}${BOX.rt}`);

  // Quota Section
  if (data.quotas.length > 0) {
    const sectionTitle = '📊 Usage Quotas';
    lines.push(`${BOX.v} ${COLORS.bold(sectionTitle)}${' '.repeat(Math.max(0, innerWidth - sectionTitle.length - 2))} ${BOX.v}`);
    lines.push(`${BOX.v}${' '.repeat(innerWidth)}${BOX.v}`);
    for (const quota of data.quotas) {
      const barLine = renderQuotaBar(quota, innerWidth - 4);
      const padded = padOrTruncate(barLine, innerWidth - 2);
      lines.push(`${BOX.v} ${padded} ${BOX.v}`);
    }
    lines.push(`${BOX.lt}${BOX.h}${BOX.h.repeat(innerWidth - 2)}${BOX.h}${BOX.rt}`);
  }

  // Model Usage Section
  const modelTitle = '🤖 Model Usage (24h)';
  lines.push(`${BOX.v} ${COLORS.bold(modelTitle)}${' '.repeat(Math.max(0, innerWidth - modelTitle.length - 2))} ${BOX.v}`);
  lines.push(`${BOX.v}${' '.repeat(innerWidth)}${BOX.v}`);
  const modelLines = renderModelUsage(data.modelUsage, innerWidth - 4);
  for (const ml of modelLines) {
    const padded = padOrTruncate(ml, innerWidth - 2);
    lines.push(`${BOX.v} ${padded} ${BOX.v}`);
  }
  lines.push(`${BOX.lt}${BOX.h}${BOX.h.repeat(innerWidth - 2)}${BOX.h}${BOX.rt}`);

  // Tool Usage Section
  const toolTitle = '🔧 Tool Usage (24h)';
  lines.push(`${BOX.v} ${COLORS.bold(toolTitle)}${' '.repeat(Math.max(0, innerWidth - toolTitle.length - 2))} ${BOX.v}`);
  lines.push(`${BOX.v}${' '.repeat(innerWidth)}${BOX.v}`);
  const toolLines = renderToolUsage(data.toolUsage, innerWidth - 4);
  for (const tl of toolLines) {
    const padded = padOrTruncate(tl, innerWidth - 2);
    lines.push(`${BOX.v} ${padded} ${BOX.v}`);
  }
  lines.push(`${BOX.lt}${BOX.h}${BOX.h.repeat(innerWidth - 2)}${BOX.h}${BOX.rt}`);

  // Footer
  const timestamp = COLORS.dim(`Updated: ${data.timestamp.toLocaleString()}`);
  const tsPad = innerWidth - stripAnsi(timestamp).length;
  lines.push(`${BOX.v} ${timestamp}${' '.repeat(Math.max(0, tsPad - 2))} ${BOX.v}`);
  lines.push(`${BOX.bl}${BOX.h.repeat(innerWidth)}${BOX.br}`);

  return lines.join('\n');
}

// ─── Main ──────────────────────────────────────────────────────

async function main() {
  try {
    const data = await fetchAllUsage();
    console.log(render(data));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
