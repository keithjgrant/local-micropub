import { readFile, writeFile, unlink } from 'node:fs/promises';
import { relative } from 'node:path';

import { SITE_DIR } from '../config.mjs';
import { urlToFilePath, parseFrontmatter } from './source.mjs';
import { gitUpdate, gitDelete } from './git.mjs';

const MF2_TO_FRONTMATTER = {
  'in-reply-to': 'mf-in-reply-to',
  'bookmark-of': 'mf-bookmark-of',
  'like-of': 'mf-like-of',
  'repost-of': 'mf-repost-of',
  'mp-syndicate-to': 'mf-syndicate-to',
  'photo': 'mf-photo',
  'published': 'date',
  'category': 'tags',
  'name': 'title',
  'mp-slug': 'slug',
};

export function mf2KeyToFm(key) {
  return MF2_TO_FRONTMATTER[key] || key;
}

export function serializeFrontmatter(fm) {
  let out = '---\n';
  for (const [key, values] of Object.entries(fm)) {
    if (!values || !values.length) continue;
    if (values.length === 1 && !key.startsWith('mf-')) {
      const v = values[0];
      if (v === '') {
        out += `${key}: ''\n`;
      } else if (/[:\[\]{},&*?|>!%@`#]/.test(v) || v.startsWith("'") || v.startsWith('"')) {
        out += `${key}: '${v.replace(/'/g, "''")}'\n`;
      } else {
        out += `${key}: ${v}\n`;
      }
    } else if (key === 'tags') {
      out += `tags: [${values.join(', ')}]\n`;
    } else {
      out += `${key}:\n`;
      for (const v of values) {
        out += `  - '${v}'\n`;
      }
    }
  }
  out += '---\n';
  return out;
}

export function applyReplace(fm, body, replace) {
  for (const [key, values] of Object.entries(replace)) {
    if (key === 'content') {
      body = Array.isArray(values) ? values[0] : values;
      if (typeof body === 'object' && body.html) body = body.html;
    } else {
      const fmKey = mf2KeyToFm(key);
      fm[fmKey] = Array.isArray(values) ? values : [values];
    }
  }
  return body;
}

export function applyAdd(fm, body, add) {
  for (const [key, values] of Object.entries(add)) {
    if (key === 'content') continue;
    const fmKey = mf2KeyToFm(key);
    const existing = fm[fmKey] || [];
    fm[fmKey] = existing.concat(Array.isArray(values) ? values : [values]);
  }
}

export function applyDelete(fm, body, del) {
  if (Array.isArray(del)) {
    for (const key of del) {
      if (key === 'content') {
        body = '';
      } else {
        delete fm[mf2KeyToFm(key)];
      }
    }
  } else {
    for (const [key, values] of Object.entries(del)) {
      if (key === 'content') continue;
      const fmKey = mf2KeyToFm(key);
      if (fm[fmKey]) {
        const removeSet = new Set(Array.isArray(values) ? values : [values]);
        fm[fmKey] = fm[fmKey].filter((v) => !removeSet.has(v));
        if (!fm[fmKey].length) delete fm[fmKey];
      }
    }
  }
  return body;
}

export async function updatePost(postUrl, replace, add, del) {
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

  let { frontmatter: fm, body } = parsed;

  if (replace) body = applyReplace(fm, body, replace);
  if (add) applyAdd(fm, body, add);
  if (del) body = applyDelete(fm, body, del);

  const frontmatterStr = serializeFrontmatter(fm);
  const fileContent = body ? `${frontmatterStr}\n${body}\n` : frontmatterStr;

  await writeFile(filePath, fileContent, 'utf-8');

  const relFile = relative(SITE_DIR, filePath);
  const slug = filePath.split('/').pop().replace(/\.md$/, '');
  await gitUpdate(relFile, slug);

  console.log(`Updated ${filePath}`);
  return { ok: true };
}

export async function deletePost(postUrl) {
  const filePath = urlToFilePath(postUrl);
  if (!filePath) {
    return { error: 'invalid_request', description: 'URL does not belong to this site' };
  }

  try {
    await readFile(filePath);
  } catch {
    return { error: 'invalid_request', description: 'The post with the requested URL was not found' };
  }

  const relFile = relative(SITE_DIR, filePath);
  const slug = filePath.split('/').pop().replace(/\.md$/, '');
  await gitDelete(relFile, slug);

  console.log(`Deleted ${filePath}`);
  return { ok: true };
}
