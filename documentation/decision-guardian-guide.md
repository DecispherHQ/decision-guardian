# Decision Guardian - Complete Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [What is Decision Guardian?](#what-is-decision-guardian)
3. [Quick Start](#quick-start)
4. [Installation & Integration](#installation--integration)
5. [The Decisions File](#the-decisions-file)
6. [Decision Format Reference](#decision-format-reference)
7. [Advanced Rules System](#advanced-rules-system)
8. [Configuration Options](#configuration-options)
9. [Use Cases & Examples](#use-cases--examples)
10. [Troubleshooting](#troubleshooting)
11. [Performance & Optimization](#performance--optimization)
12. [Best Practices](#best-practices)

---

## Introduction

Decision Guardian is a GitHub Action that automatically surfaces architectural decisions and important context when Pull Requests modify protected files. Instead of relying on institutional knowledge or hoping developers read documentation, Decision Guardian proactively alerts teams when changes touch sensitive areas of the codebase.

### Key Features

- **Automatic Context Surfacing**: Alerts appear as PR comments when protected files are modified
- **Severity Levels**: Categorize decisions as Critical, Warning, or Info
- **Advanced Pattern Matching**: Support for glob patterns, regex, content-based rules, and nested logic
- **Performance Optimized**: Handles PRs with thousands of files efficiently
- **Zero Configuration**: Works out-of-the-box with sensible defaults

---

## What is Decision Guardian?

Decision Guardian helps engineering teams by:

1. **Preserving Context**: Documents "why" certain files or patterns require careful review
2. **Onboarding New Developers**: Automatically educates team members about architectural decisions
3. **Preventing Technical Debt**: Surfaces warnings before problematic changes are merged
4. **Enforcing Standards**: Can fail PR checks for critical violations

### How It Works

1. You create a `decisions.md` file documenting architectural decisions
2. Add Decision Guardian to your GitHub Actions workflow
3. When a PR is opened, Decision Guardian:
   - Analyzes which files changed
   - Matches them against your documented decisions
   - Posts a comment with relevant context
   - Optionally fails the check for critical violations

---

## Quick Start

### 1. Create a Decisions File

Create `.decispher/decisions.md` in your repository:

```markdown
<!-- DECISION-DB-001 -->
## Decision: Database Connection Pool Configuration

**Status**: Active  
**Date**: 2025-01-15  
**Severity**: Critical

**Files**:
- `src/config/database.ts`
- `src/lib/db-pool.ts`

### Context

These files control database connection pooling. Changes here can cause:
- Connection exhaustion under load
- Memory leaks
- Performance degradation

Always load-test changes with production-like traffic patterns.

---
```

### 2. Add GitHub Action Workflow

Create `.github/workflows/decision-guardian.yml`:

```yaml
name: Decision Guardian

on:
  pull_request:

jobs:
  check-decisions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Decision Guardian
        uses: decispher/decision-guardian@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fail_on_critical: true
```

### 3. Test It

Create a PR that modifies `src/config/database.ts`. Decision Guardian will automatically post a comment with the context from `DECISION-DB-001`.

---

## Installation & Integration

### Prerequisites

- GitHub repository
- GitHub Actions enabled
- Node.js 20+ (handled automatically by the action)

### Step-by-Step Integration

#### Option 1: Standalone Workflow (Recommended)

Create `.github/workflows/decision-guardian.yml`:

```yaml
name: Decision Guardian

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  decision-check:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write  # Required to post comments
      contents: read
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Run Decision Guardian
        uses: decispher/decision-guardian@v1
        with:
          decision_file: '.decispher/decisions.md'
          fail_on_critical: true
          fail_on_error: false
          token: ${{ secrets.GITHUB_TOKEN }}
```

#### Option 2: Integrate with Existing CI Workflow

Add to your existing test workflow:

```yaml
name: CI

on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: npm test
      
      # Add Decision Guardian
      - name: Check Architectural Decisions
        uses: decispher/decision-guardian@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
```

### Permissions Required

Decision Guardian needs these GitHub permissions:

- `pull-requests: write` - To post/update comments
- `contents: read` - To read the decisions file

These are automatically granted when using `${{ secrets.GITHUB_TOKEN }}`.

---

## The Decisions File

The decisions file is a Markdown document containing structured architectural decisions. By default, Decision Guardian looks for `.decispher/decisions.md`, but you can customize this location.

### File Structure

```markdown
<!-- DECISION-ID -->
## Decision: Title

**Status**: Active  
**Date**: YYYY-MM-DD  
**Severity**: Critical|Warning|Info

**Files**:
- pattern1
- pattern2

### Context

Description of the decision and why it matters.

---

<!-- Next decision -->
```

### Decision ID Format

Decision IDs follow this pattern:

```
DECISION-[CATEGORY-]NUMBER

Examples:
- DECISION-001
- DECISION-DB-001
- DECISION-API-AUTH-001
- DECISION-SECURITY-XSS-001
```

**Rules**:
- Must start with `DECISION-`
- Can include category prefixes (DB, API, SECURITY, etc.)
- Must end with a number
- Use uppercase letters and hyphens only

### Organizing Multiple Decisions Files

For large repositories, you can split decisions across multiple files:

**Option 1: Multiple separate files**
```
.decispher/
├── decisions.md          # Main file
├── backend-decisions.md  # Backend-specific
└── frontend-decisions.md # Frontend-specific
```

Configure separate workflow jobs:
```yaml
- name: Check Backend Decisions
  uses: decispher/decision-guardian@v1
  with:
    decision_file: '.decispher/backend-decisions.md'

- name: Check Frontend Decisions
  uses: decispher/decision-guardian@v1
  with:
    decision_file: '.decispher/frontend-decisions.md'
```

**Option 2: Directory-based organization (NEW)**

You can now provide a directory path instead of a single file. Decision Guardian will automatically discover and parse all `.md` files in that directory and its subdirectories:

```yaml
- name: Check All Decisions
  uses: decispher/decision-guardian@v1
  with:
    decision_file: '.decispher/'  # Points to directory
```

Directory structure example:
```
.decispher/
├── backend/
│   ├── database.md
│   ├── api.md
│   └── auth.md
├── frontend/
│   ├── components.md
│   └── routing.md
└── infrastructure/
    ├── docker.md
    └── kubernetes.md
```

**Benefits**:
- Automatic discovery of new decision files
- Better organization by domain/team
- Cleaner repository structure
- No need to update workflow when adding new decision files

**Note**: Hidden directories (starting with `.`) like `.git` are automatically skipped.

---

## Decision Format Reference

### Required Fields

#### Decision Marker

```markdown
<!-- DECISION-ID -->
```

This unique identifier must be the first line of each decision block.

#### Title

```markdown
## Decision: Your Decision Title
```

A clear, descriptive title explaining what the decision covers.

#### Status

```markdown
**Status**: Active
```

**Valid Values**:
- `Active` / `Enabled` / `Live` - Currently enforced
- `Deprecated` / `Obsolete` - Still in code but being phased out
- `Superseded` / `Replaced` - Replaced by another decision
- `Archived` / `Inactive` - No longer relevant

**Only `Active` decisions trigger alerts.**

#### Date

```markdown
**Date**: 2025-01-15
```

**Format**: `YYYY-MM-DD` (ISO 8601)

This tracks when the decision was made. Decision Guardian will warn if:
- Date is in the future
- Date is more than 10 years old (suggesting it should be reviewed)

#### Severity

```markdown
**Severity**: Critical
```

**Valid Values**:

| Severity | Synonyms | Use Case | Fails PR? |
|----------|----------|----------|-----------|
| `Info` | `Informational`, `Low` | FYI notices, documentation | No |
| `Warning` | `Warn`, `Medium` | Important but not blocking | No |
| `Critical` | `Error`, `High`, `Blocker` | Must be reviewed carefully | Yes (if `fail_on_critical: true`) |

#### Files

```markdown
**Files**:
- `src/config/*.ts`
- `lib/security/**/*.js`
- `!lib/security/tests/**`
```

File patterns use glob syntax:

| Pattern | Matches |
|---------|---------|
| `*.ts` | All TypeScript files in current directory |
| `**/*.ts` | All TypeScript files in any subdirectory |
| `src/config/*.ts` | TypeScript files in `src/config/` only |
| `!pattern` | Exclude files matching pattern |

**Examples**:

```markdown
**Files**:
- `package.json`                    # Exact file
- `src/**/*.ts`                     # All TS files under src/
- `*.config.js`                     # All config files
- `migrations/**/*.sql`             # All SQL migrations
- `!migrations/**/test_*.sql`       # Exclude test migrations
```

#### Context

```markdown
### Context

This is where you explain:
- Why this decision was made
- What developers should know
- What to watch out for
- Links to related documentation
```

The context section is the most important part. Make it:
- Clear and actionable
- Specific about risks
- Include examples where helpful
- Link to deeper documentation

---

## Advanced Rules System

For complex matching scenarios, Decision Guardian supports a JSON-based rules system alongside file patterns.

### When to Use Advanced Rules

Use advanced rules when you need to:
- Match specific code patterns (not just files)
- Combine multiple conditions with AND/OR logic
- Match content within diffs (added/modified lines)
- Exclude certain files from broad patterns
- Create conditional logic (e.g., "if file X changes AND contains pattern Y")

### Basic Rule Structure

#### Inline Rules

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

This rule triggers when:
1. Any TypeScript file under `src/` is modified, AND
2. The changes contain `process.env` or `API_KEY`

#### External Rule Files

For complex rules or reusable rule sets, you can reference external JSON files:

```markdown
**Rules**: [Security Rules](./rules/security-rules.json)
```

Or simply:

```markdown
**Rules**: ./rules/database-rules.json
```

The external file should contain valid JSON matching the rule structure:

```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "src/db/**/*.ts",
      "content_rules": [
        {
          "mode": "string",
          "patterns": ["DROP TABLE", "TRUNCATE"]
        }
      ]
    }
  ]
}
```

**Benefits of external files**:
- Reuse rules across multiple decisions
- Keep decision files cleaner and more readable
- Share rule libraries across repositories
- Version control complex rule logic separately

### Rule Types

#### File Rules

Match files by glob pattern, optionally with content matching:

```json
{
  "type": "file",
  "pattern": "src/api/**/*.ts",
  "exclude": "src/api/**/*.test.ts",
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
- `pattern`: Glob pattern for file paths
- `exclude`: Optional glob to exclude files
- `content_rules`: Array of content matching rules (see below)

### Content Matching Modes

#### 1. String Mode

Match exact strings in changed lines:

```json
{
  "mode": "string",
  "patterns": ["TODO", "FIXME", "console.log"]
}
```

**Use for**: Simple keyword matching

#### 2. Regex Mode

Match using regular expressions:

```json
{
  "mode": "regex",
  "pattern": "password\\s*=\\s*['\"]",
  "flags": "i"
}
```

**Flags**:
- `i` - Case insensitive
- `m` - Multiline
- `g` - Global

**Security**: Decision Guardian runs regex with a 5-second timeout and rejects unsafe patterns to prevent ReDoS attacks.

**Use for**: Complex pattern matching, validation checks

#### 3. Line Range Mode

Match changes in specific line numbers:

```json
{
  "mode": "line_range",
  "start": 1,
  "end": 50
}
```

**Use for**: Protecting specific sections (e.g., license headers, config blocks)

#### 4. Full File Mode

Match any change to the file:

```json
{
  "mode": "full_file"
}
```

**Use for**: Files that always need review regardless of what changed

#### 5. JSON Path Mode (Experimental)

Match changes to specific JSON keys:

```json
{
  "mode": "json_path",
  "paths": ["$.database.pool_size", "$.api.timeout"]
}
```

**Use for**: Configuration files where only certain fields matter

### Complex Rule Logic

#### AND Logic (All conditions must match)

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

This triggers only if BOTH auth and database files are changed.

#### OR Logic (Any condition matches)

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

This triggers if EITHER Docker file is changed.

#### Nested Logic

Combine AND/OR for complex scenarios:

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

This reads as: "Alert if (API files with fetch/axios changes) AND (config OR http-client file changed)"

**Nesting Limit**: Maximum 10 levels deep to prevent stack overflow

### Complete Example

```markdown
<!-- DECISION-SEC-001 -->
## Decision: Prevent Hardcoded Credentials

**Status**: Active  
**Date**: 2025-01-15  
**Severity**: Critical

**Files**:
- `src/**/*.ts`
- `src/**/*.js`

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
          "patterns": ["PASSWORD=", "API_KEY=", "SECRET="]
        }
      ]
    }
  ]
}
```

### Context

This decision prevents hardcoded credentials in source code.

**What triggers an alert**:
- Any JS/TS file (excluding tests) containing patterns like `password = "xyz"`, `apiKey: "abc"`, etc.
- .env files with PASSWORD, API_KEY, or SECRET assignments

**What to do**:
- Use environment variables
- Use secret management services (AWS Secrets Manager, HashiCorp Vault)
- Never commit credentials to git

**Related docs**: [Security Guidelines](link)

---
```

---

## Configuration Options

### Action Inputs

Configure Decision Guardian in your workflow file:

```yaml
- uses: decispher/decision-guardian@v1
  with:
    decision_file: '.decispher/decisions.md'
    fail_on_critical: true
    fail_on_error: false
    telemetry_enabled: false
    token: ${{ secrets.GITHUB_TOKEN }}
```

#### `decision_file`

**Type**: String  
**Default**: `.decispher/decisions.md`  
**Required**: No

Path to your decisions file (relative to repository root).

**Examples**:
```yaml
decision_file: 'docs/architecture/decisions.md'
decision_file: '.github/decisions.md'
decision_file: 'decisions.md'
```

**Security**: Path must be relative (not absolute) and cannot contain `..` to prevent path traversal attacks.

#### `fail_on_critical`

**Type**: Boolean  
**Default**: `false`  
**Required**: No

Whether to fail the PR check when Critical decisions are violated.

**Recommended**: `true` for production projects

**Example**:
```yaml
fail_on_critical: true  # PR check fails if critical files modified
```

When `true`:
- PR status check shows ❌ if critical decisions match
- Prevents accidental merging of risky changes
- Can be overridden by admins if necessary

When `false`:
- PR status check always passes ✅
- Comments still appear with context
- Purely informational

#### `fail_on_error`

**Type**: Boolean  
**Default**: `false`  
**Required**: No

Whether to fail the action if the decisions file has parse errors.

**Recommended**: `false` (be lenient with syntax errors)

**Example**:
```yaml
fail_on_error: true  # Strict mode - any parse errors fail the check
```

Parse errors include:
- Invalid decision ID format
- Malformed JSON rules
- Missing required fields
- Invalid date formats

When `false`: Warnings are logged but the action continues.

#### `telemetry_enabled`

**Type**: Boolean  
**Default**: `false`  
**Required**: No

Enable anonymous telemetry to help improve Decision Guardian.

**Data collected** (when enabled):
- Number of decisions processed
- Number of matches found
- Performance metrics (duration, file count)
- Error types (no sensitive data)

**Not collected**:
- Repository names
- File contents
- Decision contents
- User information

```yaml
telemetry_enabled: true
```

#### `token`

**Type**: String  
**Default**: `${{ github.token }}`  
**Required**: Yes

GitHub token for API access. Always use the automatic token:

```yaml
token: ${{ secrets.GITHUB_TOKEN }}
```

**Do not** use a personal access token (PAT) unless you need specific permissions.

### Action Outputs

Decision Guardian sets these outputs for use in subsequent workflow steps:

```yaml
- uses: decispher/decision-guardian@v1
  id: decision-check
  with:
    token: ${{ secrets.GITHUB_TOKEN }}

- name: Use outputs
  run: |
    echo "Matches found: ${{ steps.decision-check.outputs.matches_found }}"
    echo "Critical count: ${{ steps.decision-check.outputs.critical_count }}"
```

#### `matches_found`

**Type**: Number

Total number of decision matches found.

#### `critical_count`

**Type**: Number

Number of Critical severity matches.

#### `metrics`

**Type**: JSON String

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

## Use Cases & Examples

### Example 1: Database Migration Safety

**Scenario**: Prevent database schema changes without proper review

```markdown
<!-- DECISION-DB-MIGRATION-001 -->
## Decision: Database Schema Changes

**Status**: Active  
**Date**: 2025-01-10  
**Severity**: Critical

**Files**:
- `prisma/schema.prisma`
- `migrations/**/*.sql`
- `src/db/schema.ts`

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
- Breaking changes for deployed services

**Required before merging**:
1. DBA review
2. Backup verification
3. Rollback plan documented
4. Load test completed
5. Migration tested on staging

**Documentation**: [Migration Runbook](link)

---
```

### Example 2: API Contract Changes

**Scenario**: Alert when public API contracts change

```markdown
<!-- DECISION-API-001 -->
## Decision: Public API Contract Protection

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

Changes to v1 API routes affect external clients.

**Before merging**:
- Update API documentation
- Notify integration partners
- Consider deprecation path
- Add to changelog

**Breaking changes require**: Major version bump and migration guide

---
```

### Example 3: Security-Sensitive Files

**Scenario**: Protect authentication and authorization code

```markdown
<!-- DECISION-SEC-AUTH-001 -->
## Decision: Authentication System Protection

**Status**: Active  
**Date**: 2025-01-08  
**Severity**: Critical

**Files**:
- `src/auth/**/*`
- `src/middleware/auth.ts`
- `src/lib/jwt.ts`

**Rules**:
```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "src/auth/**/*.ts"
    },
    {
      "type": "file",
      "pattern": "src/**/*.ts",
      "content_rules": [
        {
          "mode": "string",
          "patterns": [
            "jwt.sign",
            "bcrypt",
            "crypto.createHmac",
            "passport.authenticate"
          ]
        }
      ]
    }
  ]
}
```

### Context

Authentication bugs can lead to:
- Account takeovers
- Data breaches
- Compliance violations

**Required reviews**:
- Security team approval
- Penetration testing
- Session management audit

**Testing checklist**:
- [ ] Unit tests for all auth paths
- [ ] Integration tests with real tokens
- [ ] Test with expired/invalid tokens
- [ ] Test permission boundaries

---
```

### Example 4: Performance-Critical Code

**Scenario**: Flag changes to hot paths

```markdown
<!-- DECISION-PERF-001 -->
## Decision: Performance-Critical Path Protection

**Status**: Active  
**Date**: 2025-01-05  
**Severity**: Warning

**Files**:
- `src/services/search.ts`
- `src/lib/cache.ts`

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

These files handle 10K+ requests/second. Changes here impact:
- API response times
- Server CPU usage
- User experience

**Before merging**:
- Run performance benchmarks
- Compare against baseline metrics
- Check for O(n²) complexity
- Profile with production data

**Benchmark script**: `npm run benchmark`

---
```

### Example 5: Configuration File Changes

**Scenario**: Require approval for infrastructure config

```markdown
<!-- DECISION-INFRA-001 -->
## Decision: Infrastructure Configuration Protection

**Status**: Active  
**Date**: 2025-01-03  
**Severity**: Critical

**Files**:
- `Dockerfile`
- `docker-compose.yml`
- `k8s/**/*.yaml`
- `.github/workflows/*.yml`

**Rules**:
```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "{Dockerfile,docker-compose.yml}"
    },
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
  ]
}
```

### Context

Infrastructure changes affect:
- Production deployments
- Cost (resource limits)
- Availability (replicas)
- Security (container config)

**Required before merging**:
- DevOps team review
- Staging deployment test
- Rollback plan
- Monitoring alerts updated

---
```

---

## Troubleshooting

### Common Issues

#### Issue: "Not a pull request event, skipping comment"

**Cause**: Decision Guardian only runs on pull request events, but workflow triggered on push to main.

**Solution**: Update your workflow trigger:

```yaml
on:
  pull_request:  # ✅ Correct
  # Don't use: push, schedule, etc. for comment posting
```

#### Issue: "Failed to read file: ENOENT"

**Cause**: Decisions file not found at specified path.

**Solution**: 
1. Verify the file exists: `ls .decispher/decisions.md`
2. Check the path in your workflow:
   ```yaml
   decision_file: '.decispher/decisions.md'  # Must match actual location
   ```
3. Ensure the file is committed to git

#### Issue: "Security: Path traversal detected"

**Cause**: Invalid file path with `..` or absolute path.

**Solution**: Use relative paths only:

```yaml
decision_file: '.decispher/decisions.md'  # ✅ Correct
decision_file: '../decisions.md'          # ❌ Invalid
decision_file: '/etc/decisions.md'        # ❌ Invalid
```

#### Issue: Parse errors in decisions file

**Cause**: Malformed markdown or invalid JSON rules.

**Solution**: Check the workflow logs for specific errors:

```
Warning: Line 45: Decision missing required fields (id or title)
Warning: DECISION-001: Failed to parse JSON rules: Unexpected token
```

Common fixes:
- Ensure decision ID is in `<!-- DECISION-ID -->` format
- Validate JSON rules with a JSON validator
- Check all required fields are present
- Use correct field names (case-sensitive)

#### Issue: "Rate limit hit"

**Cause**: GitHub API rate limit exceeded (rare, usually only with 3000+ file PRs).

**Solution**: Decision Guardian automatically retries with exponential backoff. If it fails:

1. Wait for rate limit to reset (shown in error)
2. Re-run the workflow
3. For chronic issues, split large PRs into smaller ones

#### Issue: No comment posted on PR

**Possible causes**:

1. **No matches found** - Check if files in PR actually match decision patterns:
   ```bash
   # Test pattern matching locally
   echo "src/config/database.ts" | grep -E "src/config/.*\.ts"
   ```

2. **Permissions issue** - Ensure workflow has `pull-requests: write`:
   ```yaml
   permissions:
     pull-requests: write
     contents: read
   ```

3. **Decision status not Active** - Only Active decisions trigger alerts:
   ```markdown
   **Status**: Active  # Must be Active, not Deprecated/Archived
   ```

#### Issue: Comment not updating, creating duplicates

**Cause**: Concurrent workflow runs or race condition (very rare).

**Solution**: Decision Guardian has built-in duplicate cleanup. If you see duplicates:

1. They'll be auto-cleaned on next run
2. Manually delete extra comments if needed
3. Enable concurrency control in workflow:
   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.event.pull_request.number }}
     cancel-in-progress: true
   ```

### Debug Mode

Enable debug logging:

```yaml
- uses: decispher/decision-guardian@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
  env:
    ACTIONS_STEP_DEBUG: true
```

This outputs detailed logs including:
- File matching decisions
- Rule evaluation steps
- API calls and responses
- Performance metrics

---

## Performance & Optimization

### How Decision Guardian Handles Large PRs

Decision Guardian is optimized for performance:

| PR Size | Strategy | Performance |
|---------|----------|-------------|
| < 100 files | Single batch fetch | ~2-5 seconds |
| 100-1000 files | Parallel processing | ~5-15 seconds |
| 1000-3000 files | Streaming mode | ~15-45 seconds |
| 3000+ files | Paginated with limit | ~45-120 seconds |

### Optimization Techniques Used

1. **Pattern Trie**: O(1) candidate lookup instead of O(n×m) brute force
2. **Caching**: Regex results cached to avoid re-evaluation
3. **Parallel Processing**: Batch rule evaluation with Promise.allSettled
4. **Streaming**: Memory-efficient processing for huge PRs
5. **Early Termination**: Stop matching once enough context found

### Performance Monitoring

Check the metrics output:

```json
{
  "api_calls": 5,
  "files_processed": 237,
  "decisions_evaluated": 15,
  "duration_ms": 4521
}
```

**Typical benchmarks**:
- 1 API call per 100 files
- 10-50ms per decision evaluation
- Sub-second for simple pattern matching
- 1-5 seconds for complex rules with regex

### Tips for Faster Runs

1. **Use specific patterns** instead of broad wildcards:
   ```markdown
   src/config/*.ts          # ✅ Fast
   **/*.ts                  # ⚠️ Slower (scans entire repo)
   ```

2. **Limit regex complexity**:
   ```json
   "pattern": "fetch\\("         # ✅ Fast
   "pattern": "(fetch|axios|http|request)\\([^)]*\\)"  # ⚠️ Slower
   ```

3. **Use file patterns** over content rules when possible:
   ```markdown
   Files: src/api/auth.ts   # ✅ Fastest
   Rules: { regex match }   # ⚠️ Requires diff parsing
   ```

4. **Group related decisions**:
   ```markdown
   # Instead of 10 decisions for 10 files
   # Use 1 decision with 10 file patterns
   Files:
   - src/auth/*.ts
   - src/api/*.ts
   - ...
   ```

---

## Best Practices

### Writing Effective Decisions

#### 1. Be Specific and Actionable

**Bad**:
```markdown
### Context
This is important. Be careful.
```

**Good**:
```markdown
### Context
This file controls rate limiting. Changes here can:
- Block legitimate users if too strict
- Allow abuse if too lenient
- Cause OOM if configured incorrectly

Before merging:
1. Load test with 2x expected traffic
2. Verify Redis connection pool settings
3. Test rate limit bypass for admins
```

#### 2. Include Links and Examples

```markdown
### Context

API authentication tokens must use JWT with RSA-256 signing.

**Why**: HMAC-SHA256 uses symmetric keys, creating key distribution problems.

**Examples**:
```typescript
// ✅ Correct
const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

// ❌ Avoid
const token = jwt.sign(payload, secretKey, { algorithm: 'HS256' });
```

**Related docs**: 
- [JWT Best Practices](https://example.com/jwt-guide)
- [Key Management](https://example.com/keys)
- [Security Audit Results](https://example.com/audit-2024)
```

#### 3. Use Appropriate Severity Levels

| Use Critical When | Use Warning When | Use Info When |
|-------------------|------------------|---------------|
| Production outage risk | Best practice violations | FYI documentation |
| Security vulnerabilities | Performance concerns | Coding standards |
| Data loss possible | Breaking API changes | Design patterns |
| Compliance violation | Tech debt | Historical context |

#### 4. Keep Decisions Updated

```markdown
<!-- DECISION-OLD-001 -->
## Decision: Legacy Authentication System

**Status**: Deprecated  
**Date**: 2023-05-10  
**Severity**: Warning

**Superseded by**: DECISION-AUTH-002

**Files**:
- `src/auth/legacy/**/*`

### Context

This authentication system is being phased out.

**Migration deadline**: 2025-03-01

**New implementations**: Use DECISION-AUTH-002 instead
**Existing code**: Will be migrated in Q1 2025

---
```

#### 5. Organize by Domain

Use consistent ID prefixes:

```
DECISION-DB-*       # Database decisions
DECISION-API-*      # API decisions
DECISION-SEC-*      # Security decisions
DECISION-INFRA-*    # Infrastructure decisions
DECISION-PERF-*     # Performance decisions
DECISION-UI-*       # Frontend/UI decisions
```

### Team Workflow Recommendations

#### For Small Teams (< 10 developers)

1. **Single decisions file**: `.decispher/decisions.md`
2. **Liberal use**: Document anything worth remembering
3. **Quick updates**: Edit directly in PRs
4. **Severity**: Mostly Info and Warning, few Critical

**Example workflow**:
```markdown
<!-- DECISION-TEAM-001 -->
## Decision: PR Review Requirements

**Status**: Active  
**Date**: 2025-01-15  
**Severity**: Info

**Files**:
- `.github/CODEOWNERS`

### Context

All PRs require 1 approval. Critical files need 2.

Critical files are marked in CODEOWNERS.
```

**Recommended directory structure**:
```
.decispher/
├── README.md              # Overview of your decision process
├── general/
│   └── pr-process.md
├── backend/
│   └── decisions.md
└── frontend/
    └── decisions.md
```

Then configure:
```yaml
- uses: decispher/decision-guardian@v1
  with:
    decision_file: '.decispher/'  # Auto-discovers all .md files
```

#### For Medium Teams (10-50 developers)

1. **Organized decisions**: Split by domain
2. **Clear ownership**: Use CODEOWNERS with decisions file
3. **Regular review**: Quarterly decision audit
4. **Severity enforcement**: Use `fail_on_critical: true`

**Directory structure**:
```
.decispher/
├── decisions.md              # Cross-cutting concerns
├── rules/                    # Shared rule libraries
│   ├── security-common.json
│   └── performance-common.json
├── backend/
│   └── backend-decisions.md
├── frontend/
│   └── frontend-decisions.md
└── infrastructure/
    └── infra-decisions.md
```

**Workflow configuration**:
```yaml
- name: Check All Decisions
  uses: decispher/decision-guardian@v1
  with:
    decision_file: '.decispher/'  # Recursively finds all .md files
    fail_on_critical: true
```

**Decision file example using shared rules**:
```markdown
<!-- DECISION-SEC-001 -->
## Decision: Authentication Security

**Status**: Active  
**Date**: 2025-01-15  
**Severity**: Critical

**Files**:
- `src/auth/**/*.ts`

**Rules**: ./rules/security-common.json

### Context

See shared security rules for details on what triggers alerts.
```

#### For Large Teams (50+ developers)

1. **Federated decisions**: Each team owns their file
2. **Strict governance**: Decision review board
3. **Automated compliance**: Critical decisions enforced
4. **Metrics tracking**: Monitor decision violation rates

**Advanced setup with directory scanning**:
```yaml
# Single job scans entire decision directory tree
- name: Check All Team Decisions
  uses: decispher/decision-guardian@v1
  with:
    decision_file: '.decispher/'  # Scans all subdirectories
    fail_on_critical: true

# Or if you want separate checks per team:
- name: Check Backend Decisions
  uses: decispher/decision-guardian@v1
  with:
    decision_file: '.decispher/backend/'
    fail_on_critical: true

- name: Check Frontend Decisions
  uses: decispher/decision-guardian@v1
  with:
    decision_file: '.decispher/frontend/'
    fail_on_critical: true
```

**Team structure example**:
```
.decispher/
├── backend/
│   ├── api/
│   │   ├── rest-api.md
│   │   └── graphql.md
│   ├── database/
│   │   └── migrations.md
│   └── rules/
│       └── backend-common.json
├── frontend/
│   ├── components/
│   │   └── ui-library.md
│   └── state/
│       └── redux.md
└── shared/
    └── security.md
```

### Decision Lifecycle Management

#### Creating a New Decision

1. **Identify the need**: What keeps breaking? What needs protection?
2. **Document clearly**: Use the template below
3. **Set appropriate severity**: Start conservative (Info), increase if needed
4. **Review with team**: Get feedback on wording and scope
5. **Merge and announce**: Let team know it's active

**Template**:
```markdown
<!-- DECISION-XXX-NNN -->
## Decision: [Clear, Descriptive Title]

**Status**: Active  
**Date**: YYYY-MM-DD  
**Severity**: [Info|Warning|Critical]

**Files**:
- `pattern/one`
- `pattern/two`

### Context

**What**: Brief description of what this protects

**Why**: Reason for the decision

**Impact**: What happens if ignored

**Actions required**: What reviewers should do

**Related**: Links to docs, ADRs, tickets

---
```

#### Updating an Existing Decision

```markdown
<!-- DECISION-DB-001 -->
## Decision: Database Connection Pooling

**Status**: Active  
**Date**: 2025-01-15  
**Severity**: Critical
**Last Updated**: 2025-01-20  
**Updated By**: @username

**Files**:
- `src/config/database.ts`
- `src/lib/db-pool.ts`

### Context

[Updated context with new information]

**Update notes**:
- 2025-01-20: Added max_connections limit warning
- 2025-01-15: Initial version

---
```

#### Deprecating a Decision

```markdown
<!-- DECISION-OLD-LOGGING-001 -->
## Decision: Winston Logger Configuration

**Status**: Deprecated  
**Date**: 2023-06-01  
**Severity**: Warning
**Deprecated Date**: 2025-01-15
**Superseded By**: DECISION-LOGGING-002

**Files**:
- `src/config/winston.ts`

### Context

This decision is deprecated. Use structured logging (DECISION-LOGGING-002) instead.

**Migration guide**: [Link to migration doc]

**Deprecation timeline**:
- 2025-01-15: Marked deprecated
- 2025-03-01: Will change to Archived
- 2025-06-01: Old code will be removed

---
```

#### Archiving a Decision

```markdown
<!-- DECISION-ANCIENT-001 -->
## Decision: Legacy Build System

**Status**: Archived  
**Date**: 2020-03-10  
**Archived Date**: 2025-01-15
**Severity**: Info

**Files**:
- `gulpfile.js` (removed)
- `build/legacy/**` (removed)

### Context

This decision is archived for historical reference only.

**What it was**: Gulp-based build system used 2020-2024

**Why archived**: Migrated to Vite (DECISION-BUILD-003)

**Code removed**: 2024-12-15

---
```

### Security Best Practices

#### 1. Never Commit Secrets in Decisions

**Bad**:
```markdown
API_KEY: sk_live_abc123xyz  # ❌ NEVER DO THIS
```

**Good**:
```markdown
API keys must be stored in AWS Secrets Manager.
Path: `/prod/api-keys/stripe`
```

#### 2. Use Pattern Matching, Not Hardcoded Values

**Bad**:
```json
{
  "mode": "string",
  "patterns": ["password123", "admin@example.com"]
}
```

**Good**:
```json
{
  "mode": "regex",
  "pattern": "(password|secret|token)\\s*[=:]\\s*['\"][^'\"]+['\"]",
  "flags": "i"
}
```

#### 3. Protect the Decisions File Itself

```markdown
<!-- DECISION-META-001 -->
## Decision: Decision Guardian Configuration Protection

**Status**: Active  
**Date**: 2025-01-15  
**Severity**: Critical

**Files**:
- `.decispher/decisions.md`
- `.github/workflows/decision-guardian.yml`

### Context

Changes to Decision Guardian config affect PR protection.

**Required**:
- Senior engineer approval
- Test on a test PR first
- Document changes in commit message

---
```

### Advanced Patterns

#### Pattern 1: Multi-Repo Consistency

For organizations with multiple repos:

**Create a shared decisions template**:
```
shared-decisions/
├── security-decisions.md
├── database-decisions.md
└── api-decisions.md
```

**Import in each repo**:
```bash
# In CI or setup script
curl -o .decispher/security.md https://internal.example.com/shared-decisions/security-decisions.md
```

#### Pattern 2: Dynamic Decision Generation

Generate decisions from other sources:

```yaml
# .github/workflows/generate-decisions.yml
name: Generate Decisions

on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Generate from ADRs
        run: |
          node scripts/adr-to-decisions.js
          
      - name: Commit if changed
        run: |
          git config user.name "Decision Bot"
          git config user.email "bot@example.com"
          git add .decispher/decisions.md
          git commit -m "Update decisions from ADRs" || true
          git push
```

#### Pattern 3: Integration with Other Tools

**With Danger.js**:
```javascript
// dangerfile.js
import { danger, warn } from 'danger';

// Complement Decision Guardian with additional checks
const modifiedFiles = danger.git.modified_files;

if (modifiedFiles.includes('package.json')) {
  warn('📦 package.json modified - review dependencies for security issues');
}
```

**With Reviewdog**:
```yaml
- name: Run Decision Guardian
  uses: decispher/decision-guardian@v1
  
- name: Reviewdog annotations
  uses: reviewdog/action-eslint@v1
```

### Testing Your Decisions

#### Test Decision Matching Locally

Create a test script:

```bash
#!/bin/bash
# test-decisions.sh

echo "Testing decision patterns..."

# Test 1: Database files
echo "✓ Testing DECISION-DB-001"
if echo "src/config/database.ts" | grep -qE "src/config/.*\.ts"; then
  echo "  ✓ Pattern matches"
else
  echo "  ✗ Pattern failed"
fi

# Test 2: Exclusions
echo "✓ Testing exclusions"
if echo "src/api/test.ts" | grep -qE "src/api/.*\.ts" && \
   ! echo "src/api/test.ts" | grep -qE "\.test\.ts"; then
  echo "  ✗ Should be excluded"
else
  echo "  ✓ Correctly excluded"
fi
```

#### Create Test PRs

Set up test PRs to validate your decisions:

```markdown
# .github/PULL_REQUEST_TEMPLATE/decision-test.md

## Decision Guardian Test PR

This PR tests decision: DECISION-XXX-NNN

**Expected behavior**:
- [ ] Comment should appear
- [ ] Severity should be: [Critical/Warning/Info]
- [ ] Should match files: [list]

**Actual behavior**:
[Fill after running]
```

### Monitoring and Metrics

#### Track Decision Violations

Use GitHub Actions outputs:

```yaml
- name: Run Decision Guardian
  id: decisions
  uses: decispher/decision-guardian@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}

- name: Report Metrics
  run: |
    echo "Matches: ${{ steps.decisions.outputs.matches_found }}"
    echo "Critical: ${{ steps.decisions.outputs.critical_count }}"
    
    # Send to monitoring system
    curl -X POST https://metrics.example.com/api/decisions \
      -d "matches=${{ steps.decisions.outputs.matches_found }}" \
      -d "critical=${{ steps.decisions.outputs.critical_count }}"
```

#### Dashboard Example

Track over time:
- Most frequently violated decisions
- Average time to resolve critical violations
- Decisions that need updating (old dates)
- Decision coverage (% of files protected)

### Migration Guide

#### Migrating from Manual PR Comments

**Before**: Team members manually comment on PRs

**After**: Automated with Decision Guardian

**Steps**:

1. **Audit existing comments**: What knowledge exists in old PR discussions?
2. **Document patterns**: Create decisions for recurring comments
3. **Start with Info severity**: Non-blocking at first
4. **Gather feedback**: Iterate on wording
5. **Increase severity**: Move to Warning/Critical as needed

#### Migrating from CODEOWNERS

**Before**: CODEOWNERS for required reviewers

**After**: Use both - CODEOWNERS + Decision Guardian

```
# CODEOWNERS - Who reviews
src/auth/**     @security-team
src/db/**       @database-team

# decisions.md - What to review for
DECISION-SEC-001: Security patterns
DECISION-DB-001: Database migration safety
```

**Benefits of using both**:
- CODEOWNERS: Enforces reviewers
- Decision Guardian: Provides context

#### Migrating from ADRs (Architecture Decision Records)

If you have ADRs in `docs/adr/`:

**Option 1: Reference ADRs**
```markdown
<!-- DECISION-ARCH-001 -->
## Decision: Microservices Communication Pattern

**Status**: Active  
**Date**: 2025-01-10  
**Severity**: Warning

**Files**:
- `services/*/src/api/**/*.ts`

### Context

See ADR-015 for full rationale: [link](docs/adr/015-service-communication.md)

**Quick summary**: All service-to-service calls must use gRPC, not HTTP REST.

---
```

**Option 2: Convert ADRs to Decisions**
```bash
# Script to convert ADRs
for adr in docs/adr/*.md; do
  echo "<!-- DECISION-ADR-$(basename $adr .md) -->" >> decisions.md
  echo "## Decision: $(grep '^# ' $adr | sed 's/# //')" >> decisions.md
  # ... extract other fields
done
```

### Troubleshooting Advanced Scenarios

#### Scenario: Decision Comment Not Appearing

**Debug checklist**:

1. Verify decision status:
   ```markdown
   **Status**: Active  # Must be Active, not Deprecated
   ```

2. Test pattern matching:
   ```bash
   # Check if your file matches the pattern
   # Use https://globster.xyz/ to test glob patterns
   ```

3. Check file normalization:
   ```bash
   # Windows paths use backslashes, Decision Guardian normalizes to forward slashes
   # src\config\db.ts → src/config/db.ts
   ```

4. Verify PR contains actual changes:
   ```bash
   # Decision Guardian only checks modified/added files
   # Renamed-only or deleted-only won't trigger
   ```

5. Check GitHub Actions logs:
   ```
   Loaded 15 decisions (with advanced rules)
   PR modifies 3 files
   Found 0 matches  # ← Issue is here
   ```

#### Scenario: Too Many False Positives

**Solutions**:

1. **Narrow file patterns**:
   ```markdown
   # Too broad
   **/*.ts
   
   # Better
   src/api/v1/**/*.ts
   ```

2. **Add exclusions**:
   ```json
   {
     "type": "file",
     "pattern": "src/**/*.ts",
     "exclude": "**/*.{test,spec}.ts"
   }
   ```

3. **Use content rules**:
   ```json
   {
     "type": "file",
     "pattern": "src/**/*.ts",
     "content_rules": [
       {
         "mode": "string",
         "patterns": ["database", "connection"]
       }
     ]
   }
   ```

4. **Lower severity**:
   ```markdown
   # Change from Critical to Info
   **Severity**: Info
   ```

#### Scenario: Performance Issues with Large PRs

**Symptoms**: Action takes > 60 seconds, times out, or fails

**Solutions**:

1. **Simplify patterns**:
   ```markdown
   # Avoid very broad patterns
   **/**/***  # ❌ Too broad
   
   # Use specific paths
   src/specific-dir/**/*.ts  # ✅ Better
   ```

2. **Reduce regex complexity**:
   ```json
   {
     "mode": "regex",
     "pattern": "simple.*pattern"  # ✅ Fast
     // Avoid: "((complex|nested)+|(patterns)*)*"  ❌ Slow
   }
   ```

3. **Batch decisions**:
   ```markdown
   # Instead of 50 small decisions
   # Create 5 larger decisions with multiple patterns
   ```

4. **Use file patterns over content rules**:
   ```markdown
   # Faster
   **Files**: src/api/auth.ts
   
   # Slower (requires diff parsing)
   **Rules**: { content_rules: [...] }
   ```

#### Scenario: Regex Pattern Security Warnings

**Error**: `[Security] Unsafe regex pattern rejected`

**Cause**: Pattern could cause ReDoS (Regular Expression Denial of Service)

**Solution**: Simplify the regex:

```json
// ❌ Unsafe (catastrophic backtracking)
"pattern": "(a+)+"

// ✅ Safe
"pattern": "a+"

// ❌ Unsafe
"pattern": "(.*)*"

// ✅ Safe
"pattern": ".*"
```

Use tools like [regex101.com](https://regex101.com/) to test patterns.

### FAQ

#### Q: Can Decision Guardian prevent merges?

**A**: Yes, when `fail_on_critical: true` is set, PRs touching Critical decisions will fail the status check. However, repository admins can override this.

#### Q: Does it work with monorepos?

**A**: Yes! Decision Guardian works great with monorepos. Use path-specific patterns:

```markdown
**Files**:
- `apps/backend/src/auth/**/*`
- `packages/shared/src/security/**/*`
```

#### Q: Can I use it with private repositories?

**A**: Yes, Decision Guardian works with both public and private repositories using the standard `GITHUB_TOKEN`.

#### Q: Does it support other CI/CD platforms?

**A**: Currently, Decision Guardian is GitHub Actions only. GitLab CI and other platforms are on the roadmap.

#### Q: How do I ignore Decision Guardian for specific PRs?

**A**: Add a workflow condition:

```yaml
- uses: decispher/decision-guardian@v1
  if: "!contains(github.event.pull_request.labels.*.name, 'skip-decisions')"
```

Then add the `skip-decisions` label to PRs that should bypass checking.

#### Q: Can I customize the comment format?

**A**: Not currently, but you can request features via GitHub Issues on the Decision Guardian repository.

#### Q: What's the difference between Decision Guardian and CODEOWNERS?

| Feature | CODEOWNERS | Decision Guardian |
|---------|-----------|-------------------|
| Purpose | Assign reviewers | Provide context |
| Enforcement | Required reviews | Optional (or fail check) |
| Content | Who reviews | Why it matters |
| Format | Simple list | Rich markdown |
| Conditions | File patterns only | Advanced rules |

**Best practice**: Use both together!

#### Q: How do I version control decisions?

**A**: Decisions are version-controlled in git alongside code. Use `git log` to see decision history:

```bash
git log --follow .decispher/decisions.md
```

For major decision changes, use git tags:

```bash
git tag -a decisions-v2.0 -m "Major decision overhaul"
```

#### Q: Can decisions reference external documents?

**A**: Yes! Link to any documentation:

```markdown
### Context

See full details: [Security Runbook](https://docs.example.com/security)

Quick reference:
- [Authentication Guide](https://wiki.example.com/auth)
- [Slack Channel](https://example.slack.com/archives/C123456)
```

---

## Additional Resources

### Example Repositories

- [Decision Guardian Examples](https://github.com/decispher/examples) - Sample decisions for common scenarios
- [Enterprise Template](https://github.com/decispher/enterprise-template) - Complete setup for large organizations

### Community

- **GitHub Discussions**: Ask questions, share patterns
- **Discord**: Real-time chat with other users
- **Stack Overflow**: Tag questions with `decision-guardian`

### Related Tools

- **ADR Tools**: Architecture Decision Records
- **Danger**: Automated PR review
- **Reviewdog**: Automated code review comments
- **CODEOWNERS**: Automatic PR reviewer assignment

### Further Reading

- [Architecture Decision Records (ADRs)](https://adr.github.io/)
- [GitHub Actions Best Practices](https://docs.github.com/en/actions/learn-github-actions/best-practices-for-github-actions)
- [Glob Pattern Reference](https://en.wikipedia.org/wiki/Glob_(programming))

---

## Support

### Getting Help

1. **Documentation**: Start here (you're reading it!)
2. **GitHub Issues**: Bug reports and feature requests
3. **Discussions**: Questions and community support
4. **Email**: decispher@gmail.com for support

### Contributing

Decision Guardian is open source! Contributions welcome:

- Submit bug fixes
- Propose new features
- Improve documentation
- Share example decisions

See [Contributing.md](https://github.com/decispher/decision-guardian/blob/main/Contributing.md)

### License

Decision Guardian is MIT licensed. Free for commercial and personal use.

---

## Changelog

### v1.0.0 (2025-01-15)

**Initial Release**

- File pattern matching with glob support
- Advanced rules system (AND/OR logic, content matching)
- Severity levels (Critical, Warning, Info)
- Automatic comment posting and updates
- Performance optimization for large PRs
- Comprehensive documentation

---

**Decision Guardian** - Surface architectural context automatically.

Built with ❤️ by the Decispher Team