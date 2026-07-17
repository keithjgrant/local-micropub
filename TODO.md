# Micropub Server TODO

## Spec compliance

- [x] Support `action: update` (replace, add, remove properties on existing posts)
- [x] Support `action: delete`
- [ ] Support `action: undelete`
- [ ] Support `multipart/form-data` requests for photo/file uploads
- [ ] Store and return `mp-slug` as a recognized command (currently handled, but not documented)

## Nice to have

- [ ] Media endpoint for async file uploads
- [ ] CORS headers for browser-based Micropub clients
- [ ] Configurable default syndication targets (so they can be passed without typing full URLs)
- [ ] Logging to a file instead of just stdout
- [ ] Graceful shutdown on SIGINT/SIGTERM
