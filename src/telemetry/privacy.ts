import { REPO_HASH_PATTERN } from './identity';

const BLOCKED_FIELDS = new Set([
  'repo_name',
  'org_name',
  'repo_url',
  'remote_url',
  'file_names',
  'file_paths',
  'pr_title',
  'pr_body',
  'decision_content',
  'user_names',
  'github_token',
  'commit_message',
  'branch_name',
  'author',
  'email',
]);

/** Fields that must carry a hash, never a raw value, if present at all. */
const HASHED_FIELDS = new Set(['repo_hash']);

export function validatePrivacy(payload: Record<string, unknown>): void {
  const violations = findBlockedKeys(payload);
  if (violations.length > 0) {
    throw new Error(`Telemetry privacy violation: blocked fields found: ${violations.join(', ')}`);
  }

  const malformed = findMalformedHashes(payload);
  if (malformed.length > 0) {
    throw new Error(
      `Telemetry privacy violation: non-hashed value in hashed field: ${malformed.join(', ')}`,
    );
  }
}

function findMalformedHashes(obj: Record<string, unknown>, prefix = ''): string[] {
  const violations: string[] = [];

  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (HASHED_FIELDS.has(key.toLowerCase())) {
      if (value !== null && (typeof value !== 'string' || !REPO_HASH_PATTERN.test(value))) {
        violations.push(fullKey);
      }
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      violations.push(...findMalformedHashes(value as Record<string, unknown>, fullKey));
    }
  }

  return violations;
}

function findBlockedKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const violations: string[] = [];

  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (BLOCKED_FIELDS.has(key.toLowerCase())) {
      violations.push(fullKey);
    }

    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      violations.push(...findBlockedKeys(obj[key] as Record<string, unknown>, fullKey));
    }
  }

  return violations;
}
