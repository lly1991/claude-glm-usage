#!/usr/bin/env node
/**
 * GLM Usage Hub - HUD Data Provider
 *
 * Fetches GLM Plan quota data and outputs JSON for OMC HUD Custom Rate Limit Provider.
 * Standalone ESM script — no build dependencies required.
 *
 * Output format: { version: 1, generatedAt, buckets: [...] }
 */

import https from 'https';

const BASE_URL = process.env.ANTHROPIC_BASE_URL || '';
const AUTH_TOKEN = process.env.ANTHROPIC_AUTH_TOKEN || '';

function httpsGet(url, authToken) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: 443,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          Authorization: authToken,
          'Accept-Language': 'en-US,en',
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          try {
            const json = JSON.parse(data);
            resolve(json.data ?? json);
          } catch {
            reject(new Error('Invalid JSON'));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.end();
  });
}

function emptyOutput() {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    buckets: [],
  };
}

async function main() {
  if (!BASE_URL || !AUTH_TOKEN) {
    console.log(JSON.stringify(emptyOutput()));
    return;
  }

  const parsed = new URL(BASE_URL);
  const baseDomain = `${parsed.protocol}//${parsed.host}`;

  let raw;
  try {
    raw = await httpsGet(`${baseDomain}/api/monitor/usage/quota/limit`, AUTH_TOKEN);
  } catch {
    console.log(JSON.stringify(emptyOutput()));
    return;
  }

  const limits = raw?.limits;
  if (!Array.isArray(limits)) {
    console.log(JSON.stringify(emptyOutput()));
    return;
  }

  const UNIT_LABELS = { 3: 'h', 4: 'd', 5: 'mo', 6: 'd' };
  const BAR_WIDTH = 6;

  function makeBar(pct) {
    const filled = Math.round((pct / 100) * BAR_WIDTH);
    return '■'.repeat(filled) + '□'.repeat(BAR_WIDTH - filled);
  }

  function formatReset(date) {
    if (!date) return '';
    const diffMs = date.getTime() - Date.now();
    if (diffMs <= 0) return '';
    const m = Math.floor(diffMs / 60_000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return h % 24 > 0 ? `${d}d${h % 24}h` : `${d}d`;
    return h > 0 ? `${h}h${m % 60}m` : `${m}m`;
  }

  const buckets = limits.map((item) => {
    const type = String(item.type || '');
    const percentage = Number(item.percentage || 0);
    const resetTime = item.nextResetTime ? new Date(Number(item.nextResetTime)) : null;
    const unitLabel = UNIT_LABELS[item.unit] || '';
    const win = item.number && unitLabel ? `${item.number}${unitLabel}` : '';

    if (type === 'TOKENS_LIMIT') {
      const label = win || '5h';
      const reset = formatReset(resetTime);
      const value = reset
        ? `${makeBar(percentage)}${percentage}%(${reset})`
        : `${makeBar(percentage)}${percentage}%`;
      return { id: `glm-tok-${label}`, label, usage: { type: 'string', value } };
    }

    if (type === 'TIME_LIMIT') {
      const used = Number(item.currentValue || 0);
      const limit = Number(item.usage || 0);
      const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
      const label = win || 'mo';
      const reset = formatReset(resetTime);
      const value = reset
        ? `${makeBar(pct)}${used}/${limit}(${reset})`
        : `${makeBar(pct)}${used}/${limit}`;
      return { id: 'glm-mcp', label: `MCP`, usage: { type: 'string', value } };
    }

    const label = win || type;
    return {
      id: `glm-${type.toLowerCase()}`,
      label,
      usage: { type: 'percent', value: percentage },
    };
  });

  console.log(
    JSON.stringify({
      version: 1,
      generatedAt: new Date().toISOString(),
      buckets,
    })
  );
}

main().catch(() => {
  console.log(JSON.stringify(emptyOutput()));
});
