# SPEC-021: Manual QA Checklist for Billing Flows

## Prerequisites

Before starting manual QA, ensure:

- [ ] Staging environment is deployed with all SPEC-021 changes
- [ ] MercadoPago **sandbox** credentials are configured (`HOSPEDA_MERCADOPAGO_ACCESS_TOKEN` with test token)
- [ ] PostgreSQL database is seeded with billing plans (`owner-basico`, `owner-pro`, `owner-premium`)
- [ ] Redis is configured (`HOSPEDA_REDIS_URL`) or confirm fallback mode works
- [ ] At least 2 test user accounts exist (User A and User B, both HOST role)
- [ ] Admin user account exists with `ADMIN` role
- [ ] API logs are accessible (Vercel logs or equivalent)
- [ ] Database access available for manual verification (Drizzle Studio or psql)

### MercadoPago Sandbox Setup

1. Go to [MercadoPago Developers](https://www.mercadopago.com.ar/developers/panel/app)
2. Use sandbox test credentials (NOT production)
3. Create test buyer accounts if needed
4. Have sandbox card numbers ready:
   - **Approved**: `5031 7557 3453 0604` (Mastercard)
   - **Rejected (insufficient funds)**: `5031 7557 3453 0604` with CVV `123` and expiry in the past
   - Check [MercadoPago test cards](https://www.mercadopago.com.ar/developers/en/docs/your-integrations/test/cards) for current test data

---

## Test Scenarios

### 1. Webhook Retry Recovery (BILL-01)

**Goal**: Verify failed MercadoPago webhooks are automatically retried and resolved.

**Steps**:

1. Create a payment via MercadoPago sandbox that generates a webhook
2. **Simulate webhook failure**: Temporarily make the webhook endpoint return 500 (or check if there are already dead-letter entries in the DB)
3. Check database: `SELECT * FROM billing_webhook_dead_letter WHERE resolved_at IS NULL ORDER BY created_at DESC;`
4. Wait for the webhook retry cron to run (every hour), or trigger manually:

   ```bash
   curl -X POST https://<staging-api>/api/v1/cron/webhook-retry \
     -H "Authorization: Bearer <cron-secret>"
   ```

5. **Verify**: Check API logs for webhook retry processing messages
6. **Verify**: Dead letter entry should now have `resolved_at` set: `SELECT id, attempts, resolved_at FROM billing_webhook_dead_letter ORDER BY created_at DESC LIMIT 5;`
7. **Verify**: The subscription/payment state reflects the webhook data

**Expected Results**:

- Dead letter entries are processed
- Successful retries marked as resolved
- Failed retries increment `attempts` counter
- After 5 failed attempts, entry marked as permanently failed with alert in logs

**Pass Criteria**: At least one dead letter entry successfully retried and resolved.

---

### 2. Grace Period for Past-Due Subscriptions (BILL-02)

**Goal**: Verify 3-day grace period before blocking access for past-due subscriptions.

**Steps**:

1. As User A, ensure they have an active subscription
2. **Trigger past-due state**: Let a payment fail in MercadoPago sandbox, or manually update DB:

   ```sql
   -- Find User A's subscription
   SELECT id, status, current_period_end FROM billing_subscriptions WHERE customer_id = '<user-a-customer-id>';
   -- Update to past_due (only on staging!)
   UPDATE billing_subscriptions SET status = 'past_due' WHERE id = '<subscription-id>';
   ```

3. **Day 0-2 (within grace)**: Make API calls to billing endpoints as User A:

   ```bash
   curl https://<staging-api>/api/v1/protected/billing/customers/<id> \
     -H "Authorization: Bearer <user-a-token>"
   ```

4. **Verify**: Response is 200 OK
5. **Verify**: Response headers contain `X-Grace-Period-Days-Remaining` with remaining days
6. **Day 3+ (expired grace)**: Either wait or manipulate `status_changed_at` in DB:

   ```sql
   -- Set status change to 4 days ago
   UPDATE billing_subscriptions
   SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{statusChangedAt}', to_jsonb(now() - interval '4 days'))
   WHERE id = '<subscription-id>';
   ```

7. Make the same API call again
8. **Verify**: Response is **402 Payment Required**
9. **Verify**: Response body contains:

   ```json
   {
     "error": "GRACE_PERIOD_EXPIRED",
     "message": "Tu periodo de gracia ha expirado...",
     "daysOverdue": 4
   }
   ```

10. **Resolve payment**: Update subscription back to active:

    ```sql
    UPDATE billing_subscriptions SET status = 'active' WHERE id = '<subscription-id>';
    ```

11. Make the API call again
12. **Verify**: Response is 200 OK, no grace period header

**Pass Criteria**: Grace period allows access within 3 days, blocks after, restores after payment resolution.

---

### 3. Trial Extension Updates trialEnd (BILL-03)

**Goal**: Verify that extending a trial actually updates the `trialEnd` field on the subscription.

**Steps**:

1. Create a new HOST user to start a fresh trial
2. Check initial trial end date:

   ```sql
   SELECT id, status, trial_end, metadata FROM billing_subscriptions
   WHERE customer_id = '<new-user-customer-id>';
   ```

3. Note the original `trial_end` value (should be ~14 days from now)
4. Extend trial via admin API:

   ```bash
   curl -X POST https://<staging-api>/api/v1/admin/billing/trial/extend \
     -H "Authorization: Bearer <admin-token>" \
     -H "Content-Type: application/json" \
     -d '{"customerId": "<customer-id>", "additionalDays": 7}'
   ```

5. **Verify** API response contains `previousTrialEnd` and `newTrialEnd`
6. **Verify** `newTrialEnd` = `previousTrialEnd` + 7 days
7. Check database again:

   ```sql
   SELECT id, trial_end, metadata->'trialExtendedAt' as extended_at
   FROM billing_subscriptions WHERE customer_id = '<customer-id>';
   ```

8. **Verify**: `trial_end` column is updated (not just metadata)
9. **Verify**: `metadata` contains audit trail (`originalTrialEnd`, `newTrialEnd`, `trialExtendedAt`)
10. Wait for trial-expiry cron (or trigger it). **Verify** trial does NOT expire at the original date

**Pass Criteria**: `trial_end` field updated in DB, cron respects new date.

---

### 4. Dunning - Automatic Failed Payment Retries (BILL-04)

**Goal**: Verify dunning cron retries failed payments on schedule.

**Steps**:

1. Set up a subscription with a past-due status (failed payment)
2. Trigger dunning cron manually:

   ```bash
   curl -X POST https://<staging-api>/api/v1/cron/dunning \
     -H "Authorization: Bearer <cron-secret>"
   ```

3. **Verify** API logs show dunning processing:
   - "Processing dunning for X past-due subscriptions"
   - Retry attempts logged
4. Check `billing_dunning_attempts` table:

   ```sql
   SELECT subscription_id, attempt_number, result, error_message, attempted_at
   FROM billing_dunning_attempts ORDER BY attempted_at DESC LIMIT 10;
   ```

5. **Verify**: Attempt recorded with correct `attempt_number` and `result`
6. **Verify**: On successful retry, subscription status changes to `active`
7. **Verify**: On failed retry after max attempts (4), subscription is cancelled

**Pass Criteria**: Dunning attempts recorded, retries executed, final failure cancels subscription.

---

### 5. Billing Route Ownership Verification (BILL-06)

**Goal**: Verify users cannot access other users' billing data.

**Steps**:

1. As **User A**, get their own customer ID and subscription ID
2. As **User B**, attempt to access User A's billing data:

   ```bash
   # Try to read User A's customer record as User B
   curl https://<staging-api>/api/v1/protected/billing/customers/<user-a-customer-id> \
     -H "Authorization: Bearer <user-b-token>"
   ```

3. **Verify**: Response is **403 Forbidden** (not 200, not 404)
4. Try subscription endpoint:

   ```bash
   curl https://<staging-api>/api/v1/protected/billing/subscriptions/<user-a-subscription-id> \
     -H "Authorization: Bearer <user-b-token>"
   ```

5. **Verify**: Response is **403 Forbidden**
6. Try invoice endpoint:

   ```bash
   curl https://<staging-api>/api/v1/protected/billing/invoices?customerId=<user-a-customer-id> \
     -H "Authorization: Bearer <user-b-token>"
   ```

7. **Verify**: Response is **403 Forbidden**
8. As **Admin**, access User A's data:

   ```bash
   curl https://<staging-api>/api/v1/admin/billing/customers/<user-a-customer-id> \
     -H "Authorization: Bearer <admin-token>"
   ```

9. **Verify**: Response is **200 OK** (admin bypass works)

**Pass Criteria**: Cross-user access blocked with 403, admin access works.

---

### 6. Redis & Notification Idempotency (BILL-07)

**Goal**: Verify Redis is connected and notification idempotency works.

**Steps**:

1. Check API startup logs for Redis connection status:
   - Look for: "Redis client connected successfully" or "Redis not configured, using in-memory fallbacks"
2. If Redis is connected, verify via:

   ```bash
   # Check a billing-related Redis key exists after a notification is sent
   redis-cli -u <HOSPEDA_REDIS_URL> KEYS "hospeda:notification:*"
   ```

3. Trigger a notification (e.g., by creating a trial that's about to expire)
4. Trigger notification cron:

   ```bash
   curl -X POST https://<staging-api>/api/v1/cron/notification-schedule \
     -H "Authorization: Bearer <cron-secret>"
   ```

5. **Verify**: Notification sent (check logs)
6. Run the cron again immediately
7. **Verify**: Same notification is NOT sent again (idempotency). Logs should show "Notification already sent" or similar skip message

**Pass Criteria**: Redis connected (or graceful fallback), notifications deduplicated.

---

### 7. Renewal Reminder with Correct Price (BILL-08)

**Goal**: Verify renewal reminder notifications show actual plan price, not $0.

**Steps**:

1. Set up a subscription nearing renewal (or manipulate `current_period_end` to be within 7 days)
2. Trigger notification schedule cron:

   ```bash
   curl -X POST https://<staging-api>/api/v1/cron/notification-schedule \
     -H "Authorization: Bearer <cron-secret>"
   ```

3. **Verify** in API logs: notification payload contains correct `amount` (e.g., plan price from billing_plan_prices, not 0)
4. If email notifications are configured, check the email content
5. **Verify**: Amount matches the plan's price for the subscription interval

**Pass Criteria**: Renewal reminder contains actual plan price > 0.

---

### 8. Trial Reactivation (BILL-09)

**Goal**: Verify expired trial users can reactivate via the reactivation endpoint.

**Steps**:

1. Create a HOST user and let trial expire (or manipulate DB):

   ```sql
   UPDATE billing_subscriptions
   SET status = 'canceled', trial_end = now() - interval '1 day'
   WHERE customer_id = '<customer-id>';
   ```

2. Attempt to reactivate:

   ```bash
   curl -X POST https://<staging-api>/api/v1/protected/billing/trial/reactivate \
     -H "Authorization: Bearer <user-token>" \
     -H "Content-Type: application/json" \
     -d '{"planId": "<owner-pro-plan-id>"}'
   ```

3. **Verify**: Response is 200 OK with new subscription details
4. **Verify** DB: new subscription with `status = 'active'` and selected plan
5. Test error cases:
   - Active trial user tries to reactivate: expect **422** `TRIAL_STILL_ACTIVE`
   - Invalid planId: expect **422** or **404**
   - No auth token: expect **401**

**Pass Criteria**: Expired trial reactivated, error cases handled correctly.

---

### 9. Interval Mapping for Plan Changes (BILL-12)

**Goal**: Verify quarterly and semi-annual intervals are correctly mapped.

**Steps**:

1. Have a user with an active monthly subscription
2. Change to quarterly plan:

   ```bash
   curl -X POST https://<staging-api>/api/v1/protected/billing/plan-change \
     -H "Authorization: Bearer <user-token>" \
     -H "Content-Type: application/json" \
     -d '{"planId": "<quarterly-plan-id>"}'
   ```

3. **Verify** API logs or MercadoPago sandbox: the request to MercadoPago uses `interval: "month"` and `intervalCount: 3` (not `interval: "quarterly"`)
4. Test semi-annual:

   ```bash
   curl -X POST https://<staging-api>/api/v1/protected/billing/plan-change \
     -H "Authorization: Bearer <user-token>" \
     -H "Content-Type: application/json" \
     -d '{"planId": "<semi-annual-plan-id>"}'
   ```

5. **Verify**: MercadoPago receives `interval: "month"` and `intervalCount: 6`

**Pass Criteria**: Quarterly = month x 3, semi-annual = month x 6 in MercadoPago.

---

### 10. New User Trial Auto-Start (BILL-10)

**Goal**: Verify new HOST users automatically get a 14-day trial.

**Steps**:

1. Register a new user with `role: HOST` via the signup flow (or API)
2. **Verify** API logs show: "Trial started for new HOST user"
3. Check database:

   ```sql
   SELECT bc.id as customer_id, bs.id as sub_id, bs.status, bs.trial_end, bs.plan_id
   FROM billing_customers bc
   JOIN billing_subscriptions bs ON bs.customer_id = bc.id
   WHERE bc.user_id = '<new-user-id>';
   ```

4. **Verify**: Subscription exists with `status = 'trialing'`
5. **Verify**: `trial_end` is ~14 days from now
6. **Verify**: Plan is `owner-basico`
7. Register a new user with `role: GUEST`
8. **Verify**: No billing customer or subscription created

**Pass Criteria**: HOST gets trial, GUEST does not.

---

## Results Template

| # | Scenario | Status | Notes | Date | Tester |
|---|----------|--------|-------|------|--------|
| 1 | Webhook Retry Recovery | | | | |
| 2 | Grace Period | | | | |
| 3 | Trial Extension | | | | |
| 4 | Dunning Retries | | | | |
| 5 | Ownership Verification | | | | |
| 6 | Redis & Idempotency | | | | |
| 7 | Renewal Reminder Price | | | | |
| 8 | Trial Reactivation | | | | |
| 9 | Interval Mapping | | | | |
| 10 | New User Trial | | | | |

**Status values**: PASS / FAIL / BLOCKED / SKIPPED

---

## Post-QA Actions

- [ ] Document all FAIL results with screenshots/API responses
- [ ] File issues for any failures found
- [ ] Re-test after fixes
- [ ] Sign off on QA completion
- [ ] Update SPEC-021 state to `completed` after all scenarios pass
