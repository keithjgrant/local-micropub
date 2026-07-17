# Micropub Server

A local [Micropub](https://micropub.spec.indieweb.org) server that creates posts for a
static site. It writes Eleventy-compatible markdown files to a local site repo, commits,
and pushes so your hosting platform picks up the change automatically.

Zero npm dependencies -- just Node built-ins.

## How it works

1. You send an HTTP POST to `http://localhost:3456/micropub` (via curl, a Micropub client, etc.)
2. The server parses the request, determines the post type, and generates a markdown file
   with the correct frontmatter for the Eleventy site
3. The file is written to `$SITE_DIR/content/{type}/{YYYY}/{MM}/{slug}.md`
4. The server runs `git add`, `git commit`, and `git push` in the site repo
5. Your hosting platform detects the push and rebuilds the site

## Supported post types

| Type     | Detected by property | Written to           |
| -------- | -------------------- | -------------------- |
| Note     | _(default)_          | `content/notes/`     |
| Reply    | `in-reply-to`        | `content/replies/`   |
| Bookmark | `bookmark-of`        | `content/bookmarks/` |
| Like     | `like-of`            | `content/likes/`     |
| Repost   | `repost-of`          | `content/notes/`     |

## Setup

```bash
cp .env.example .env
# Edit .env with your token, site path, site URL, and syndication targets
npm start
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

All config is via a `.env` file (or environment variables). Copy `.env.example` to get started.

| Variable         | Default      | Description                                           |
| ---------------- | ------------ | ----------------------------------------------------- |
| `MICROPUB_TOKEN` | _(required)_ | Bearer token for auth                                 |
| `MICROPUB_PORT`  | `3456`       | Port to listen on                                     |
| `SITE_DIR`       | _(required)_ | Path to the site repo (supports `~`)                  |
| `SITE_URL`       | _(required)_ | Public URL of the site (for `Location` header)        |
| `SYNDICATE_TO`   | _(empty)_    | Comma-separated `uid name` pairs (see `.env.example`) |

Environment variables take precedence over `.env` values.

## Omnibear setup

To configure [Omnibear](https://omnibear.com) to use this server, go to
Settings > Authentication Details and set the following values:

- Set "Me" to your site's URL.
- Set "Micropub Endpoint" to `http://localhost:3456/micropub`
  (replacing the port number if you've configured a different MICROPUB_PORT in .env)
- Set OAuth token to match the MICROPUB_TOKEN in your .env

Since this server uses a simple shared token instead of full IndieAuth, Omnibear
won't auto-discover the syndication targets. They need to be set manually via the
browser console of the Omnibear authoring page, using your own target UIDs
and names:

```js
storage.set({
  syndicateTo: [
    { uid: 'https://social.example/@you', name: 'Your Social Name' },
  ],
});
```

## Frontmatter format

The generated markdown files use frontmatter conventions for an Eleventy site with
[Microformats2](http://microformats.org/wiki/microformats2)-style properties
(`mf-in-reply-to`, `mf-bookmark-of`, etc.). If your site uses a different static
site generator or different frontmatter fields, edit the builders in `lib/post.mjs`.

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
