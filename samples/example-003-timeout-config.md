<!-- DECISION-PERF-001 -->
## Decision: HTTP Timeout Configuration for Payment Processing

**Status**: Active  
**Date**: 2024-09-10  
**Severity**: Critical

**Files**:
- `config/timeouts.ts`
- `src/services/payment-gateway.ts`
- `src/middleware/timeout-handler.ts`

**Rules**:
```json
{
  "type": "file",
  "pattern": "config/timeouts.ts",
  "content_rules": [
    {
      "mode": "line_range",
      "start": 1,
      "end": 25
    }
  ]
}
```

### Context

We enforce **strict timeout values** for payment processing to prevent race conditions and ensure data consistency.

#### The Incident

**August 28, 2024 - Payment Double-Charge Bug:**

A developer increased the payment gateway timeout from 30 seconds to 90 seconds to "reduce failed payments."

**What happened:**
1. User clicks "Pay Now" button
2. Payment gateway takes 45 seconds to respond (slow network)
3. User gets impatient, clicks button again
4. First request completes at 45s, charges card successfully
5. Second request also completes at 50s, charges card AGAIN
6. User charged twice: $299.99 × 2 = $599.98

**Impact:**
- 127 users double-charged over 3 days
- Total erroneous charges: $42,847.60
- Refund processing time: 2 weeks
- Customer support tickets: 89
- Trust damage: 12 users cancelled subscriptions
- **Estimated total cost**: $68,000 (refunds + support + churn)

#### Root Cause Analysis

**The Race Condition:**

Our payment idempotency key has a **30-second TTL** in Redis:
```typescript
// Idempotency key expires after 30 seconds
redis.setex(`payment:${userId}:${orderId}`, 30, 'processing');
```

**Timeline with 30s timeout (SAFE):**
```
T+0s:  Request 1 starts, idempotency key set
T+10s: Gateway responds, payment successful
T+10s: Idempotency key deleted
T+15s: User clicks again (impatient)
T+15s: Request 2 starts, NEW idempotency key (old one expired)
T+15s: Request 2 rejected (order already paid)
```

**Timeline with 90s timeout (BROKEN):**
```
T+0s:  Request 1 starts, idempotency key set
T+15s: User clicks again (no response yet)
T+15s: Request 2 starts, idempotency key still exists
T+15s: Request 2 proceeds (key exists = "in progress")
T+30s: Idempotency key expires (Redis TTL)
T+45s: Request 1 completes, charges card
T+50s: Request 2 completes, NEW key created, charges card AGAIN
```

#### The Solution

**Fixed timeout values that MUST NOT be changed:**

```typescript
// config/timeouts.ts
/**
 * CRITICAL: These timeouts are calibrated with Redis TTLs
 * DO NOT MODIFY without updating:
 * 1. Redis idempotency TTL (src/services/payment-gateway.ts)
 * 2. Load testing the full payment flow
 * 3. Approval from @payments-lead AND @infra-lead
 * 
 * Last incident: Aug 28, 2024 - Double charge bug
 * Decision: DECISION-PERF-001
 */
export const PAYMENT_TIMEOUTS = {
  /**
   * Payment gateway HTTP timeout
   * WHY 30 seconds:
   * - Matches Redis idempotency key TTL (30s)
   * - Stripe p99 response time: 8.2s
   * - PayPal p99 response time: 12.4s
   * - 30s provides 2.5x buffer over p99
   * 
   * DO NOT INCREASE: Creates race condition window
   * DO NOT DECREASE: Causes false payment failures
   */
  GATEWAY_REQUEST_MS: 30_000,

  /**
   * Time before showing "Still processing..." to user
   * WHY 15 seconds:
   * - Gives user feedback before they get anxious
   * - Prevents double-clicks during processing
   * - Half of gateway timeout (shows progress at midpoint)
   */
  USER_FEEDBACK_MS: 15_000,

  /**
   * Maximum time to wait for webhook confirmation
   * WHY 60 seconds:
   * - Webhooks can be delayed by gateway (30-60s typical)
   * - Must be longer than GATEWAY_REQUEST_MS
   * - Used for async payment methods (bank transfers)
   */
  WEBHOOK_WAIT_MS: 60_000,
} as const;
```

#### Why 30 Seconds Exactly

**Gateway Performance Data (measured over 30 days):**

| Gateway | p50 | p95 | p99 | Max |
|---------|-----|-----|-----|-----|
| Stripe | 2.1s | 5.8s | 8.2s | 14.3s |
| PayPal | 3.4s | 8.9s | 12.4s | 28.7s |
| Square | 1.8s | 4.2s | 6.1s | 11.2s |

**Buffer Calculation:**
- Worst p99: 12.4s (PayPal)
- Buffer multiplier: 2.5x (industry standard)
- Result: 12.4s × 2.5 = 31s
- **Chosen: 30s** (round number, aligns with Redis TTL)

**Redis Idempotency TTL:**
```typescript
// MUST match GATEWAY_REQUEST_MS
const IDEMPOTENCY_TTL_SECONDS = 30;
```

**Why NOT 60s or 90s:**
- Increases window for race conditions
- Users wait too long without feedback
- Higher timeout = higher double-click risk
- Our data shows: 99.8% of requests complete under 30s

**Why NOT 15s or 20s:**
- 12.4s p99 + 15s timeout = only 1.2x buffer (too tight)
- Would cause legitimate payment failures
- User experience: "Payment failed, try again" (frustrating)

#### Alternatives Considered

**Database-Based Idempotency (No Redis):**
- ❌ **Rejected**: Postgres has higher latency than Redis (15ms vs 1ms)
- ❌ Under high load, DB checks can take 50-100ms
- ❌ Race condition still possible (read → process → write gap)
- ✅ Would be good for: Strong consistency requirements (not needed here)

**Optimistic Locking:**
- ❌ **Rejected**: Payment gateways don't support versioning
- ❌ Can't rollback a charged card (only refund)
- ✅ Would be good for: Inventory management (our other use case)

**Client-Side Deduplication:**
- ❌ **Rejected**: Can't trust client (malicious users, bugs)
- ❌ User could clear browser state and retry
- ✅ Would be good for: Additional layer (we DO implement this)

**Server-Side Request Queuing:**
- ✅ **Implemented as additional safeguard**
- Queue ensures one payment request per user at a time
- But still need proper timeout + TTL alignment

#### Implementation Details

**Payment Flow with Timeout:**

```typescript
// src/services/payment-gateway.ts
import { PAYMENT_TIMEOUTS } from '@/config/timeouts';

async function processPayment(userId: string, amount: number) {
  const idempotencyKey = `payment:${userId}:${Date.now()}`;
  
  // 1. Check idempotency (30s TTL)
  const exists = await redis.get(idempotencyKey);
  if (exists) {
    throw new Error('Payment already in progress');
  }
  
  // 2. Set idempotency key (30s TTL)
  await redis.setex(idempotencyKey, 30, 'processing');
  
  try {
    // 3. Call payment gateway with 30s timeout
    const response = await axios.post(
      GATEWAY_URL,
      { amount, userId },
      { 
        timeout: PAYMENT_TIMEOUTS.GATEWAY_REQUEST_MS,
        headers: { 'Idempotency-Key': idempotencyKey }
      }
    );
    
    // 4. Success: Delete idempotency key immediately
    await redis.del(idempotencyKey);
    
    return response.data;
    
  } catch (error) {
    // 5. Failure: Keep key for remaining TTL (prevent retries)
    // Key will auto-expire after 30s
    throw error;
  }
}
```

**User Experience:**

```typescript
// Frontend timeout handling
const PaymentButton = () => {
  const [status, setStatus] = useState('idle');
  
  const handlePayment = async () => {
    setStatus('processing');
    
    // Show feedback after 15s
    const feedbackTimer = setTimeout(() => {
      setStatus('still_processing');
      // Show: "Payment is taking longer than usual. Please wait..."
    }, PAYMENT_TIMEOUTS.USER_FEEDBACK_MS);
    
    try {
      await processPayment();
      setStatus('success');
    } catch (error) {
      if (error.code === 'TIMEOUT') {
        setStatus('timeout');
        // Show: "Payment timed out. Check your email for confirmation."
      } else {
        setStatus('error');
      }
    } finally {
      clearTimeout(feedbackTimer);
    }
  };
  
  return (
    <button 
      onClick={handlePayment}
      disabled={status === 'processing' || status === 'still_processing'}
    >
      {status === 'processing' && 'Processing...'}
      {status === 'still_processing' && 'Still processing, please wait...'}
      {status === 'idle' && 'Pay Now'}
    </button>
  );
};
```

#### Monitoring & Alerts

**Metrics:**
- Payment timeout rate (target: <0.2%)
- Double-charge detection (target: 0)
- Gateway response time distribution
- Idempotency key collision rate

**Alerts:**
- 🔴 **Critical**: Any double-charge detected (page immediately)
- 🔴 **Critical**: Payment timeout rate >1% for 5 minutes
- 🟡 **Warning**: Gateway p95 response time >20s
- 🟡 **Warning**: Redis latency >10ms

**Dashboards:**
- Datadog: "Payment Processing Health"
- Real-time: Payment success/failure rates
- Daily: Timeout analysis, gateway performance

#### Testing Requirements

**Before Changing These Values:**

1. **Load Test** (required):
   ```bash
   # Simulate 1,000 concurrent payments
   # With varying network latencies
   npm run test:load:payments -- --timeout=NEW_VALUE
   ```

2. **Race Condition Test** (required):
   ```bash
   # Simulate double-click scenarios
   # Verify no double charges occur
   npm run test:race:payments
   ```

3. **Redis TTL Alignment** (required):
   ```bash
   # Verify idempotency TTL matches timeout
   npm run test:verify:timeouts
   ```

4. **Approval Required:**
   - @payments-lead review
   - @infra-lead review
   - Load test results attached to PR
   - 7-day monitoring period post-deploy

#### Success Metrics

**Since Implementation (Sept 10, 2024):**
- ✅ Zero double-charge incidents (97 days)
- ✅ Payment timeout rate: 0.14% (target: <0.2%)
- ✅ Gateway response time p99: 11.2s (well under 30s)
- ✅ User complaints: 0 related to timeouts

**Prevented Incidents:**
- 3 PRs attempted to increase timeout (blocked by Decision Guardian)
- All 3 developers educated on the race condition
- Team understanding of timeout criticality: 100%

#### When to Revisit

**Triggers:**
- Gateway p99 consistently >25s for 7 days
- Redis architecture changes (clustering, different TTL semantics)
- Payment provider changes (new gateway with different performance)
- Idempotency strategy changes (move to database, etc.)

**Review Schedule:**
- Quarterly: Review gateway performance data
- Annual: Full payment flow audit
- Next review: March 2025

#### References

- **Incident Report**: [Post-mortem - Double Charge Aug 28, 2024](https://docs.google.com/document/d/payment-double-charge)
- **Gateway Performance Data**: [30-Day Analysis Dashboard](https://datadog.com/dashboard/payments)
- **Load Test Results**: [Sept 8, 2024 - Timeout Calibration](https://github.com/company/load-tests/blob/main/payment-timeout-2024-09.md)
- **Slack Discussion**: [#payments channel Sept 1-5, 2024](https://company.slack.com/archives/C456/p1693526400)

#### Related Decisions

- **DECISION-PAY-002**: Payment idempotency key format
- **DECISION-PAY-003**: Refund processing timeouts
- **DECISION-INFRA-005**: Redis cluster configuration

---

**Last Updated**: 2024-12-15  
**Next Review**: 2025-03-10  
**Owner**: Payments Team (@payments-lead)  
**Status**: Active - enforced via Decision Guardian

**🚨 EXTREME CAUTION REQUIRED 🚨**

This configuration prevents financial loss. Changes require:
1. Full payment flow regression testing
2. Load testing under production conditions
3. Manual approval from Payments Lead + CTO
4. 2-week monitoring period with rollback plan ready

**Lines 1-25 of config/timeouts.ts are PROTECTED.**  
Decision Guardian will flag any changes to this critical section.
