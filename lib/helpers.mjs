import { createHash } from 'node:crypto';

export function slugify(text) {
  return text
    .toLowerCase()
    .split(' ')
    .slice(0, 6)
    .join('-')
    .replace(/[^A-Za-z0-9-]/g, '');
}

export function toISOString(datetime) {
  const offset = datetime.getTimezoneOffset();
  const localDate = new Date(datetime.getTime() - offset * 60000);
  const isoString = localDate.toISOString().substring(0, 19);
  const hours = Math.floor(Math.abs(offset) / 60);
  const sign = offset > 0 ? '-' : '+';
  const offsetString = `${sign}${String(hours).padStart(2, '0')}:00`;
  return `${isoString}${offsetString}`;
}

export function buildPath(contentType) {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `content/${contentType}/${date.getFullYear()}/${month}`;
}

export function generateSlug(text) {
  if (text) return slugify(text);
  return createHash('md5').update(Date.now().toString()).digest('hex').slice(0, 8);
}

export function hashSlug(value) {
  return createHash('md5').update(value).digest('hex').slice(0, 6);
}
