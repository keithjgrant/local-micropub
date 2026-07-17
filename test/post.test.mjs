import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectPostType,
  buildNoteFrontmatter,
  buildBookmarkFrontmatter,
  buildReplyFrontmatter,
  buildLikeFrontmatter,
  buildRepostFrontmatter,
} from '../lib/post.mjs';

describe('detectPostType', () => {
  it('detects note (default)', () => {
    assert.equal(detectPostType({ content: ['hello'] }), 'note');
  });

  it('detects reply', () => {
    assert.equal(detectPostType({ 'in-reply-to': ['http://x.com'] }), 'reply');
  });

  it('detects bookmark', () => {
    assert.equal(detectPostType({ 'bookmark-of': ['http://x.com'] }), 'bookmark');
  });

  it('detects like', () => {
    assert.equal(detectPostType({ 'like-of': ['http://x.com'] }), 'like');
  });

  it('detects repost', () => {
    assert.equal(detectPostType({ 'repost-of': ['http://x.com'] }), 'repost');
  });
});

describe('buildNoteFrontmatter', () => {
  const date = '2026-07-17T09:00:00-07:00';

  it('builds basic note frontmatter', () => {
    const fm = buildNoteFrontmatter({ content: ['hello'] }, 'hello', date);
    assert.ok(fm.includes('date: 2026-07-17T09:00:00-07:00'));
    assert.ok(fm.includes("title: ''"));
    assert.ok(fm.includes('slug: hello'));
    assert.ok(fm.includes('category: notes'));
    assert.ok(fm.startsWith('---\n'));
    assert.ok(fm.endsWith('---\n'));
  });

  it('includes tags from category property', () => {
    const fm = buildNoteFrontmatter(
      { category: ['css', 'web'] },
      'test', date,
    );
    assert.ok(fm.includes('tags: [css, web]'));
  });

  it('omits mf-syndicate-to when no targets', () => {
    const fm = buildNoteFrontmatter({ content: ['hi'] }, 'hi', date);
    assert.ok(!fm.includes('mf-syndicate-to'));
  });

  it('includes mf-syndicate-to when targets provided', () => {
    const fm = buildNoteFrontmatter(
      { 'mp-syndicate-to': ['https://mastodon.example/@me'] },
      'test', date,
    );
    assert.ok(fm.includes('mf-syndicate-to:'));
    assert.ok(fm.includes("'https://mastodon.example/@me'"));
  });
});

describe('buildBookmarkFrontmatter', () => {
  it('includes bookmark-of URL and title', () => {
    const fm = buildBookmarkFrontmatter(
      { 'bookmark-of': ['https://example.com/article'], name: ['Great Post'] },
      'great-post', '2026-01-01T00:00:00-07:00',
    );
    assert.ok(fm.includes('title: Great Post'));
    assert.ok(fm.includes("'https://example.com/article'"));
    assert.ok(fm.includes('category: bookmarks'));
  });
});

describe('buildReplyFrontmatter', () => {
  it('includes in-reply-to URL', () => {
    const fm = buildReplyFrontmatter(
      { 'in-reply-to': ['https://example.com/post'] },
      'test', '2026-01-01T00:00:00-07:00',
    );
    assert.ok(fm.includes('mf-in-reply-to:'));
    assert.ok(fm.includes("'https://example.com/post'"));
    assert.ok(fm.includes('category: replies'));
  });

  it('omits mf-syndicate-to when no targets', () => {
    const fm = buildReplyFrontmatter(
      { 'in-reply-to': ['https://example.com/post'] },
      'test', '2026-01-01T00:00:00-07:00',
    );
    assert.ok(!fm.includes('mf-syndicate-to'));
  });
});

describe('buildLikeFrontmatter', () => {
  it('includes like-of URL', () => {
    const fm = buildLikeFrontmatter(
      { 'like-of': ['https://example.com/post'] },
      'abc123', '2026-01-01T00:00:00-07:00',
    );
    assert.ok(fm.includes('mf-like-of:'));
    assert.ok(fm.includes("'https://example.com/post'"));
    assert.ok(fm.includes('category: likes'));
  });
});

describe('buildRepostFrontmatter', () => {
  it('includes repost-of URL', () => {
    const fm = buildRepostFrontmatter(
      { 'repost-of': ['https://example.com/post'] },
      'abc123', '2026-01-01T00:00:00-07:00',
    );
    assert.ok(fm.includes('mf-repost-of:'));
    assert.ok(fm.includes("'https://example.com/post'"));
    assert.ok(fm.includes('category: notes'));
  });
});
