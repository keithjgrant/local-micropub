# Micropub Server TODO

## Spec compliance

- [ ] Support `action: update` (replace, add, remove properties on existing posts)
- [ ] Support `action: delete` / `action: undelete`
- [ ] Support `multipart/form-data` requests for photo/file uploads
- [ ] Support `?q=source` query to return source content of a post
- [ ] Store and return `mp-slug` as a recognized command (currently handled, but not documented)

## Nice to have

- [ ] Media endpoint for async file uploads
- [ ] CORS headers for browser-based Micropub clients
- [ ] Configurable default syndication targets (so they can be passed without typing full URLs)
- [ ] Logging to a file instead of just stdout
- [ ] Graceful shutdown on SIGINT/SIGTERM
