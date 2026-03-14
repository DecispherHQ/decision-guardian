<!-- DECISION-DB-001 -->
## Decision: Migration Files Are Immutable
**Status**: Active
**Date**: 2024-03-01
**Severity**: Critical
**Files**:
- `migrations/**/*`
- `db/migrations/**/*`

### Context
Never modify existing migration files. Create new migrations instead. Modifying past migrations breaks deployed databases.

---

<!-- DECISION-DB-002 -->
## Decision: Schema Version Lock
**Status**: Active
**Date**: 2024-03-15
**Severity**: Critical
**Files**:
- `src/db/schema.ts`
- `prisma/schema.prisma`
- `drizzle/**/*.ts`

**Rules**:
```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "prisma/schema.prisma",
      "content_rules": [
        {
          "mode": "regex",
          "pattern": "@@map|@@ignore|model\\s+\\w+"
        }
      ]
    },
    {
      "type": "file",
      "pattern": "src/db/schema.ts",
      "content_rules": [
        {
          "mode": "string",
          "patterns": ["createTable", "dropTable", "alterTable", "addColumn", "dropColumn"]
        }
      ]
    },
    {
      "type": "file",
      "pattern": "drizzle/**/*.ts",
      "content_rules": [
        {
          "mode": "string",
          "patterns": ["createTable", "dropTable", "alterTable", "addColumn", "dropColumn"]
        }
      ]
    }
  ]
}
```

### Context
Schema changes must be paired with migrations and reviewed by the database team.

---

<!-- DECISION-DB-003 -->
## Decision: Connection Pool Configuration
**Status**: Active
**Date**: 2024-04-01
**Severity**: Warning
**Files**:
- `config/database.*`
- `src/db/pool.*`
- `.env*`

**Rules**:
```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "config/database.*",
      "content_rules": [
        {
          "mode": "regex",
          "pattern": "(pool_size|max_connections|min_connections|idle_timeout)\\s*[:=]",
          "flags": "i"
        }
      ]
    },
    {
      "type": "file",
      "pattern": "src/db/pool.*",
      "content_rules": [
        {
          "mode": "regex",
          "pattern": "(pool_size|max_connections|min_connections|idle_timeout)\\s*[:=]",
          "flags": "i"
        }
      ]
    }
  ]
}
```

### Context
Pool configuration changes can cause production outages. Must be load-tested before deployment.
