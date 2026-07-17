import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { slugify, toISOString, buildPath, generateSlug, hashSlug } from '../lib/helpers.mjs';

describe('slugify', () => {
  it('lowercases and joins with hyphens', () => {
    assert.equal(slugify('Hello World'), 'hello-world');
  });

  it('takes only first 6 words', () => {
    assert.equal(
      slugify('one two three four five six seven eight'),
      'one-two-three-four-five-six',
    );
  });

  it('strips non-alphanumeric characters', () => {
    assert.equal(slugify("What's up, doc?"), 'whats-up-doc');
  });

  it('handles single word', () => {
    assert.equal(slugify('hello'), 'hello');
  });

  it('handles emoji and unicode', () => {
    assert.equal(slugify('Hello 🌍 world'), 'hello--world');
  });
});

describe('toISOString', () => {
  it('produces a local ISO string with offset', () => {
    const result = toISOString(new Date('2026-07-17T12:00:00Z'));
    assert.match(result, /^2026-07-17T\d{2}:\d{2}:\d{2}[+-]\d{2}:00$/);
  });
});

describe('buildPath', () => {
  it('returns content/{type}/{year}/{month}', () => {
    const result = buildPath('notes');
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    assert.equal(result, `content/notes/${now.getFullYear()}/${month}`);
  });
});

describe('generateSlug', () => {
  it('slugifies text when provided', () => {
    assert.equal(generateSlug('Hello world'), 'hello-world');
  });

  it('returns a hash when text is null', () => {
    const result = generateSlug(null);
    assert.equal(result.length, 8);
    assert.match(result, /^[a-f0-9]+$/);
  });
});

describe('hashSlug', () => {
  it('returns a 6-char hex hash', () => {
    const result = hashSlug('https://example.com/post');
    assert.equal(result.length, 6);
    assert.match(result, /^[a-f0-9]+$/);
  });

  it('is deterministic', () => {
    assert.equal(
      hashSlug('https://example.com/post'),
      hashSlug('https://example.com/post'),
    );
  });
});
