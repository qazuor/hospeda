# `billing_customers.mp_customer_id` is NULL by design (HOS-233)

## Decision

`billing_customers.mp_customer_id` stays `NULL` for every customer in Hospeda's
MercadoPago preapproval card-first model. Do not add a back-fill, a checkout-time
write, or any other mechanism to populate it. If a future need genuinely requires a
stored MP customer/payment-method reference, that is a new design decision — not a
"fix" for this column being empty.

## Why

- **Write-only, zero readers.** A spike (HOS-233) confirmed no code in
  `service-core`, `billing`, `web`, or `admin` ever reads this column. No
  payment-method display, no reconciliation job, nothing depends on it.
- **It's a Stripe-style slot, not an MP concept.** The column is re-exported from
  `@qazuor/qzpay-drizzle`'s schema (see `packages/db/src/billing/schemas.ts`) to hold
  an MP Customers-API (`/v1/customers`) resource id. Hospeda's checkout flow (camino
  C: `preapproval_plan` + hosted share link) never calls the Customers API and never
  tokenizes a card — there is no MP customer resource to reference, so there is no
  stable id to store.
- **The backfilled value was a misnomer.** HOS-234/HOS-233's back-fill wrote the
  authorized-payment's `payer_id` into this column. `payer_id` is MercadoPago's
  *user/account* id for the subscriber, not a Customers-API id, and it is documented
  unstable per
  [`mp-subscription-flow-research-2026-07-18.md:65`](mp-subscription-flow-research-2026-07-18.md).
  Storing it under a `mp_customer_id` name misrepresents what the value actually is
  and invites a future reader to trust it as an authoritative handle it never was.

## What was removed

- `backfillMpCustomerId()` and its call site in
  `apps/api/src/routes/webhooks/mercadopago/subscription-payment-handler.ts`.
- The `mpPayerId` field on `MPAuthorizedPaymentDetails`, its parsing, and the
  HOS-233/HOS-234 payload-shape diagnostic log in
  `apps/api/src/utils/mp-authorized-payment.ts`.
- The corresponding test surface in `subscription-payment-handler.test.ts` and
  `mp-authorized-payment.test.ts`.

This reverts most of PR #2449 (HOS-234), whose observability code existed solely to
diagnose the back-fill being deleted here — that is expected, not a regression.

## If you ever need saved-payment-method display

Do not resurrect `mp_customer_id` for this. The correct source is the inner
`payment` block already returned by MercadoPago's authorized-payment resource
(`payment_method_id`, `last_four_digits`, etc. — see the raw response parsed in
`parseAuthorizedPaymentResponse`). That block reflects the actual card used for a
given charge, which is what a "payment method on file" UI needs — a static
per-customer id is neither necessary nor sufficient for that use case in a
preapproval-only integration.

## See also

- [`mp-subscription-flow-research-2026-07-18.md`](mp-subscription-flow-research-2026-07-18.md) —
  the research doc documenting `payer_id` instability (line 65).
