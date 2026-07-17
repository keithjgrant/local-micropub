import { writeFile, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';

import { SITE_DIR, SITE_URL } from '../config.mjs';
import { toISOString, buildPath, generateSlug, hashSlug } from './helpers.mjs';
import { gitPublish } from './git.mjs';

// ---------------------------------------------------------------------------
// Property access helpers
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

// ---------------------------------------------------------------------------
// Post type detection
// ---------------------------------------------------------------------------

export function detectPostType(properties) {
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

function buildNoteFrontmatter(properties, slug, dateStr) {
  const tags = prop(properties, 'category') || [];
  const syndicateTo = prop(properties, 'mp-syndicate-to') || [];

  let fm = '---\n';
  fm += `date: ${dateStr}\n`;
  fm += `title: ''\n`;
  fm += `tags: [${tags.join(', ')}]\n`;
  fm += `slug: ${slug}\n`;
  if (syndicateTo.length) {
    fm += `mf-syndicate-to:\n`;
    for (const target of syndicateTo) {
      fm += `  - '${target}'\n`;
    }
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
  const syndicateTo = prop(properties, 'mp-syndicate-to') || [];

  let fm = '---\n';
  fm += `date: ${dateStr}\n`;
  fm += `title: ${title}\n`;
  fm += `mf-in-reply-to:\n`;
  for (const url of replyTo) {
    fm += `  - '${url}'\n`;
  }
  fm += `tags: ${tags.length ? `[${tags.join(', ')}]` : '[]'}\n`;
  fm += `slug: ${slug}\n`;
  if (syndicateTo.length) {
    fm += `mf-syndicate-to:\n`;
    for (const target of syndicateTo) {
      fm += `  - '${target}'\n`;
    }
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
// Post creation
// ---------------------------------------------------------------------------

function getContentBody(properties) {
  const content = firstProp(properties, 'content');
  if (!content) return '';
  if (typeof content === 'object' && content.html) return content.html;
  return content;
}

function resolveSlug(postType, properties) {
  const mpSlug = firstProp(properties, 'mp-slug');
  if (mpSlug) return mpSlug;

  const content = getContentBody(properties);
  if (content) return generateSlug(content);

  const name = firstProp(properties, 'name');
  if (name) return generateSlug(name);

  const target =
    firstProp(properties, 'bookmark-of') ||
    firstProp(properties, 'like-of') ||
    firstProp(properties, 'in-reply-to') ||
    firstProp(properties, 'repost-of');
  if (target) return hashSlug(target);

  return generateSlug(null);
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function dedupeSlug(dir, baseSlug) {
  if (!(await fileExists(join(dir, `${baseSlug}.md`)))) return baseSlug;
  let n = 2;
  while (await fileExists(join(dir, `${baseSlug}-${n}.md`))) n++;
  return `${baseSlug}-${n}`;
}

export async function createPost(postType, properties) {
  const now = new Date();
  const dateStr = toISOString(now);
  const category = TYPE_TO_CATEGORY[postType];
  const baseSlug = resolveSlug(postType, properties);

  const relDir = buildPath(category);
  const absDir = join(SITE_DIR, relDir);
  await mkdir(absDir, { recursive: true });

  const slug = await dedupeSlug(absDir, baseSlug);

  const buildFrontmatter = FRONTMATTER_BUILDERS[postType];
  const frontmatter = buildFrontmatter(properties, slug, dateStr);
  const body = getContentBody(properties);

  const fileContent = body ? `${frontmatter}\n${body}\n` : frontmatter;

  const relFile = `${relDir}/${slug}.md`;
  const absFile = join(SITE_DIR, relFile);

  await writeFile(absFile, fileContent, 'utf-8');

  console.log(`Created ${absFile}`);

  await gitPublish(relFile, postType, slug);

  const postUrl = `${SITE_URL}/${category}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${slug}/`;
  return { url: postUrl, file: absFile };
}
