# Decision File Format Reference

**Author**: Ali Abbas  
**Project**: Decispher

Complete reference for the decisions file format used by Decision Guardian.

---

## Table of Contents

1. [File Location](#file-location)
2. [Decision Structure](#decision-structure)
3. [Required Fields](#required-fields)
4. [Optional Fields](#optional-fields)
5. [File Patterns](#file-patterns)
6. [Advanced Rules](#advanced-rules)
7. [Content Matching](#content-matching)
8. [Examples](#examples)
9. [Validation](#validation)

---

## File Location

**Default**: `.decispher/decisions.md`

**Customizable via**:
- **GitHub Action**: `decision_file` input
- **CLI**: positional argument to `check <path>`, or auto-discovered by `checkall`

**Accepted values**:
- Single file: `.decispher/decisions.md`
- Directory: `.decispher/` (auto-discovers all `.md` files recursively)

**Directory scanning**:
- Recursively finds all `.md` files
- Skips hidden directories (`.git`, `.github`)
- Merges all decisions into single collection

---

## Decision Structure

### Basic Format

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

### Required Elements

1. **Decision Marker**: `<!-- DECISION-ID -->`
2. **Title**: `## Decision: Title`
3. **At least one of**: `Files` or `Rules`

All other fields have defaults if omitted.

---

## Required Fields

### Decision ID

```markdown
<!-- DECISION-[IDENTIFIER] -->
```

**Format rules**:
- Must start with `DECISION-`
- Followed by uppercase letters, numbers, and hyphens
- Case-insensitive (normalized to uppercase)

**Valid examples**:
```markdown
<!-- DECISION-001 -->
<!-- DECISION-DB-001 -->
<!-- DECISION-API-AUTH-001 -->
<!-- DECISION-TEST-001 -->
```

### Title

```markdown
## Decision: Your Decision Title
```

**Guidelines**:
- Clear and descriptive
- Explains what the decision covers
- Keep under 100 characters

---

## Optional Fields

### Status

```markdown
**Status**: Active
```

| Status | Synonyms | Behavior |
|--------|----------|----------|
| `active` | `enabled`, `live` | ✅ Triggers PR alerts |
| `deprecated` | `obsolete` | ⚠️ Parsed but ignored |
| `superseded` | `replaced` | ⚠️ Parsed but ignored |
| `archived` | `inactive` | ⚠️ Parsed but ignored |

**Default**: `active`

**Important**: Only `active` decisions trigger alerts.

### Date

```markdown
**Date**: 2024-01-15
```

**Format**: ISO 8601 (`YYYY-MM-DD`)

**Validation**:
- Future dates trigger warning
- Dates >10 years old suggest review

**Default**: Current date

### Severity

```markdown
**Severity**: Critical
```

| Severity | Synonyms | Display | Fails check? |
|----------|----------|---------|-----------|
| `info` | `informational`, `low` | ℹ️ | No |
| `warning` | `warn`, `medium` | 🟡 | No |
| `critical` | `error`, `high`, `blocker` | 🔴 | Yes (if `fail_on_critical: true` / `--fail-on-critical`) |

**Default**: `info`

---

## File Patterns

### Basic Syntax

```markdown
**Files**:
- `src/db/pool.ts`
- `src/**/*.ts`
- `config/*.yml`
```

### Glob Patterns

| Pattern | Matches | Example |
|---------|---------|---------|
| `file.ts` | Exact file | `src/app.ts` |
| `*.ts` | All `.ts` in directory | `src/*.ts` |
| `**/*.ts` | All `.ts` recursively | `src/**/*.ts` |
| `{a,b}` | a or b | `*.{ts,js}` |
| `[a-z]` | Character range | `test[0-9].ts` |
| `!pattern` | Exclusion | `!**/*.test.ts` |

### Format Options

Both backtick formats supported:

```markdown
**Files**:
- `src/app.ts`      <!-- recommended -->
- src/utils.ts      <!-- also works -->
```

### Examples

```markdown
**Files**:
- `package.json`                # Exact file
- `src/**/*.ts`                 # All TypeScript
- `config/*.{yml,yaml}`         # Config files
- `migrations/**/*.sql`         # SQL migrations
- `!migrations/**/test_*.sql`   # Exclude tests
```

---

## Advanced Rules

JSON-based rules for fine-grained control.

### Inline Rules

```markdown
**Rules**:
```json
{
  "type": "file",
  "pattern": "src/**/*.ts",
  "content_rules": [
    {
      "mode": "string",
      "patterns": ["TODO", "FIXME"]
    }
  ]
}
```
```

### External Rules

```markdown
**Rules**: ./rules/security.json
```

or

```markdown
**Rules**: [Security Rules](./rules/security.json)
```

**External file example**:
```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "src/**/*.ts"
    }
  ]
}
```

### Rule Structure

#### Top-Level

```json
{
  "match_mode": "any" | "all",  // OR | AND
  "conditions": [...]            // Array of rules
}
```


| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `match_mode` | `"any"` \| `"all"` | `"any"` | Boolean logic for conditions |
| `conditions` | Array | Required | List of file rules or nested conditions |


#### File Rule

```json
{
  "type": "file",
  "pattern": "src/**/*.ts",      // Glob pattern
  "exclude": "**/*.test.ts",     // Optional exclusion
  "content_rules": [...]          // Optional content matching
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"file"` | Yes | Must be `"file"` |
| `pattern` | String | Yes | Glob pattern for file matching |
| `exclude` | String | No | Glob pattern to exclude files |
| `content_rules` | Array | No | Rules to match within file diff |

---

## Content Matching

Rules for matching within file diffs.

### 1. String Mode

Match exact strings in changed lines.

```json
{
  "mode": "string",
  "patterns": ["pool_size", "max_connections"]
}
```

**Use case**: Simple keyword detection


| Property | Type | Description |
|----------|------|-------------|
| `mode` | `"string"` | Required |
| `patterns` | String[] | List of strings to search for |

### 2. Regex Mode

Pattern matching with security protection.

```json
{
  "mode": "regex",
  "pattern": "MAX_\\w+\\s*=\\s*\\d+",
  "flags": "i"
}
```

**Flags**: `i` (case-insensitive), `m` (multiline), `g` (global)


| Property | Type | Description |
|----------|------|-------------|
| `mode` | `"regex"` | Required |
| `pattern` | String | Regular expression pattern |
| `flags` | String | Optional regex flags (`i` = case-insensitive) |



**Security**:
- 5-second timeout
- ReDoS detection (safe-regex)
- VM sandbox execution

**Use case**: Complex pattern matching

### 3. Line Range Mode

Match changes in specific line numbers.

```json
{
  "mode": "line_range",
  "start": 15,
  "end": 45
}
```

**Use case**: Protect license headers, config blocks


| Property | Type | Description |
|----------|------|-------------|
| `mode` | `"line_range"` | Required |
| `start` | Number | Start line number (inclusive) |
| `end` | Number | End line number (inclusive) |

### 4. Full File Mode

Match any change to the file.

```json
{
  "mode": "full_file"
}
```

**Use case**: Files always needing review

### 5. JSON Path Mode

Match JSON keys in changes.

```json
{
  "mode": "json_path",
  "paths": ["$.database.pool_size", "$.cache.ttl"]
}
```

**Use case**: Config files where only certain fields matter


| Property | Type | Description |
|----------|------|-------------|
| `mode` | `"json_path"` | Required |
| `paths` | String[] | JSON paths to check |

---

## Boolean Logic

### OR Logic (`match_mode: "any"`)

```json
{
  "match_mode": "any",
  "conditions": [
    { "type": "file", "pattern": "Dockerfile" },
    { "type": "file", "pattern": "docker-compose.yml" }
  ]
}
```

Triggers if **either** file changes.

### AND Logic (`match_mode: "all"`)

```json
{
  "match_mode": "all",
  "conditions": [
    { "type": "file", "pattern": "src/auth/**/*.ts" },
    { "type": "file", "pattern": "config/auth.yml" }
  ]
}
```

Triggers only if **both** change.

### Nested Logic

**Maximum depth**: 10 levels

```json
{
  "match_mode": "all",
  "conditions": [
    {
      "match_mode": "any",
      "conditions": [
        { "type": "file", "pattern": "config/db.yml" },
        { "type": "file", "pattern": "config/db.json" }
      ]
    },
    { "type": "file", "pattern": "src/db/**/*.ts" }
  ]
}
```

**Logic**: (config/db.yml OR config/db.json) AND src/db/**/*.ts

---


## Context Section

Free-form markdown describing the decision.

```markdown
### Context

The connection pool size in `database.yml` is set to 20 connections.

**Why this matters:**
- Database has 100 connection limit
- 5 services × 20 = 100 (at capacity)

**References:**
- [Incident Report](https://wiki.example.com/incident-456)
- [Architecture Doc](https://docs.example.com/db-design)
```

---

## Examples

### Example 1: Simple File Patterns

```markdown
<!-- DECISION-DB-001 -->
## Decision: Database Pool Configuration

**Status**: Active  
**Date**: 2024-01-15  
**Severity**: Critical

**Files**:
- `src/db/pool.ts`
- `config/database.yml`

### Context

Pool size fixed at 20 to prevent connection exhaustion.
Tested with 5K req/s. Do not modify without load testing.

---
```

### Example 2: String Matching

```markdown
<!-- DECISION-RATE-001 -->
## Decision: Rate Limit Constants

**Status**: Active  
**Date**: 2024-02-10  
**Severity**: Warning

**Rules**:
```json
{
  "type": "file",
  "pattern": "src/constants.ts",
  "content_rules": [
    {
      "mode": "string",
      "patterns": ["MAX_REQUESTS", "RATE_LIMIT"]
    }
  ]
}

### Context

Rate limiting constants require security review.

```
---

### Example 3: Regex Matching

```markdown
<!-- DECISION-SEC-001 -->
## Decision: No Hardcoded Credentials

**Status**: Active  
**Date**: 2024-03-01  
**Severity**: Critical

**Rules**:
```json
{
  "type": "file",
  "pattern": "src/**/*.{ts,js}",
  "exclude": "**/*.test.{ts,js}",
  "content_rules": [
    {
      "mode": "regex",
      "pattern": "(password|api[_-]?key|secret)\\s*[=:]\\s*['\"][^'\"]+['\"]",
      "flags": "i"
    }
  ]
}

### Context

Detects hardcoded credentials. Use environment variables
or AWS Secrets Manager.

```
---

### Example 4: Complex Logic

```markdown
<!-- DECISION-AUTH-001 -->
## Decision: Authentication Changes

**Status**: Active  
**Date**: 2024-03-15  
**Severity**: Critical

**Rules**:
```json
{
  "match_mode": "all",
  "conditions": [
    {
      "type": "file",
      "pattern": "config/auth.yml"
    },
    {
      "match_mode": "any",
      "conditions": [
        { "type": "file", "pattern": "src/auth/**/*.ts" },
        { "type": "file", "pattern": "src/middleware/auth.ts" }
      ]
    }
  ]
}

### Context

Auth config AND auth code must both change for this alert.

```
---

### Example 5: Line Range

```markdown
<!-- DECISION-LICENSE-001 -->
## Decision: License Header Protection

**Status**: Active  
**Date**: 2024-01-01  
**Severity**: Warning

**Rules**:
```json
{
  "type": "file",
  "pattern": "src/**/*.ts",
  "content_rules": [
    {
      "mode": "line_range",
      "start": 1,
      "end": 10
    }
  ]
}

### Context

Lines 1-10 contain license header. Changes require legal approval.

```

---

## Validation

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Decision missing required fields` | Missing ID or title | Add `<!-- DECISION-ID -->` and `## Decision:` |
| `Failed to parse JSON rules` | Invalid JSON | Validate with JSON linter |
| `Rule nesting exceeds max depth` | >10 levels | Flatten structure |
| `Invalid regex pattern` | Bad regex syntax | Test regex first |
| `Line range start must be <= end` | start > end | Swap values |
| `Unsafe regex pattern detected` | ReDoS risk | Simplify pattern |

### Validation Warnings

**Date warnings**:
- Future date: "Date is in the future - is this correct?"
- Old date: "Date is >10 years old - consider archiving"

**Format warnings**:
- Invalid date format: "Use YYYY-MM-DD"
- Invalid ID: "Must start with DECISION-"

---

## Best Practices

### Writing Decisions

1. **Use descriptive IDs**: `DECISION-DB-POOL-001` > `DECISION-001`
2. **Write clear context**: Explain why, not just what
3. **Start simple**: File patterns before advanced rules
4. **Test regex**: Use online testers before committing
5. **Keep nesting shallow**: Avoid deep rule structures
6. **External files**: For complex, reusable rules
7. **Regular review**: Archive outdated decisions

### Severity Guidelines

| Use Critical | Use Warning | Use Info |
|--------------|-------------|----------|
| Production outage risk | Best practices | Documentation |
| Security vulnerabilities | Performance | Coding standards |
| Data loss possible | Breaking changes | Patterns |
| Compliance issues | Tech debt | Historical context |

### Context Guidelines

Include:
- **Why**: Reason for decision
- **Impact**: What happens if ignored
- **Tested**: How it was validated
- **Links**: Slack, Jira, PRs

---

## About

**Decision Guardian** is created and maintained by **Ali Abbas** as part of the Decispher project.

---

**Made with ❤️ by [Ali Abbas](https://github.com/gr8-alizaidi)**