# Runbook: Chargeback / Dispute Handling (Manual v1)

Operational guide for chargeback and dispute events received from MercadoPago.

**Contract**: The Hospeda API does NOT auto-cancel or transition subscriptions on
dispute events. All subscription writes are manual — follow this runbook.
(Pinned by: `dispute-logic.ts`, test: `dispute-logic.test.ts` SPEC-194 T-026.)

**Related documents:**

- [MercadoPago Webhook Integration](webhooks/mercadopago.md)
- [Billing API Endpoints](billing-api-endpoints.md)

---

## What triggers this runbook

MercadoPago sends a webhook with `type: "chargebacks"` or `topic: "payment"` with
`action: "payment.chargebacked"` when a user initiates a dispute with their bank.

The Hospeda handler (`dispute-logic.ts`) responds by:

1. Logging the event at `warn` level with: `eventId`, `eventType`, `disputeId`,
   `paymentId`, `status`, `amount`, `reason`.
2. Sending an `ADMIN_SYSTEM_EVENT` notification with `severity: "critical"` to every
   address in `HOSPEDA_ADMIN_NOTIFICATION_EMAILS`.
3. Returning `true` (event consumed, not requeued).

**No subscription status is changed automatically.**

---

## Admin notification contents

The admin email contains an `eventDetails` object with these fields:

| Field | Source |
|---|---|
| `eventType` | MP webhook `type` field |
| `disputeId` | `eventData.id` |
| `paymentId` | `eventData.payment_id` or `eventData.paymentId` |
| `status` | `eventData.status` (e.g. `"opened"`, `"closed"`) |
| `amount` | `eventData.amount` or `eventData.transaction_amount` (centavos) |
| `reason` | `eventData.reason` (e.g. `"fraud"`, `"not_received"`) |

Use `disputeId` to look up the case in the MP Dashboard.

---

## Step 1 — Locate the dispute in MercadoPago

1. Log in to [MercadoPago Dashboard](https://www.mercadopago.com.ar/activities).
2. Navigate to **Actividad > Disputas** (or use the search bar with the `disputeId`).
3. Review the dispute reason, amount, and current status.
4. Note the `paymentId` — use it to cross-reference the `billing_payments` table.

```sql
-- Cross-reference the payment in the Hospeda DB
SELECT id, subscription_id, customer_id, amount, status, created_at
FROM billing_payments
WHERE provider_payment_id = '<paymentId>';
```

---

## Step 2 — Decision tree

### A. Dispute is fraudulent / user error (you will win)

1. Gather evidence: MP notification of the original payment, subscription confirmation
   email, usage logs showing the user accessed the service.
2. Submit evidence via the MP Dashboard within the deadline shown on the dispute page.
3. **Do not change subscription status yet.** Wait for MP to close the dispute.
4. If MP rules in Hospeda's favour: no action required; subscription remains active.
5. If MP rules against Hospeda (rare): proceed to **Refund path** below.

### B. Legitimate complaint (user did not receive service / double charge)

1. Verify in the DB that the subscription was actually active during the period.
2. Issue a full or partial refund via the admin refund endpoint:

   ```
   POST /api/v1/admin/billing/subscriptions/:subscriptionId/refund
   ```

   See [Billing API Endpoints](billing-api-endpoints.md) for the request body.
3. After the refund is confirmed, cancel the subscription if appropriate:

   ```
   POST /api/v1/admin/billing/subscriptions/:subscriptionId/cancel
   ```

4. Notify the user (optional — the refund flow may already send a notification).

### C. Duplicate/accidental charge

1. Identify the duplicate payment using the `paymentId` from the admin notification.
2. Issue a refund for the duplicate amount only.
3. Do not cancel the active subscription.

---

## Step 3 — Post-resolution

After any dispute is resolved:

1. Update the internal notes field in the MP Dashboard with the resolution outcome.
2. If a subscription was manually cancelled, confirm the `billing_subscriptions.status`
   column was updated to `'canceled'`:

   ```sql
   SELECT id, status, updated_at
   FROM billing_subscriptions
   WHERE id = '<subscriptionId>';
   ```

3. If the dispute resulted in an MP-initiated debit (chargeback deducted from balance),
   reconcile the amount in the monthly billing report.

---

## Quick reference — useful MP Dashboard paths

| Task | Path |
|---|---|
| List all disputes | Actividad > Disputas |
| Search by payment | Actividad > Movimientos (search by `paymentId`) |
| Submit evidence | Disputas > [dispute row] > Responder disputa |
| View refund status | Actividad > Devoluciones |

---

## Related specs

- SPEC-194 T-026 — Manual dispute contract pinning and this runbook.
- SPEC-143 — Billing testing coverage (staging smoke checklist).
