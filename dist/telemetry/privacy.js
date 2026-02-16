"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePrivacy = validatePrivacy;
const BLOCKED_FIELDS = new Set([
    'repo_name',
    'org_name',
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
function validatePrivacy(payload) {
    const violations = findBlockedKeys(payload);
    if (violations.length > 0) {
        throw new Error(`Telemetry privacy violation: blocked fields found: ${violations.join(', ')}`);
    }
}
function findBlockedKeys(obj, prefix = '') {
    const violations = [];
    for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (BLOCKED_FIELDS.has(key)) {
            violations.push(fullKey);
        }
        if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
            violations.push(...findBlockedKeys(obj[key], fullKey));
        }
    }
    return violations;
}
