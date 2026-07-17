#!/usr/bin/env node

import { createServer } from 'node:http';
import { TOKEN, PORT, SITE_DIR } from './config.mjs';
import { errorResponse } from './lib/http.mjs';
import { handleRequest } from './lib/handler.mjs';

if (!TOKEN) {
  console.error('MICROPUB_TOKEN environment variable is required');
  process.exit(1);
}

const server = createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error('Unhandled error:', err);
    if (!res.headersSent) {
      errorResponse(res, 500, 'server_error', 'Internal server error');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Micropub server listening on http://localhost:${PORT}/micropub`);
  console.log(`Site directory: ${SITE_DIR}`);
});
