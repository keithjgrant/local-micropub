import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

export const TOKEN = process.env.MICROPUB_TOKEN;
export const PORT = parseInt(process.env.MICROPUB_PORT || '3456', 10);
export const SITE_DIR = resolve(
  process.env.SITE_DIR || join(homedir(), 'self/notes.keithjgrant.com')
);
export const SITE_URL = 'https://notes.keithjgrant.com';

export const SYNDICATION_TARGETS = [
  {
    uid: 'https://front-end.social/@keithjgrant',
    name: 'Mastodon (front-end.social)',
  },
  {
    uid: 'https://bsky.app/profile/keithjgrant.com',
    name: 'Bluesky',
  },
];
