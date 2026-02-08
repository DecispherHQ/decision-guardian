<!-- DECISION-DEP-001 -->
## Decision: Pin All Production Dependencies to Exact Versions

**Status**: Active  
**Date**: 2024-07-20  
**Severity**: Critical

**Files**:
- `package.json`
- `package-lock.json`
- `yarn.lock`
- `requirements.txt`
- `Pipfile.lock`

**Rules**:
```json
{
  "type": "file",
  "pattern": "package.json",
  "content_rules": [
    {
      "mode": "regex",
      "pattern": "\"[^\"]+\":\\s*\"[~^]",
      "flags": ""
    }
  ]
}
```

### Context

We **pin all production dependencies to exact versions** (no `^` or `~` ranges) after a

 minor version update broke production.

#### The Incident

**June 28, 2024 - Production Outage from Dependency Update:**

**What happened:**
```json
// package.json (before)
{
  "dependencies": {
    "express": "^4.18.0"  // ← Allowed minor/patch updates
  }
}
```

**Timeline:**
- **9:00 AM**: Deploy to production (working fine)
- **2:30 PM**: `express` released v4.19.0 (minor version bump)
- **3:15 PM**: Kubernetes pod restart (routine autoscaling)
- **3:16 PM**: Pod runs `npm install`, gets express@4.19.0
- **3:17 PM**: Application crashes on startup
- **3:18 PM**: All pods crash in cascade (rolling restart)
- **3:20 PM**: Complete outage (500 errors)
- **4:05 PM**: Root cause identified, rollback initiated
- **4:30 PM**: Service restored

**Root Cause:**

Express 4.19.0 introduced a breaking change in middleware initialization:

```javascript
// Worked in express@4.18.x
app.use('/api', apiRouter);

// Required in express@4.19.x
app.use('/api', apiRouter());  // ← Must invoke function
```

**Impact:**
- **Outage duration**: 75 minutes
- **Affected users**: 100% (complete outage)
- **Revenue loss**: $47,000 (estimated)
- **Customer complaints**: 234 support tickets
- **SLA breach**: 2 enterprise customers (penalty: $15,000)

**Why It Happened:**

Express maintainers classified it as a "minor" update (4.18 → 4.19) but it was semantically breaking. Our `^4.18.0` range automatically pulled 4.19.0 during pod restart.

#### The Solution

**Exact Version Pinning:**

```json
// ✅ Correct: Exact versions
{
  "dependencies": {
    "express": "4.18.2",        // No ^ or ~
    "lodash": "4.17.21",
    "axios": "1.6.2"
  },
  "devDependencies": {
    "jest": "29.7.0",
    "typescript": "5.3.3"
  }
}
```

**Why Exact Versions:**

1. **Deterministic builds**: Same code = same dependencies = same behavior
2. **Predictable deployments**: No surprises during pod restarts
3. **Controlled updates**: We decide when to update, not package authors
4. **Security patching**: We can still update (just deliberately)

#### Semver Ranges vs. Exact Versions

| Range | Example | Matches | Risk |
|-------|---------|---------|------|
| `^1.2.3` | express@^4.18.0 | 4.18.x, 4.19.x, 4.20.x | **HIGH** - Auto-updates minors |
| `~1.2.3` | express@~4.18.0 | 4.18.x only | **MEDIUM** - Auto-updates patches |
| `1.2.3` | express@4.18.2 | 4.18.2 only | **LOW** - No auto-updates |

**Our Choice: Exact versions (1.2.3)**

- Updates are intentional (via automated PRs)
- Security patches applied within 48 hours (automated)
- Breaking changes caught in CI/CD, not production

#### Implementation

**package.json Enforcement:**

```json
{
  "name": "api-server",
  "version": "1.0.0",
  "dependencies": {
    "express": "4.18.2",
    "body-parser": "1.20.2",
    "pg": "8.11.3"
  },
  "devDependencies": {
    "jest": "29.7.0",
    "eslint": "8.56.0"
  },
  "engines": {
    "node": "20.10.0",
    "npm": "10.2.5"
  }
}
```

**Lockfile Strategy:**

```bash
# Always commit lockfiles
git add package-lock.json
git add yarn.lock
git add pnpm-lock.yaml

# Never ignore lockfiles
# .gitignore should NOT contain:
# package-lock.json
# yarn.lock
```

**CI/CD Enforcement:**

```yaml
# .github/workflows/dependency-check.yml
name: Dependency Check

on: [pull_request]

jobs:
  check-exact-versions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Check for semver ranges
        run: |
          if grep -E '"\^|"~' package.json; then
            echo "❌ Found semver ranges (^ or ~) in package.json"
            echo "Use exact versions only. See DECISION-DEP-001"
            exit 1
          fi
          echo "✅ All dependencies use exact versions"
```

#### Dependency Update Strategy

**Automated Updates:**

We recommend using an automated dependency update tool (like Renovate or GitHub's native tools) to maintain security while adhering to exact version pinning.

**Update Process:**

1. **Scheduled Updates**: The automation creates PRs on a regular schedule (e.g., weekly).
2. **Automated tests**: CI/CD runs full test suite.
3. **Security check**: Scan for vulnerabilities (e.g., Snyk or GitHub Security).
4. **Manual review**: Engineer reviews changelog.
5. **Merge**: If tests pass + review approves.
6. **Deploy**: Staging → Production (next deploy cycle).

**Security Patches:**

Critical security vulnerabilities get expedited:

```bash
# Emergency security update
npm update package-name@1.2.4  # Exact version with security fix
npm run test                   # Verify tests pass
git add package.json package-lock.json
git commit -m "security: update package-name to 1.2.4 (CVE-2024-XXXXX)"
# Deploy immediately to production
```

#### Alternatives Considered

**Semver Ranges with Aggressive Testing:**
- ❌ **Rejected**: Can't test future versions (they don't exist yet)
- ❌ Still vulnerable to surprise updates during pod restarts
- ✅ Would be good for: Development dependencies (less critical)

**Renovate Bot (vs. GitHub native tools):**
- ✅ **Considered**: More flexible than native tools
- ❌ **Rejected**: Native tools are built into GitHub (one less tool)
- ⚖️ May revisit if we need more complex update strategies

**Manual Updates Only:**
- ❌ **Rejected**: Too slow for security patches
- ❌ Human error (forgetting to update)
- ✅ Would be good for: Very small projects (<5 dependencies)

#### Monitoring

**Dependency Health Metrics:**
- Average dependency age (target: <90 days)
- Security vulnerabilities (target: 0 high/critical)
- Update PR merge time (target: <48 hours)
- Failed updates (investigate if >10%)

**Alerts:**
- 🔴 **Critical**: High/critical CVE in production dependency
- 🟡 **Warning**: Dependency >180 days old
- 🟢 **Info**: Weekly automated update summary

**Dashboard:**
- Snyk: Security vulnerability tracking
- GitHub Security: Update stats
- Custom: Dependency age distribution

#### Developer Experience

**Making Updates Easy:**

```bash
# Check for outdated dependencies
npm outdated

# Review security vulnerabilities
npm audit

# Update specific package
npm install package-name@1.2.3 --save-exact

# Verify everything still works
npm test
```

**Documentation:**
- [Wiki: Dependency Update Process](https://wiki.company.com/engineering/dependencies)
- [Runbook: Emergency Security Update](https://wiki.company.com/runbooks/security-update)

#### Success Metrics

**Since Implementation (July 20, 2024):**
- ✅ Zero production outages from dependency updates (148 days)
- ✅ 234 dependencies updated via automation
- ✅ Average security patch time: 18 hours (was 7 days)
- ✅ 0 SLA breaches related to dependencies

**Developer Satisfaction:**
- Initial resistance: "Extra work to update manually"
- Current feedback: "Much more predictable, worth it"
- Update PR merge rate: 94% (high confidence)

#### Edge Cases

**When to Use Ranges:**

```json
{
  "dependencies": {
    "express": "4.18.2"  // ✅ Production: exact
  },
  "devDependencies": {
    "jest": "29.7.0",    // ✅ Dev: exact (consistency)
    "prettier": "3.1.1"  // ✅ Dev: exact (format consistency)
  },
  "peerDependencies": {
    "react": "^18.0.0"   // ✅ Peer: range OK (library compatibility)
  }
}
```

**Peer Dependencies:**
- ✅ Ranges allowed (libraries need flexibility)
- Example: React component library supports React 18.x

**Internal Packages:**
```json
{
  "dependencies": {
    "@company/ui-components": "2.4.1",  // ✅ Exact version
    "@company/utils": "1.8.0"           // ✅ Exact version
  }
}
```

#### Related Decisions

- **DECISION-DEP-002**: Node.js version pinning strategy
- **DECISION-DEP-003**: Docker base image version pinning
- **DECISION-INFRA-002**: Kubernetes image tag policy (no :latest)

#### References

- **Incident Report**: [Post-mortem - Express Update June 28, 2024](https://docs.google.com/document/d/express-outage-2024)
- **Dependency Research**: [Analysis of 50 Popular NPM Packages](https://docs.google.com/spreadsheets/d/npm-semver-analysis)
- **Industry Practice**: [How Stripe Manages Dependencies](https://stripe.com/blog/dependency-management)

---

**Last Updated**: 2024-12-15  
**Next Review**: 2025-01-20  
**Owner**: Platform Team (@platform-lead)  
**Status**: Active - enforced via Decision Guardian

**⚠️ IMPORTANT**

If Decision Guardian flags your package.json:
1. Remove `^` or `~` from dependency versions
2. Use exact versions (e.g., "1.2.3" not "^1.2.3")
3. Run `npm install` to update lockfile
4. Commit both package.json AND package-lock.json

**Questions? Ask in #platform-help**
