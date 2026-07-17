#!/usr/bin/env node

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import { URL } from 'node:url';
import { createHash } from 'node:crypto';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TOKEN = process.env.MICROPUB_TOKEN;
const PORT = parseInt(process.env.MICROPUB_PORT || '3456', 10);
const SITE_DIR = resolve(
  (process.env.SITE_DIR || join(homedir(), 'self/notes.keithjgrant.com'))
);
const SITE_URL = 'https://notes.keithjgrant.com';

const SYNDICATION_TARGETS = [
  {
    uid: 'https://front-end.social/@keithjgrant',
    name: 'Mastodon (front-end.social)',
  },
  {
    uid: 'https://bsky.app/profile/keithjgrant.com',
    name: 'Bluesky',
  },
];

if (!TOKEN) {
  console.error('MICROPUB_TOKEN environment variable is required');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text) {
  return text
    .toLowerCase()
    .split(' ')
    .slice(0, 6)
    .join('-')
    .replace(/[^A-Za-z0-9-]/g, '');
}

function toISOString(datetime) {
  const offset = datetime.getTimezoneOffset();
  const localDate = new Date(datetime.getTime() - offset * 60000);
  const isoString = localDate.toISOString().substring(0, 19);
  const hours = Math.floor(Math.abs(offset) / 60);
  const sign = offset > 0 ? '-' : '+';
  const offsetString = `${sign}${String(hours).padStart(2, '0')}:00`;
  return `${isoString}${offsetString}`;
}

function buildPath(contentType) {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `content/${contentType}/${date.getFullYear()}/${month}`;
}

function jsonResponse(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function errorResponse(res, status, error, description) {
  jsonResponse(res, status, { error, error_description: description });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function authenticate(req, body) {
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1] === TOKEN;
  }
  if (body && body.access_token) {
    return body.access_token === TOKEN;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Request body parsing
// ---------------------------------------------------------------------------

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function parseFormEncoded(raw) {
  const params = new URLSearchParams(raw);
  const result = {};
  for (const key of params.keys()) {
    const values = params.getAll(key);
    const normalizedKey = key.replace(/\[\]$/, '');
    if (values.length === 1 && !key.endsWith('[]')) {
      result[normalizedKey] = values[0];
    } else {
      result[normalizedKey] = result[normalizedKey]
        ? [].concat(result[normalizedKey], ...values)
        : values;
    }
  }
  return result;
}

function normalizeRequest(contentType, rawBody) {
  if (contentType && contentType.includes('application/json')) {
    const json = JSON.parse(rawBody);
    return {
      type: json.type?.[0] || 'h-entry',
      properties: json.properties || {},
      raw: json,
    };
  }

  const form = parseFormEncoded(rawBody);
  const type = form.h ? `h-${form.h}` : 'h-entry';
  const properties = {};

  for (const [key, value] of Object.entries(form)) {
    if (['h', 'access_token', 'action', 'url'].includes(key)) continue;
    properties[key] = Array.isArray(value) ? value : [value];
  }

  return { type, properties, raw: form };
}

// ---------------------------------------------------------------------------
// Post type detection
// ---------------------------------------------------------------------------

function detectPostType(properties) {
  if (properties['in-reply-to']) return 'reply';
  if (properties['bookmark-of']) return 'bookmark';
  if (properties['like-of']) return 'like';
  if (properties['repost-of']) return 'repost';
  return 'note';
}

const TYPE_TO_CATEGORY = {
  note: 'notes',
  bookmark: 'bookmarks',
  reply: 'replies',
  like: 'likes',
  repost: 'notes',
};

// ---------------------------------------------------------------------------
// Frontmatter builders
// ---------------------------------------------------------------------------

function prop(properties, key) {
  const val = properties[key];
  if (!val) return undefined;
  return Array.isArray(val) ? val : [val];
}

function firstProp(properties, key) {
  const val = prop(properties, key);
  return val ? val[0] : undefined;
}

function buildNoteFrontmatter(properties, slug, dateStr) {
  const tags = prop(properties, 'category') || [];
  const syndicateTo = prop(properties, 'mp-syndicate-to') || [
    'https://front-end.social/@keithjgrant',
    'https://bsky.app/profile/keithjgrant.com',
  ];

  let fm = '---\n';
  fm += `date: ${dateStr}\n`;
  fm += `title: ''\n`;
  fm += `tags: [${tags.join(', ')}]\n`;
  fm += `slug: ${slug}\n`;
  fm += `mf-syndicate-to:\n`;
  for (const target of syndicateTo) {
    fm += `  - '${target}'\n`;
  }
  fm += `category: notes\n`;
  fm += '---\n';
  return fm;
}

function buildBookmarkFrontmatter(properties, slug, dateStr) {
  const url = firstProp(properties, 'bookmark-of');
  const title = firstProp(properties, 'name') || '';
  const tags = prop(properties, 'category') || [];

  let fm = '---\n';
  fm += `date: ${dateStr}\n`;
  fm += `title: ${title}\n`;
  fm += `mf-bookmark-of:\n`;
  fm += `  - '${url}'\n`;
  fm += `tags: ${tags.length ? `[${tags.join(', ')}]` : "''"}\n`;
  fm += `slug: ${slug}\n`;
  fm += `category: bookmarks\n`;
  fm += '---\n';
  return fm;
}

function buildReplyFrontmatter(properties, slug, dateStr) {
  const replyTo = prop(properties, 'in-reply-to') || [];
  const title = firstProp(properties, 'name') || '';
  const tags = prop(properties, 'category') || [];
  const syndicateTo = prop(properties, 'mp-syndicate-to') || [
    'https://front-end.social/@keithjgrant',
  ];

  let fm = '---\n';
  fm += `date: ${dateStr}\n`;
  fm += `title: ${title}\n`;
  fm += `mf-in-reply-to:\n`;
  for (const url of replyTo) {
    fm += `  - '${url}'\n`;
  }
  fm += `tags: ${tags.length ? `[${tags.join(', ')}]` : '[]'}\n`;
  fm += `slug: ${slug}\n`;
  fm += `mf-syndicate-to:\n`;
  for (const target of syndicateTo) {
    fm += `  - '${target}'\n`;
  }
  fm += `category: replies\n`;
  fm += '---\n';
  return fm;
}

function buildLikeFrontmatter(properties, slug, dateStr) {
  const likeOf = prop(properties, 'like-of') || [];

  let fm = '---\n';
  fm += `date: ${dateStr}\n`;
  fm += `title: ''\n`;
  fm += `mf-like-of:\n`;
  for (const url of likeOf) {
    fm += `  - '${url}'\n`;
  }
  fm += `slug: ${slug}\n`;
  fm += `category: likes\n`;
  fm += '---\n';
  return fm;
}

function buildRepostFrontmatter(properties, slug, dateStr) {
  const repostOf = prop(properties, 'repost-of') || [];

  let fm = '---\n';
  fm += `date: ${dateStr}\n`;
  fm += `title: ''\n`;
  fm += `mf-repost-of:\n`;
  for (const url of repostOf) {
    fm += `  - '${url}'\n`;
  }
  fm += `slug: ${slug}\n`;
  fm += `category: notes\n`;
  fm += '---\n';
  return fm;
}

const FRONTMATTER_BUILDERS = {
  note: buildNoteFrontmatter,
  bookmark: buildBookmarkFrontmatter,
  reply: buildReplyFrontmatter,
  like: buildLikeFrontmatter,
  repost: buildRepostFrontmatter,
};

// ---------------------------------------------------------------------------
// File + git operations
// ---------------------------------------------------------------------------

function getContentBody(properties) {
  const content = firstProp(properties, 'content');
  if (!content) return '';
  if (typeof content === 'object' && content.html) return content.html;
  return content;
}

function getSlugSource(postType, properties) {
  const mpSlug = firstProp(properties, 'mp-slug');
  if (mpSlug) return mpSlug;

  const content = getContentBody(properties);
  if (content) return slugify(content);

  const name = firstProp(properties, 'name');
  if (name) return slugify(name);

  const target =
    firstProp(properties, 'bookmark-of') ||
    firstProp(properties, 'like-of') ||
    firstProp(properties, 'in-reply-to') ||
    firstProp(properties, 'repost-of');
  if (target) {
    const hash = createHash('md5').update(target).digest('hex').slice(0, 6);
    return hash;
  }

  return createHash('md5').update(Date.now().toString()).digest('hex').slice(0, 8);
}

async function createPost(postType, properties) {
  const now = new Date();
  const dateStr = toISOString(now);
  const category = TYPE_TO_CATEGORY[postType];
  const slug = getSlugSource(postType, properties);

  const buildFrontmatter = FRONTMATTER_BUILDERS[postType];
  const frontmatter = buildFrontmatter(properties, slug, dateStr);
  const body = getContentBody(properties);

  const fileContent = body ? `${frontmatter}\n${body}\n` : frontmatter;

  const relDir = buildPath(category);
  const absDir = join(SITE_DIR, relDir);
  const relFile = `${relDir}/${slug}.md`;
  const absFile = join(SITE_DIR, relFile);

  await mkdir(absDir, { recursive: true });
  await writeFile(absFile, fileContent, 'utf-8');

  console.log(`Created ${absFile}`);

  await gitPublish(relFile, postType, slug);

  const postUrl = `${SITE_URL}/${category}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${slug}/`;
  return { url: postUrl, file: absFile };
}

async function gitPublish(relFile, postType, slug) {
  const opts = { cwd: SITE_DIR };
  try {
    await execFileAsync('git', ['add', relFile], opts);
    await execFileAsync(
      'git',
      ['commit', '-m', `Add ${postType}: ${slug}`],
      opts
    );
    console.log(`Committed ${relFile}`);
  } catch (err) {
    console.error('Git commit failed:', err.message);
    throw err;
  }

  try {
    await execFileAsync('git', ['push'], opts);
    console.log(`Pushed ${relFile}`);
  } catch (err) {
    console.error(`Git push failed (commit is local): ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Query handlers
// ---------------------------------------------------------------------------

function handleQuery(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const q = url.searchParams.get('q');

  if (q === 'config') {
    return jsonResponse(res, 200, {
      'syndicate-to': SYNDICATION_TARGETS,
    });
  }

  if (q === 'syndicate-to') {
    return jsonResponse(res, 200, {
      'syndicate-to': SYNDICATION_TARGETS,
    });
  }

  if (q === 'source') {
    return errorResponse(res, 400, 'invalid_request', 'Source query is not yet supported');
  }

  return errorResponse(res, 400, 'invalid_request', `Unknown query: ${q}`);
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname !== '/micropub') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  // GET queries don't need auth for config, but spec says they should
  if (req.method === 'GET') {
    if (!authenticate(req, null)) {
      return errorResponse(res, 401, 'unauthorized', 'Missing or invalid access token');
    }
    return handleQuery(req, res);
  }

  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end('Method not allowed');
    return;
  }

  const rawBody = await collectBody(req);
  const contentType = req.headers['content-type'] || '';

  let parsed;
  try {
    parsed = normalizeRequest(contentType, rawBody);
  } catch (err) {
    return errorResponse(res, 400, 'invalid_request', `Could not parse request body: ${err.message}`);
  }

  if (!authenticate(req, parsed.raw)) {
    return errorResponse(res, 401, 'unauthorized', 'Missing or invalid access token');
  }

  if (parsed.type !== 'h-entry') {
    return errorResponse(res, 400, 'invalid_request', `Unsupported type: ${parsed.type}`);
  }

  const postType = detectPostType(parsed.properties);

  try {
    const { url: postUrl } = await createPost(postType, parsed.properties);
    res.writeHead(201, { Location: postUrl });
    res.end();
    console.log(`201 Created -> ${postUrl}`);
  } catch (err) {
    console.error('Error creating post:', err);
    return errorResponse(res, 500, 'server_error', err.message);
  }
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error('Unhandled error:', err);
    if (!res.headersSent) {
      errorResponse(res, 500, 'server_error', 'Internal server error');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Micropub server listening on http://localhost:${PORT}/micropub`);
  console.log(`Site directory: ${SITE_DIR}`);
});
