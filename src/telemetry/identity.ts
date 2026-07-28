/**
 * Pseudonymous repository identity for telemetry.
 *
 */
import { createHmac } from 'crypto';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

const REPO_HASH_SALT = 'decision-guardian.repo-identity.v1';

export const REPO_HASH_LENGTH = 16;
export const REPO_HASH_PATTERN = /^[a-f0-9]{16}$/;

/**
 * Normalize a repository reference so the same repo always yields the same
 * hash regardless of how it was addressed.
 *
 * All of these collapse to `github.com/owner/repo`:
 *   git@github.com:Owner/Repo.git
 *   https://github.com/owner/repo
 *   https://x-access-token:TOKEN@github.com/owner/repo.git
 *   owner/repo            (GITHUB_REPOSITORY form, assumed github.com)
 */
export function normalizeRepoRef(raw: string): string | null {
  let ref = raw.trim();
  if (!ref) return null;

  if (/^[^/\s:]+\/[^/\s:]+$/.test(ref) && !ref.includes('@')) {
    return `github.com/${ref.toLowerCase()}`;
  }

  const scp = ref.match(/^[^@\s]+@([^:\s]+):(.+)$/);
  if (scp) {
    ref = `${scp[1]}/${scp[2]}`;
  } else {
    ref = ref.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
    ref = ref.replace(/^[^@/]*@/, '');
  }

  ref = ref.replace(/\.git$/i, '').replace(/\/+$/, '');
  if (!ref.includes('/')) return null;

  return ref.toLowerCase();
}

/**
 * Resolve the current repository reference.
 * Prefers the CI-provided value; falls back to the git origin remote for
 * local CLI runs. Returns null when neither is available (never guesses).
 */
export function resolveRepoRef(): string | null {
  const fromEnv = process.env.GITHUB_REPOSITORY;
  if (fromEnv) return normalizeRepoRef(fromEnv);

  try {
    const out = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      encoding: 'utf-8',
      timeout: 2000,
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
    return normalizeRepoRef(out);
  } catch {
    return null;
  }
}

/**
 * Stable pseudonymous identifier for the current repository,
 * or null when the repository cannot be determined.
 */
export function computeRepoHash(ref: string | null = resolveRepoRef()): string | null {
  if (!ref) return null;

  return createHmac('sha256', REPO_HASH_SALT)
    .update(ref, 'utf8')
    .digest('hex')
    .substring(0, REPO_HASH_LENGTH);
}

export function resolveRepoVisibility(): 'public' | 'private' | null {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return null;

  try {
    const payload = JSON.parse(readFileSync(eventPath, 'utf-8'));
    const isPrivate = payload?.repository?.private;
    if (typeof isPrivate !== 'boolean') return null;
    return isPrivate ? 'private' : 'public';
  } catch {
    return null;
  }
}
