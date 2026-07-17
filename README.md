# Micropub Server

A local [Micropub](https://micropub.spec.indieweb.org) server that creates posts for
[notes.keithjgrant.com](https://notes.keithjgrant.com). It writes Eleventy-compatible
markdown files to the site repo, commits, and pushes so Netlify picks up the change
automatically.

Zero npm dependencies -- just Node built-ins.

## How it works

1. You send an HTTP POST to `http://localhost:3456/micropub` (via curl, a Micropub client, etc.)
2. The server parses the request, determines the post type, and generates a markdown file
   with the correct frontmatter for the Eleventy site
3. The file is written to `~/self/notes.keithjgrant.com/content/{type}/{YYYY}/{MM}/{slug}.md`
4. The server runs `git add`, `git commit`, and `git push` in the site repo
5. Netlify detects the push and rebuilds the site

## Supported post types

| Type     | Detected by property | Written to        |
| -------- | -------------------- | ----------------- |
| Note     | _(default)_          | `content/notes/`  |
| Reply    | `in-reply-to`        | `content/replies/` |
| Bookmark | `bookmark-of`        | `content/bookmarks/` |
| Like     | `like-of`            | `content/likes/`  |
| Repost   | `repost-of`          | `content/notes/`  |

## Usage

```bash
# Set your token and start the server
MICROPUB_TOKEN=your-secret-token npm start
```

### Post a note

```bash
curl http://localhost:3456/micropub \
  -H "Authorization: Bearer your-secret-token" \
  -d "h=entry" \
  -d "content=Hello from micropub"
```

### Post a bookmark

```bash
curl http://localhost:3456/micropub \
  -H "Authorization: Bearer your-secret-token" \
  -d "h=entry" \
  -d "bookmark-of=https://example.com/article" \
  -d "name=Great Article"
```

### Post with syndication targets

```bash
curl http://localhost:3456/micropub \
  -H "Authorization: Bearer your-secret-token" \
  -d "h=entry" \
  -d "content=Hello world" \
  -d "mp-syndicate-to[]=https://front-end.social/@keithjgrant" \
  -d "mp-syndicate-to[]=https://bsky.app/profile/keithjgrant.com"
```

### JSON syntax

```bash
curl http://localhost:3456/micropub \
  -H "Authorization: Bearer your-secret-token" \
  -H "Content-Type: application/json" \
  -d '{"type":["h-entry"],"properties":{"content":["Hello from JSON"]}}'
```

### Query server config

```bash
curl 'http://localhost:3456/micropub?q=config' \
  -H "Authorization: Bearer your-secret-token"
```

## Configuration

All config is via environment variables:

| Variable         | Default                              | Description               |
| ---------------- | ------------------------------------ | ------------------------- |
| `MICROPUB_TOKEN` | _(required)_                         | Bearer token for auth     |
| `MICROPUB_PORT`  | `3456`                               | Port to listen on         |
| `SITE_DIR`       | `~/self/notes.keithjgrant.com`       | Path to the site repo     |

## Project structure

```
server.mjs          Entry point (config validation, start server)
config.mjs          Environment config and constants
lib/
  handler.mjs       Request routing and dispatch
  http.mjs          Auth, body parsing, response helpers
  post.mjs          Post type detection, frontmatter builders, file creation
  git.mjs           Git add/commit/push
  helpers.mjs       Slug generation, date formatting, path building
```
