import { URL } from 'node:url';

import { SYNDICATION_TARGETS } from '../config.mjs';
import {
  jsonResponse,
  errorResponse,
  authenticate,
  collectBody,
  normalizeRequest,
} from './http.mjs';
import { detectPostType, createPost } from './post.mjs';

function handleQuery(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const q = url.searchParams.get('q');

  if (q === 'config') {
    return jsonResponse(res, 200, { 'syndicate-to': SYNDICATION_TARGETS });
  }

  if (q === 'syndicate-to') {
    return jsonResponse(res, 200, { 'syndicate-to': SYNDICATION_TARGETS });
  }

  if (q === 'source') {
    return errorResponse(
      res,
      400,
      'invalid_request',
      'Source query is not yet supported',
    );
  }

  return errorResponse(res, 400, 'invalid_request', `Unknown query: ${q}`);
}

export async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname !== '/micropub') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  if (req.method === 'GET') {
    if (!authenticate(req, null)) {
      return errorResponse(
        res,
        401,
        'unauthorized',
        'Missing or invalid access token',
      );
    }
    return handleQuery(req, res);
  }

  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end('Method not allowed');
    return;
  }

  const rawBody = await collectBody(req);
  const contentType = req.headers['content-type'] || '';

  let parsed;
  try {
    parsed = normalizeRequest(contentType, rawBody);
  } catch (err) {
    return errorResponse(
      res,
      400,
      'invalid_request',
      `Could not parse request body: ${err.message}`,
    );
  }

  if (!authenticate(req, parsed.raw)) {
    return errorResponse(
      res,
      401,
      'unauthorized',
      'Missing or invalid access token',
    );
  }

  if (parsed.type !== 'h-entry') {
    return errorResponse(
      res,
      400,
      'invalid_request',
      `Unsupported type: ${parsed.type}`,
    );
  }

  const postType = detectPostType(parsed.properties);

  try {
    const { url: postUrl } = await createPost(postType, parsed.properties);
    res.writeHead(201, { Location: postUrl });
    res.end();
    console.log(`201 Created -> ${postUrl}`);
  } catch (err) {
    console.error('Error creating post:', err);
    return errorResponse(res, 500, 'server_error', err.message);
  }
}
