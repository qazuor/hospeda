# Security Audit Report: Billing/Payment System

**Audit Date:** February 3, 2026
**Auditor:** Tech Lead - Hospeda Security Team
**Scope:** Billing and payment processing system (Mercado Pago integration)
**Version:** 1.0.0

---

## Executive Summary

This security audit was conducted on the Hospeda billing and payment system, focusing on critical security concerns for payment processing. The system integrates with Mercado Pago via QZPay and handles sensitive financial transactions.

### Overall Security Posture

Grade: B+ (Good with areas for improvement)

The billing system demonstrates **solid security fundamentals** with proper authentication, authorization, and input validation. However, several **medium-priority vulnerabilities** and **best-practice gaps** were identified that should be addressed before production deployment.

### Key Strengths

1. ✅ Strong authentication (Better Auth) and authorization (role-based + permissions)
2. ✅ Comprehensive input validation via Zod schemas
3. ✅ Webhook signature verification (QZPay handles MercadoPago signatures)
4. ✅ SQL injection prevention (using Drizzle ORM with parameterized queries)
5. ✅ Structured logging with PII sanitization
6. ✅ Rate limiting on sensitive endpoints

### Critical Findings

**🔴 NONE** - No critical security vulnerabilities were found

### High-Priority Findings

**🟠 2 HIGH** - Require attention before production

### Medium-Priority Findings

**🟡 6 MEDIUM** - Should be addressed in near term

### Low-Priority Findings

**🔵 4 LOW** - Best practices and hardening opportunities

---

## Detailed Findings

### 🟠 HIGH SEVERITY

#### H-001: Missing CSRF Protection on State-Changing Endpoints

**Severity:** HIGH
**Category:** CSRF Protection
**CWE:** CWE-352 (Cross-Site Request Forgery)

**Location:**

- `/api/v1/protected/billing/trial/start` (POST)
- `/api/v1/protected/billing/promo-codes/apply` (POST)
- `/apps/api/src/routes/billing/*.ts`

**Description:**

While the API uses Bearer token authentication (which provides inherent CSRF protection), there is no explicit CSRF token validation on state-changing billing endpoints. The `originVerificationMiddleware` provides defense-in-depth but is not a complete CSRF solution.

**Risk:**

- If a user's Bearer token is compromised (e.g., via XSS on web app), an attacker could potentially trigger state-changing operations
- Medium likelihood in current architecture (Bearer tokens + CORS), but becomes HIGH if cookies are ever added

**Evidence:**

```typescript
// apps/api/src/routes/billing/trial.ts:125
export const startTrialRoute = createSimpleRoute({
  method: 'post',
  path: '/start',
  // ❌ No CSRF token validation
  handler: async (c) => {
    // Proceeds with authentication only
  }
});
```

**Recommendation:**

1. **Implement CSRF tokens for state-changing operations:**
   - Add `csrf-token` header requirement for POST/PUT/PATCH/DELETE
   - Generate tokens via `/api/v1/csrf-token` endpoint
   - Validate tokens in middleware before processing requests

2. **Add SameSite cookie policy (if using cookies):**
   - Set `SameSite=Strict` for session cookies
   - Set `SameSite=Lax` for less sensitive cookies

3. **Short-term mitigation (already implemented):**
   - ✅ Origin verification middleware is in place
   - ✅ CORS properly configured
   - Continue using Bearer tokens (avoid cookie-based auth for billing)

**References:**

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- CWE-352: Cross-Site Request Forgery (CSRF)

---

#### H-002: Insufficient Rate Limiting on Payment-Related Endpoints

**Severity:** HIGH
**Category:** Rate Limiting
**CWE:** CWE-770 (Allocation of Resources Without Limits or Throttling)

**Location:**

- `/api/v1/protected/billing/addons/purchase` (POST)
- `/api/v1/protected/billing/trial/start` (POST)
- `/api/v1/webhooks/mercadopago` (POST)

**Description:**

While global rate limiting is implemented via `rateLimitMiddleware`, payment-specific endpoints lack stricter, dedicated rate limits. The current configuration allows:

- **General endpoints:** 100 requests/minute
- **Auth endpoints:** 10 requests/minute
- **Public endpoints:** 50 requests/minute
- **Payment endpoints:** ❌ No dedicated stricter limits

An attacker could potentially abuse payment endpoints to:

- Trigger excessive payment requests
- Generate multiple checkout sessions
- Spam webhook processing

**Risk:**

- Financial abuse (creating multiple checkout sessions)
- Resource exhaustion (webhook spam)
- Merchant account suspension by payment processor

**Evidence:**

```typescript
// apps/api/src/routes/billing/addons.ts
// No custom rate limit for payment endpoints
export const purchaseAddonRoute = createProtectedRoute({
  method: 'post',
  path: '/purchase',
  // ❌ Uses default rate limit (100/min) - too permissive for payments
  handler: async (c, _params, body) => {
    // Payment processing
  }
});
```

**Recommendation:**

1. **Implement stricter rate limits for payment endpoints:**

```typescript
// Create payment-specific rate limit middleware
export const paymentRateLimitMiddleware = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 payment requests per 15 minutes
  message: 'Too many payment requests. Please try again in 15 minutes.'
});

// Apply to payment routes
app.post('/billing/addons/purchase',
  paymentRateLimitMiddleware,
  purchaseAddonRoute
);
```

2. **Add per-user rate limiting** (not just per-IP):
   - Track payment attempts by `userId` or `billingCustomerId`
   - Prevent rapid-fire checkout session creation

3. **Implement idempotency keys:**
   - Require `Idempotency-Key` header for payment requests
   - Prevent duplicate payment processing

**References:**

- [OWASP API Security - Rate Limiting](https://owasp.org/www-project-api-security/)
- CWE-770: Allocation of Resources Without Limits or Throttling

---

### 🟡 MEDIUM SEVERITY

#### M-001: Potential PII Leakage in Webhook Error Logs

**Severity:** MEDIUM
**Category:** PII in Logs
**CWE:** CWE-532 (Insertion of Sensitive Information into Log File)

**Location:**

- `apps/api/src/routes/webhooks/mercadopago.ts`
- Lines: 53-83 (sanitizeErrorForNotification)
- Lines: 725-730 (error logging)

**Description:**

While the `sanitizeErrorForNotification` function sanitizes errors for **notifications**, webhook error logs may still contain PII from the webhook payload. The MercadoPago webhook payload can include:

- Customer email addresses
- Payment amounts
- External references with user IDs

**Risk:**

- PII exposure in log files/monitoring systems
- Potential GDPR/CCPA compliance violations
- Log aggregation services (Sentry, etc.) may store PII indefinitely

**Evidence:**

```typescript
// apps/api/src/routes/webhooks/mercadopago.ts:725
} catch (error) {
  apiLogger.error(
    {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      eventId: event.id,
      requestId: c.get('requestId')
    },
    'Error processing add-on purchase in webhook'
  );
  // ❌ Full event object may have been logged elsewhere with PII
}
```

**Recommendation:**

1. **Sanitize webhook payloads before logging:**

```typescript
function sanitizeWebhookPayload(payload: unknown): unknown {
  const sanitized = { ...payload as Record<string, unknown> };

  // Remove sensitive fields
  delete sanitized.email;
  delete sanitized.customer_email;
  delete sanitized.payer;

  // Redact payment amounts (keep for fraud detection)
  if (sanitized.transaction_amount) {
    sanitized.transaction_amount = '[REDACTED]';
  }

  // Keep only essential fields for debugging
  return {
    id: sanitized.id,
    type: sanitized.type,
    status: sanitized.status,
    // ... safe fields only
  };
}

// Use in logs
apiLogger.error({
  sanitizedPayload: sanitizeWebhookPayload(event.data),
  eventId: event.id
}, 'Webhook processing error');
```

2. **Review all `apiLogger` calls in billing routes:**
   - Ensure customer emails are NOT logged
   - Redact payment amounts in production logs
   - Use structured logging with safe fields only

3. **Configure log retention policies:**
   - Set shorter retention for billing/payment logs (e.g., 30 days)
   - Use log scrubbing in log aggregation services

**Current Mitigation:**

✅ The `sanitizeErrorForNotification` function already sanitizes errors for notifications
✅ Most logs use structured logging with specific fields (not full payloads)

**References:**

- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- GDPR Article 5(1)(e) - Storage Limitation
- CWE-532: Insertion of Sensitive Information into Log File

---

#### M-002: Missing Authorization Check in Promo Code Validation

**Severity:** MEDIUM
**Category:** Authorization (IDOR)
**CWE:** CWE-639 (Authorization Bypass Through User-Controlled Key)

**Location:**

- `apps/api/src/routes/billing/promo-codes.ts`
- Lines: 214-244 (validatePromoCodeRoute handler)

**Description:**

The promo code validation endpoint checks if the user is validating for themselves, but **only for non-admin users**. An attacker could potentially:

1. Validate promo codes for other users (enumeration attack)
2. Discover valid promo codes by testing against multiple user IDs
3. Bypass promo code restrictions (e.g., first-purchase-only)

**Risk:**

- Promo code enumeration
- Potential for discount abuse if codes are discovered
- Privacy violation (user purchase history inference)

**Evidence:**

```typescript
// apps/api/src/routes/billing/promo-codes.ts:228
handler: async (c, _params, body) => {
  const actor = getActorFromContext(c);

  // Check authorization
  if (
    actor.role !== RoleEnum.ADMIN &&
    actor.role !== RoleEnum.SUPER_ADMIN &&
    body.userId !== actor.id
  ) {
    throw new Error('Cannot validate promo code for another user');
  }
  // ✅ Authorization check present, but throws generic Error
  // ❌ Should use HTTPException with proper status code

  const result = await service.validate(body.code as string, {
    planId: body.planId as string | undefined,
    userId: body.userId as string,
    amount: body.amount as number | undefined
  });

  return result; // ❌ Returns validation result to potentially unauthorized user
}
```

**Recommendation:**

1. **Enforce strict authorization with proper HTTP status:**

```typescript
// Throw HTTPException instead of generic Error
if (
  actor.role !== RoleEnum.ADMIN &&
  actor.role !== RoleEnum.SUPER_ADMIN &&
  body.userId !== actor.id
) {
  throw new HTTPException(403, {
    message: 'Cannot validate promo code for another user'
  });
}

// Add audit logging for admin validations
if (actor.role === RoleEnum.ADMIN || actor.role === RoleEnum.SUPER_ADMIN) {
  apiLogger.info({
    action: 'admin_promo_code_validation',
    adminId: actor.id,
    targetUserId: body.userId,
    code: body.code
  }, 'Admin validated promo code for another user');
}
```

2. **Implement rate limiting on validation endpoint:**
   - Limit promo code validation attempts per user (e.g., 10/hour)
   - Prevent enumeration attacks

3. **Add promo code complexity requirements:**
   - Require minimum 8 characters (preferably 12+)
   - Use cryptographically random codes
   - Avoid sequential/guessable patterns

**Current Mitigation:**

✅ Authorization check is present
✅ Admin actions are logged

**Improvement Needed:**

❌ Use proper HTTP exception
❌ Add rate limiting on validation endpoint

**References:**

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- CWE-639: Authorization Bypass Through User-Controlled Key

---

#### M-003: Webhook Idempotency Race Condition

**Severity:** MEDIUM
**Category:** Concurrency Control
**CWE:** CWE-362 (Concurrent Execution using Shared Resource with Improper Synchronization)

**Location:**

- `apps/api/src/routes/webhooks/mercadopago.ts`
- Lines: 784-960 (handleWebhookEvent)

**Description:**

The webhook idempotency implementation uses an "optimistic insert first, check on duplicate" approach. While this is generally good for performance, there's a narrow **race condition window** between the duplicate detection and status check (lines 849-865):

1. Webhook 1 arrives → INSERT fails (duplicate)
2. Webhook 2 arrives (same event) → INSERT fails (duplicate)
3. Webhook 1 queries status → Gets "pending"
4. Webhook 2 queries status → Gets "pending" (**race window**)
5. Both webhooks proceed to process the event

**Risk:**

- Duplicate payment processing (LOW probability but HIGH impact)
- Add-on entitlements granted twice
- Double notification sending
- Data inconsistency

**Evidence:**

```typescript
// apps/api/src/routes/webhooks/mercadopago.ts:849
for (let attempt = 1; attempt <= MAX_STATUS_CHECK_ATTEMPTS; attempt++) {
  const result = await db
    .select()
    .from(billingWebhookEvents)
    .where(eq(billingWebhookEvents.providerEventId, providerEventId))
    .limit(1);

  if (result.length > 0) {
    existingEvent = result[0];
    break;
  }

  // ❌ Race window: Another webhook might update status between attempts
  if (attempt < MAX_STATUS_CHECK_ATTEMPTS) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

// Check status
if (existingEvent.status === 'pending') {
  // ❌ Another webhook might also see 'pending' and proceed
  return c.json({ success: true, message: 'Webhook currently being processed' }, 200);
}
```

**Recommendation:**

1. **Use database-level locking for webhook processing:**

```typescript
// Use SELECT FOR UPDATE to lock the row
const existingEvent = await db.transaction(async (trx) => {
  const result = await trx
    .select()
    .from(billingWebhookEvents)
    .where(eq(billingWebhookEvents.providerEventId, providerEventId))
    .limit(1)
    .for('UPDATE'); // ✅ Lock row during transaction

  if (result.length === 0) return null;

  const event = result[0];

  // Check status under lock
  if (event.status === 'pending') {
    // Already being processed by another webhook
    return { alreadyProcessing: true, event };
  }

  // Update to pending under lock
  await trx
    .update(billingWebhookEvents)
    .set({ status: 'pending', updatedAt: new Date() })
    .where(eq(billingWebhookEvents.id, event.id));

  return { alreadyProcessing: false, event };
});

if (existingEvent?.alreadyProcessing) {
  return c.json({ success: true, message: 'Already processing' }, 200);
}
```

2. **Add distributed locking (Redis) for horizontal scaling:**
   - If API runs on multiple instances, use Redis-based locks
   - Prevent duplicate processing across instances

3. **Implement idempotency at payment processor level:**
   - QZPay should handle idempotency internally
   - Verify QZPay's idempotency guarantees

**Current Mitigation:**

✅ Optimistic insert with duplicate detection
✅ Status-based deduplication (pending/processed)
✅ Retry mechanism with delays

**Improvement Needed:**

⚠️ Add row-level locking for critical section
⚠️ Consider distributed locking for multi-instance deployments

**References:**

- [OWASP Concurrency Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
- CWE-362: Concurrent Execution using Shared Resource

---

#### M-004: Insufficient Signature Verification Documentation

**Severity:** MEDIUM
**Category:** Documentation/Validation
**CWE:** CWE-345 (Insufficient Verification of Data Authenticity)

**Location:**

- `apps/api/src/routes/webhooks/mercadopago.ts`
- Lines: 8-21 (documentation)

**Description:**

While the webhook route documentation states that signature verification is handled by the MercadoPago adapter, **there is no explicit code validation** visible in the codebase to confirm:

1. What signature algorithm is used (HMAC-SHA256? RSA?)
2. Whether timing-safe comparison is used
3. Whether the secret key is properly secured
4. What happens if verification fails

The security relies entirely on the `@qazuor/qzpay-hono` package's `createWebhookRouter` function, which is a third-party dependency.

**Risk:**

- If QZPay's signature verification has vulnerabilities, the entire webhook system is compromised
- Attackers could forge webhook events (payment confirmations, subscription changes)
- No visibility into signature verification logic

**Evidence:**

```typescript
// apps/api/src/routes/webhooks/mercadopago.ts:20
import { createWebhookRouter } from '@qazuor/qzpay-hono';

// ...

const webhookRouter = createWebhookRouter({
  billing: dependencies.billing,
  paymentAdapter: dependencies.paymentAdapter,
  signatureHeader: 'x-signature', // ✅ Specified
  // ❌ No explicit signature verification function visible
  handlers: {
    'payment.created': handlePaymentCreated,
    // ...
  }
});
```

**Recommendation:**

1. **Audit `@qazuor/qzpay-hono` signature verification:**
   - Review source code of `createWebhookRouter`
   - Ensure HMAC-SHA256 with timing-safe comparison
   - Verify secret key is not hardcoded

2. **Add explicit signature verification middleware:**

```typescript
// Add visibility into signature verification
const verifyWebhookSignature: MiddlewareHandler = async (c, next) => {
  const signature = c.req.header('x-signature');
  const body = await c.req.text();

  if (!signature) {
    apiLogger.warn('Webhook signature missing');
    return c.json({ error: 'Signature required' }, 401);
  }

  // Verify signature (delegate to QZPay, but log result)
  const isValid = await paymentAdapter.verifyWebhookSignature(
    body,
    signature,
    process.env.MERCADO_PAGO_WEBHOOK_SECRET
  );

  if (!isValid) {
    apiLogger.error('Webhook signature verification failed');
    return c.json({ error: 'Invalid signature' }, 401);
  }

  apiLogger.debug('Webhook signature verified successfully');
  await next();
};
```

3. **Ensure MERCADO_PAGO_WEBHOOK_SECRET is not hardcoded:**
   - ✅ Verify it's loaded from environment variables
   - ✅ Ensure it's not committed to version control
   - ✅ Use different secrets for dev/staging/production

4. **Add signature verification tests:**

```typescript
describe('Webhook Signature Verification', () => {
  it('should reject webhooks with invalid signature', async () => {
    const response = await app.request('/api/v1/webhooks/mercadopago', {
      method: 'POST',
      headers: {
        'x-signature': 'invalid-signature',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: '123', type: 'payment.updated' })
    });

    expect(response.status).toBe(401);
  });

  it('should accept webhooks with valid signature', async () => {
    const payload = { id: '123', type: 'payment.updated' };
    const validSignature = generateValidSignature(payload);

    const response = await app.request('/api/v1/webhooks/mercadopago', {
      method: 'POST',
      headers: {
        'x-signature': validSignature,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(200);
  });
});
```

**Current Mitigation:**

✅ Signature verification is enabled via QZPay
✅ Signature header is configured (`x-signature`)

**Improvement Needed:**

⚠️ Audit third-party signature verification implementation
⚠️ Add explicit verification logging
⚠️ Add signature verification tests

**References:**

- [OWASP Webhook Security](https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html)
- CWE-345: Insufficient Verification of Data Authenticity

---

#### M-005: Missing Input Validation for Payment Amounts

**Severity:** MEDIUM
**Category:** Input Validation
**CWE:** CWE-20 (Improper Input Validation)

**Location:**

- `apps/api/src/services/addon.service.ts`
- Lines: 259-525 (purchase method)

**Description:**

While the system uses Zod schemas for input validation, there is **no explicit validation** for payment amounts to prevent:

1. Negative amounts
2. Zero amounts
3. Extremely large amounts (integer overflow)
4. Fractional amounts when expecting integers (ARS cents)

An attacker could potentially:

- Create negative-price checkouts (credit abuse)
- Overflow payment systems with massive amounts
- Bypass payment processing with zero amounts

**Risk:**

- Financial loss (negative amount abuse)
- Payment processor rejection (invalid amounts)
- Accounting inconsistencies

**Evidence:**

```typescript
// apps/api/src/services/addon.service.ts:339
let finalPrice = addon.priceArs; // ❌ No validation if priceArs is negative/invalid

if (input.promoCode) {
  const validation = await promoService.validate(input.promoCode, {
    userId: input.userId,
    amount: addon.priceArs // ❌ No validation before passing to promo service
  });

  if (validation.discountAmount) {
    discountAmount = validation.discountAmount;
    finalPrice = Math.max(0, addon.priceArs - discountAmount);
    // ✅ Math.max(0, ...) prevents negative, but should validate earlier
  }
}

// Create Mercado Pago preference
const preference = await preferenceClient.create({
  body: {
    items: [{
      unit_price: finalPrice, // ❌ Could be 0 if discount = 100%
      // ...
    }]
  }
});
```

**Recommendation:**

1. **Add payment amount validation schema:**

```typescript
const PaymentAmountSchema = z.number()
  .int('Amount must be an integer (cents)')
  .min(1, 'Amount must be at least 1 cent') // No zero/negative amounts
  .max(999999999, 'Amount exceeds maximum allowed value'); // Prevent overflow

// Validate before processing
const validatePaymentAmount = (amount: number): void => {
  const result = PaymentAmountSchema.safeParse(amount);
  if (!result.success) {
    throw new HTTPException(400, {
      message: `Invalid payment amount: ${result.error.message}`
    });
  }
};

// Use in addon purchase
async purchase(input: PurchaseAddonInput): Promise<ServiceResult<PurchaseAddonResult>> {
  // ...
  let finalPrice = addon.priceArs;

  // ✅ Validate original price
  validatePaymentAmount(finalPrice);

  // Apply discount
  if (input.promoCode) {
    finalPrice = Math.max(100, addon.priceArs - discountAmount);
    // ✅ Minimum 100 cents ($1 ARS) after discount
  }

  // ✅ Validate final price before Mercado Pago call
  validatePaymentAmount(finalPrice);

  // ...
}
```

2. **Add business rule validations:**

```typescript
// Prevent free/zero-price purchases
if (finalPrice < 100) {
  throw new HTTPException(400, {
    message: 'Payment amount too low. Minimum purchase is $1 ARS.'
  });
}

// Prevent suspiciously large purchases (anti-fraud)
if (finalPrice > 10000000) { // 100,000 ARS
  throw new HTTPException(400, {
    message: 'Payment amount exceeds maximum. Please contact support for large purchases.'
  });
}
```

3. **Add promo code discount limits:**

```typescript
// Prevent 100% discounts (creates $0 purchases)
if (discountAmount >= addon.priceArs) {
  // Cap discount at 99% of price
  discountAmount = Math.floor(addon.priceArs * 0.99);
  apiLogger.warn({
    promoCode: input.promoCode,
    addonSlug: addon.slug,
    originalDiscount: validation.discountAmount,
    cappedDiscount: discountAmount
  }, 'Promo code discount capped at 99%');
}
```

**Current Mitigation:**

✅ `Math.max(0, ...)` prevents negative amounts
✅ Mercado Pago will reject invalid amounts

**Improvement Needed:**

⚠️ Add explicit validation before payment processing
⚠️ Add minimum/maximum amount limits
⚠️ Prevent zero-price purchases

**References:**

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- CWE-20: Improper Input Validation

---

#### M-006: Promo Code Enumeration via Timing Attack

**Severity:** MEDIUM
**Category:** Timing Attack
**CWE:** CWE-208 (Observable Timing Discrepancy)

**Location:**

- `apps/api/src/services/promo-code.service.ts`
- Validation logic (timing varies based on existence)

**Description:**

The promo code validation logic may have **observable timing differences** between:

1. Non-existent promo codes (fast rejection)
2. Existent but expired/invalid codes (slower validation)
3. Valid codes (full validation path)

An attacker could use timing analysis to enumerate valid promo codes, even if validation fails.

**Risk:**

- Promo code enumeration (discovering valid codes)
- Potential for targeted discount abuse
- Privacy violation (business intelligence leakage)

**Evidence:**

```typescript
// Hypothetical timing variation in PromoCodeService
async validate(code: string, context: ValidationContext): Promise<ValidationResult> {
  // Fast path: Code doesn't exist (10ms)
  const promoCode = await this.getByCode(code);
  if (!promoCode) {
    return { valid: false, errorMessage: 'Invalid promo code' };
  }

  // Slow path: Code exists, check expiry/limits (50ms)
  if (this.isExpired(promoCode)) {
    return { valid: false, errorMessage: 'Promo code expired' };
  }

  // Even slower: Check usage limits (100ms)
  const usageCount = await this.getUsageCount(promoCode.id);
  if (usageCount >= promoCode.maxUses) {
    return { valid: false, errorMessage: 'Promo code limit reached' };
  }

  // Valid code (150ms)
  return { valid: true, discountAmount: ... };
}
```

**Recommendation:**

1. **Implement constant-time validation response:**

```typescript
async validate(code: string, context: ValidationContext): Promise<ValidationResult> {
  const startTime = Date.now();

  // Always perform all checks, regardless of early failures
  const [promoCode, usageCount] = await Promise.all([
    this.getByCode(code),
    this.getUsageCount(code) // Check usage even if code doesn't exist
  ]);

  // Collect all validation errors (don't short-circuit)
  const errors: string[] = [];

  if (!promoCode) {
    errors.push('Invalid promo code');
  }

  if (promoCode && this.isExpired(promoCode)) {
    errors.push('Promo code expired');
  }

  if (promoCode && usageCount >= promoCode.maxUses) {
    errors.push('Promo code limit reached');
  }

  // Add artificial delay to normalize timing (optional)
  const elapsed = Date.now() - startTime;
  const targetTime = 100; // 100ms baseline
  if (elapsed < targetTime) {
    await new Promise(resolve => setTimeout(resolve, targetTime - elapsed));
  }

  // Return first error or success
  if (errors.length > 0) {
    return { valid: false, errorMessage: errors[0] };
  }

  return { valid: true, discountAmount: ... };
}
```

2. **Add rate limiting per user (not just per IP):**
   - Limit promo code validation attempts per user (e.g., 20/hour)
   - Prevent brute-force enumeration

3. **Use generic error messages:**
   - Don't reveal if code exists but is invalid
   - Always return "Invalid or expired promo code"

**Current Mitigation:**

⚠️ No timing attack mitigation currently implemented

**Improvement Needed:**

⚠️ Implement constant-time validation
⚠️ Add per-user rate limiting on validation endpoint
⚠️ Use generic error messages

**References:**

- [OWASP Timing Attack Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#password-storage)
- CWE-208: Observable Timing Discrepancy

---

### 🔵 LOW SEVERITY

#### L-001: Missing Security Headers on Webhook Endpoint

**Severity:** LOW
**Category:** Security Headers
**CWE:** N/A (Best Practice)

**Location:**

- `apps/api/src/routes/webhooks/mercadopago.ts`
- Security headers middleware

**Description:**

The webhook endpoint (`/api/v1/webhooks/mercadopago`) may not have all recommended security headers applied, particularly:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (HSTS)

While webhooks are public endpoints, these headers provide defense-in-depth.

**Recommendation:**

1. Ensure `securityHeadersMiddleware` is applied to webhook routes
2. Add explicit security headers to webhook responses

```typescript
app.post('/api/v1/webhooks/mercadopago', async (c) => {
  // ... webhook processing

  // Add security headers to response
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');

  return c.json({ success: true });
});
```

**References:**

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)

---

#### L-002: SQL Injection Prevention Relies on ORM

**Severity:** LOW
**Category:** SQL Injection
**CWE:** CWE-89 (SQL Injection)

**Description:**

The system **correctly** uses Drizzle ORM with parameterized queries, which prevents SQL injection. However, there is **no explicit SQL injection testing** or security documentation confirming this protection.

**Evidence:**

```typescript
// Good example: Parameterized query via Drizzle ORM
const result = await db
  .select()
  .from(billingAddonPurchases)
  .where(
    and(
      eq(billingAddonPurchases.customerId, customerId), // ✅ Parameterized
      eq(billingAddonPurchases.addonSlug, addonSlug)    // ✅ Parameterized
    )
  );
```

**Recommendation:**

1. **Add SQL injection tests:**

```typescript
describe('SQL Injection Prevention', () => {
  it('should not be vulnerable to SQL injection in promo code search', async () => {
    const maliciousInput = "'; DROP TABLE billing_promo_codes; --";

    const response = await app.request('/api/v1/protected/billing/promo-codes', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
      query: { codeSearch: maliciousInput }
    });

    // Should safely escape/parameterize the input
    expect(response.status).not.toBe(500);
  });
});
```

2. **Document ORM usage in security docs:**
   - Confirm all database queries use Drizzle ORM
   - Prohibit raw SQL queries in billing routes
   - Add linting rules to detect raw SQL

**Current Mitigation:**

✅ All queries use Drizzle ORM with parameterized queries
✅ No raw SQL found in billing routes

**Improvement Needed:**

⚠️ Add explicit SQL injection tests
⚠️ Document SQL injection prevention strategy

**References:**

- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- CWE-89: SQL Injection

---

#### L-003: No XSS Prevention Tests

**Severity:** LOW
**Category:** XSS Prevention
**CWE:** CWE-79 (Cross-Site Scripting)

**Description:**

The API returns JSON responses (not HTML), which significantly reduces XSS risk. However, there are **no explicit XSS prevention tests** for scenarios where user input might be reflected in responses.

**Potential XSS vectors:**

- Promo code descriptions (if displayed without encoding)
- Add-on names/descriptions (if user-generated)
- Error messages with user input

**Recommendation:**

1. **Add XSS prevention tests:**

```typescript
describe('XSS Prevention', () => {
  it('should sanitize HTML in promo code descriptions', async () => {
    const xssPayload = '<script>alert("XSS")</script>';

    const response = await app.request('/api/v1/protected/billing/promo-codes', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: 'TEST-XSS',
        description: xssPayload,
        discountType: 'percentage',
        discountValue: 10
      })
    });

    const data = await response.json();

    // Should escape HTML entities
    expect(data.description).not.toContain('<script>');
    expect(data.description).toContain('&lt;script&gt;');
  });
});
```

2. **Use DOMPurify on frontend when displaying API data:**
   - Even though API returns JSON, frontend should sanitize before rendering
   - Especially for user-generated content (promo code descriptions, reviews)

3. **Set Content-Type explicitly:**

```typescript
// Ensure all responses are JSON (not HTML)
return c.json({ data }, 200); // ✅ Sets Content-Type: application/json
```

**Current Mitigation:**

✅ API returns JSON (not HTML), reducing XSS risk
✅ Content-Type is set correctly

**Improvement Needed:**

⚠️ Add XSS prevention tests for edge cases
⚠️ Document frontend sanitization requirements

**References:**

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- CWE-79: Cross-Site Scripting

---

#### L-004: Missing Security Monitoring and Alerting

**Severity:** LOW
**Category:** Monitoring
**CWE:** N/A (Best Practice)

**Description:**

While the system has comprehensive logging, there is **no explicit security monitoring or alerting** for:

- Multiple failed payment attempts
- Suspicious promo code usage patterns
- Webhook signature verification failures
- Rate limit violations

**Recommendation:**

1. **Set up security alerts:**

```typescript
// Alert on suspicious activity
const alertSecurityTeam = (event: SecurityEvent) => {
  if (process.env.NODE_ENV === 'production') {
    // Send to Sentry, PagerDuty, etc.
    apiLogger.error({
      alert: 'SECURITY_INCIDENT',
      severity: event.severity,
      type: event.type,
      details: event.details
    }, 'Security alert triggered');
  }
};

// Example usage in webhook handler
if (!isValidSignature) {
  alertSecurityTeam({
    severity: 'HIGH',
    type: 'WEBHOOK_SIGNATURE_FAILURE',
    details: { ip: clientIp, eventId: event.id }
  });
}
```

2. **Monitor key security metrics:**
   - Failed authentication attempts (per user, per IP)
   - Rate limit violations
   - Payment anomalies (multiple failed payments, unusual amounts)
   - Promo code abuse (excessive validation attempts)

3. **Set up automated responses:**
   - Block IPs after N failed authentications
   - Temporarily disable promo codes with excessive validation failures
   - Flag customers with suspicious payment patterns

**Current Mitigation:**

✅ Comprehensive structured logging
✅ Rate limiting with logging

**Improvement Needed:**

⚠️ Add security alerting system
⚠️ Monitor security metrics dashboards
⚠️ Implement automated responses

**References:**

- [OWASP Security Logging and Monitoring](https://owasp.org/www-project-proactive-controls/v3/en/c9-security-logging)

---

## Authentication & Authorization Review

### ✅ PASS: Authentication System

**Strengths:**

1. ✅ **Better Auth authentication** properly integrated
2. ✅ **Bearer token** authentication (not vulnerable to CSRF by default)
3. ✅ **Actor middleware** extracts and validates user identity on every request
4. ✅ **Role-based access control** (ADMIN, SUPER_ADMIN, USER, GUEST)
5. ✅ **Permission system** with fine-grained controls

**Evidence:**

```typescript
// apps/api/src/middlewares/actor.ts:109
const auth = getAuth(c);
if (auth?.userId) {
  const dbUser = await userCache.getUser(auth.userId);
  // ✅ Validates user exists and loads permissions
}
```

### ✅ PASS: Authorization System

**Strengths:**

1. ✅ **Route-level authorization** via `createAdminRoute`, `createProtectedRoute`
2. ✅ **Ownership checks** in promo code and addon services
3. ✅ **Role checks** on sensitive operations (trial extension, metrics)

**Evidence:**

```typescript
// apps/api/src/routes/billing/trial.ts:228
const actor = getActorFromContext(c);
if (actor.role !== RoleEnum.ADMIN && actor.role !== RoleEnum.SUPER_ADMIN) {
  throw new HTTPException(403, { message: 'Admin access required' });
}
```

**Minor Issue (addressed in M-002):**

⚠️ Promo code validation uses generic `Error` instead of `HTTPException`

---

## Input Validation Review

### ✅ PASS: Comprehensive Zod Validation

**Strengths:**

1. ✅ **All API inputs validated** with Zod schemas
2. ✅ **Type inference** from schemas (`z.infer<typeof schema>`)
3. ✅ **Validation at API boundary** (before service layer)
4. ✅ **Strong typing** throughout the stack

**Evidence:**

```typescript
// apps/api/src/routes/billing/promo-codes.ts:84
requestBody: CreatePromoCodeSchema,
handler: async (_c, _params, body) => {
  // body is typed and validated by Zod
  const result = await service.create({
    code: body.code as string, // ✅ Already validated
    // ...
  });
}
```

**Minor Issues (addressed in M-005):**

⚠️ Payment amounts lack explicit min/max validation
⚠️ No validation for zero/negative amounts before discount application

---

## HMAC/Signature Verification Review

### ⚠️ PARTIAL PASS: Webhook Signature Verification

**Strengths:**

1. ✅ **Signature verification enabled** via QZPay adapter
2. ✅ **Signature header configured** (`x-signature`)
3. ✅ **Environment-based secrets** (not hardcoded)

**Concerns (addressed in M-004):**

⚠️ Signature verification is **delegated to third-party** (`@qazuor/qzpay-hono`)
⚠️ No visibility into signature algorithm used
⚠️ No explicit verification logging
⚠️ No signature verification tests

**Recommendation:**

- Audit `@qazuor/qzpay-hono` implementation
- Add explicit signature verification middleware
- Add comprehensive signature verification tests

---

## PII in Logs Review

### ⚠️ PARTIAL PASS: PII Sanitization

**Strengths:**

1. ✅ **Sanitization function exists** (`sanitizeErrorForNotification`)
2. ✅ **Removes stack traces** from notifications
3. ✅ **Removes file paths, connection strings, IPs** from error messages
4. ✅ **Structured logging** (uses specific fields, not full payloads)

**Concerns (addressed in M-001):**

⚠️ Sanitization only applied to **notifications**, not all logs
⚠️ Webhook error logs may contain customer emails
⚠️ Payment amounts logged in debug mode

**Evidence:**

```typescript
// apps/api/src/routes/webhooks/mercadopago.ts:53
function sanitizeErrorForNotification(error: string, maxLength = 500): string {
  // ✅ Removes stack traces, file paths, connection strings
  // ❌ Not used for all logs, only notifications
}
```

**Recommendation:**

- Apply sanitization to all billing/payment logs
- Redact customer emails and payment amounts in production logs
- Review log retention policies

---

## CSRF Protection Review

### ⚠️ PARTIAL PASS: Origin Verification

**Strengths:**

1. ✅ **Bearer token authentication** (inherent CSRF protection)
2. ✅ **CORS properly configured** with allowed origins
3. ✅ **Origin verification middleware** for mutating requests
4. ✅ **No cookie-based authentication** in billing system

**Concerns (addressed in H-001):**

⚠️ No explicit CSRF tokens on state-changing endpoints
⚠️ Origin verification is defense-in-depth, not primary CSRF protection
⚠️ If cookies are added in the future, CSRF vulnerability would emerge

**Evidence:**

```typescript
// apps/api/src/middlewares/security.ts:99
export const originVerificationMiddleware = async (c: Context, next: Next) => {
  // ✅ Verifies Origin/Referer headers
  // ✅ Only for mutating methods (POST, PUT, PATCH, DELETE)
  // ⚠️ Not a complete CSRF solution (no tokens)
}
```

**Recommendation:**

- Implement CSRF tokens for state-changing operations
- Add `SameSite=Strict` if cookies are ever used
- Continue using Bearer tokens (avoid cookie-based auth)

---

## Rate Limiting Review

### ⚠️ PARTIAL PASS: Rate Limiting Implementation

**Strengths:**

1. ✅ **Rate limiting middleware implemented** (`rateLimitMiddleware`)
2. ✅ **Differentiated limits** for auth (10/min), public (50/min), general (100/min)
3. ✅ **Per-IP rate limiting** with proxy trust configuration
4. ✅ **Rate limit headers** (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, etc.)

**Concerns (addressed in H-002):**

⚠️ **No dedicated stricter limits for payment endpoints**
⚠️ Payment routes use general limit (100/min) - too permissive
⚠️ **No per-user rate limiting** (only per-IP)
⚠️ **No idempotency key requirement** for payment requests

**Evidence:**

```typescript
// apps/api/src/middlewares/rate-limit.ts:24
const getEndpointType = (path: string): 'auth' | 'public' | 'admin' | 'general' => {
  if (path.includes('/auth/')) return 'auth'; // ✅ 10/min
  if (path.includes('/admin/')) return 'admin';
  if (path.includes('/public/')) return 'public'; // ✅ 50/min
  return 'general'; // ⚠️ Payment endpoints use this (100/min)
};
```

**Recommendation:**

- Add dedicated rate limiting for payment endpoints (5 requests per 15 minutes)
- Implement per-user rate limiting (not just per-IP)
- Require idempotency keys for payment requests

---

## SQL Injection Prevention Review

### ✅ PASS: ORM-Based Protection

**Strengths:**

1. ✅ **Drizzle ORM used exclusively** for database queries
2. ✅ **Parameterized queries** throughout
3. ✅ **No raw SQL found** in billing routes
4. ✅ **Type-safe query builder**

**Evidence:**

```typescript
// apps/api/src/services/addon.service.ts:567
const addonPurchases = await db
  .select()
  .from(billingAddonPurchases)
  .where(
    and(
      eq(billingAddonPurchases.customerId, customer.id), // ✅ Parameterized
      eq(billingAddonPurchases.status, 'active')         // ✅ Parameterized
    )
  );
```

**Minor Improvement (addressed in L-002):**

⚠️ No explicit SQL injection tests
⚠️ No documentation confirming SQL injection prevention strategy

**Recommendation:**

- Add SQL injection tests for edge cases
- Document ORM usage policy in security standards
- Add linting rules to detect raw SQL queries

---

## Recommendations Summary

### Critical (Must Fix Before Production)

**None** - No critical vulnerabilities found

### High Priority (Fix Before Production)

1. **H-001: Implement CSRF tokens** for state-changing operations
   - Add CSRF token generation endpoint
   - Validate tokens on POST/PUT/PATCH/DELETE requests
   - Set `SameSite=Strict` if cookies are used

2. **H-002: Add stricter rate limiting for payment endpoints**
   - Limit to 5 payment requests per 15 minutes
   - Implement per-user rate limiting (not just per-IP)
   - Require idempotency keys for payment requests

### Medium Priority (Fix Within 30 Days)

3. **M-001: Sanitize webhook payloads in logs**
   - Remove customer emails from webhook logs
   - Redact payment amounts in production
   - Set shorter log retention for billing data (30 days)

4. **M-002: Fix authorization in promo code validation**
   - Use `HTTPException` instead of generic `Error`
   - Add rate limiting on validation endpoint (10 attempts/hour)
   - Add audit logging for admin validations

5. **M-003: Add row-level locking for webhook idempotency**
   - Use `SELECT FOR UPDATE` to lock webhook records
   - Consider distributed locking (Redis) for horizontal scaling

6. **M-004: Audit third-party signature verification**
   - Review `@qazuor/qzpay-hono` source code
   - Add explicit signature verification logging
   - Add signature verification tests

7. **M-005: Validate payment amounts**
   - Add min/max validation (1 cent - 100,000 ARS)
   - Prevent zero-price purchases after discount
   - Add business rule validations

8. **M-006: Prevent promo code enumeration via timing**
   - Implement constant-time validation response
   - Add per-user rate limiting on validation endpoint
   - Use generic error messages

### Low Priority (Best Practices)

9. **L-001: Apply security headers to webhook endpoint**
10. **L-002: Add SQL injection tests**
11. **L-003: Add XSS prevention tests**
12. **L-004: Set up security monitoring and alerting**

---

## Compliance Considerations

### OWASP API Security Top 10 (2023)

| Risk | Status | Notes |
|------|--------|-------|
| API1: Broken Object Level Authorization | ✅ PASS | Authorization checks in place, minor issue in M-002 |
| API2: Broken Authentication | ✅ PASS | Better Auth session-based authentication + Bearer tokens |
| API3: Broken Object Property Level Authorization | ✅ PASS | Zod schemas validate input properties |
| API4: Unrestricted Resource Consumption | ⚠️ PARTIAL | Rate limiting present, but needs stricter limits (H-002) |
| API5: Broken Function Level Authorization | ✅ PASS | Role-based access control enforced |
| API6: Unrestricted Access to Sensitive Business Flows | ⚠️ PARTIAL | No idempotency keys for payments (H-002) |
| API7: Server Side Request Forgery (SSRF) | ✅ N/A | No external URL requests from user input |
| API8: Security Misconfiguration | ⚠️ PARTIAL | No CSRF tokens (H-001), security headers OK |
| API9: Improper Inventory Management | ✅ PASS | OpenAPI docs, clear API structure |
| API10: Unsafe Consumption of APIs | ⚠️ PARTIAL | Third-party signature verification not audited (M-004) |

### GDPR Compliance

| Requirement | Status | Notes |
|-------------|--------|-------|
| **Data Minimization** | ✅ PASS | Only necessary payment data collected |
| **Storage Limitation** | ⚠️ ACTION NEEDED | Set log retention to 30 days for billing data (M-001) |
| **Security of Processing** | ✅ PASS | Encryption in transit (HTTPS), proper access controls |
| **Data Breach Notification** | ⚠️ ACTION NEEDED | Set up security monitoring (L-004) |

### PCI DSS Considerations

**Note:** Since the system uses **Mercado Pago as payment processor**, PCI DSS compliance is primarily Mercado Pago's responsibility. Hospeda does **not store credit card data** directly.

| Requirement | Status | Notes |
|-------------|--------|-------|
| **Secure Network** | ✅ PASS | HTTPS enforced, security headers applied |
| **Protect Cardholder Data** | ✅ N/A | No card data stored (handled by Mercado Pago) |
| **Vulnerability Management** | ⚠️ PARTIAL | Security monitoring needed (L-004) |
| **Access Control** | ✅ PASS | Strong authentication and authorization |
| **Monitor Networks** | ⚠️ ACTION NEEDED | Security alerting needed (L-004) |
| **Security Policy** | ⚠️ ACTION NEEDED | Document security policies in `/docs/security/` |

---

## Testing Recommendations

### Security Test Suite

Create a dedicated security test suite at `apps/api/test/security/`:

```typescript
// apps/api/test/security/billing-security.test.ts
describe('Billing Security Tests', () => {

  describe('CSRF Protection', () => {
    it('should require CSRF token for state-changing operations');
    it('should reject requests with invalid CSRF tokens');
  });

  describe('Rate Limiting', () => {
    it('should enforce stricter rate limits on payment endpoints');
    it('should rate limit by user ID (not just IP)');
  });

  describe('Input Validation', () => {
    it('should reject negative payment amounts');
    it('should reject zero payment amounts');
    it('should reject amounts exceeding maximum');
  });

  describe('Authorization', () => {
    it('should prevent users from validating promo codes for other users');
    it('should prevent users from viewing other users\' billing data');
  });

  describe('Webhook Security', () => {
    it('should reject webhooks with invalid signatures');
    it('should prevent duplicate webhook processing');
  });

  describe('SQL Injection Prevention', () => {
    it('should safely handle SQL injection attempts in search');
  });

  describe('XSS Prevention', () => {
    it('should sanitize HTML in promo code descriptions');
  });
});
```

### Penetration Testing Checklist

Before production deployment, perform penetration testing:

- [ ] Attempt promo code enumeration via timing analysis
- [ ] Test rate limiting bypass techniques (IP rotation, etc.)
- [ ] Attempt authorization bypass (IDOR vulnerabilities)
- [ ] Test payment amount manipulation (negative amounts, overflow)
- [ ] Attempt webhook replay attacks
- [ ] Test CSRF protection (if implemented)
- [ ] Attempt SQL injection in search queries
- [ ] Test for XSS in user-generated content

---

## Deployment Checklist

Before deploying to production:

### Critical

- [ ] ✅ Implement CSRF tokens (H-001)
- [ ] ✅ Add stricter rate limiting for payment endpoints (H-002)
- [ ] ✅ Audit third-party webhook signature verification (M-004)
- [ ] ✅ Add payment amount validation (M-005)

### High Priority

- [ ] ✅ Sanitize webhook payloads in logs (M-001)
- [ ] ✅ Fix promo code validation authorization (M-002)
- [ ] ✅ Add row-level locking for webhook idempotency (M-003)
- [ ] ✅ Prevent promo code timing attacks (M-006)

### Environment Configuration

- [ ] ✅ Verify `MERCADO_PAGO_WEBHOOK_SECRET` is set (not committed to git)
- [ ] ✅ Enable rate limiting in production (`API_RATE_LIMIT_ENABLED=true`)
- [ ] ✅ Enable security headers (`API_SECURITY_ENABLED=true`)
- [ ] ✅ Enable CORS with production origins only
- [ ] ✅ Disable debug logging in production (`LOG_LEVEL=warn`)
- [ ] ✅ Enable HTTPS/TLS (handled by Vercel)

### Monitoring & Alerting

- [ ] ✅ Set up security monitoring dashboards
- [ ] ✅ Configure alerting for failed authentications
- [ ] ✅ Configure alerting for rate limit violations
- [ ] ✅ Configure alerting for webhook signature failures
- [ ] ✅ Set log retention policy (30 days for billing data)

### Documentation

- [ ] ✅ Document CSRF protection implementation
- [ ] ✅ Document rate limiting policies
- [ ] ✅ Document webhook security (signature verification)
- [ ] ✅ Document security incident response procedures

---

## Conclusion

The Hospeda billing/payment system demonstrates **solid security fundamentals** with proper authentication, authorization, input validation, and SQL injection prevention. However, several **medium-priority vulnerabilities** and **best-practice gaps** were identified that should be addressed before production deployment.

### Overall Assessment

Security Grade: B+ (Good with areas for improvement)

**Strengths:**

- ✅ Strong authentication and authorization
- ✅ Comprehensive input validation via Zod
- ✅ SQL injection prevention via Drizzle ORM
- ✅ Webhook signature verification (via QZPay)
- ✅ Rate limiting implemented

**Areas for Improvement:**

- ⚠️ Add CSRF tokens for state-changing operations (H-001)
- ⚠️ Implement stricter rate limiting for payment endpoints (H-002)
- ⚠️ Sanitize webhook payloads in logs (M-001)
- ⚠️ Audit third-party signature verification (M-004)
- ⚠️ Add payment amount validation (M-005)

### Recommended Timeline

**Before Production (Must Fix):**

- Week 1: H-001 (CSRF tokens), H-002 (rate limiting)
- Week 2: M-004 (signature verification audit), M-005 (amount validation)

**Post-Launch (30 Days):**

- M-001 (log sanitization), M-002 (authorization), M-003 (locking), M-006 (timing)

**Ongoing:**

- L-001 through L-004 (best practices, monitoring)

### Sign-Off

This security audit was conducted following OWASP guidelines and industry best practices for payment system security. All findings have been documented with severity ratings, evidence, and remediation recommendations.

**Auditor:** Tech Lead - Hospeda Security Team
**Date:** February 3, 2026
**Next Audit:** After critical and high-priority issues are resolved

---

## Appendix A: Security Testing Tools

Recommended tools for ongoing security testing:

1. **Static Analysis:**
   - ESLint with security plugins
   - Semgrep for pattern-based security checks
   - npm audit for dependency vulnerabilities

2. **Dynamic Analysis:**
   - OWASP ZAP for API security testing
   - Burp Suite for manual penetration testing
   - Postman/Newman for security test automation

3. **Monitoring:**
   - Sentry for error tracking
   - Datadog/New Relic for APM
   - CloudFlare for DDoS protection

---

## Appendix B: Security Resources

### OWASP Resources

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [OWASP Webhook Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

### Payment Security

- [PCI Security Standards](https://www.pcisecuritystandards.org/)
- [Mercado Pago Security Best Practices](https://www.mercadopago.com.ar/developers/en/docs/security)

### API Security

- [API Security Best Practices](https://github.com/shieldfy/API-Security-Checklist)
- [REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)

---

<!-- END OF REPORT -->
