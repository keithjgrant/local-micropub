import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { SITE_DIR } from '../config.mjs';

const execFileAsync = promisify(execFile);

export async function gitPublish(relFile, postType, slug) {
  const opts = { cwd: SITE_DIR };
  try {
    await execFileAsync('git', ['add', relFile], opts);
    await execFileAsync(
      'git',
      ['commit', '-m', `Add ${postType}: ${slug}`],
      opts,
    );
    console.log(`Committed ${relFile}`);
  } catch (err) {
    console.error('Git commit failed:', err.message);
    throw err;
  }

  try {
    await execFileAsync('git', ['push'], opts);
    console.log(`Pushed ${relFile}`);
  } catch (err) {
    console.error(`Git push failed (commit is local): ${err.message}`);
  }
}
