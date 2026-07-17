import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { SITE_DIR, SITE_URL } from '../config.mjs';

export function urlToFilePath(postUrl) {
  if (!postUrl.startsWith(SITE_URL)) return null;
  let path = postUrl.slice(SITE_URL.length);
  path = path.replace(/^\/|\/$/g, '');
  return join(SITE_DIR, 'content', `${path}.md`);
}

export function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;

  const fm = {};
  let currentKey = null;

  for (const line of match[1].split('\n')) {
    const kvMatch = line.match(/^(\S[\w-]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const value = kvMatch[2].trim();
      if (value === '' || value === '[]' || value === "''") {
        fm[currentKey] = [];
      } else if (value.startsWith('[') && value.endsWith(']')) {
        fm[currentKey] = value.slice(1, -1).split(',').map((s) => s.trim());
      } else {
        fm[currentKey] = [value.replace(/^['"]|['"]$/g, '')];
      }
      continue;
    }

    const listMatch = line.match(/^\s+-\s+'?(.*?)'?$/);
    if (listMatch && currentKey) {
      if (!Array.isArray(fm[currentKey])) fm[currentKey] = [];
      fm[currentKey].push(listMatch[1]);
    }
  }

  return { frontmatter: fm, body: match[2].trim() };
}

const FRONTMATTER_TO_MF2 = {
  'mf-in-reply-to': 'in-reply-to',
  'mf-bookmark-of': 'bookmark-of',
  'mf-like-of': 'like-of',
  'mf-repost-of': 'repost-of',
  'mf-syndicate-to': 'mp-syndicate-to',
  'mf-photo': 'photo',
};

function toMf2Properties(frontmatter, body) {
  const properties = {};

  if (frontmatter.date?.length) {
    properties.published = frontmatter.date;
  }
  if (frontmatter.slug?.length) {
    properties['mp-slug'] = frontmatter.slug;
  }
  if (frontmatter.tags?.length) {
    properties.category = frontmatter.tags;
  }
  if (frontmatter.title?.length && frontmatter.title[0] !== '') {
    properties.name = frontmatter.title;
  }

  for (const [fmKey, mf2Key] of Object.entries(FRONTMATTER_TO_MF2)) {
    if (frontmatter[fmKey]?.length) {
      properties[mf2Key] = frontmatter[fmKey];
    }
  }

  if (body) {
    properties.content = [body];
  }

  return properties;
}

export async function getSource(postUrl, requestedProperties) {
  const filePath = urlToFilePath(postUrl);
  if (!filePath) {
    return { error: 'invalid_request', description: 'URL does not belong to this site' };
  }

  let raw;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch {
    return { error: 'invalid_request', description: 'The post with the requested URL was not found' };
  }

  const parsed = parseFrontmatter(raw);
  if (!parsed) {
    return { error: 'invalid_request', description: 'Could not parse post file' };
  }

  const allProperties = toMf2Properties(parsed.frontmatter, parsed.body);

  if (requestedProperties && requestedProperties.length) {
    const filtered = {};
    for (const key of requestedProperties) {
      if (allProperties[key]) {
        filtered[key] = allProperties[key];
      }
    }
    return { ok: true, data: { properties: filtered } };
  }

  return {
    ok: true,
    data: {
      type: ['h-entry'],
      properties: allProperties,
    },
  };
}
