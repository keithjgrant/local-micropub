import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function loadEnv() {
  try {
    const raw = readFileSync(join(__dirname, '.env'), 'utf-8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // No .env file -- rely on environment variables
  }
}

loadEnv();

function parseSyndicationTargets(raw) {
  if (!raw) return [];
  return raw.split(',').map((entry) => {
    const trimmed = entry.trim();
    const spaceIdx = trimmed.indexOf(' ');
    if (spaceIdx === -1) return { uid: trimmed, name: trimmed };
    return {
      uid: trimmed.slice(0, spaceIdx),
      name: trimmed.slice(spaceIdx + 1),
    };
  });
}

export const TOKEN = process.env.MICROPUB_TOKEN;
export const PORT = parseInt(process.env.MICROPUB_PORT || '3456', 10);
if (!process.env.SITE_DIR) {
  console.error('SITE_DIR environment variable is required');
  process.exit(1);
}
export const SITE_DIR = resolve(
  process.env.SITE_DIR.replace(/^~/, homedir())
);
export const SITE_URL = process.env.SITE_URL || 'https://example.com';
export const SYNDICATION_TARGETS = parseSyndicationTargets(process.env.SYNDICATE_TO);
