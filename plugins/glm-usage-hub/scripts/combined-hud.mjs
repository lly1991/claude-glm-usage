#!/usr/bin/env node
/**
 * Combined Status Line - Line 1: OMC HUD | Line 2: GLM Usage
 *
 * Runs OMC HUD and GLM Usage HUD independently,
 * outputs them on two separate lines.
 */

import { execSync } from 'child_process';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OMC_HUD = join(homedir(), '.claude/hud/omc-hud.mjs');
const GLM_HUD = join(__dirname, '..', 'skills', 'usage-skill', 'scripts', 'hud-provider.mjs');

function run(script) {
  try {
    return execSync(`node "${script}"`, {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

// Line 1: OMC HUD
const omcLine = run(OMC_HUD);

// Line 2: GLM Usage - parse JSON and format as readable string
let glmLine = '';
try {
  const raw = run(GLM_HUD);
  if (raw) {
    const data = JSON.parse(raw);
    if (data.buckets && data.buckets.length > 0) {
      glmLine = 'GLM: ' + data.buckets
        .map(b => `${b.label} ${b.usage.value}`)
        .join(' │ ');
    }
  }
} catch { /* ignore */ }

const lines = [omcLine, glmLine].filter(Boolean);
if (lines.length > 0) {
  console.log(lines.join('\n'));
}
