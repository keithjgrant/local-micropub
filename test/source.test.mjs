import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseFrontmatter } from '../lib/source.mjs';

describe('parseFrontmatter', () => {
  it('parses frontmatter and body', () => {
    const raw = `---
date: 2026-07-17T09:00:00-07:00
title: ''
slug: hello
category: notes
---

Hello world`;
    const result = parseFrontmatter(raw);
    assert.ok(result);
    assert.deepEqual(result.frontmatter.date, ['2026-07-17T09:00:00-07:00']);
    assert.deepEqual(result.frontmatter.slug, ['hello']);
    assert.equal(result.body, 'Hello world');
  });

  it('parses YAML list values', () => {
    const raw = `---
mf-syndicate-to:
  - 'https://mastodon.example/@me'
  - 'https://bsky.example/me'
---
`;
    const result = parseFrontmatter(raw);
    assert.deepEqual(result.frontmatter['mf-syndicate-to'], [
      'https://mastodon.example/@me',
      'https://bsky.example/me',
    ]);
  });

  it('parses inline array values', () => {
    const raw = `---
tags: [css, web, indieweb]
---
`;
    const result = parseFrontmatter(raw);
    assert.deepEqual(result.frontmatter.tags, ['css', 'web', 'indieweb']);
  });

  it('handles empty values', () => {
    const raw = `---
title: ''
tags: []
---
`;
    const result = parseFrontmatter(raw);
    assert.deepEqual(result.frontmatter.title, []);
    assert.deepEqual(result.frontmatter.tags, []);
  });

  it('returns null for non-frontmatter content', () => {
    assert.equal(parseFrontmatter('just some text'), null);
  });
});
