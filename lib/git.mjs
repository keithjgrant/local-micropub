import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { SITE_DIR } from '../config.mjs';

const execFileAsync = promisify(execFile);

async function gitCommitAndPush(files, message) {
  const opts = { cwd: SITE_DIR };
  const fileList = Array.isArray(files) ? files : [files];

  try {
    await execFileAsync('git', ['add', ...fileList], opts);
    await execFileAsync('git', ['commit', '-m', message], opts);
    console.log(`Committed: ${message}`);
  } catch (err) {
    console.error('Git commit failed:', err.message);
    throw err;
  }

  try {
    await execFileAsync('git', ['push'], opts);
    console.log(`Pushed: ${message}`);
  } catch (err) {
    console.error(`Git push failed (commit is local): ${err.message}`);
  }
}

export async function gitPublish(relFile, postType, slug) {
  await gitCommitAndPush(relFile, `Add ${postType}: ${slug}`);
}

export async function gitUpdate(relFile, slug) {
  await gitCommitAndPush(relFile, `Update: ${slug}`);
}

export async function gitDelete(relFile, slug) {
  const opts = { cwd: SITE_DIR };
  try {
    await execFileAsync('git', ['rm', relFile], opts);
    await execFileAsync('git', ['commit', '-m', `Delete: ${slug}`], opts);
    console.log(`Committed deletion: ${slug}`);
  } catch (err) {
    console.error('Git delete commit failed:', err.message);
    throw err;
  }

  try {
    await execFileAsync('git', ['push'], opts);
    console.log(`Pushed deletion: ${slug}`);
  } catch (err) {
    console.error(`Git push failed (commit is local): ${err.message}`);
  }
}
