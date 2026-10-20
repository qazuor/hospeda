# Billing revocation requests (S36)

Use this runbook when a customer requests revocation of a subscription charge through the public right-of-withdrawal link or support email.

## 1. What arrives and where

The public footer link **Botón de arrepentimiento** (every public page, in Spanish, English, and Portuguese) opens `/{lang}/legal/arrepentimiento/`. Its contact form submits type `revocation` without sign-in. The submission sends an email to the support inbox with **Revocación de compra (botón de arrepentimiento)** in its subject. A customer can also email `info@hospeda.com.ar` with that same subject.

If the email provider is unavailable, the API still records the submission in its logs as `Contact form submission received` with `contactType: revocation`.

## 2. Act the same business day

Record the request with S36 on the same business day it arrives. S36 checks the 10-calendar-day window from the charge against the time the request is recorded (`packages/service-core/src/services/billing/subscription/revocation-payment.ts:30, 126-128, 403-405`). A request received on day 9 but recorded on day 11 is refused with `REVOCATION_WINDOW_CLOSED`.

The spec cites a 24-hour identification figure as a fact to confirm. The internal target is to reply within 24 hours acknowledging the request with an identifier: the subscription ID and request date.

## 3. Find the subscription

There is no subscription list in the admin. Use read-only SQL through `hops`; `--target=prod` must come before `psql`:

```bash
hops --target=prod psql --stdin <<'SQL'
select s.id, s.vertical, s.status, s.class, s.created_at
from subscription s
join users u on u.id = s.user_id
where lower(u.email) = lower('<customer email>')
  and s.class = 'PRINCIPAL'
order by s.created_at desc;
SQL
```

An empty output can mean a swallowed command error; it does not prove there are zero matching rows. Only a `PRINCIPAL` subscription can be revoked.

## 4. Record the revocation (S36)

Open `/billing/subscriptions/<subscriptionId>/revocation` in the admin. The action requires `billing.cancelSubscription`.

Review the preview, which shows the payment to be returned, its amount, and the end of the window. Confirming cancels the authorization (our email first), ends the service immediately, and creates an RF1 refund request for the total. Put the request reference in the note.

## 5. Refusals and what to do

The preview and action report the following twelve reasons (source: `apps/api/docs/error-contract.md`, “Action 8 revocation rejections”; mirrored in `apps/admin/src/features/billing-revocation/revocation-reasons.ts`). Do not retry an ineligible request or substitute a payment or amount.

| `reason` | Action |
|---|---|
| `SUBSCRIPTION_NOT_FOUND` | Check the customer email and subscription ID, then find the subscription again. |
| `ADMINISTRATIVE_ACTION_FORBIDDEN` | Another admin must process it; nobody acts on their own account. |
| `REVOCATION_NOT_PRINCIPAL` | Find the customer's `PRINCIPAL` subscription. |
| `REVOCATION_STATE_NOT_ALLOWED` | Check the current subscription state and escalate to the billing owner; do not force the action. |
| `REVOCATION_NO_CREDITED_PAYMENT` | Check the subscription's payment history and escalate; there is no credited payment for S36 to revoke. |
| `REVOCATION_WINDOW_CLOSED` | Tell the customer the window closed. If they still want to leave, use administrative cancellation without refund at `/billing/subscriptions/<id>/cancellation` (HOS-1696), or direct them to self-service cancellation. |
| `REVOCATION_AMOUNT_UNAVAILABLE` | Do not confirm. Escalate the unanchored manual payment amount to the billing owner. |
| `REVOCATION_PAYMENT_CHANGED` | Reload the preview and confirm again only if it still shows the intended payment. |
| `REVOCATION_STATE_CHANGED` | Reload the preview and confirm again only if the subscription remains eligible. |
| `PAYMENT_NOT_REFUNDABLE` | Do not retry; inspect the last credited payment and escalate to the billing owner. |
| `REFUND_EXCEEDS_BALANCE` | Do not create another refund; inspect existing refund claims for the payment. |
| `REFUND_AMOUNT_INVALID` | Do not substitute an amount; escalate the invalid refund amount to the billing owner. |

## 6. Getting the money out (cutover state)

RF2/RF3 (confirming and executing through the provider) belong to B6 and do not exist yet (`packages/service-core/src/services/billing/refund/refund-machine.ts:29-41`). First refund the payment manually from the Mercado Pago panel.

### Record it from the revocation result (panel)

Immediately after confirming S36, the result offers **Settle the refund (action 14)**. It requires `billing.settleExternal`; if you do not have that permission, another team member records it. Nobody settles a refund on their own account. The payment, requested amount, and RF1 request are prefilled. For a card payment, the default channel is **Provider panel**. Enter the refund ID from Mercado Pago as the reference.

If the refunded amount differs from the request, the review step explains the difference before confirmation. Choose whether to close the request for that amount or record the refund separately (AC:B5:41). Closing it updates the existing RF1 instead of creating another refund.

### If the result screen was closed

Return to `/billing/subscriptions/<subscriptionId>/revocation` for that subscription. Its **Open refund requests** section lists each `REQUESTED` refund for that subscription's payments and offers the same settlement form for each request (D-1, option 2). Reading the list requires `billing.subscription.inspect`; settling requires `billing.settleExternal`. If you do not have either permission, another team member can do it.

### API fallback

If the panel is unavailable, find open requests with this read-only query:

```bash
hops --target=prod psql --stdin <<'SQL'
select r.id as refund_id, r.amount, r.reason, r.payment_id, r.manual_payment_id, r.created_at
from refund r
left join payment p on p.id = r.payment_id
left join manual_payment m on m.id = r.manual_payment_id
left join subscription s on s.id = coalesce(p.subscription_id, m.subscription_id)
left join addon_instance ai on ai.id = p.addon_instance_id
join users u on u.id = coalesce(s.user_id, ai.owner_id)
where r.status = 'REQUESTED'
  and lower(u.email) = lower('<customer email>')
order by r.created_at desc;
SQL
```

An empty output can mean a swallowed command error; it does not prove there are zero matching rows. Use the API call below to record the completed refund:

```http
POST /api/v1/admin/billing-refunds/external
Permission: billing.settleExternal
Content-Type: application/json

{
  "paymentId": "<payment id>",
  "amount": 1234,
  "channel": "PROVIDER_PANEL",
  "reference": "<Mercado Pago refund id>",
  "reason": "OUT_OF_FLOW_REFUND",
  "refundId": "<RF1 id returned by the revocation>",
  "note": "<request reference>"
}
```

Use `paymentId` or `manualPaymentId`, according to the payment source. Set `refundId` to the request being settled.

`amount` is a positive integer in cents. Replace the example with the amount actually refunded.

### Add-on refunds of the same revocation

S36 can also open RF1 requests for add-ons (`ADDON_ORPHAN`) and one-time add-ons (`ONE_TIME_ADDON_REVOCATION`). These requests belong to payments on another row—the add-on subscription or add-on instance—so they do not appear in the panel's open-request list (D-2). They appear in the query above, which filters by the owner's email, and must be settled through the API, one request at a time with its own `refundId`.

## 7. Close the loop

Reply to the customer that the subscription was cancelled, service ended, and the refund was issued from the provider panel.
