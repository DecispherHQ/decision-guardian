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
  "match": "any",
  "conditions": [
    {
      "files": ["src/api/**/*.ts", "src/routes/**/*.ts"],
      "content": {
        "mode": "string",
        "patterns": ["router.get(", "router.post(", "app.get(", "app.post("]
      }
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
  "match": "any",
  "conditions": [
    {
      "files": ["src/api/**/*.ts"],
      "content": {
        "mode": "string",
        "patterns": ["res.json(", "res.send(", "response.json("]
      }
    }
  ]
}
```

### Context
API responses should use validated schemas. Check that response DTOs are defined.
