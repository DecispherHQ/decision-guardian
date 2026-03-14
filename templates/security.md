<!-- DECISION-SEC-001 -->
## Decision: No Hardcoded Secrets
**Status**: Active
**Date**: 2024-04-01
**Severity**: Critical
**Files**:
- `src/**/*.ts`
- `src/**/*.js`
- `config/**/*`

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
          "mode": "regex",
          "pattern": "(api[_-]?key|secret|password|token|private[_-]?key)\\s*[:=]\\s*['\"][^'\"]{8,}['\"]",
          "flags": "i"
        }
      ]
    },
    {
      "type": "file",
      "pattern": "src/**/*.js",
      "content_rules": [
        {
          "mode": "regex",
          "pattern": "(api[_-]?key|secret|password|token|private[_-]?key)\\s*[:=]\\s*['\"][^'\"]{8,}['\"]",
          "flags": "i"
        }
      ]
    },
    {
      "type": "file",
      "pattern": "config/**/*",
      "content_rules": [
        {
          "mode": "regex",
          "pattern": "(api[_-]?key|secret|password|token|private[_-]?key)\\s*[:=]\\s*['\"][^'\"]{8,}['\"]",
          "flags": "i"
        }
      ]
    }
  ]
}
```

### Context
Hardcoded secrets must never appear in source code. Use environment variables or a secrets manager.

---

<!-- DECISION-SEC-002 -->
## Decision: Auth Middleware Required on Mutating Routes
**Status**: Active
**Date**: 2024-04-15
**Severity**: Critical
**Files**:
- `src/routes/**/*.ts`
- `src/api/**/*.ts`

**Rules**:
```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "src/routes/**/*.ts",
      "content_match_mode": "all",
      "content_rules": [
        {
          "mode": "string",
          "patterns": ["router.post(", "router.put(", "router.delete(", "app.post(", "app.put(", "app.delete("]
        },
        {
          "mode": "regex",
          "pattern": "authenticate|authMiddleware|requireAuth"
        }
      ]
    },
    {
      "type": "file",
      "pattern": "src/api/**/*.ts",
      "content_match_mode": "all",
      "content_rules": [
        {
          "mode": "string",
          "patterns": ["router.post(", "router.put(", "router.delete(", "app.post(", "app.put(", "app.delete("]
        },
        {
          "mode": "regex",
          "pattern": "authenticate|authMiddleware|requireAuth"
        }
      ]
    }
  ]
}
```

### Context
Fires only when a changed route file **both** defines a mutating endpoint (POST/PUT/DELETE) **and** references
an auth middleware in the same diff. Uses `content_match_mode: "all"` for per-file AND logic — both
`content_rules` must match the same file for the decision to trigger.

---

<!-- DECISION-SEC-003 -->
## Decision: Security-Critical Dependencies
**Status**: Active
**Date**: 2024-05-01
**Severity**: Warning
**Files**:
- `package.json`
- `package-lock.json`

**Rules**:
```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "package.json",
      "content_rules": [
        {
          "mode": "json_path",
          "paths": ["dependencies.jsonwebtoken", "dependencies.bcrypt", "dependencies.helmet", "dependencies.cors"]
        }
      ]
    }
  ]
}
```

### Context
Changes to security-critical dependencies require extra review and testing.
