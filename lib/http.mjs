import { TOKEN } from '../config.mjs';

export function jsonResponse(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export function errorResponse(res, status, error, description) {
  jsonResponse(res, status, { error, error_description: description });
}

export function authenticate(req, body) {
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1] === TOKEN;
  }
  if (body && body.access_token) {
    return body.access_token === TOKEN;
  }
  return false;
}

export function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

export function parseFormEncoded(raw) {
  const params = new URLSearchParams(raw);
  const result = {};
  const seen = new Set();
  for (const key of params.keys()) {
    if (seen.has(key)) continue;
    seen.add(key);
    const values = params.getAll(key);
    const normalizedKey = key.replace(/\[\]$/, '');
    if (values.length === 1 && !key.endsWith('[]')) {
      result[normalizedKey] = values[0];
    } else {
      result[normalizedKey] = values;
    }
  }
  return result;
}

export function normalizeRequest(contentType, rawBody) {
  if (contentType && contentType.includes('application/json')) {
    const json = JSON.parse(rawBody);
    return {
      type: json.type?.[0] || 'h-entry',
      properties: json.properties || {},
      raw: json,
    };
  }

  const form = parseFormEncoded(rawBody);
  const type = form.h ? `h-${form.h}` : 'h-entry';
  const properties = {};

  for (const [key, value] of Object.entries(form)) {
    if (['h', 'access_token', 'action', 'url'].includes(key)) continue;
    properties[key] = Array.isArray(value) ? value : [value];
  }

  return { type, properties, raw: form };
}
