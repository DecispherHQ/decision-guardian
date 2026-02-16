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
  "match": "any",
  "conditions": [
    {
      "files": ["src/**/*.ts", "src/**/*.js", "config/**/*"],
      "content": {
        "mode": "regex",
        "pattern": "(api[_-]?key|secret|password|token|private[_-]?key)\\s*[:=]\\s*['\"][^'\"]{8,}['\"]",
        "flags": "i"
      }
    }
  ]
}
```

### Context
Hardcoded secrets must never appear in source code. Use environment variables or a secrets manager.

---

<!-- DECISION-SEC-002 -->
## Decision: Auth Middleware Required
**Status**: Active
**Date**: 2024-04-15
**Severity**: Critical
**Files**:
- `src/routes/**/*.ts`
- `src/api/**/*.ts`

**Rules**:
```json
{
  "match": "any",
  "conditions": [
    {
      "files": ["src/routes/**/*.ts", "src/api/**/*.ts"],
      "content": {
        "mode": "string",
        "patterns": ["router.get(", "router.post(", "router.put(", "router.delete(", "app.get(", "app.post("]
      }
    }
  ]
}
```

### Context
All route handlers must use the authentication middleware. Changes to route files require security review.

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
  "match": "any",
  "conditions": [
    {
      "files": ["package.json"],
      "content": {
        "mode": "json_path",
        "paths": ["dependencies.jsonwebtoken", "dependencies.bcrypt", "dependencies.helmet", "dependencies.cors"]
      }
    }
  ]
}
```

### Context
Changes to security-critical dependencies require extra review and testing.
