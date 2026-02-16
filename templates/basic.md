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

---

<!-- DECISION-003 -->
## Decision: Authentication Module
**Status**: Active
**Date**: 2024-03-10
**Severity**: Critical
**Files**:
- `src/auth/**/*`
- `config/auth.json`

### Context
Auth module changes require security team review.
