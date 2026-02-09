# Additional Production-Grade Examples (8-10)

This file contains three more production-grade decision examples.

---

## Example 8: Error Logging Standards

<!-- DECISION-LOG-001 -->
## Decision: Structured Logging with Correlation IDs

**Status**: Active  
**Date**: 2024-04-15  
**Severity**: Warning

**Files**:
- `src/utils/logger.ts`
- `src/middleware/correlation-id.ts`
- `**/*.ts`

**Rules**:
```json
{
  "type": "file",
  "pattern": "src/**/*.ts",
  "exclude": "src/utils/logger.ts",
  "content_rules": [
    {
      "mode": "regex",
      "pattern": "console\\.(log|error|warn|info)",
      "flags": ""
    }
  ]
}
```

### Context

We mandate **structured logging with correlation IDs** to make production debugging tractable.

#### The Debugging Nightmare

**March 20, 2024 - 6-Hour Debug Session:**

Production error: "Payment processing failed" (no context)

**Attempting to debug:**
```javascript
// The unhelpful log
console.log('Payment processing failed');
// Which user? Which payment? Which server? What time exactly?
```

**What we had to do:**
1. Search CloudWatch for "Payment processing failed"
2. Found 4,847 matching logs in last hour
3. No way to correlate with user session
4. No request ID to link logs together
5. Spent 6 hours adding debug logs + redeploying
6. **Cost**: 6 engineer-hours + user frustration

#### The Solution

**Structured Logger:**

```typescript
// src/utils/logger.ts
import { v4 as uuidv4 } from 'uuid';

interface LogContext {
  correlationId?: string;
  userId?: string;
  requestId?: string;
  [key: string]: any;
}

class Logger {
  private context: LogContext = {};

  setContext(context: LogContext) {
    this.context = { ...this.context, ...context };
  }

  info(message: string, data?: object) {
    console.log(JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      message,
      ...this.context,
      ...data
    }));
  }

  error(message: string, error?: Error, data?: object) {
    console.error(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      message,
      error: error?.message,
      stack: error?.stack,
      ...this.context,
      ...data
    }));
  }
}

export const logger = new Logger();
```

**Usage:**

```typescript
// ❌ Before: Unhelpful
console.log('Payment processing failed');

// ✅ After: Actionable
logger.error('Payment processing failed', error, {
  userId: '123',
  paymentId: 'pay_456',
  amount: 99.99,
  gateway: 'stripe'
});

// Output:
// {
//   "level": "error",
//   "timestamp": "2024-04-15T14:32:15.123Z",
//   "message": "Payment processing failed",
//   "correlationId": "req_abc123",
//   "userId": "123",
//   "paymentId": "pay_456",
//   "amount": 99.99,
//   "gateway": "stripe",
//   "error": "Card declined",
//   "stack": "Error: Card declined\n    at processPayment..."
// }
```

**Correlation ID Middleware:**

```typescript
// src/middleware/correlation-id.ts
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/utils/logger';

export function correlationIdMiddleware(req, res, next) {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  
  logger.setContext({
    correlationId,
    userId: req.user?.id,
    requestId: uuidv4(),
    method: req.method,
    path: req.path
  });
  
  next();
}
```

**Benefits:**

1. **Trace full request:** All logs share correlationId
2. **Find user sessions:** Filter by userId
3. **Debugging:** JSON logs → CloudWatch Insights queries
4. **Performance:** Identify slow operations by request

**Success Metrics:**
- Debug time: 6 hours → 15 minutes
- Mean time to resolution: 82% faster
- False positive alerts: Reduced 67%

---

## Example 9: Infrastructure as Code Validation

<!-- DECISION-INFRA-001 -->
## Decision: Terraform Required for All Infrastructure Changes

**Status**: Active  
**Date**: 2024-03-01  
**Severity**: Critical

**Files**:
- `terraform/**/*.tf`
- `!.terraform/**`
- `!terraform.tfstate`

**Rules**:
```json
{
  "type": "file",
  "pattern": "terraform/**/*.tf",
  "content_rules": [
    {
      "mode": "string",
      "patterns": ["provider \"aws\"", "resource \"aws_"]
    }
  ]
}
```

### Context

**No infrastructure changes without Terraform** to prevent "ClickOps" disasters and maintain audit trail.

#### The ClickOps Disaster

**February 10, 2024 - Production Database Deleted:**

Engineer manually deleted "test" RDS instance via AWS Console. It was production.

**What happened:**
1. Engineer logged into AWS Console (bypass Terraform)
2. Selected RDS instance (thought it was staging)
3. Clicked "Delete" (no confirmation in Terraform)
4. **Realized mistake 10 seconds later** (too late)
5. Database gone (30-minute backup lag)
6. **Data loss**: 30 minutes of transactions
7. **Downtime**: 45 minutes (restore from backup)
8. **Cost**: $85K (recovery + manual data reconciliation)

**Why it happened:**
- No IAM restriction on Console access
- No required review process
- Instance naming ambiguous (prod-db-1 vs prod-db-test)
- Manual changes invisible to team

#### The Solution

**Terraform-Only Policy:**

```terraform
# terraform/rds.tf
resource "aws_db_instance" "production" {
  identifier = "production-db-primary"  # Clear naming
  
  # Deletion protection
  deletion_protection = true
  skip_final_snapshot = false
  final_snapshot_identifier = "production-db-final-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
  
  # Explicit lifecycle
  lifecycle {
    prevent_destroy = true  # Terraform will refuse to destroy
  }
  
  tags = {
    Environment = "production"
    ManagedBy = "terraform"
    Team = "platform"
  }
}
```

**IAM Policy (Prevent Console Changes):**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Deny",
      "Action": [
        "rds:DeleteDBInstance",
        "rds:ModifyDBInstance",
        "ec2:TerminateInstances"
      ],
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "aws:PrincipalArn": "arn:aws:iam::123456789:role/TerraformRole"
        }
      }
    }
  ]
}
```

**PR Process:**

1. Make Terraform change
2. Run `terraform plan` (review diff)
3. Open PR with plan output
4. Team reviews (2 approvals required for production)
5. Merge → Automated `terraform apply`
6. Slack notification with change summary

**Benefits:**
- **Audit trail**: Git history = infrastructure history
- **Peer review**: Team sees all changes
- **Rollback**: `git revert` = infrastructure rollback
- **Documentation**: Code IS documentation
- **Reproducible**: Disaster recovery = `terraform apply`

**Success Metrics:**
- Manual AWS changes: 100% prevented
- Infrastructure incidents: 0 (since March 2024)
- Audit compliance: 100% (vs 0% before)

---

## Example 10: Test Coverage Requirements

<!-- DECISION-TEST-001 -->
## Decision: 80% Test Coverage for Critical Paths

**Status**: Active  
**Date**: 2024-02-01  
**Severity**: Warning

**Files**:
- `src/services/payment/**/*.ts`
- `src/services/auth/**/*.ts`
- `src/services/billing/**/*.ts`
- `!**/*.test.ts`

**Rules**:
```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "src/services/{payment,auth,billing}/**/*.ts",
      "exclude": "**/*.test.ts"
    }
  ]
}
```

### Context

**Critical business logic requires 80% test coverage** to prevent regressions in payment, auth, and billing.

#### The Regression Bug

**January 15, 2024 - Refactor Broke Payments:**

Developer refactored payment service without tests:

```typescript
// Before (working)
function calculateTax(amount: number, country: string): number {
  if (country === 'US') {
    return amount * 0.07;
  }
  return amount * 0.20; // EU default
}

// After (broken) - refactored for "cleanliness"
function calculateTax(amount: number, country: string): number {
  const taxRates = {
    'US': 0.07,
    'EU': 0.20
  };
  return amount * taxRates[country]; // ← Bug: undefined for non-US/EU
}

// Result: Canada customers charged $0 tax
```

**Impact:**
- 147 orders with incorrect tax
- **Revenue loss**: $8,420 in uncollected tax
- Legal compliance issue (incorrect tax reporting)
- Manual corrections required

**Why it wasn't caught:**
- No tests for tax calculation
- Manual QA tested US only (missed Canada)
- Code review didn't catch edge case

#### The Solution

**Coverage Requirements:**

```json
// jest.config.js
{
  "coverageThreshold": {
    "global": {
      "statements": 60,
      "branches": 60,
      "functions": 60,
      "lines": 60
    },
    // Critical paths: Higher threshold
    "./src/services/payment/**/*.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "./src/services/auth/**/*.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    },
    "./src/services/billing/**/*.ts": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    }
  }
}
```

**Required Tests:**

```typescript
// payment.test.ts
describe('calculateTax', () => {
  it('calculates US tax correctly', () => {
    expect(calculateTax(100, 'US')).toBe(7);
  });
  
  it('calculates EU tax correctly', () => {
    expect(calculateTax(100, 'DE')).toBe(20);
  });
  
  it('handles unsupported countries', () => {
    expect(calculateTax(100, 'CA')).toBe(20); // Default to EU rate
  });
  
  it('handles edge cases', () => {
    expect(calculateTax(0, 'US')).toBe(0);
    expect(calculateTax(0.01, 'US')).toBeCloseTo(0.0007);
  });
});
```

**CI/CD Enforcement:**

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm test -- --coverage

- name: Check coverage
  run: |
    if ! npm test -- --coverage --coverageReporters=text-summary | grep -E "Statements.*: (8[0-9]|9[0-9]|100)%"; then
      echo "❌ Critical paths below 80% coverage"
      exit 1
    fi
```

**PR Checks:**
- Tests must pass
- Coverage must meet threshold
- Decision Guardian alerts if critical files modified without tests

**Benefits:**
- Catch bugs before production
- Safe refactoring (tests verify behavior)
- Documentation (tests show how code works)
- Faster debugging (failing test = root cause)

**Success Metrics:**
- Bugs in critical paths: 89% reduction
- Regression bugs: 0 (since Feb 2024)
- Refactoring confidence: "High" (team survey)

**When Coverage Doesn't Matter:**
- Utility functions (trivial code)
- Generated code (Prisma schema, etc.)
- UI components (prefer E2E tests)

---

## Using These Examples

### Example 8 (Logging) Use Cases:
- **Debugging production issues** without SSH access
- **Tracing user sessions** across microservices
- **Performance profiling** (find slow operations)
- **Security auditing** (track suspicious activity)

### Example 9 (Infrastructure) Use Cases:
- **Prevent accidental deletions** (deletion_protection)
- **Audit infrastructure changes** (git history)
- **Disaster recovery** (terraform apply = rebuild)
- **Multi-environment consistency** (same Terraform, different vars)

### Example 10 (Test Coverage) Use Cases:
- **Safe refactoring** (tests catch regressions)
- **Onboarding** (tests as documentation)
- **Code review** (missing tests = red flag)
- **Compliance** (SOC2 requires test coverage)

---

**Author**: Ali Abbas  
**Organization**: Decispher  
**Last Updated**: 2024-12-15
