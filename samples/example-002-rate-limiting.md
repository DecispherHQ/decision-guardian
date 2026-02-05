<!-- DECISION-API-001 -->
## Decision: Rate Limiting Configuration for Public API

**Status**: Active  
**Date**: 2024-10-20  
**Severity**: Critical

**Files**:
- `src/middleware/rate-limiter.ts`
- `config/rate-limits.yml`
- `src/constants/rate-limits.ts`

**Rules**:
```json
{
  "type": "file",
  "pattern": "src/{middleware/rate-limiter.ts,constants/rate-limits.ts,config/rate-limits.yml}",
  "content_rules": [
    {
      "mode": "regex",
      "pattern": "(MAX_REQUESTS|RATE_LIMIT|WINDOW_MS)\\s*[=:]\\s*\\d+",
      "flags": "i"
    }
  ]
}
```

### Context

We set strict rate limits on our public API to prevent abuse while maintaining good UX for legitimate users.

#### The Problem

**Incident that triggered this decision:**

On October 15, 2024, a misconfigured client script made 500,000 requests in 10 minutes:
- API response times spiked from 120ms → 8,000ms
- Database connection pool exhausted (100/100 connections used)
- Legitimate users experienced timeouts and errors
- Incident duration: 47 minutes until we manually blocked the IP
- **Estimated revenue impact**: $12,000 in lost sales

We had no rate limiting in place.

#### The Solution

**Tiered rate limiting based on authentication level:**

| Tier | Rate Limit | Window | Use Case |
|------|------------|--------|----------|
| **Anonymous** | 10 req/min | 60 sec | Public endpoints, documentation |
| **Free Tier** | 100 req/min | 60 sec | Basic API access |
| **Paid Tier** | 1,000 req/min | 60 sec | Production integrations |
| **Enterprise** | 10,000 req/min | 60 sec | High-volume customers |

**Implementation:**
```typescript
// src/constants/rate-limits.ts
export const RATE_LIMITS = {
  ANONYMOUS: {
    MAX_REQUESTS: 10,
    WINDOW_MS: 60_000, // 1 minute
  },
  FREE: {
    MAX_REQUESTS: 100,
    WINDOW_MS: 60_000,
  },
  PAID: {
    MAX_REQUESTS: 1_000,
    WINDOW_MS: 60_000,
  },
  ENTERPRISE: {
    MAX_REQUESTS: 10_000,
    WINDOW_MS: 60_000,
  },
} as const;
```

**Why These Numbers:**

**Anonymous (10/min):**
- Browsing documentation typically requires 2-5 requests/min
- 10/min allows comfortable exploration without enabling scraping
- Tested with 20 user sessions: 95% stayed under 8 req/min

**Free Tier (100/min):**
- Supports small-scale development and testing
- 100 req/min = 1.67 req/sec (adequate for prototype apps)
- Encourages upgrade to paid tier for production use

**Paid Tier (1,000/min):**
- Based on customer usage analysis: 95th percentile paid customer uses 847 req/min
- 1,000/min provides 15% headroom
- Supports most production applications (16.7 req/sec)

**Enterprise (10,000/min):**
- Our infrastructure can handle 50,000 req/min total
- 10,000/min per customer ensures 5 concurrent enterprise customers at peak
- Allows bursts without impacting other customers

#### Alternatives Considered

**Token Bucket Algorithm:**
- ❌ **Rejected**: Too complex for initial implementation
- ❌ Harder to explain to customers
- ✅ Would be good for: Allowing brief bursts (may implement later)
- ✅ More sophisticated rate smoothing

**Fixed Window (Chosen):**
- ✅ **Selected**: Simple to implement and understand
- ✅ Easy to communicate to customers
- ✅ Predictable behavior
- ❌ Downside: Allows double rate at window boundary (acceptable risk)

**Sliding Window:**
- ❌ **Rejected**: Higher memory usage (track every request timestamp)
- ❌ More complex implementation
- ✅ Would be good for: More accurate limiting (overkill for our scale)

**IP-Based Only:**
- ❌ **Rejected**: Penalizes users behind NAT/proxy
- ❌ Can't differentiate paying customers
- ✅ Would be good for: Pure DDoS protection (not our goal)

#### Implementation Details

**Technology Stack:**
- Redis for rate limit storage (atomic INCR operation)
- Express middleware for enforcement
- Fallback: In-memory Map if Redis unavailable (degraded mode)

**Response Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1699920000
Retry-After: 42
```

**Error Response (429 Too Many Requests):**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Limit: 1000 req/min",
    "retry_after": 42,
    "docs": "https://api.company.com/docs/rate-limits"
  }
}
```

**Redis Key Schema:**
```
rate_limit:{tier}:{user_id}:{window_start}
TTL: 120 seconds (2x window to prevent edge cases)
```

#### Performance Impact

**Benchmarks:**
- Middleware overhead: 1.2ms per request (Redis local)
- Middleware overhead: 3.8ms per request (Redis remote)
- Memory usage: 24 bytes per active user per window

**Load Testing Results:**
- 50,000 req/min across 500 users: No degradation
- 100,000 req/min across 1,000 users: 2ms slowdown (acceptable)
- Redis memory usage: 12MB at peak load

#### Monitoring & Alerts

**Metrics to Track:**
- Rate limit violations per tier (daily)
- 95th percentile usage per tier
- False positive rate (legitimate users hitting limits)

**Alerts:**
- 🔴 **Critical**: >100 enterprise customers hitting limits (within 1 hour)
- 🟡 **Warning**: >50% of paid customers hitting limits (within 24 hours)
- 🟢 **Info**: >10% increase in rate limit violations week-over-week

**Dashboards:**
- Grafana: "API Rate Limiting Overview"
- Weekly review: Adjust limits based on usage patterns

#### Customer Communication

**Documentation:**
- [API Rate Limits](https://api.company.com/docs/rate-limits)
- Code examples for handling 429 responses
- Best practices for staying under limits

**Email to Existing Customers (sent Oct 22, 2024):**
- 7-day notice before enforcement
- Clear explanation of new limits
- Upgrade path for users needing higher limits
- Contact info for special cases

**Result:**
- 3 customers upgraded to paid tier
- 1 enterprise customer negotiated custom limit (15,000/min)
- 0 complaints after enforcement

#### When to Increase Limits

**Triggers:**
- >25% of paid customers hitting limits regularly
- Infrastructure upgraded (Redis cluster, more API servers)
- Enterprise SLA agreements require higher limits
- Competitive pressure (competitors offer higher limits)

**Review Schedule:**
- Quarterly review of limit effectiveness
- Annual review of tier structure
- Next review: January 2025

#### Risk Mitigation

**Redis Failure:**
- Fallback: In-memory rate limiting (per-instance, less strict)
- Alert: Redis connection errors
- Graceful degradation: Allow requests but log warnings

**Accidentally Blocking Legitimate Users:**
- Whitelist capability for critical integrations
- Support ticket → manual limit increase (24-hour turnaround)
- Monitoring dashboard for false positives

**DDoS Attacks:**
- Rate limiting alone won't stop DDoS
- Additional protections: Cloudflare, AWS Shield
- This decision addresses abuse, not attacks

#### Success Metrics

**Since Implementation (Oct 22, 2024):**
- ✅ Zero infrastructure incidents due to API abuse
- ✅ 99.97% of legitimate requests succeed
- ✅ 847 abusive requests blocked per day (average)
- ✅ API response time p95: 142ms (was 8,000ms during incident)

**Customer Satisfaction:**
- 3 support tickets about rate limits (all resolved)
- 0 escalations
- NPS score for API: 42 → 38 (slight decrease, within noise)

#### References

- **Incident Report**: [Post-mortem - API Overload Oct 15, 2024](https://docs.google.com/document/d/xyz789)
- **Slack Discussion**: [#api-team channel Oct 16-18, 2024](https://company.slack.com/archives/C789/p1697472000)
- **Customer Usage Analysis**: [Data Analysis - API Usage Patterns](https://lookerstudio.google.com/reporting/abc123)
- **Industry Benchmarks**: [Researched 15 competitor APIs](https://docs.google.com/spreadsheets/d/def456)

#### Examples of Enforcement

**Scenario 1: Development Testing**
```bash
# User exceeds 10 req/min anonymous limit
$ curl -i https://api.company.com/v1/users

HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1699920042
Retry-After: 42

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Limit: 10 req/min. Authenticate for higher limits.",
    "docs": "https://api.company.com/docs/authentication"
  }
}
```

**Scenario 2: Production Integration**
```javascript
// Paid customer handles rate limits gracefully
async function apiRequest(endpoint) {
  try {
    const response = await fetch(endpoint);
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      console.log(`Rate limited. Retrying after ${retryAfter}s`);
      await sleep(retryAfter * 1000);
      return apiRequest(endpoint); // Retry
    }
    
    return response.json();
  } catch (error) {
    console.error('API request failed:', error);
  }
}
```

---

**Last Updated**: 2024-12-15  
**Next Review**: 2025-01-20  
**Owner**: API Team (@api-lead)  
**Status**: Active - enforced via Decision Guardian

**⚠️ CRITICAL**: Changing these limits affects all customers. Requires:
1. Load testing with new limits
2. Customer communication (7-day notice)
3. Approval from Product & Engineering leads
4. Monitoring for 2 weeks post-change
