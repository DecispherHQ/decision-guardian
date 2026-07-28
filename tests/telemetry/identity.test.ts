import {
  normalizeRepoRef,
  computeRepoHash,
  resolveRepoRef,
  resolveRepoVisibility,
  REPO_HASH_PATTERN,
} from '../../src/telemetry/identity';

describe('normalizeRepoRef', () => {
  it('collapses every addressing form of the same repo to one value', () => {
    const expected = 'github.com/owner/repo';

    expect(normalizeRepoRef('owner/repo')).toBe(expected);
    expect(normalizeRepoRef('Owner/Repo')).toBe(expected);
    expect(normalizeRepoRef('git@github.com:Owner/Repo.git')).toBe(expected);
    expect(normalizeRepoRef('https://github.com/owner/repo')).toBe(expected);
    expect(normalizeRepoRef('https://github.com/owner/repo.git')).toBe(expected);
    expect(normalizeRepoRef('ssh://git@github.com/owner/repo.git')).toBe(expected);
    expect(normalizeRepoRef('  https://github.com/owner/repo/  \n')).toBe(expected);
  });

  it('strips embedded credentials so tokens are never hashed in', () => {
    expect(normalizeRepoRef('https://x-access-token:ghs_SECRET@github.com/owner/repo.git')).toBe(
      'github.com/owner/repo',
    );
    expect(normalizeRepoRef('https://user:pass@gitlab.com/group/proj.git')).toBe(
      'gitlab.com/group/proj',
    );
  });

  it('keeps distinct hosts distinct', () => {
    expect(normalizeRepoRef('git@gitlab.com:owner/repo.git')).toBe('gitlab.com/owner/repo');
    expect(normalizeRepoRef('https://github.com/owner/repo')).not.toBe(
      normalizeRepoRef('https://gitlab.com/owner/repo'),
    );
  });

  it('returns null for values that are not repository references', () => {
    expect(normalizeRepoRef('')).toBeNull();
    expect(normalizeRepoRef('   ')).toBeNull();
    expect(normalizeRepoRef('not-a-repo')).toBeNull();
  });
});

describe('computeRepoHash', () => {
  it('produces a 16-char lowercase hex hash', () => {
    const hash = computeRepoHash('github.com/owner/repo');
    expect(hash).toMatch(REPO_HASH_PATTERN);
  });

  it('is stable across calls', () => {
    expect(computeRepoHash('github.com/owner/repo')).toBe(computeRepoHash('github.com/owner/repo'));
  });

  it('differs between repositories', () => {
    expect(computeRepoHash('github.com/owner/repo-a')).not.toBe(
      computeRepoHash('github.com/owner/repo-b'),
    );
  });

  it('never contains the repository name', () => {
    const hash = computeRepoHash('github.com/acme-corp/secret-project')!;
    expect(hash).not.toContain('acme');
    expect(hash).not.toContain('secret');
    expect(hash).not.toContain('project');
  });

  it('returns null when the repository is unknown', () => {
    expect(computeRepoHash(null)).toBeNull();
  });
});

describe('resolveRepoRef', () => {
  const original = process.env.GITHUB_REPOSITORY;
  afterEach(() => {
    if (original === undefined) delete process.env.GITHUB_REPOSITORY;
    else process.env.GITHUB_REPOSITORY = original;
  });

  it('prefers GITHUB_REPOSITORY when present', () => {
    process.env.GITHUB_REPOSITORY = 'DecispherHQ/decision-guardian';
    expect(resolveRepoRef()).toBe('github.com/decispherhq/decision-guardian');
  });

  it('falls back to the git remote without throwing when unset', () => {
    delete process.env.GITHUB_REPOSITORY;
    // Either resolves from the local checkout's origin, or null outside a repo.
    // The contract under test is "does not throw and never returns a raw URL".
    const ref = resolveRepoRef();
    expect(ref === null || !ref.includes('://')).toBe(true);
  });
});

describe('resolveRepoVisibility', () => {
  const original = process.env.GITHUB_EVENT_PATH;
  afterEach(() => {
    if (original === undefined) delete process.env.GITHUB_EVENT_PATH;
    else process.env.GITHUB_EVENT_PATH = original;
  });

  it('returns null outside a GitHub event context', () => {
    delete process.env.GITHUB_EVENT_PATH;
    expect(resolveRepoVisibility()).toBeNull();
  });

  it('returns null when the event file is unreadable', () => {
    process.env.GITHUB_EVENT_PATH = '/nonexistent/event.json';
    expect(resolveRepoVisibility()).toBeNull();
  });
});
