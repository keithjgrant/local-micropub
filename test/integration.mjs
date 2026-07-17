import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { readFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const TEST_DIR = join(import.meta.dirname, '..', '.test-site');
const TOKEN = 'test-token-123';

process.env.MICROPUB_TOKEN = TOKEN;
process.env.SITE_DIR = TEST_DIR;
process.env.SITE_URL = 'https://test.example';

const { handleRequest } = await import('../lib/handler.mjs');
const { errorResponse } = await import('../lib/http.mjs');

describe('micropub integration', () => {
  let server;
  let PORT;
  const _log = console.log;
  const _error = console.error;

  function request(method, path, { body, headers = {} } = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, `http://localhost:${PORT}`);
      const req = httpRequest(
        {
          method,
          hostname: 'localhost',
          port: PORT,
          path: url.pathname + url.search,
          headers: { Authorization: `Bearer ${TOKEN}`, Connection: 'close', ...headers },
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString();
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: text,
              json: () => JSON.parse(text),
            });
          });
        },
      );
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  before(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
    await mkdir(TEST_DIR, { recursive: true });
    execFileSync('git', ['init'], { cwd: TEST_DIR });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: TEST_DIR });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: TEST_DIR });
    execFileSync('git', ['commit', '--allow-empty', '-m', 'init'], { cwd: TEST_DIR });

    server = createServer((req, res) => {
      handleRequest(req, res).catch(() => {
        if (!res.headersSent) errorResponse(res, 500, 'server_error', 'err');
      });
    });

    await new Promise((resolve) => server.listen(0, resolve));
    PORT = server.address().port;

    console.log = () => {};
    console.error = () => {};
  });

  after(async () => {
    console.log = _log;
    console.error = _error;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request('POST', '/micropub', {
      body: 'h=entry&content=hello',
      headers: { Authorization: '', 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    assert.equal(res.status, 401);
  });

  it('creates a note from form-encoded data', async () => {
    const res = await request('POST', '/micropub', {
      body: 'h=entry&content=Integration+test+note',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    assert.equal(res.status, 201);
    assert.ok(res.headers.location);
    assert.ok(res.headers.location.includes('/notes/'));

    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const filePath = join(
      TEST_DIR, 'content', 'notes', String(now.getFullYear()), month,
      'integration-test-note.md',
    );
    const content = await readFile(filePath, 'utf-8');
    assert.ok(content.includes('Integration test note'));
    assert.ok(content.includes('category: notes'));
  });

  it('creates a note from JSON data', async () => {
    const res = await request('POST', '/micropub', {
      body: JSON.stringify({
        type: ['h-entry'],
        properties: { content: ['JSON integration test'] },
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(res.status, 201);
    assert.ok(res.headers.location.includes('/notes/'));
  });

  it('creates a bookmark', async () => {
    const res = await request('POST', '/micropub', {
      body: 'h=entry&bookmark-of=https%3A%2F%2Fexample.com&name=Example',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    assert.equal(res.status, 201);
    assert.ok(res.headers.location.includes('/bookmarks/'));
  });

  it('creates a like', async () => {
    const res = await request('POST', '/micropub', {
      body: 'h=entry&like-of=https%3A%2F%2Fexample.com%2Fpost',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    assert.equal(res.status, 201);
    assert.ok(res.headers.location.includes('/likes/'));
  });

  it('deduplicates slugs', async () => {
    const res = await request('POST', '/micropub', {
      body: 'h=entry&content=Integration+test+note',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    assert.equal(res.status, 201);
    assert.ok(res.headers.location.includes('integration-test-note-2'));
  });

  it('returns config with syndication targets', async () => {
    const res = await request('GET', '/micropub?q=config');
    assert.equal(res.status, 200);
    const json = res.json();
    assert.ok(Array.isArray(json['syndicate-to']));
  });

  it('returns source content of a post', async () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const url = `https://test.example/notes/${now.getFullYear()}/${month}/integration-test-note/`;
    const res = await request('GET', `/micropub?q=source&url=${encodeURIComponent(url)}`);
    assert.equal(res.status, 200);
    const json = res.json();
    assert.deepEqual(json.type, ['h-entry']);
    assert.ok(json.properties.content[0].includes('Integration test note'));
  });

  it('returns filtered source properties', async () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const url = `https://test.example/notes/${now.getFullYear()}/${month}/integration-test-note/`;
    const res = await request(
      'GET',
      `/micropub?q=source&url=${encodeURIComponent(url)}&properties[]=content`,
    );
    assert.equal(res.status, 200);
    const json = res.json();
    assert.ok(json.properties.content);
    assert.equal(json.properties.published, undefined);
  });

  it('returns 400 for missing post source', async () => {
    const url = 'https://test.example/notes/9999/01/nope/';
    const res = await request(
      'GET',
      `/micropub?q=source&url=${encodeURIComponent(url)}`,
    );
    assert.equal(res.status, 400);
  });

  it('updates a post with replace', async () => {
    const createRes = await request('POST', '/micropub', {
      body: JSON.stringify({
        type: ['h-entry'],
        properties: {
          content: ['Post to be updated'],
          category: ['original'],
        },
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const postUrl = createRes.headers.location;

    const res = await request('POST', '/micropub', {
      body: JSON.stringify({
        action: 'update',
        url: postUrl,
        replace: { content: ['Updated content'] },
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(res.status, 200);

    const sourceRes = await request(
      'GET',
      `/micropub?q=source&url=${encodeURIComponent(postUrl)}`,
    );
    assert.equal(sourceRes.json().properties.content[0], 'Updated content');
  });

  it('updates a post with add', async () => {
    const createRes = await request('POST', '/micropub', {
      body: JSON.stringify({
        type: ['h-entry'],
        properties: { content: ['Add test'], category: ['original'] },
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const postUrl = createRes.headers.location;

    const res = await request('POST', '/micropub', {
      body: JSON.stringify({
        action: 'update',
        url: postUrl,
        add: { category: ['added-tag'] },
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(res.status, 200);

    const sourceRes = await request(
      'GET',
      `/micropub?q=source&url=${encodeURIComponent(postUrl)}`,
    );
    assert.ok(sourceRes.json().properties.category.includes('added-tag'));
  });

  it('deletes a post', async () => {
    const createRes = await request('POST', '/micropub', {
      body: JSON.stringify({
        type: ['h-entry'],
        properties: { content: ['Post to be deleted'] },
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const postUrl = createRes.headers.location;

    const res = await request('POST', '/micropub', {
      body: JSON.stringify({ action: 'delete', url: postUrl }),
      headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(res.status, 200);

    const sourceRes = await request(
      'GET',
      `/micropub?q=source&url=${encodeURIComponent(postUrl)}`,
    );
    assert.equal(sourceRes.status, 400);
  });
});
