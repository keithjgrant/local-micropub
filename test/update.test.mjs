import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { mf2KeyToFm, serializeFrontmatter, applyReplace, applyAdd, applyDelete } from '../lib/update.mjs';

describe('mf2KeyToFm', () => {
  it('maps known Micropub keys to frontmatter keys', () => {
    assert.equal(mf2KeyToFm('in-reply-to'), 'mf-in-reply-to');
    assert.equal(mf2KeyToFm('bookmark-of'), 'mf-bookmark-of');
    assert.equal(mf2KeyToFm('category'), 'tags');
    assert.equal(mf2KeyToFm('published'), 'date');
    assert.equal(mf2KeyToFm('name'), 'title');
  });

  it('passes through unknown keys unchanged', () => {
    assert.equal(mf2KeyToFm('custom-property'), 'custom-property');
  });
});

describe('serializeFrontmatter', () => {
  it('serializes single-value properties', () => {
    const fm = { date: ['2026-07-17'], slug: ['hello'], category: ['notes'] };
    const result = serializeFrontmatter(fm);
    assert.ok(result.includes('date: 2026-07-17'));
    assert.ok(result.includes('slug: hello'));
  });

  it('serializes tags as inline array', () => {
    const fm = { tags: ['css', 'web'] };
    const result = serializeFrontmatter(fm);
    assert.ok(result.includes('tags: [css, web]'));
  });

  it('serializes mf- prefixed keys as YAML lists', () => {
    const fm = { 'mf-in-reply-to': ['https://example.com/post'] };
    const result = serializeFrontmatter(fm);
    assert.ok(result.includes('mf-in-reply-to:\n'));
    assert.ok(result.includes("  - 'https://example.com/post'"));
  });

  it('quotes empty string values', () => {
    const fm = { title: [''] };
    const result = serializeFrontmatter(fm);
    assert.ok(result.includes("title: ''"));
  });

  it('skips empty arrays', () => {
    const fm = { tags: [] };
    const result = serializeFrontmatter(fm);
    assert.ok(!result.includes('tags'));
  });
});

describe('applyReplace', () => {
  it('replaces frontmatter properties', () => {
    const fm = { tags: ['old'] };
    applyReplace(fm, 'body', { category: ['new1', 'new2'] });
    assert.deepEqual(fm.tags, ['new1', 'new2']);
  });

  it('replaces content body', () => {
    const fm = {};
    const newBody = applyReplace(fm, 'old body', { content: ['new body'] });
    assert.equal(newBody, 'new body');
  });
});

describe('applyAdd', () => {
  it('appends to existing values', () => {
    const fm = { tags: ['existing'] };
    applyAdd(fm, '', { category: ['new'] });
    assert.deepEqual(fm.tags, ['existing', 'new']);
  });

  it('creates property if it does not exist', () => {
    const fm = {};
    applyAdd(fm, '', { category: ['first'] });
    assert.deepEqual(fm.tags, ['first']);
  });
});

describe('applyDelete', () => {
  it('deletes entire properties by key', () => {
    const fm = { tags: ['a', 'b'] };
    applyDelete(fm, 'body', ['category']);
    assert.equal(fm.tags, undefined);
  });

  it('deletes specific values from a property', () => {
    const fm = { tags: ['keep', 'remove'] };
    applyDelete(fm, 'body', { category: ['remove'] });
    assert.deepEqual(fm.tags, ['keep']);
  });

  it('removes property entirely when last value is deleted', () => {
    const fm = { tags: ['only'] };
    applyDelete(fm, 'body', { category: ['only'] });
    assert.equal(fm.tags, undefined);
  });

  it('clears content body', () => {
    const fm = {};
    const newBody = applyDelete(fm, 'old body', ['content']);
    assert.equal(newBody, '');
  });
});
