# New-system smoke checklist

Manual smoke for the new billing verticals system (HOS-1352, piece `B13a`, GATE:SMOKE).
Covers what the design declares non-simulable (B/20 §5.1): a real checkout on the application
page, Mercado Pago emails to the customer, edge cache and revalidation at Cloudflare, and the
actual cron schedules on the first day.

The labels `status-needs-smoke-staging` and `status-needs-smoke-prod` go **only on HOS-1352**,
never on the piece issue (GATE:M1).

## Scope

This checklist covers what the design declares non-simulable (B/20 §5.1): a real checkout on the
application page, Mercado Pago transactional emails to the customer, edge cache and revalidation
at Cloudflare, and the actual cron schedules on the first day. It does **not** replace end-to-end
or unit tests — it is a manual smoke run on a live environment.

Each later phase adds its own items to this checklist (GATE:FP.2).

## How to use this checklist

Each part is executed in its own environment and signed off separately.

- **Part 1 (staging)** is executed inside the cutover rehearsal ([PASO:0](../../.specs/HOS-1352-billing-verticals-redesign/spec-consolidada/30-el-corte.md#paso-0),
  [GATE:M3](../../.specs/HOS-1352-billing-verticals-redesign/spec-consolidada/30-el-corte.md#gate-m3)). Before merging any PR that touches billing to
  `staging`, run the relevant staging items (CLAUDE.md).
- **Part 2 (production)** is executed in step 5c of the cutover, after step 5. It is run **only
  by the owner**, with their card and an amount approved in advance. Its observation — together
  with the M5 condition (first real charge from a post-cutover account and seven days of clean
  sweeps) — is what retires `status-needs-smoke-prod` on HOS-1352 (GATE:M5).

Sign off each part by filling the table at the end of that part. Leave fields blank if not yet
available.

## Part 1 — Staging (cutover rehearsal)

Executed inside the cutover rehearsal on `staging`, with MP sandbox, before merging any billing
touching PR to `staging` (CLAUDE.md). This part is TEST:B13a:14 and TEST:U1:19.

### S1 — Checkout (new account)

- **Preconditions:** MP sandbox configured on `staging`; a test user with no subscription exists.
- **Steps:**
  1. Open the application page on `https://staging.hospeda.com.ar` as the test user.
  2. Complete a checkout through the real MP sandbox (card token or card form).
  3. Wait for the webhook and for the subscription row to appear.
- **Expected:** The subscription row reaches `ACTIVE`; the preapproval is created at MP without a
  provider plan; the delivery for the new account lands in `provider_notification` with its
  channel.
- **Evidence:** `hops psql --target=staging` — read-only query on `subscriptions` and
  `provider_notification` for the last inserted rows.
- **Covers:** TEST:B3:23 (via the small payment of B3.11); TEST:U3:12 (cutover smoke: the probe
  path).

### S2 — Our emails (outbox)

- **Preconditions:** A subscription exists (S1 or any other); the rehearsal rewrites emails to a
  non-delivering mailbox.
- **Steps:** Check the `email_outbox` and `notification_log` tables for emails sent by the new
  system for that subscription.
- **Expected:** Our emails appear in the outbox; our mail leaves before the provider's
  (LISTA:B13).
- **Evidence:** Read-only query on `email_outbox` filtering by `recipient_user_id` and
  `template_name`; confirm the `email_outbox` row exists even though the email does not deliver.
- **Covers:** LISTA:B13 ("nuestro correo sale antes que el del proveedor").

### S3 — Self-service cancellation (full path)

- **Preconditions:** An active subscription exists on `staging`.
- **Steps:**
  1. Open **My Subscription** on `https://staging.hospeda.com.ar`.
  2. Trigger the self-service cancellation flow (B8a).
  3. Confirm the cancellation.
- **Expected:** The subscription moves through its transition path to terminal state; a
  cancellation email is enqueued in the outbox.
- **Evidence:** Read-only query on `subscriptions` confirming the final status.
- **Covers:** B8a (the self-service cancellation, hand-on).

### S4 — Renewal notice

- **Preconditions:** An active card subscription exists on `staging` whose Mercado Pago
  preapproval is `authorized`.
- **Steps:**
  1. Run the `billing-reconciliation-sweep` cron on `staging` and confirm that
     `subscription.next_charge_at` equals the preapproval's `next_payment_date` (read-only
     `GET /preapproval/{id}`).
  2. On a staging test subscription created for this smoke (never a real customer's row), write
     `next_charge_at` 5 days ahead of the AR day, after the sweep and before the next one.
  3. Run the `subscription-renewal-notice` cron on `staging`.
  4. Check the outbox for a `billing.renewal-upcoming` row.
- **Expected:** `subscription.next_charge_at` equals the preapproval's `next_payment_date`; the
  outbox contains a `billing.renewal-upcoming` email with the occurrence
  `sub:<subscriptionId>:renov:-5d:<chargeDay>`.
- **Evidence:** Read-only `GET /preapproval/{id}` and query on `subscriptions` after the sweep;
  read-only query on `email_outbox` filtering by `template_name = 'billing.renewal-upcoming'`.
- **Covers:** HOS-1685 (provider next charge date copy); AC:B13a:13 (renewal notices at 5 and 1 day);
  TEST:B13a:13 (integration).

### S5 — Cloudflare edge cache and revalidation

- **Preconditions:** A listing exists on `staging` with active coverage.
- **Steps:**
  1. Read the listing page and note the `CF-Cache-Status` header.
  2. Change the listing coverage (approve or moderate a change).
  3. Re-read the listing page and verify ISR revalidation.
- **Expected:** The cache serves `HIT` after first read; after a coverage change, `CF-Cache-Status`
  shows `REVALIDATED` or `MISS` and the listing reflects the change.
- **Evidence:** `curl -I https://staging.hospeda.com.ar/<listing-slug>/` before and after the change;
  the listing content reflects the update.
- **Covers:** Cloudflare edge caching; ISR revalidation on coverage change.

### S6 — Cron schedules on the first day

- **Preconditions:** The billing crons are running on `staging`.
- **Steps:**
  1. Compare the running crons against the manifest at
     `apps/api/src/cron/schedules.manifest.ts`.
  2. Check the Sentry cron monitors for `billing-reconciliation-sweep` and
     `listing-coverage-reconciler`.
- **Expected:** Each cron's schedule matches the manifest; the Sentry monitors exist with the
  correct interval and check-in margin.
- **Evidence:** Screenshot of the Sentry Crons page for the staging environment; the manifest file.
  Sentry monitors: see [Cutover smoke: the Sentry cron monitors](../../scripts/cutover/README.md#cutover-smoke-the-sentry-cron-monitors).
- **Covers:** Cron schedule correctness on staging.

### S7 — Promo redemption: Mercado Pago amount-change email (CT-3)

- **Preconditions:** A «N cobros» code created from the editor at `/billing/promo-codes`; a card subscription in the Mercado Pago sandbox.
- **Steps:** Redeem the code in My Subscription and reread the Mercado Pago preapproval.
- **Expected:** The 7-bis notice appears on screen, `transaction_amount` is mutated, and Mercado Pago's “El vendedor Hospeda cambió el monto” email reaches the payer (not us).
- **Evidence:** Screenshot of the notice, the preapproval, and the email.
- **Covers:** AC:B9b:12; TEST:B9b:12; CT-3 (`B/14` §2.4).

### S8 — A deferred cancellation leaves within minutes (HOS-1955)

- **Preconditions:** A pending card signup on `staging` (MP sandbox); the
  `billing-deferred-cancellation-retry` cron is enabled.
- **Steps:**
  1. Press “Cancelar ese intento” in checkout (S40).
  2. Note the time and the row id (`ABANDONED`).
  3. Wait for `billing.attempt-cancelled-cancel` to become `sent` in `email_outbox`.
  4. Wait for the next `billing-deferred-cancellation-retry` run (minute 4 + 5n).
- **Expected:** The preapproval reads `cancelled` in MP within 10 minutes after the notice was
  `sent`, without running the daily sweep by hand; the cron run has
  `details.retried.confirmed` = 1; exactly one `billing.attempt-cancelled-cancel` row exists for
  that subscription.
- **Evidence:** Read-only `GET /preapproval/{id}`; the job's `cron_runs` row; a query on
  `email_outbox` filtered by `recipient_user_id` and template.
- **Covers:** AC:1955:1, AC:1955:6; the HOS-1955 measurement (29 October: about one hour with
  a manual sweep).

### S9 — Partner applications: claim notice, claim on verification, rejection

- **Preconditions:** `staging` with a real `HOSPEDA_EMAIL_API_KEY`; two mailboxes controlled by the executor, A (with a Hospeda account) and B (without an account); an admin with `PARTNER_RESOLVE_APPLICATION`; and a third mailbox C for rejection.
- **Steps:** Submit applications for A, B, and C through the public form; approve A and B and reject C through the admin API; open all three emails; open the verification link in B's email.
- **Expected:** A receives “Reclamá tu Partner en Hospeda” with a `/partners/reclamar/#partner=…&secret=…` link; B receives Better Auth verification and, after opening it, B's account owns the Partner with `PARTNER_OWNER`; C receives the rejection communication with the date from which they can apply again and without the reason; no email arrives twice.
- **Evidence:** `hops psql --target=staging`, read-only: A's Partner has a non-null `claim_secret_hash` different from the link secret; the payloads of both `email_outbox` rows contain neither the secret nor the reason; B's Partner `owner_user_id` equals B's account and has a `partner.claimed` event. V7.2 (HOS-1486) covers A's claim-link screen; do not open it in this step.
- **Covers:** AC:V7:4, AC:V7:5; TEST:V7:4, TEST:V7:5.

### S10 — Partner claim by link

- **Preconditions:** `staging` with a real `HOSPEDA_EMAIL_API_KEY`; mailbox A with a verified Hospeda account and a distinct mailbox B, both controlled by the executor; mailbox C owned by an unverified account, with another approved application, a second session open in another browser, and Google linked; an admin with `PARTNER_RESOLVE_APPLICATION`.
- **Steps:** Submit an application with A and approve it through the admin API; open its notice link in a signed-out browser, sign in as B, and claim; open the same link with another account; open it again after changing one character of the secret; with C, claim its Partner from the password-authenticated session, then try the other session and sign in with Google.
- **Expected:** B owns the Partner with `PARTNER_OWNER` and A is unchanged; the second claim shows «Este Partner ya tiene dueño; si no fuiste vos, escribinos a soporte»; the altered secret shows the nonexistent-Partner state; C becomes verified, its other session stops working within 5 minutes (session-cache window, R-1) and Google can no longer sign in; the sign-in URL never contains the secret.
- **Evidence:** `hops psql --target=staging`, read-only queries: `owner_user_id` and `claim_secret_hash` for the Partner before and after (the hash is unchanged); the `partner.claimed` event with `reason = 'claim_link'` and, for C, `changes` containing `email_verified`, `revoked_session_count`, and `removed_credential_providers`; C's `session` and `account` rows.
- **Covers:** AC:V7:7, AC:V7:8, AC:V7:9; TEST:V7:7, TEST:V7:8, TEST:V7:9, TEST:V7:22.

### S11 — Manual payment installments (HOS-1541)

- **Preconditions:** HOS-1629 manual signup is deployed on staging; use only a test account and a SUPER_ADMIN. The manual payment path does not call Mercado Pago, except that activation can cancel an inherited Tourist VIP.
- **Steps:**
  1. Start a manual plan. Confirm `PENDING_AUTHORIZATION`, one `AWAITING` installment and one unpaid installment notice per SUPER_ADMIN.
  2. As SUPER_ADMIN, call `GET …/manual-payments`, preview `GET …/{id}/register`, then `POST …/{id}/register` with `proofRef`. Confirm preview effect `S29` and the new date, then `REGISTERED` with actor, time and proof, `ACTIVE`, one `receipt`, one cycle of `next_charge_at`, signup confirmation and publishable coverage.
  3. Set `next_charge_at` in the past on that test row with `hops psql --target=staging` and wait for `manual-installment-open` at minute 13. Confirm a second `AWAITING` installment, `GRACE_PERIOD`, `grace_ends_at` after the plan's grace days and one admin notice. Rerun the job and confirm exact counts remain one installment and one notice for that period.
  4. Register the second installment. Confirm `ACTIVE`, cleared grace and one cycle of date advancement.
  5. Repeat step 3 and declare the new installment unpaid. Confirm `DECLARED_UNPAID`, `SUSPENDED`, the manual payer suspension notice and removal from public coverage.
  6. Confirm an ADMIN without the action permissions receives 403 on both POST routes, a foreign installment receives 404, and declaring unpaid on an `ACTIVE` row receives 409.
- **Expected:** Steps 1–6 reach exactly the states, dates, notices, receipt and HTTP responses stated above, without creating duplicate installments or notices on retry.
- **Evidence:** The API responses, the test subscription and installment rows, its receipts and coverage, the per-admin outbox rows and the `manual-installment-open` cron run.
- **Covers:** AC:B5:13–16; TEST:B5:7 and the MP2 half of TEST:B5:8.
- **Sign-off:** [ ] Date: ______ Executor: ______ Result: ______ Notes: ______

### Sign-off

| Date | Executor | PR | Result | Notes |
| --- | --- | --- | --- | --- |
| | | | | |

## Part 2 — Production (cutover step 5c)

Executed in step 5c of the cutover, after step 5. **Owner only.**
This part is TEST:B13a:15 and TEST:U1:20.

### P1 — Real checkout

- **Preconditions:** The owner's account on production; a card on file with an approved amount.
- **Steps:**
  1. Open the application page on the production site as the owner.
  2. Complete a real checkout with the owner's card.
- **Expected:** The subscription row reaches `ACTIVE`; the delivery lands in `provider_notification`
  with its channel.
- **Evidence:** Read-only query on `subscriptions` and `provider_notification` from the admin
  database.
- **Covers:** TEST:B3:36 (real checkout); AC:B3:34 (checkout confirmed).

### P2 — Refund (revocation from the admin panel)

- **Preconditions:** P1 completed successfully; an active subscription exists.
- **Steps:**
  1. Open the subscription in the admin panel.
  2. Trigger the revocation (S36, total refund + cancellation in one act, DEC-RF-001).
  3. Re-read the subscription and the payment.
- **Expected:** The subscription is cancelled; the payment shows a full refund.
- **Evidence:** Read-only query on `subscriptions`, `payments`, and `payment_refunds`.
- **Covers:** H-11 (return via admin panel revocation).

### P3 — Mercado Pago email

- **Preconditions:** A real payment was processed (P1 or P2).
- **Steps:** Check the owner's inbox for the email sent by Mercado Pago.
- **Expected:** The email arrived at the owner's address; its content matches the MP template
  (do not quote email text as a contract — it has not been measured).
- **Evidence:** Screenshot of the email in the inbox (subject, date, presence).
- **Covers:** Mercado Pago transactional emails to the customer.

### P4 — Edge cache on production

- **Preconditions:** A public listing on production.
- **Steps:**
  1. Read the listing and note the `CF-Cache-Status` header.
  2. Change the listing coverage.
  3. Re-read the listing and verify revalidation.
- **Expected:** Same behavior as on staging: cache HIT, then REVALIDATED or MISS after a change.
- **Evidence:** `curl -I https://<production-domain>/<listing-slug>/` before and after the change.
- **Covers:** Cloudflare edge cache in production.

### P5 — Cron schedules on the first day

- **Preconditions:** The billing crons are running on production (after step 5 of the cutover).
- **Steps:**
  1. Compare the running crons against the manifest at
     `apps/api/src/cron/schedules.manifest.ts`.
  2. Check the Sentry cron monitors for `billing-reconciliation-sweep` (included in the cron
     schedules) and `listing-coverage-reconciler`, and verify the
     `subscription-renewal-notice` cron appears in the manifest.
- **Expected:** Each cron matches the manifest schedule; the Sentry monitors exist with the
  correct interval.
- **Evidence:** Screenshot of the Sentry Crons page for production; the manifest file.
  Sentry monitors: see [Cutover smoke: the Sentry cron monitors](../../scripts/cutover/README.md#cutover-smoke-the-sentry-cron-monitors).
- **Covers:** Cron schedules on production, the first day (includes
  `billing-reconciliation-sweep` and `subscription-renewal-notice`).

### Sign-off

This part is run **only by the owner** with their card and a pre-approved amount. The observation
from this part — together with the M5 condition (first real charge from a post-cutover account
and seven days of clean daily sweeps) — is what retires `status-needs-smoke-prod` on HOS-1352.

| Date | Executor | PR | Result | Notes |
| --- | --- | --- | --- | --- |
| | | | | |

## Extending this checklist in later phases

Each later phase extends this checklist with its own items ([GATE:FP.2](../../scripts/cutover/README.md#gate-fp-2)):
the staging part, executed before merging the phase branch to `staging`, and a production 5c
own to the phase, with the owner's card and an approved amount, after the phase reaches production.
The B9b slice that went to cut (HOS-1588, HOS-1589, HOS-1591) added its item to Part 1; B9b phase 2 (temporary courtesy: pause and resumption, HOS-1590/HOS-1592) adds its own.

## Related

- [Cutover script (U3)](../../scripts/cutover/README.md) — TEST:U3:11 (manual smoke for the owner) and
  TEST:U3:12 (staging rehearsal smoke), plus the Sentry cron monitors.
- [CLAUDE.md — billing testing](../../CLAUDE.md) — the smoke rule requiring staging and production
  manual verification before merge and production promotion.
