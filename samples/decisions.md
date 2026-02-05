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
