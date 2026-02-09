<!-- 
Decision Guardian Sample File with Advanced Rules
This demonstrates the new JSON-based rule system for fine-grained matching
-->

<!-- DECISION-001 -->
## Decision: Database Connection Pool Configuration

**Status**: Active  
**Date**: 2024-01-15  
**Severity**: Critical  

**Rules**:
```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "config/database.yml",
      "content_rules": [
        {
          "mode": "string",
          "patterns": ["pool_size", "max_connections", "timeout"]
        },
        {
          "mode": "regex",
          "pattern": "idle_timeout:\\s*\\d+"
        }
      ]
    },
    {
      "type": "file",
      "pattern": "src/db/**/*.ts",
      "content_rules": [
        {
          "mode": "line_range",
          "start": 15,
          "end": 45
        }
      ]
    }
  ]
}
```

### Context

The connection pool size in our database configuration is set to 20 connections. This was determined after incident INC-2024-001 where we exhausted database connections during peak load, causing the billing service to fail.

**Why this matters:**
- Our database server has a hard limit of 100 connections across all services
- We run 5 microservices, each allocated 20 connections (5 × 20 = 100)
- Exceeding 20 connections per service causes connection exhaustion

**What happens if you change this:**
- **Setting it higher (e.g., 30):** Database runs out of connections → all services fail
- **Setting it lower (e.g., 10):** Queries queue up → timeout errors during peak traffic

---

<!-- DECISION-002 -->
## Decision: Rate Limiting Constants

**Status**: Active  
**Date**: 2024-02-10  
**Severity**: Warning  

**Rules**:
```json
{
  "match_mode": "all",
  "conditions": [
    {
      "type": "file",
      "pattern": "src/constants.ts",
      "content_rules": [
        {
          "mode": "regex",
          "pattern": "MAX_REQUESTS_PER_MINUTE\\s*=\\s*\\d+"
        }
      ]
    }
  ]
}
```

### Context

The rate limiting constant `MAX_REQUESTS_PER_MINUTE` is set to 100. This protects our API from abuse and ensures fair usage across all clients.

---

<!-- DECISION-003 -->
## Decision: Authentication Configuration (Full File)

**Status**: Active  
**Date**: 2024-03-01  
**Severity**: Critical  

**Rules**:
```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "config/auth.yml",
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

Any change to the authentication configuration file requires security review. This file contains sensitive settings for JWT validation, session management, and OAuth configurations.

---

<!-- DECISION-004 -->
## Decision: Legacy File-Based Matching

**Status**: Active  
**Date**: 2024-01-01  
**Severity**: Info  

**Files**:
- `legacy/**/*.ts`
- `migrations/*.sql`

### Context

This decision demonstrates backward compatibility with the original file-based matching. Any changes to legacy code or database migrations should be reviewed carefully.
