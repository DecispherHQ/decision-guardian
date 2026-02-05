<!-- DECISION-API-002 -->
## Decision: Semantic API Versioning in URL Path

**Status**: Active  
**Date**: 2024-05-10  
**Severity**: Warning

**Files**:
- `src/routes/**/*.ts`
- `src/controllers/v*/**/*.ts`
- `openapi.yaml`

**Rules**:
```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "src/routes/**/*.ts",
      "content_rules": [
        {
          "mode": "regex",
          "pattern": "router\\.(get|post|put|delete|patch)\\(['\"]/((?!v\\d+/)[^'\"]+)['\"]",
          "flags": ""
        }
      ]
    }
  ]
}
```

### Context

All public API endpoints MUST include version in URL path (`/v1/`, `/v2/`) to prevent breaking changes for existing clients.

#### The Breaking Change Incident

**April 25, 2024 - Unversioned API Change Broke Mobile App:**

We changed a response format without versioning:

```typescript
// Before (April 1, 2024)
app.get('/api/users/:id', (req, res) => {
  res.json({
    id: user.id,
    name: user.name,  // Single field
    email: user.email
  });
});

// After (April 25, 2024) - "Improvement"
app.get('/api/users/:id', (req, res) => {
  res.json({
    id: user.id,
    name: {           // Now an object!
      first: user.firstName,
      last: user.lastName
    },
    email: user.email
  });
});
```

**Impact:**
- Mobile app (v2.1) crashed on launch (tried to access `user.name.toUpperCase()`)
- 50,000 active users affected
- App Store rating dropped from 4.7 → 3.9
- Support tickets: 892 in 2 hours
- Emergency hotfix required
- **Cost**: $28K (mobile team 48-hour sprint + support costs)

#### The Solution

**URL Path Versioning:**

```typescript
// ✅ Correct: Version in URL
app.get('/v1/users/:id', (req, res) => {
  // Old format (forever)
  res.json({
    id: user.id,
    name: user.name,
    email: user.email
  });
});

app.get('/v2/users/:id', (req, res) => {
  // New format
  res.json({
    id: user.id,
    name: {
      first: user.firstName,
      last: user.lastName
    },
    email: user.email
  });
});
```

**Versioning Rules:**

1. **New endpoints**: Start at `/v1/`
2. **Breaking changes**: Increment version (`/v2/`)
3. **Non-breaking additions**: Keep same version
4. **Deprecation**: Support N-1 versions (current + previous)

**What's a Breaking Change:**
- ❌ Removing fields
- ❌ Renaming fields
- ❌ Changing field types (string → object)
- ❌ Changing response structure
- ❌ Adding required request parameters
- ✅ Adding optional request parameters
- ✅ Adding new response fields (backwards compatible)

#### Implementation

**Route Organization:**

```
src/
├── routes/
│   ├── v1/
│   │   ├── users.ts       # /v1/users/*
│   │   ├── posts.ts       # /v1/posts/*
│   │   └── index.ts
│   ├── v2/
│   │   ├── users.ts       # /v2/users/* (new format)
│   │   ├── posts.ts
│   │   └── index.ts
│   └── index.ts           # Mounts all versions
```

**Version Mounting:**

```typescript
// src/routes/index.ts
import express from 'express';
import v1Router from './v1';
import v2Router from './v2';

const router = express.Router();

// Mount all versions
router.use('/v1', v1Router);
router.use('/v2', v2Router);

// Redirect root to latest stable
router.get('/', (req, res) => {
  res.redirect('/v2');
});

export default router;
```

**Version Deprecation:**

```typescript
// src/middleware/deprecation.ts
export function deprecationWarning(version: string, sunsetDate: string) {
  return (req, res, next) => {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', sunsetDate);
    res.setHeader('Link', '</v2>; rel="successor-version"');
    
    console.warn(`[DEPRECATED] ${req.method} ${req.path} accessed (sunset: ${sunsetDate})`);
    next();
  };
}

// Usage
router.use(deprecationWarning('v1', '2025-12-31'));
```

#### Alternatives Considered

**Header Versioning:**
```http
GET /api/users/123
Accept: application/vnd.company.v2+json
```

- ❌ **Rejected**: Harder for developers to test (need to set headers)
- ❌ Not visible in browser URLs
- ❌ Caching more complex
- ✅ Would be good for: GraphQL APIs (single endpoint)

**Query Parameter Versioning:**
```http
GET /api/users/123?version=2
```

- ❌ **Rejected**: Easy to forget parameter
- ❌ Default version ambiguous
- ❌ Breaks RESTful principles
- ✅ Would be good for: Legacy API migration (temporary)

**Custom Header Versioning:**
```http
GET /api/users/123
X-API-Version: 2
```

- ❌ **Rejected**: Same issues as Accept header
- ❌ Not standard (invented header)
- ✅ Would be good for: Internal microservices only

**Subdomain Versioning:**
```http
GET https://v2.api.company.com/users/123
```

- ❌ **Rejected**: DNS complexity
- ❌ Certificate management overhead
- ❌ Harder to deprecate (can't sunset subdomain easily)
- ✅ Would be good for: Completely separate platforms

**URL Path Versioning (CHOSEN):**
```http
GET /v2/users/123
```

- ✅ Visible, explicit, easy to test
- ✅ Simple for developers
- ✅ Works in browser, curl, Postman
- ✅ RESTful
- ❌ Downside: URL "pollution" (multiple versions visible)

#### Version Lifecycle

**Timeline:**

```
v1 Released: 2024-01-01
v2 Released: 2024-06-01
v1 Deprecated: 2024-06-01 (warning headers added)
v1 Sunset: 2024-12-31 (6 months notice)
v1 Removed: 2025-01-01
```

**Deprecation Notice:**

```typescript
// Response headers for deprecated v1
HTTP/1.1 200 OK
Deprecation: true
Sunset: Wed, 31 Dec 2024 23:59:59 GMT
Link: </v2/users>; rel="successor-version"
Warning: 299 - "This API version will be removed on 2024-12-31. Migrate to /v2"
```

**Customer Communication:**

1. **T-180 days**: Email announcement of v2, v1 deprecation
2. **T-90 days**: Second email reminder
3. **T-30 days**: Final warning, migration guide
4. **T-7 days**: Last chance email
5. **T-0 days**: v1 returns 410 Gone

#### Monitoring

**Metrics:**

```javascript
// Track version usage
app.use((req, res, next) => {
  const version = req.path.split('/')[1]; // 'v1' or 'v2'
  metrics.increment('api.requests', { version });
  next();
});
```

**Alerts:**
- 🟡 **Warning**: v1 usage >10% after sunset date (stragglers)
- 🟢 **Info**: New version released (track adoption)

**Dashboard:**
- Version distribution (v1: 23%, v2: 77%)
- Deprecated endpoint usage (top 10 endpoints still on v1)
- Client migration status (which API keys still use v1)

#### Migration Guide

**For API Consumers:**

```javascript
// Before (v1)
const response = await fetch('https://api.company.com/v1/users/123');
const user = await response.json();
console.log(user.name); // "John Doe"

// After (v2)
const response = await fetch('https://api.company.com/v2/users/123');
const user = await response.json();
console.log(`${user.name.first} ${user.name.last}`); // "John Doe"
```

**Breaking Changes Documentation:**

```markdown
# Migration Guide: v1 → v2

## Changes

### GET /users/:id

**Before (v1):**
```json
{
  "id": "123",
  "name": "John Doe",
  "email": "john@example.com"
}
```

**After (v2):**
```json
{
  "id": "123",
  "name": {
    "first": "John",
    "last": "Doe"
  },
  "email": "john@example.com"
}
```

**Migration:**
- Replace `user.name` with `user.name.first + ' ' + user.name.last`
```

#### Success Metrics

**Since Implementation (May 10, 2024):**
- ✅ Zero breaking changes for existing clients
- ✅ v2 adoption: 77% of requests (after 7 months)
- ✅ v1 sunset on schedule (Dec 31, 2024)
- ✅ App Store rating recovered: 3.9 → 4.6

**Developer Experience:**
- Migration guide used by 94% of clients
- Average migration time: 3 hours
- Support tickets during migration: 12 (vs 892 during incident)

#### References

- **Incident Report**: [Mobile App Crash April 25, 2024](https://docs.google.com/document/d/api-breaking-change)
- **API Versioning Best Practices**: [Industry Research](https://docs.google.com/document/d/api-versioning-research)
- **Migration Guide**: [v1 → v2 Migration](https://api.company.com/docs/migration-v1-v2)

---

**Last Updated**: 2024-12-15  
**Next Review**: 2025-05-10  
**Owner**: API Team (@api-lead)  
**Status**: Active - enforced via Decision Guardian

**⚠️ IMPORTANT**

All new public API endpoints MUST include version:
- ✅ `/v1/endpoint`
- ✅ `/v2/endpoint`
- ❌ `/endpoint` (will be rejected by Decision Guardian)

**Questions? See [API Versioning Guide](https://wiki.company.com/api/versioning)**
