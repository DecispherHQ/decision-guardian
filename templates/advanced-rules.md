<!-- DECISION-ADV-001 -->
## Decision: Config File Validation
**Status**: Active
**Date**: 2024-06-01
**Severity**: Critical
**Files**:
- `config/**/*.json`
- `config/**/*.yml`

**Rules**:
```json
{
  "match": "any",
  "conditions": [
    {
      "files": ["config/**/*.json"],
      "content": {
        "mode": "json_path",
        "paths": ["database.host", "database.port", "database.password"]
      }
    },
    {
      "files": ["config/**/*.yml"],
      "content": {
        "mode": "regex",
        "pattern": "(password|secret|api_key)\\s*[:=]",
        "flags": "i"
      }
    }
  ]
}
```

### Context
All config changes affecting database credentials must be reviewed.

---

<!-- DECISION-ADV-002 -->
## Decision: License Header Enforcement
**Status**: Active
**Date**: 2024-06-15
**Severity**: Warning
**Files**:
- `src/**/*.ts`

**Rules**:
```json
{
  "match": "all",
  "conditions": [
    {
      "files": ["src/**/*.ts"],
      "content": {
        "mode": "line_range",
        "start": 1,
        "end": 5
      }
    }
  ]
}
```

### Context
Source files must contain license headers in the first 5 lines.

---

<!-- DECISION-ADV-003 -->
## Decision: Deprecated API Detection
**Status**: Active
**Date**: 2024-07-01
**Severity**: Info
**Files**:
- `src/**/*.ts`

**Rules**:
```json
{
  "match": "any",
  "conditions": [
    {
      "files": ["src/**/*.ts"],
      "content": {
        "mode": "string",
        "patterns": ["@deprecated", "TODO: remove"]
      }
    }
  ]
}
```

### Context
Track usage of deprecated APIs and items marked for removal.
