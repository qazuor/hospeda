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
  1. Trigger `billing-reconciliation-sweep?newCycle=true` on `staging`. The exclusive
     manual trigger answers `202` with a `runId`; read the result from `cron_runs`.
     Confirm that `subscription.next_charge_at` equals the preapproval's
     `next_payment_date` (read-only `GET /preapproval/{id}`).
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

### S4a — Resumable sweep slicing

- **Preconditions:** Staging test subscriptions are available and no reconciliation sweep is running.
- **Steps:**
  1. Configure a small slice budget in the test harness so one cycle spans 02:10, 03:10 and 04:10.
  2. Kill one slice mid-run, then allow the next scheduled slice to resume.
  3. Read the completed cycle summary from `cron_runs` and confirm the interrupted row was safely retried.
- **Expected:** The cycle reaches `CYCLE_DONE`, preserves completed row/pass progress, and reports its aggregate summary.
- **Evidence:** The three slice records and the final cycle summary in `cron_runs`.

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

### V7.3 · Alta directa de Partner (HOS-1487)

- **Preconditions:** `staging` with a real `HOSPEDA_EMAIL_API_KEY`; two mailboxes controlled by the executor; an admin with `PARTNER_MANAGE`.
- **Steps:**
  1. Create a Partner in the admin and enter a claim notice address controlled by the executor.
  2. Verify the claim notice arrives at that address.
  3. Claim the Partner with a different account.
  4. Verify the Partner is owned by the claiming account and the mailbox account received no other email.
- **Expected:** The Partner remains unowned until the link is claimed; the claiming account receives `PARTNER_OWNER`.
- **Covers:** AC:V7:11, AC:V7:12; TEST:V7:11 and TEST:V7:12(a).

### V7.5 · Acción 6: configurar plan y pago de un Partner (HOS-1489)

- **Preconditions:** `staging` with a claimed Partner, a monthly `partner-silver` option, and a SUPER_ADMIN.
- **Steps:**
  1. Open the Partner detail in the admin, select **Configurar plan y pago**, choose `partner-silver` monthly, and enter a reason. Select **Revisar**; confirm the panel names the Partner, owner, plan, amount and Manual method, while no subscription has been written.
  2. Select **Confirmar**. Confirm one `MANUAL` subscription in `PENDING_AUTHORIZATION`, one `AWAITING` installment, one `partner.billing_configured` event with the actor, Partner and reason, and one unpaid installment notice per SUPER_ADMIN in the outbox.
  3. Register the installment (action 3, MP1, S11 step 2). Confirm the subscription becomes `ACTIVE` and the Partner's plan presence appears in the carousel (Silver) and page (Gold).
  4. Confirm an admin without `partner.configureBilling` does not see the button and receives 403 from `POST …/billing-setup`.
- **Expected:** The action writes only after explicit confirmation and records actor, subject and reason.
- **Evidence:** The preview and POST responses; read-only queries on `subscription`, `manual_payment`, `domain_event` and `email_outbox`.
- **Covers:** AC:V7:17; TEST:V7:18.

### S11 — Manual payment installments (HOS-1541, HOS-1542)

- **Preconditions:** HOS-1629 manual signup is deployed on staging; use only a test account and a SUPER_ADMIN. The manual payment path does not call Mercado Pago, except that activation can cancel an inherited Tourist VIP.
- **Steps:**
  1. In the Partner detail, use **Configurar plan y pago** to select a manual plan, review the confirmation panel, and confirm. Verify `PENDING_AUTHORIZATION`, one `AWAITING` installment and one unpaid installment notice per SUPER_ADMIN.
  2. As SUPER_ADMIN, call `GET …/manual-payments`, preview `GET …/{id}/register`, then `POST …/{id}/register` with `proofRef`. Confirm preview effect `S29` and the new date, then `REGISTERED` with actor, time and proof, `ACTIVE`, one `receipt`, one cycle of `next_charge_at`, signup confirmation and publishable coverage.
  3. Set `next_charge_at` in the past on that test row with `hops psql --target=staging` and wait for `manual-installment-open` at minute 13. Confirm a second `AWAITING` installment, `GRACE_PERIOD`, `grace_ends_at` after the plan's grace days and one admin notice. Rerun the job and confirm exact counts remain one installment and one notice for that period.
  4. Register the second installment. Confirm `ACTIVE`, cleared grace and one cycle of date advancement.
  5. Repeat step 3 and declare the new installment unpaid. Confirm `DECLARED_UNPAID`, `SUSPENDED`, the manual payer suspension notice and removal from public coverage.
  6. Confirm an ADMIN without the action permissions receives 403 on both POST routes, a foreign installment receives 404, and declaring unpaid on an `ACTIVE` row receives 409.
  7. Leave a new `AWAITING` installment past `grace_ends_at` and wait for `manual-grace-expiry`. Confirm it becomes `DECLARED_UNPAID`, the subscription becomes `SUSPENDED`, and retrying the job leaves exactly one installment for that period. The payer's suspension email names the overdue installment and does not mention a card. In My Subscription, confirm “Pago pendiente” during grace, “Suspendida” after expiry and “Activa” after MP4.
  8. Preview and register that late payment through `GET` and `POST …/{id}/register-late`. Repeat with a period that has already ended. Confirm the first returns through S7, and the ended period is reimputed to the reactivation period with its next charge date advanced by one cycle. Compare preview results with the persisted row after the GET to confirm no writes.
  9. On a separate manual subscription whose latest installment is `REGISTERED` and covered, preview and register a second transfer through `GET` and `POST …/unallocated`. Confirm the new `UNALLOCATED` row is `REGISTERED`, the mark reason is `COBRO_DUPLICADO` (20), and coverage, subscription state and next charge date are unchanged. Repeat on a `CANCELLED` subscription with a final `DECLARED_UNPAID` installment and on an `ABANDONED` subscription with its first installment `DECLARED_UNPAID`; confirm `COBRO_POSTERIOR_A_LA_BAJA` (2).
- **Expected:** Steps 1–9 reach the stated states, dates, notices, receipts, marks and HTTP responses; MP4 and MP6 previews preserve subscription, installments and marks; retries do not duplicate installments or notices.
- **Evidence:** The API responses, the test subscription and installment rows, receipts, coverage, reconciliation marks, per-admin outbox rows and the `manual-installment-open` and `manual-grace-expiry` cron runs.
- **Covers:** AC:B5:13–19, AC:B5:35; TEST:B5:7, TEST:B5:8 (MP2 and MP3), TEST:B5:9, TEST:B5:10 and the MP5 half of TEST:B5:18; AC:B7:32 (manual path); TEST:B7:20.
- **Sign-off:** [ ] Date: ______ Executor: ______ Result: ______ Notes: ______

### S12 — Partner presence and moderation (HOS-1488)

- **Preconditions:** A claimed Partner whose owner has a live Gold plan; an admin with `LISTING_MODERATE` and an admin without it.
- **Steps:**
  1. Open `/es/partners/<slug>/` and the home carousel; confirm the page responds 200 and the logo appears.
  2. In the admin, open the Partner detail and moderate its presence with a reason. Confirm the page responds 404 (not 410), the logo leaves the carousel after purge, and the owner's subscription is unchanged in billing admin.
  3. Lift moderation with a reason and confirm the page returns 200 on the next read.
  4. Confirm an admin without `listing.moderate` does not see the moderation button and receives 403 from `POST …/presence-moderation`.
- **Expected:** The presence is hidden and restored without changing the partner's billing; only an admin with `LISTING_MODERATE` can use the control.
- **Evidence:** Read-only query on `domain_event` for `partner.presence_moderation_changed` and on the Partner moderation bit; the public page's HTTP response code before, during, and after moderation.
- **Covers:** AC:V7:14; TEST:V7:14.
- **Sign-off:** [ ] Date: ______ Executor: ______ Result: ______ Notes: ______

### S13 — Partner screens for row 33 and row 34 (HOS-1497)

- **Preconditions:** `staging` with a real `HOSPEDA_EMAIL_API_KEY`; account A that already owns a Partner; a second approved Partner B with an unspent claim link (from the S10 setup); account C with an UNVERIFIED email (sign up and do not follow the verification link) and a second browser profile for C; the web and the API on the same deployment.
- **Steps:**
  1. Signed in as A, open B's claim link and press the claim button.
  2. Confirm the page and the database (read-only) show B is still unclaimed; sign out, sign in as another verified account and claim B with the same link.
  3. Signed in as C (unverified), open `/es/sumate/partner/`, complete the form and submit.
  4. On the row-34 screen, press the resend button; open the new verification email and follow its link; confirm it returns to `/es/sumate/partner/`.
  5. Submit the form again as C.
  6. Repeat step 3 right after verifying, in the same browser, and note whether the first submit still answers with the row-34 screen (session-cache window, R-1).
- **Expected:** A sees «Tu cuenta ya es dueña de un Partner. Cada cuenta administra un solo Partner: el segundo negocio se reclama con otra cuenta. Si necesitás ayuda, escribinos a soporte.» with the support link, and B's claim link still works for another account; C sees «Para postular un Partner primero tenés que verificar el correo de tu cuenta. Todavía no registramos tu postulación.» and the resend button, no application exists for the typed email after step 3, the resend sends a verification email whose link comes back to the application page, and after verifying the submit is accepted (a short delay of up to 5 minutes from the session cache is acceptable and must be noted).
- **Evidence:** `hops psql --target=staging`, read-only: B's `owner_user_id` and `claim_secret_hash` before and after step 1 (unchanged) and after step 2 (`owner_user_id` = the second account); `SELECT count(*) FROM partner_application WHERE lower(email) = lower('<typed email>')` = 0 after step 3 and 1 after step 5; the `email_outbox`/Better Auth verification email for C. No secrets in the sign-off.
- **Covers:** AC:V8b:4, AC:V8b:5; TEST:V8b:4, TEST:V8b:5.
- **Sign-off:** [ ] Date: ______ Executor: ______ Result: ______ Notes: ______

### S14 — Empty a Partner presence on request (HOS-1498)

- **Preconditions:** `staging` with Cloudinary configured; a claimed test Partner with a live billing subscription; a SUPER_ADMIN or ADMIN with `partner.emptyPresence`; the owner's account has completed step 1 of the manual account closure and no longer holds the Partner page key.
- **Steps:**
  1. Upload a test logo manually to the real Cloudinary account under `hospeda/…`, then set that URL as the test Partner's `logo_url`. Record the URL privately for the asset check.
  2. Open the Partner detail in the admin and choose **Vaciar presencia**. Confirm the dialog names the Partner and says its content is deleted and does not come back; enter the owner's request as the reason and confirm.
  3. Check the recorded Cloudinary URL and confirm it now returns 404.
  4. Open the Partner's public page through the public site and confirm it returns 404 past the edge. Use the cache handling from S5; the owner has already lost the page key, so do not infer this result from an account that still has it.
  5. With read-only `hops psql --target=staging`, inspect the Partner's `domain_event`: confirm type `partner.presence_emptied`, actor and reason. Do not select or include the logo URL in the evidence.
  6. Confirm the owner's subscription and payment state are unchanged. Continue the manual account closure with action 24 and confirm the Partner presence no longer blocks it.
- **Expected:** The real Cloudinary asset is gone; the public Partner page is 404 after edge revalidation; the event records actor and reason without exposing the URL; billing remains unchanged; and action 24 can proceed.
- **Evidence:** Cloudinary's 404 response; public page response after the S5 cache procedure; read-only Partner, `domain_event` and billing queries with no logo URL; action 24 preview and result.
- **Covers:** AC:V8b:6; TEST:V8b:6 (real provider through this staging smoke).

### S15 — Plan change by route (HOS-1579)

- **Preconditions:** A monthly `ACTIVE` principal subscription with a card on staging and two plans in its vertical.
- **Steps:**
  1. Upgrade through `POST /api/v1/protected/billing-subscription/{subscriptionId}/plan-change`. Check the sandbox checkout amount and the credited future first charge. Abandon checkout; the old subscription remains `ACTIVE` and continues billing.
  2. Repeat and authorize. Confirm the “Your plan change is active” email arrives before Mercado Pago's cancellation email. The old subscription and preapproval are cancelled, the successor is `ACTIVE`, and an old addon now belongs to it.
  3. Downgrade. Read the new preapproval amount immediately; capabilities remain until `next_charge_at`.
  4. EX-33: Confirm checkout preserves the future first charge date. If it resets that date, compensation cannot run and the person pays twice (DEC-SUB-006).
- **Expected:** The route chooses the direction and preserves the predecessor until the successor is authorized.
- **Evidence:** Route responses, fake or sandbox provider reads, subscription and addon rows, email order and cron runs.
- **Covers:** AC:B8b:8, AC:B8b:9, AC:B8b:10, AC:B8b:14, AC:B8b:15, AC:B8b:24.
- **Sign-off:** [ ] Date: ______ Executor: ______ Result: ______ Notes: ______

### S16 — Pause, resume and act notices (HOS-1580)

- **Preconditions:** A monthly `ACTIVE` card principal on staging; a test customer and a `SUPER_ADMIN`.
- **Steps:**
  1. Pause for one month from Mi Suscripción. Check the confirmation explains the listing and recurring addons, names this customer's end date, and the sandbox preapproval reads `paused`; the listing leaves the public site.
  2. Resume early. Check the result says only the next charge day and amount, and the sandbox preapproval reads `authorized` with that date.
  3. Pause again and cancel while `PAUSED`. Check the preview says service ends today and the sandbox preapproval reads `cancelled`.
  4. As `SUPER_ADMIN`, pause and resume a customer in the panel. Check the mutation audit records `administrativeAction: ACC_9` and the admin actor.
  5. Change a customer's plan to an upgrade in the panel. Check it returns the checkout, then authorize with the customer's test card.
- **Expected:** The owner and admin surfaces state the effects and dates before each act; S22 ends the paused service today unless unconsumed credit sets its later end.
- **Evidence:** Preview and action responses, sandbox provider reads, listing visibility, subscription rows, and audit entries.
- **Covers:** AC:B8b:22, AC:B8b:25 (TEST:B8b:22, TEST:B8b:25).

### S17 — Temporary courtesy and revocation (HOS-1590)

- **Preconditions:** A monthly `ACTIVE` card principal in staging with a sandbox preapproval; a test customer and a `SUPER_ADMIN`.
- **Steps:**
  1. Grant one month of temporary courtesy through the service or console until HOS-1592 supplies its route. Read the sandbox preapproval as `paused`, check whether Mercado Pago sent its pause email, and confirm the row is `PAUSED · COURTESY`.
     From HOS-1592, perform this grant in `/billing/subscriptions/<id>/courtesy`:
     confirm the end date in the panel and an `ACC_1` / `GRANT_COURTESY` audit entry with the grant id.
     Grant another two months and confirm the panel says they are added, the new end date is stored, and MP receives no second pause request.
     On an annual subscription, confirm the panel says unavailable and offers permanent courtesy and a renewal promo.
  2. In the same screen, preview revocation: it names the remaining courtesy lost, no refund, `ACTIVE`, and the predicted charge day. Confirm the action and compare the result's confirmed charge day with the sandbox preapproval's `next_payment_date`.
     Confirm revocation through `POST /api/v1/admin/billing-subscription/{subscriptionId}/courtesy/revoke`. Read the preapproval as `authorized`; check whether Mercado Pago sent its resume email.
  3. Check our `billing.courtesy-revoked` email and compare its next charge date with the sandbox preapproval's `next_payment_date`.
- **Expected:** The subscription returns to `ACTIVE`, the pause has `actual_end_at` written immediately, the next charge dates agree, and the two provider email outcomes are recorded.
- **Evidence:** Route response, read-only subscription, pause, grant and outbox rows; sandbox preapproval reads; both provider email observations and our notice.
- **Covers:** AC:B9b:11, AC:B9b:13, AC:B9b:14; TEST:B9b:11, TEST:B9b:13, TEST:B9b:14, TEST:B9b:15.

### S18 — Addon purchase: recurring checkout and one-time order (HOS-1593)

- **Preconditions:** A paying `ACTIVE` principal in staging, a test card, and saleable recurring and one-time addon products.
- **Steps:** Buy a recurring addon through the protected API; authorize its own sandbox checkout. Repeat the POST with the same `orderRequestId`. Buy a one-time addon with the test card. Let a second recurring checkout expire without authorization.
- **Expected:** The addon has its own preapproval and its `external_reference` names the complement row; the principal amount stays unchanged. Replay creates no second preapproval. The one-time order has a payment on its `ACTIVE` instance and an end date. A3 sends our email before cancelling the expired preapproval.
- **Evidence:** API responses, read-only sandbox preapprovals and order, addon instance and payment rows, receipt, and outbox delivery time.
- **Covers:** AC:B10:1, AC:B10:2, AC:B10:3, AC:B10:4; TEST:B10:1, TEST:B10:2, TEST:B10:3, TEST:B10:4, TEST:B10:5.

### S19 — Addon end of life: expiry, purged listing and declined order (HOS-1594)

- **Preconditions:** A paying principal in staging, owned listings, saleable recurring and fixed-days one-time addons, and Mercado Pago sandbox test cards.
- **Steps:**
  1. Buy and activate a recurring `LISTING` addon, then purge its listing with `POST /protected/{plural}/{id}/purge` (PB12). Observe our `billing.addon-listing-purged-cancel` email before the addon's preapproval becomes `cancelled`; check that the principal preapproval is unchanged.
  2. Buy a one-time addon with a rejection test card. Read the purchase immediately and inspect the failed `/v1/orders` order.
  3. Retry the purchase with another card and a new request identifier. Compare instance and order identifiers.
  4. Buy a fixed-days one-time addon, unpublish its listing, and pass `ends_at` using the staging clock if available. Read its instance and coverage.
- **Expected:** Purging consumes the addon and closes its complement once; the rejected order yields `ABANDONED` immediately; the new request creates a new instance and order; fixed-days expiry reaches `EXPIRED` while unpublished.
- **Evidence:** Read-only addon, complement, principal, order and outbox rows; sandbox preapproval and order reads; delivery and cancellation timestamps.
- **Covers:** AC:B10:5, AC:B10:6, AC:B10:7; TEST:B10:6, TEST:B10:7, TEST:B10:8.

### S20 — Addon version publication, free addon under grant and purchase screen (HOS-1595)

- **Preconditions:** Staging has a `SUPER_ADMIN`, an admin without `billing.publishAddonVersion`, a paying owner with a listing boost, and a separate test beneficiary of a live `includesAddons: true` grant. The sandbox has an approved recurring addon amount and a test card.
- **Steps:**
  1. Through the admin API, preview and publish a new version of a recurring addon with no live purchases and a new price. Open a new recurring checkout from `/es/mi-cuenta/complementos/`; compare its price with the previously bought instance's `addon_version_id`. Ask the admin without permission to publish.
  2. From the purchase screen, choose a compatible addon under the grant; inspect the `ACTIVE` instance and its `title_anchor_id`, then revoke the grant.
  3. Open a paid `LISTING` boost summary for a draft listing and a published listing. Read the notice before confirming either.
  4. Buy the recurring addon from the screen and follow checkout back to `/es/mi-cuenta/complementos/?compra=…`; observe processing until `ACTIVE`.
- **Expected:** The new checkout uses the new price while the old instance keeps its version; the unpermitted admin gets 403. The grant choice is `ACTIVE` without a sandbox preapproval or order and becomes `CANCELLED` without a provider call when revoked. The draft summary warns that the boost is charged while hidden, and the published summary has no warning. The recurring checkout returns to the localized purchase screen and reaches `ACTIVE`. One-time offers do not appear on the web purchase screen.
- **Evidence:** Admin API responses, read-only addon product and instance rows, grant anchor, sandbox preapprovals and orders, purchase screen captures, checkout return URL and purchase status reads.
- **Covers:** AC:B10:8, AC:B10:11, AC:B10:12, AC:B10:13; TEST:B10:9, TEST:B10:13, TEST:B10:14, TEST:B10:15.
- **Nota:** pago único: ver HOS-2094.

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

### P6 — Real plan change

- **Preconditions:** The owner's production account has an `ACTIVE` card subscription and an approved upgrade amount.
- **Steps:**
  1. Confirm `subscription-succession-reevaluation` is present in the cron panel and runs without rows.
  2. Repeat S15 step 2 with the owner's card and approved amount; inspect both subscriptions and the provider's cancellation read.
- **Expected:** The successor activates before the predecessor closes.
- **Evidence:** Route response, provider read, subscription rows and cron panel.
- **Covers:** AC:B8b:8, AC:B8b:24.

### P7 — Real pause and resume (HOS-1580, HOS-1581)

- **Preconditions:** The owner's production account has an `ACTIVE` monthly card subscription that allows a pause.
- **Steps:**
  1. Pause for one month from Mi Suscripción with the owner's card; read the real preapproval as `paused`.
  2. Resume early; compare the date shown on screen with the real preapproval, which reads `authorized` with that next charge date.
- **Expected:** The preapproval moves from `paused` to `authorized`, and its next charge date matches the screen.
- **Evidence:** Owner screen, subscription and pause rows, and read-only provider preapproval reads.
- **Covers:** AC:B8b:22, AC:B8b:23, AC:B8b:26; TEST:B8b:25, TEST:B8b:26.

### P8 — Temporary courtesy and revocation (HOS-1590)

- **Preconditions:** The owner's internal production account has an `ACTIVE` monthly card subscription and an approved amount.
- **Steps:** Grant one month of temporary courtesy through the service or console until HOS-1592 supplies its route; read the Mercado Pago preapproval as `paused` and check its provider email. Confirm revocation through the admin route; read the preapproval as `authorized`, compare its `next_payment_date` with the date in our `billing.courtesy-revoked` email, and check the provider resume email.
  From HOS-1592, perform the grant and revocation in `/billing/subscriptions/<id>/courtesy` with the internal monthly account: verify the grant end date and audit entry, the loss/no-refund/`ACTIVE`/predicted-date confirmation, the confirmed result date, and both provider emails.
- **Expected:** The subscription moves `PAUSED · COURTESY` → `ACTIVE`; the next charge dates agree, and both provider emails are observed.
- **Evidence:** Read-only subscription, pause, grant and outbox rows; read-only provider preapproval reads; both provider emails and our notice.
- **Covers:** AC:B9b:11, AC:B9b:13, AC:B9b:14; TEST:B9b:11, TEST:B9b:13, TEST:B9b:14, TEST:B9b:15.

### P9 — Real addon purchase (HOS-1593)

- **Preconditions:** The owner's internal production account has a paying `ACTIVE` principal and an approved addon amount.
- **Steps:** Buy a recurring addon and a one-time addon through the protected API with the owner's card. Read both provider charges and observe the provider email and card summary.
- **Expected:** The plan and addon have separate charges and preapprovals; the one-time order has its own payment on an `ACTIVE` instance.
- **Evidence:** Owner account responses, read-only provider records, card summary, provider email, and read-only addon/payment rows.
- **Covers:** AC:B10:1, AC:B10:2, AC:B10:3, AC:B10:4; TEST:B10:1, TEST:B10:2, TEST:B10:3, TEST:B10:4, TEST:B10:5.

### P10 — Real purged-listing addon cancellation (HOS-1594)

- **Preconditions:** The owner's internal production account has an active principal and an approved recurring `LISTING` addon amount.
- **Steps:** Repeat S19 step 1 with the owner's card and approved amount. Observe our notice and the provider's cancellation email; verify that no later addon charge occurs.
- **Expected:** The addon and its complement are `CANCELLED`, our notice precedes cancellation, the principal stays active, and the addon has no later charge.
- **Evidence:** Read-only instance, complement, principal, outbox and provider records; both emails and subsequent provider charge history.
- **Covers:** AC:B10:6; TEST:B10:7.

### P11 — Phase 3 real recurring addon purchase (HOS-1595)

- **Preconditions:** The owner's internal production account has an active paying principal and an approved recurring addon amount; only the owner runs this item.
- **Steps:** Buy a recurring addon from `/es/mi-cuenta/complementos/` with the owner's card. Observe the returned purchase and both the principal and addon charges.
- **Expected:** The recurring addon becomes `ACTIVE` with its own preapproval and charge, separate from the principal's unchanged amount; the provider sends its charge email. Action 20 is not executed in production smoke.
- **Evidence:** Owner account screen and purchase response, read-only provider and payment records, card statement, provider email, and read-only addon instance rows.
- **Covers:** AC:B10:1, AC:B10:2, AC:B10:11; TEST:B10:13 and the Phase 3 production go-live smoke.
- **Nota:** pago único: ver HOS-2094.

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
B8b (HOS-1579) added S15 to staging and P6 to production.
B8b phase 2 (HOS-1411) is covered by S15, S16 and P6/P7; courtesy pause follows in HOS-1590.
The TEST:B8b:25 row 5 variant (PM-374: pause denied while courtesy remains active) is verified with HOS-1592.
Phase 3 (B10, HOS-1373) starts with HOS-1593: S18 and P9.
Phase 3 (B10, HOS-1373) continues with HOS-1595: S20 and P11.

## Related

- [Cutover script (U3)](../../scripts/cutover/README.md) — TEST:U3:11 (manual smoke for the owner) and
  TEST:U3:12 (staging rehearsal smoke), plus the Sentry cron monitors.
- [CLAUDE.md — billing testing](../../CLAUDE.md) — the smoke rule requiring staging and production
  manual verification before merge and production promotion.
