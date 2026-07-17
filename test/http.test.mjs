import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseFormEncoded, normalizeRequest } from '../lib/http.mjs';

describe('parseFormEncoded', () => {
  it('parses simple key=value pairs', () => {
    const result = parseFormEncoded('h=entry&content=hello');
    assert.deepEqual(result, { h: 'entry', content: 'hello' });
  });

  it('parses array values with []', () => {
    const result = parseFormEncoded('category[]=foo&category[]=bar');
    assert.deepEqual(result, { category: ['foo', 'bar'] });
  });

  it('does not duplicate array values', () => {
    const result = parseFormEncoded(
      'mp-syndicate-to[]=https://a.example&mp-syndicate-to[]=https://b.example',
    );
    assert.deepEqual(result, {
      'mp-syndicate-to': ['https://a.example', 'https://b.example'],
    });
  });

  it('decodes URL-encoded values', () => {
    const result = parseFormEncoded('content=hello+world&url=https%3A%2F%2Fexample.com');
    assert.equal(result.content, 'hello world');
    assert.equal(result.url, 'https://example.com');
  });
});

describe('normalizeRequest', () => {
  it('parses JSON requests', () => {
    const body = JSON.stringify({
      type: ['h-entry'],
      properties: { content: ['hello'] },
    });
    const result = normalizeRequest('application/json', body);
    assert.equal(result.type, 'h-entry');
    assert.deepEqual(result.properties.content, ['hello']);
  });

  it('defaults to h-entry for JSON without type', () => {
    const body = JSON.stringify({ properties: { content: ['hi'] } });
    const result = normalizeRequest('application/json', body);
    assert.equal(result.type, 'h-entry');
  });

  it('parses form-encoded requests', () => {
    const result = normalizeRequest(
      'application/x-www-form-urlencoded',
      'h=entry&content=hello&category[]=foo&category[]=bar',
    );
    assert.equal(result.type, 'h-entry');
    assert.deepEqual(result.properties.content, ['hello']);
    assert.deepEqual(result.properties.category, ['foo', 'bar']);
  });

  it('strips reserved keys from properties', () => {
    const result = normalizeRequest(
      'application/x-www-form-urlencoded',
      'h=entry&content=hi&access_token=secret&action=create&url=http://x.com',
    );
    assert.equal(result.properties.access_token, undefined);
    assert.equal(result.properties.action, undefined);
    assert.equal(result.properties.url, undefined);
    assert.equal(result.raw.access_token, 'secret');
    assert.equal(result.raw.action, 'create');
  });
});
