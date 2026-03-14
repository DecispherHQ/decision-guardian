<!-- DECISION-API-001 -->
## Decision: API Versioning
**Status**: Active
**Date**: 2024-05-01
**Severity**: Critical
**Files**:
- `src/api/v1/**/*`
- `src/routes/v1/**/*`

### Context
V1 API endpoints are frozen. New features go to V2. Modifying V1 routes breaks existing integrations.

---

<!-- DECISION-API-002 -->
## Decision: Rate Limiting Required
**Status**: Active
**Date**: 2024-05-15
**Severity**: Warning
**Files**:
- `src/api/**/*.ts`
- `src/routes/**/*.ts`

**Rules**:
```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "src/api/**/*.ts",
      "content_rules": [
        {
          "mode": "string",
          "patterns": ["router.get(", "router.post(", "app.get(", "app.post("]
        }
      ]
    },
    {
      "type": "file",
      "pattern": "src/routes/**/*.ts",
      "content_rules": [
        {
          "mode": "string",
          "patterns": ["router.get(", "router.post(", "app.get(", "app.post("]
        }
      ]
    }
  ]
}
```

### Context
All public endpoints must include rate limiting. New endpoints require load testing results.

---

<!-- DECISION-API-003 -->
## Decision: Response Schema Validation
**Status**: Active
**Date**: 2024-06-01
**Severity**: Info
**Files**:
- `src/api/**/*.ts`

**Rules**:
```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "src/api/**/*.ts",
      "content_rules": [
        {
          "mode": "string",
          "patterns": ["res.json(", "res.send(", "response.json("]
        }
      ]
    }
  ]
}
```

### Context
API responses should use validated schemas. Check that response DTOs are defined.

---

<!-- DECISION-API-004 -->
## Decision: New Endpoints Must Export a Controller
**Status**: Active
**Date**: 2024-06-15
**Severity**: Warning
**Files**:
- `src/api/**/*.ts`

**Rules**:
```json
{
  "type": "file",
  "pattern": "src/api/**/*.ts",
  "content_match_mode": "all",
  "content_rules": [
    {
      "mode": "string",
      "patterns": ["router.post(", "router.put(", "router.patch(", "router.delete("]
    },
    {
      "mode": "regex",
      "pattern": "export (default |const |function )"
    }
  ]
}
```

### Context
Fires only when a changed API file **both** defines a mutating route (POST/PUT/PATCH/DELETE) **and**
exports a controller symbol — ensuring new endpoints are properly encapsulated and not defined inline.
`content_match_mode: "all"` enforces AND logic: **every** `content_rules` entry must match the same
file's diff before the decision triggers. Omit it (or use `"any"`) for OR logic (default).
