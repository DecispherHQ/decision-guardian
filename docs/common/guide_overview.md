# Decision Guardian

**Prevent institutional amnesia by surfacing architectural decisions on Pull Requests**

---

## About

**Decision Guardian** is a tool that automatically surfaces architectural decisions and critical context when code changes modify protected files. Use it as a **GitHub Action** for automated PR checks, or as a **CLI tool** for local development and any CI/CD integration. Instead of relying on tribal knowledge or hoping developers read documentation, Decision Guardian proactively alerts teams when changes touch sensitive areas of the codebase.

**Author**: Ali Abbas  
**Project**: Decispher  
**License**: MIT  
**Repository**: [DecispherHQ/decision-guardian](https://github.com/DecispherHQ/decision-guardian)

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Installation](#installation)
3. [Decision File Format](#decision-file-format)
4. [Advanced Rules System](#advanced-rules-system)
5. [Configuration](#configuration)
6. [Real-World Examples](#real-world-examples)
7. [Performance & Scale](#performance--scale)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)
10. [API Reference](#api-reference)

---

## Quick Start

### 1. Create Decision File

Create `.decispher/decisions.md`:

```markdown
<!-- DECISION-DB-001 -->
## Decision: Database Connection Pool

**Status**: Active  
**Date**: 2025-01-15  
**Severity**: Critical

**Files**:
- `src/config/database.ts`
- `src/lib/db-pool.ts`

### Context

Connection pool changes can cause:
- Production outages under load
- Memory leaks
- Performance degradation

Always load-test with production-like traffic.

---
```

### 2. Add Workflow

Create `.github/workflows/decision-guardian.yml`:

```yaml
name: Decision Guardian

on:
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Decision Guardian
        uses: DecispherHQ/decision-guardian@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fail_on_critical: true
```

### 3. Test

Open a PR modifying `src/config/database.ts` → Decision Guardian posts a comment with context.

---

## Installation

### Prerequisites

- GitHub repository with Actions enabled
- Node.js 20+ (handled automatically)

### Basic Setup

**Option 1: Standalone Workflow (Recommended)**

```yaml
name: Decision Guardian

on:
  pull_request:

concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  decision-check:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write  # Required for comments
      contents: read
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: DecispherHQ/decision-guardian@v1
        with:
          decision_file: '.decispher/decisions.md'
          fail_on_critical: true
          token: ${{ secrets.GITHUB_TOKEN }}
```

**Option 2: Integrate with Existing CI**

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test
      
      - uses: DecispherHQ/decision-guardian@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
```

### Permissions

Decision Guardian requires:
- `pull-requests: write` - Post/update PR comments
- `contents: read` - Read decision files

These are automatically granted via `secrets.GITHUB_TOKEN`.

### CLI Tool Installation

For local development or non-GitHub CI systems, install Decision Guardian as a CLI tool:

**Global Installation:**
```bash
npm install -g decision-guardian
decision-guardian --version
```

**Use Without Installation:**
```bash
npx decision-guardian --help
```

**Basic Commands:**

```bash
# Check specific decision file against staged changes
decision-guardian check .decispher/decisions.md

# Check against a branch
decision-guardian check .decispher/decisions.md --branch main

# Check all uncommitted changes
decision-guardian check .decispher/decisions.md --all

# Auto-discover all .decispher/ files
decision-guardian checkall --fail-on-critical

# Initialize a new project with template
decision-guardian init --template security
```

**Command Flags:**

| Flag | Description |
|------|-------------|
| `--staged` | Compare staged changes (default for `check`) |
| `--branch <base>` | Compare against a specific branch |
| `--all` | Compare all uncommitted changes |
| `--fail-on-critical` | Exit with code 1 if critical decisions are triggered |

**CI/CD Integration Examples:**

**GitLab CI:**
```yaml
check-decisions:
  image: node:20
  script:
    - npx decision-guardian check .decispher/decisions.md --branch $CI_MERGE_REQUEST_TARGET_BRANCH_NAME --fail-on-critical
```

**CircleCI:**
```yaml
jobs:
  check-decisions:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - run: npx decision-guardian checkall --fail-on-critical
```

**Jenkins:**
```groovy
pipeline {
  agent any
  stages {
    stage('Check Decisions') {
      steps {
        sh 'npx decision-guardian check .decispher/decisions.md --branch origin/main --fail-on-critical'
      }
    }
  }
}
```

**Pre-commit Hook:**
```bash
#!/bin/sh
# .git/hooks/pre-commit
npx decision-guardian check .decispher/decisions.md --staged --fail-on-critical
```

**Exit Codes:**
- `0` - No violations or only non-critical violations
- `1` - Critical violations found (with `--fail-on-critical`) or error occurred

---

## Decision File Format

### Basic Structure

```markdown
<!-- DECISION-ID -->
## Decision: Title

**Status**: Active  
**Date**: YYYY-MM-DD  
**Severity**: Critical|Warning|Info

**Files**:
- `pattern`

### Context

Explanation of the decision.

---
```

### Decision ID

Format: `DECISION-[CATEGORY-]NUMBER`

**Valid examples**:
- `DECISION-001`
- `DECISION-DB-001`
- `DECISION-API-AUTH-001`

**Rules**:
- Must start with `DECISION-`
- Optional category prefix (DB, API, SEC, etc.)
- Must end with number
- Uppercase only

### Status Field

**Valid values**:

| Status | Synonyms | Behavior |
|--------|----------|----------|
| `Active` | `Enabled`, `Live` | Triggers alerts |
| `Deprecated` | `Obsolete` | Triggers alerts with deprecation notice |
| `Superseded` | `Replaced` | Triggers alerts, references new decision |
| `Archived` | `Inactive` | No alerts |

**Only `Active` decisions trigger PR comments.**

### Date Field

Format: `YYYY-MM-DD` (ISO 8601)

**Warnings triggered when**:
- Date is in future
- Date is >10 years old

### Severity Levels

| Severity | Synonyms | Behavior | Fails PR? |
|----------|----------|----------|-----------|
| `Critical` | `Error`, `High`, `Blocker` | Red flag, requires review | Yes (if `fail_on_critical: true`) |
| `Warning` | `Warn`, `Medium` | Yellow flag | No |
| `Info` | `Informational`, `Low` | FYI only | No |

### File Patterns

Uses [minimatch](https://github.com/isaacs/minimatch) glob syntax:

```markdown
**Files**:
- `package.json`              # Exact file
- `src/**/*.ts`               # All .ts in src/ (recursive)
- `config/*.yml`              # All .yml in config/ (non-recursive)
- `migrations/**/*.sql`       # All .sql in migrations/
- `!migrations/**/test_*.sql` # Exclude test migrations
```

**Pattern Reference**:

| Pattern | Matches |
|---------|---------|
| `*` | Any chars except `/` |
| `**` | Any chars including `/` |
| `?` | Single char |
| `[abc]` | a, b, or c |
| `{a,b}` | a or b |
| `!pattern` | Exclude |

### Context Section

Required. Explains:
- **Why** the decision was made
- **Impact** of violating it
- **Actions** required before merging
- **Links** to docs/ADRs/runbooks

**Example**:

```markdown
### Context

This configuration controls API rate limiting.

**Why**: Prevents abuse while allowing legitimate traffic.

**Impact if changed**:
- Too strict → blocks legitimate users
- Too loose → allows API abuse
- Incorrect values → OOM errors

**Before merging**:
1. Load test with 2x expected traffic
2. Verify Redis connection pool
3. Test admin bypass routes

**Docs**: [Rate Limiting Guide](link)
```

---

## Advanced Rules System

For complex scenarios beyond simple file patterns.

### When to Use

Use advanced rules when you need:
- Content-based matching (specific code patterns)
- AND/OR logic across multiple files
- Regex pattern matching
- Line range protection
- Exclusions within broad patterns

### Basic Structure

**Inline JSON**:

```markdown
**Rules**:
```json
{
  "type": "file",
  "pattern": "src/**/*.ts",
  "content_rules": [
    {
      "mode": "string",
      "patterns": ["process.env", "API_KEY"]
    }
  ]
}
```
```

**External File**:

```markdown
**Rules**: ./rules/security.json
```

or

```markdown
**Rules**: [Security Rules](./rules/security.json)
```

### Rule Types

#### File Rule

```json
{
  "type": "file",
  "pattern": "src/api/**/*.ts",
  "exclude": "**/*.test.ts",
  "content_rules": [
    {
      "mode": "regex",
      "pattern": "fetch\\(['\"]https://",
      "flags": "i"
    }
  ]
}
```

**Fields**:
- `type`: Always `"file"`
- `pattern`: Glob pattern (required)
- `exclude`: Exclusion glob (optional)
- `content_rules`: Content matchers (optional)

### Content Matching Modes

#### 1. String Mode

Match exact strings in changed lines:

```json
{
  "mode": "string",
  "patterns": ["TODO", "FIXME", "console.log"]
}
```

#### 2. Regex Mode

**Security**: Protected by 5s timeout + unsafe pattern rejection.

```json
{
  "mode": "regex",
  "pattern": "password\\s*=\\s*['\"]",
  "flags": "i"
}
```

**Flags**: `i` (case-insensitive), `m` (multiline), `g` (global)

#### 3. Line Range Mode

```json
{
  "mode": "line_range",
  "start": 1,
  "end": 50
}
```

**Use case**: Protect license headers, config sections.

#### 4. Full File Mode

```json
{
  "mode": "full_file"
}
```

**Use case**: Any change requires review.

#### 5. JSON Path Mode

```json
{
  "mode": "json_path",
  "paths": ["$.database.pool_size", "$.api.timeout"]
}
```

**Use case**: Config files where only specific keys matter.

### Boolean Logic

#### AND Logic

```json
{
  "match_mode": "all",
  "conditions": [
    {
      "type": "file",
      "pattern": "src/auth/**/*.ts"
    },
    {
      "type": "file",
      "pattern": "src/database/**/*.ts"
    }
  ]
}
```

Triggers only if **both** auth AND database files change.

#### OR Logic

```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "Dockerfile"
    },
    {
      "type": "file",
      "pattern": "docker-compose.yml"
    }
  ]
}
```

Triggers if **either** file changes.

#### Nested Logic

**Maximum depth: 10 levels** (enforced for safety)

```json
{
  "match_mode": "all",
  "conditions": [
    {
      "type": "file",
      "pattern": "src/api/**/*.ts",
      "content_rules": [
        {
          "mode": "string",
          "patterns": ["fetch", "axios"]
        }
      ]
    },
    {
      "match_mode": "any",
      "conditions": [
        {
          "type": "file",
          "pattern": "src/config/api.ts"
        },
        {
          "type": "file",
          "pattern": "src/lib/http-client.ts"
        }
      ]
    }
  ]
}
```

**Reads as**: Alert if (API files with fetch/axios) AND (config OR http-client changed).

### Complete Example

```markdown
<!-- DECISION-SEC-001 -->
## Decision: No Hardcoded Credentials

**Status**: Active  
**Date**: 2025-01-15  
**Severity**: Critical

**Files**:
- `src/**/*.{ts,js}`

**Rules**:
```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "src/**/*.{ts,js}",
      "exclude": "**/*.test.{ts,js}",
      "content_rules": [
        {
          "mode": "regex",
          "pattern": "(password|api[_-]?key|secret|token)\\s*[=:]\\s*['\"][^'\"]+['\"]",
          "flags": "i"
        }
      ]
    },
    {
      "type": "file",
      "pattern": ".env*",
      "content_rules": [
        {
          "mode": "string",
          "patterns": ["PASSWORD=", "API_KEY="]
        }
      ]
    }
  ]
}
```

### Context

Prevents hardcoded credentials in source code.

**Triggers**:
- JS/TS files with patterns like `password = "xyz"`
- .env files with PASSWORD or API_KEY

**Required**:
- Use environment variables
- Use AWS Secrets Manager / HashiCorp Vault
- Never commit secrets to git

---
```

---

## Configuration

### Action Inputs

```yaml
- uses: DecispherHQ/decision-guardian@v1
  with:
    decision_file: '.decispher/decisions.md'
    fail_on_critical: true
    fail_on_error: false
    telemetry_enabled: false
    token: ${{ secrets.GITHUB_TOKEN }}
```

#### `decision_file`

**Type**: `string`  
**Default**: `.decispher/decisions.md`  
**Required**: No

Path to decision file (relative to repo root).

**Can be**:
- Single file: `.decispher/decisions.md`
- Directory: `.decispher/` (auto-discovers all `.md` files recursively)

**Security**: Path must be relative, cannot contain `..`

**Examples**:

```yaml
# Single file
decision_file: 'docs/decisions.md'

# Directory (scans all .md files)
decision_file: '.decispher/'

# Hidden directories (.git, .github) are skipped
```

#### `fail_on_critical`

**Type**: `boolean`  
**Default**: `false`  
**Required**: No

Fail PR check when Critical decisions are violated.

**Recommended**: `true` for production

```yaml
fail_on_critical: true  # PR shows ❌ if critical files modified
```

**When true**:
- PR status check fails
- Prevents accidental merge
- Admin override still possible

**When false**:
- PR status always passes
- Comment still posted
- Informational only

#### `fail_on_error`

**Type**: `boolean`  
**Default**: `false`  
**Required**: No

Fail action if decision file has parse errors.

**Recommended**: `false` (lenient)

**Parse errors**:
- Invalid decision ID format
- Malformed JSON rules
- Missing required fields
- Invalid dates

```yaml
fail_on_error: true  # Strict mode
```

#### `telemetry_enabled`

**Type**: `boolean`  
**Default**: `true`  
**Required**: No

Enable anonymous usage telemetry.

**Collected** (when enabled):
- Number of decisions processed
- Number of matches found
- Performance metrics
- Error types (no sensitive data)

**NOT collected**:
- Repository names
- File contents
- Decision contents
- User information

#### `token`

**Type**: `string`  
**Default**: `${{ github.token }}`  
**Required**: Yes

GitHub token for API access.

**Always use**:

```yaml
token: ${{ secrets.GITHUB_TOKEN }}
```

**Do NOT** use personal access tokens unless required for specific permissions.

### Action Outputs

```yaml
- uses: DecispherHQ/decision-guardian@v1
  id: check
  with:
    token: ${{ secrets.GITHUB_TOKEN }}

- name: Use outputs
  run: |
    echo "Matches: ${{ steps.check.outputs.matches_found }}"
    echo "Critical: ${{ steps.check.outputs.critical_count }}"
```

#### `matches_found`

**Type**: `number`

Total decision matches.

#### `critical_count`

**Type**: `number`

Number of Critical severity matches.

#### `metrics`

**Type**: `JSON string`

Performance metrics:

```json
{
  "api_calls": 5,
  "api_errors": 0,
  "rate_limit_hits": 0,
  "files_processed": 237,
  "decisions_evaluated": 15,
  "matches_found": 3,
  "duration_ms": 4521
}
```

---

## Real-World Examples

### Example 1: Database Migrations

```markdown
<!-- DECISION-DB-001 -->
## Decision: Schema Change Safety

**Status**: Active  
**Date**: 2025-01-10  
**Severity**: Critical

**Files**:
- `prisma/schema.prisma`
- `migrations/**/*.sql`

**Rules**:
```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "prisma/schema.prisma"
    },
    {
      "type": "file",
      "pattern": "migrations/**/*.sql",
      "content_rules": [
        {
          "mode": "regex",
          "pattern": "(DROP|ALTER|TRUNCATE)\\s+TABLE",
          "flags": "i"
        }
      ]
    }
  ]
}
```

### Context

Schema changes can cause:
- Production downtime
- Data loss
- Breaking changes

**Required before merge**:
1. DBA review
2. Backup verification
3. Rollback plan documented
4. Tested on staging
5. Migration window scheduled

---
```

### Example 2: API Breaking Changes

```markdown
<!-- DECISION-API-001 -->
## Decision: Public API Protection

**Status**: Active  
**Date**: 2025-01-12  
**Severity**: Warning

**Files**:
- `src/api/v1/**/*.ts`
- `openapi.yaml`

**Rules**:
```json
{
  "type": "file",
  "pattern": "src/api/v1/**/*.ts",
  "content_rules": [
    {
      "mode": "regex",
      "pattern": "@(Get|Post|Put|Delete|Patch)\\(",
      "flags": "g"
    }
  ]
}
```

### Context

v1 API changes affect external clients.

**Before merge**:
- Update API docs
- Notify integration partners
- Version bump if breaking
- Add migration guide

---
```

### Example 3: Performance Hot Paths

```markdown
<!-- DECISION-PERF-001 -->
## Decision: Search Algorithm Protection

**Status**: Active  
**Date**: 2025-01-05  
**Severity**: Warning

**Files**:
- `src/services/search.ts`

**Rules**:
```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "src/services/search.ts",
      "content_rules": [
        {
          "mode": "line_range",
          "start": 45,
          "end": 120
        }
      ]
    },
    {
      "type": "file",
      "pattern": "src/**/*.ts",
      "content_rules": [
        {
          "mode": "regex",
          "pattern": "(for|while)\\s*\\([^)]*\\)\\s*{[^}]*(for|while)",
          "flags": "s"
        }
      ]
    }
  ]
}
```

### Context

Search handles 10K+ req/s. Changes impact:
- Response times
- CPU usage
- User experience

**Before merge**:
- Run benchmarks
- Compare vs baseline
- Check for O(n²) complexity
- Profile with prod data

---
```

### Example 4: Infrastructure Config

```markdown
<!-- DECISION-INFRA-001 -->
## Decision: Kubernetes Resource Limits

**Status**: Active  
**Date**: 2025-01-03  
**Severity**: Critical

**Files**:
- `k8s/**/*.yaml`

**Rules**:
```json
{
  "type": "file",
  "pattern": "k8s/**/*.yaml",
  "content_rules": [
    {
      "mode": "string",
      "patterns": [
        "replicas:",
        "resources:",
        "limits:",
        "requests:"
      ]
    }
  ]
}
```

### Context

Resource changes affect:
- Cost (limits)
- Availability (replicas)
- Performance

**Required**:
- DevOps approval
- Staging test
- Rollback plan
- Update monitoring alerts

---
```

---

## Performance & Scale

### Handling Large PRs

Decision Guardian is optimized for scale:

| PR Size | Strategy | Time |
|---------|----------|------|
| <100 files | Single batch | 2-5s |
| 100-1K files | Parallel processing | 5-15s |
| 1K-3K files | Streaming mode | 15-45s |
| 3K+ files | Paginated (max 3K) | 45-120s |

### Optimization Techniques

1. **Trie-based pattern matching**: O(log n) instead of O(n×m)
2. **Regex caching**: Results cached by content hash
3. **Parallel rule evaluation**: Batch size 50, `Promise.allSettled`
4. **Streaming for huge PRs**: Memory-efficient processing
5. **VM sandbox for regex**: 5s timeout, prevents ReDoS

### Performance Metrics

**Typical benchmarks**:
- 1 API call per 100 files
- 10-50ms per decision evaluation
- <1s for simple patterns
- 1-5s for complex rules

**Check metrics**:

```json
{
  "api_calls": 5,
  "files_processed": 237,
  "decisions_evaluated": 15,
  "duration_ms": 4521
}
```

### Optimization Tips

1. **Specific patterns over broad**:
   ```markdown
   src/config/*.ts       # ✅ Fast
   **/*.ts               # ⚠️ Slower
   ```

2. **Simple regex over complex**:
   ```json
   "pattern": "fetch\\("                    # ✅ Fast
   "pattern": "(fetch|axios|http|...)\\("   # ⚠️ Slower
   ```

3. **File patterns over content rules**:
   ```markdown
   Files: src/api/auth.ts   # ✅ Fastest
   Rules: { content match } # ⚠️ Requires diff parsing
   ```

4. **Group related decisions**:
   ```markdown
   # Instead of 10 decisions for 10 files
   # Use 1 decision with 10 patterns
   Files:
   - src/auth/*.ts
   - src/api/*.ts
   ```

---

## Troubleshooting

### Common Issues

#### "Not a pull request event"

**Cause**: Workflow triggered on push, not PR.

**Fix**:
```yaml
on:
  pull_request:  # ✅ Correct
  # Not: push, schedule, etc.
```

#### "Failed to read file: ENOENT"

**Cause**: Decision file not found.

**Fix**:
1. Verify file exists: `ls .decispher/decisions.md`
2. Check workflow path matches actual location
3. Ensure file is committed

#### "Security: Path traversal detected"

**Cause**: Invalid path with `..` or absolute path.

**Fix**:
```yaml
decision_file: '.decispher/decisions.md'  # ✅
decision_file: '../decisions.md'          # ❌
decision_file: '/etc/decisions.md'        # ❌
```

#### Parse errors

**Symptoms**: Warnings in logs like:
```
Warning: Line 45: Decision missing required fields
Warning: DECISION-001: Failed to parse JSON rules
```

**Common fixes**:
- Ensure ID in `<!-- DECISION-ID -->` format
- Validate JSON with validator
- Check all required fields present
- Case-sensitive field names

#### No comment posted

**Causes**:

1. **No matches**: Files don't match patterns
2. **Permissions**: Missing `pull-requests: write`
3. **Status not Active**: Must be `Active`, not `Deprecated`/`Archived`

**Debug**:
```yaml
env:
  ACTIONS_STEP_DEBUG: true
```

#### Rate limit hit

**Rare** (only 3000+ file PRs).

Decision Guardian auto-retries with exponential backoff.

If fails:
1. Wait for reset (shown in error)
2. Re-run workflow
3. Split large PRs

### Debug Mode

```yaml
- uses: DecispherHQ/decision-guardian@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
  env:
    ACTIONS_STEP_DEBUG: true
```

Outputs:
- File matching logic
- Rule evaluation steps
- API calls/responses
- Performance metrics

---

## Best Practices

### Writing Effective Decisions

#### 1. Be Specific

**Bad**:
```markdown
### Context
This is important. Be careful.
```

**Good**:
```markdown
### Context

Rate limiting config. Changes can:
- Block legitimate users (too strict)
- Allow abuse (too loose)
- Cause OOM (incorrect values)

Before merge:
1. Load test 2x expected traffic
2. Verify Redis pool
3. Test admin bypass
```

#### 2. Include Examples

```markdown
### Context

Use JWT with RSA-256, not HMAC.

**Why**: HMAC uses symmetric keys (distribution problem).

**Example**:
```typescript
// ✅ Correct
jwt.sign(payload, privateKey, { algorithm: 'RS256' });

// ❌ Avoid
jwt.sign(payload, secretKey, { algorithm: 'HS256' });
```

**Docs**: [JWT Guide](link)
```

#### 3. Use Appropriate Severity

| Critical | Warning | Info |
|----------|---------|------|
| Outage risk | Best practices | Documentation |
| Security holes | Performance | Standards |
| Data loss | Breaking changes | Patterns |
| Compliance | Tech debt | History |

#### 4. Keep Updated

```markdown
<!-- DECISION-OLD-001 -->
## Decision: Legacy Auth System

**Status**: Deprecated  
**Date**: 2023-05-10  
**Severity**: Warning  
**Superseded by**: DECISION-AUTH-002

**Files**:
- `src/auth/legacy/**/*`

### Context

Being phased out.

**Deadline**: 2025-03-01  
**New code**: Use DECISION-AUTH-002  
**Migration**: Q1 2025

---
```

#### 5. Organize by Domain

```
DECISION-DB-*       # Database
DECISION-API-*      # API
DECISION-SEC-*      # Security
DECISION-INFRA-*    # Infrastructure
DECISION-PERF-*     # Performance
```

### Team Workflows

#### Small Teams (<10 devs)

```yaml
decision_file: '.decispher/decisions.md'
fail_on_critical: false  # Start lenient
```

**Strategy**:
- Single file
- Mostly Info/Warning
- Liberal documentation

#### Medium Teams (10-50 devs)

```
.decispher/
├── decisions.md
├── rules/
│   └── security-common.json
├── backend/
│   └── decisions.md
└── frontend/
    └── decisions.md
```

```yaml
decision_file: '.decispher/'  # Directory scan
fail_on_critical: true
```

**Strategy**:
- Split by domain
- CODEOWNERS on `.decispher/`
- Quarterly reviews
- Enforce critical

#### Large Teams (50+ devs)

```
.decispher/
├── backend/
│   ├── api/
│   │   └── decisions.md
│   └── database/
│       └── decisions.md
├── frontend/
│   └── decisions.md
└── shared/
    └── security.md
```

```yaml
- uses: DecispherHQ/decision-guardian@v1
  with:
    decision_file: '.decispher/'
    fail_on_critical: true
```

**Strategy**:
- Federated ownership
- Decision review board
- Metrics tracking
- Strict governance

### Security Best Practices

#### 1. Never Commit Secrets

**Bad**:
```markdown
API_KEY: sk_live_abc123xyz  # ❌
```

**Good**:
```markdown
API keys in AWS Secrets Manager: /prod/api-keys/stripe
```

#### 2. Pattern Matching, Not Values

**Bad**:
```json
{
  "patterns": ["password123", "admin@example.com"]
}
```

**Good**:
```json
{
  "pattern": "(password|secret|token)\\s*[=:]\\s*['\"][^'\"]+['\"]",
  "flags": "i"
}
```

#### 3. Protect Decision File Itself

```markdown
<!-- DECISION-META-001 -->
## Decision: Decision Guardian Config

**Status**: Active  
**Severity**: Critical

**Files**:
- `.decispher/decisions.md`
- `.github/workflows/decision-guardian.yml`

### Context

Changes affect PR protection.

**Required**:
- Senior approval
- Test first
- Document changes

---
```

---

## API Reference

### Comment Format

Decision Guardian posts structured comments:

**Header**:
```markdown
<!-- decision-guardian-v1 -->
<!-- hash:abc123def456 -->

## ⚠️ Decision Context Alert

This PR modifies N file(s) protected by decisions.
```

**Sections by Severity**:
```markdown
### 🔴 Critical Decisions (N)

#### DECISION-ID: Title

**File**: `path/to/file.ts`  
**Matched**: `pattern`  
**Match Type**: File pattern | Rule-based  
**Date**: YYYY-MM-DD

Context text...

---

### 🟡 Important Decisions (N)
### ℹ️ Informational (N)
```

**Footer**:
```markdown
---
*🤖 Generated by Decision Guardian*
```

### Comment Behavior

1. **Idempotent**: Updates existing comment instead of creating new
2. **Hash-based**: Only updates if content changed
3. **Cleanup**: Auto-deletes duplicate comments
4. **Truncation**: Handles 65,536 char GitHub limit
   - Progressively reduces detail
   - Shows summary for large PRs
   - Hard truncates as last resort
5. **Retry**: 3 retries on conflict (409)

### Directory Scanning

When `decision_file` is a directory:

1. **Recursive scan**: All `.md` files in subdirectories
2. **Skips hidden**: `.git`, `.github`, etc. ignored
3. **Merges results**: All decisions combined
4. **Error handling**: Individual file failures logged, others continue

---

## FAQ

**Q: Can it prevent merges?**  
A: Yes, when `fail_on_critical: true`. Admins can override.

**Q: Works with monorepos?**  
A: Yes. Use path-specific patterns.

**Q: Works with private repos?**  
A: Yes. Uses `GITHUB_TOKEN`.

**Q: Other CI/CD platforms?**  
A: GitHub Actions only (for now).

**Q: Skip for specific PRs?**  
A: Add label condition:
```yaml
if: "!contains(github.event.pull_request.labels.*.name, 'skip-decisions')"
```

**Q: Difference vs CODEOWNERS?**  
A: CODEOWNERS = who reviews. Decision Guardian = why it matters. Use both.

---

## Support & Contributing

### Getting Help

1. **Documentation**: You're reading it
2. **Issues**: [GitHub Issues](https://github.com/DecispherHQ/decision-guardian/issues)
3. **Discussions**: [GitHub Discussions](https://github.com/DecispherHQ/decision-guardian/discussions)

### Contributing

Open source contributions welcome:
- Bug fixes
- Feature requests
- Documentation improvements
- Example decisions

See [CONTRIBUTING.md](https://github.com/DecispherHQ/decision-guardian/blob/main/Contributing.md)

### License

MIT License. Free for commercial and personal use.

---

## About the Author

**Decision Guardian** is created and maintained by **Ali Abbas** as part of the **Decispher** project.

Decispher is building tools to help engineering teams preserve and leverage institutional knowledge.

---

## Changelog

### v1.0.0 (2025-02-03)

**Initial Release**

✅ **Core Features**:
- File pattern matching (glob support)
- Advanced rules system (AND/OR, content matching)
- Severity levels (Critical/Warning/Info)
- Idempotent PR comments
- Directory scanning

✅ **Performance**:
- Trie-based pattern matching
- Streaming for large PRs (3K+ files)
- Regex caching
- Parallel processing

✅ **Security**:
- Path traversal protection
- ReDoS prevention (regex timeout + validation)
- VM sandbox for regex
- Input validation (zod)

---

**Decision Guardian** – Institutional memory for your codebase.

Built by [Ali Abbas](https://github.com/gr8-alizaidi) | [Decispher](https://github.com/decispher)