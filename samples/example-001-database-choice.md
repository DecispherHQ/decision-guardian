<!-- DECISION-DB-001 -->
## Decision: Database Choice for User Authentication

**Status**: Active  
**Date**: 2024-11-15  
**Severity**: Critical

**Files**:
- `src/auth/database.ts`
- `src/auth/session-store.ts`
- `config/database.yml`
- `migrations/auth/**/*.sql`

**Rules**:
```json
{
  "match_mode": "all",
  "conditions": [
    {
      "type": "file",
      "pattern": "src/auth/**/*.{ts,js}",
      "exclude": "**/*.test.{ts,js}",
      "content_rules": [
        {
          "mode": "regex",
          "pattern": "(mongoose|mongodb|MongoClient)",
          "flags": "i"
        }
      ]
    }
  ]
}
```

### Context

We chose **PostgreSQL with Redis for session caching** over MongoDB for our authentication system.

#### The Problem

Our authentication system needed to handle:
- 50,000+ concurrent users
- Sub-100ms session validation
- ACID guarantees for user data
- Complex queries for permission hierarchies

#### Why PostgreSQL + Redis

**ACID Compliance:**
- User registration must be atomic (user record + initial permissions + audit log)
- MongoDB's eventual consistency caused race conditions in our tests
- Lost 3 user registrations in 10,000 during load testing with MongoDB

**Query Performance:**
- Permission checks require JOINs across 3 tables (users, roles, permissions)
- PostgreSQL query planner optimizes this to 8ms average
- MongoDB required application-level joins: 45ms average

**Session Storage:**
- Redis handles session reads (10,000+ req/sec per instance)
- PostgreSQL stores persistent session data (for audit/recovery)
- Best of both worlds: speed + durability

**Team Expertise:**
- 5/7 backend engineers have 3+ years PostgreSQL experience
- Only 1 engineer familiar with MongoDB
- Training cost: 6-8 weeks for team MongoDB proficiency

#### Alternatives Considered

**MongoDB:**
- ❌ **Rejected**: No ACID guarantees for multi-document transactions
- ❌ Data loss in registration process (3/10,000 in load test)
- ❌ Complex permission queries slow (45ms vs 8ms)
- ✅ Would be good for: Flexible schema, horizontal scaling (not our bottleneck)

**MySQL:**
- ❌ **Rejected**: Licensing concerns (GPL)
- ❌ Less robust JSONB support (we store user preferences as JSON)
- ✅ Would be good for: Simpler deployments, wide hosting support

**DynamoDB:**
- ❌ **Rejected**: Vendor lock-in to AWS
- ❌ Complex permission queries expensive (multiple queries + application-level joins)
- ❌ No local development story (emulator unreliable)
- ✅ Would be good for: Fully managed, predictable pricing at scale

#### Implementation Details

**Stack:**
- PostgreSQL 14+ (required for performance improvements)
- Redis 7+ for session store (TTL: 24 hours)
- Connection pooling: pgBouncer (max 100 connections)

**Schema Design:**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
```

**Performance Requirements:**
- Session validation: <50ms p95
- User lookup: <20ms p95
- Permission check: <30ms p95

**Tested At:**
- Load test: 50,000 concurrent users
- Sustained: 10,000 requests/second
- Peak: 25,000 requests/second (login spike)

#### Risk Considerations

**Scaling:**
- Current: Single PostgreSQL instance handles 50K users
- Horizontal scaling: Read replicas at 500K users
- Sharding: Only if we hit 5M+ users (not planned for 2 years)

**Redis Failure:**
- Fallback: Direct PostgreSQL session reads (slower but functional)
- Session data persisted in PostgreSQL for recovery
- Monitored: Redis memory usage (alert at 80%)

#### When to Revisit

**Triggers for re-evaluation:**
- User base grows beyond 1M (consider read replicas)
- Permission queries exceed 50ms p95 (consider denormalization)
- Team grows beyond 20 engineers (more MongoDB expertise available)
- AWS lock-in becomes acceptable (consider Aurora/DynamoDB)

**Review Schedule:**
- Next review: May 2025 (6 months)
- Owner: @backend-lead

#### References

- **Slack Discussion**: [#backend-architecture thread from Nov 10-12, 2024](https://company.slack.com/archives/C123456/p1699632000)
- **Load Test Results**: [Google Docs - Auth System Load Test Nov 2024](https://docs.google.com/spreadsheets/d/abc123)
- **ADR**: Internal ADR-015 "Authentication Database Architecture"
- **Benchmark Repo**: [github.com/company/auth-db-benchmark](https://github.com/company/auth-db-benchmark)

#### Success Metrics

**Achieved (as of Dec 2024):**
- ✅ Session validation p95: 42ms (target: <50ms)
- ✅ Zero data loss in production (3 months)
- ✅ 99.98% uptime
- ✅ Team onboarding: 2 days average (target: <1 week)

**Monitoring:**
- Datadog dashboard: "Auth System Performance"
- Alert: Session validation >100ms for 5 minutes
- Weekly review: Performance trends, error rates

---

**Last Updated**: 2024-12-15  
**Next Review**: 2025-05-15  
**Owner**: Backend Team (@backend-lead)  
**Status**: Active - enforced via Decision Guardian
