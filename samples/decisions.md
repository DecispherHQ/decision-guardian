<!-- DECISION-001 -->
## Decision: Database Connection Pool

**Status**: Active
**Date**: 2024-01-15
**Severity**: Critical
**Files**:
- `src/db/pool.ts`
- `config/database.yml`

### Context
Connection pool size must stay at 20 to prevent exhaustion.
See INCIDENT-456 for details.

---

<!-- DECISION-002 -->
## Decision: API Rate Limiting

**Status**: Active
**Date**: 2024-02-01
**Severity**: Warning
**Files**:
- `src/api/**/*.ts`

### Context
All new API endpoints must implement the standard rate limiter middleware.
See [RFC-789](https://link-to-rfc) for implementation details.

---

<!-- DECISION-003 -->
## Decision: No Hardcoded Secrets

**Status**: Active
**Date**: 2024-03-10
**Severity**: Critical

**Rules**:
```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "src/**/*.{ts,js}",
      "exclude": ["**/*.test.ts", "**/*.spec.ts"],
      "content_rules": [
        {
          "mode": "regex",
          "pattern": "(password|secret|api_key|token)\\s*=\\s*['\"][^'\"]+['\"]",
          "flags": "i"
        }
      ]
    }
  ]
}
```

### Context
Hardcoded credentials have caused production leaks twice (INC-2024-002, INC-2024-007).
Use environment variables or a secret manager instead. The regex above detects
common patterns like `password = "hunter2"` or `API_KEY = 'abc123'`.

---

<!-- DECISION-004 -->
## Decision: Package.json Dependency Lock

**Status**: Active
**Date**: 2024-04-01
**Severity**: Warning

**Rules**:
```json
{
  "match_mode": "all",
  "conditions": [
    {
      "type": "file",
      "pattern": "package.json",
      "content_rules": [
        {
          "mode": "json_path",
          "path": "dependencies"
        }
      ]
    }
  ]
}
```

### Context
Any change to production dependencies must be reviewed by the platform team.
This uses `json_path` mode to trigger only when the `dependencies` key changes —
devDependencies changes won't trigger this decision.

---

<!-- DECISION-005 -->
## Decision: License Header Protection

**Status**: Active
**Date**: 2024-05-15
**Severity**: Info

**Rules**:
```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "src/**/*.ts",
      "content_rules": [
        {
          "mode": "line_range",
          "start": 1,
          "end": 5
        }
      ]
    }
  ]
}
```

### Context
The first 5 lines of every source file contain the license header. Changes to these
lines must be reviewed to ensure the license text remains correct. This uses
`line_range` mode to only trigger when lines 1-5 are modified.

---

<!-- DECISION-006 -->
## Decision: Auth Config — Full File Review

**Status**: Active
**Date**: 2024-06-01
**Severity**: Critical

**Rules**:
```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "config/auth.{yml,yaml,json}",
      "content_rules": [
        {
          "mode": "full_file"
        }
      ]
    }
  ]
}
```

### Context
Any change to authentication configuration requires security team review.
The `full_file` mode triggers on any modification to these files, regardless of
which lines changed.
