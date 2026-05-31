# MercadoPago Test Cards Reference

Reference for **MercadoPago sandbox** test cards and payment-status
outcome codes. Used in conjunction with `staging-smoke-checklist.md`
(Workstream B) — every smoke section's run log records which card +
status-code combination produced the documented outcome.

Authored as part of **T-143-52** (Phase 4 polish). Focuses on
**Argentina (MLA)** because Hospeda's primary market is AR. If/when
multi-country billing lands, append the other-site sections from MP's
own reference documentation.

Source: MP developers docs, `tarjetas de prueba` topic. Re-validate
the card numbers against the live MP docs before each major release
— MP rotates the test set occasionally and a stale card number
silently fails every smoke.

## How to use

1. Pick a **card number** from the cards table below. The number alone
   does not determine the outcome — it is the **cardholder name**
   (the `APRO` / `OTHE` / `CONT` / etc. code) that drives MP's
   simulated response.
2. Pick the **outcome code** matching the scenario you want to smoke:
   - Happy path → `APRO`
   - Generic rejection → `OTHE`
   - Pending payment → `CONT`
   - Specific rejection reasons → see the outcome table.
3. Combine: any test card + the chosen outcome code + valid CVV/expiry
   = the desired simulated outcome.
4. For Argentina, the document number is **DNI 12345678** when the
   outcome code requires one (`APRO`, `OTHE`). For codes marked `-` in
   the table, any document number works.

## Cards table (Argentina — MLA)

### Approved-by-default cards

These cards return successfully when no special cardholder code is
used. The outcome can still be overridden via the cardholder name.

| Type | Brand | Number | CVV | Expiry |
|------|-------|--------|-----|--------|
| Credit | Mastercard | `5031 7557 3453 0604` | 123 | 11/30 |
| Credit | Visa | `4509 9535 6623 3704` | 123 | 11/30 |
| Credit | American Express | `3711 803032 57522` | 1234 | 11/30 |
| Debit | Mastercard | `5287 3383 1025 3304` | 123 | 11/30 |
| Debit | Visa | `4002 7686 9439 5619` | 123 | 11/30 |

Use these for **Flow 1.1 / 1.2 / 1.7** of the staging checklist
(happy-path checkouts and addons) — pair with cardholder `APRO`.

### Notes on card-number selection

- **Credit vs Debit**: most billing flows are credit-only at hospeda.
  Use credit cards by default; reach for debit only when smoking the
  preapproval (monthly) flow, which MP routes differently for debit.
- **Brand coverage**: Visa is the most-tested brand in CI stubs. Run
  smokes against Mastercard and Amex at least once per major release
  to catch brand-specific drift.
- **Card expiry**: all sandbox cards use `11/30`. The expiry-rejection
  outcome (`EXPI`) is triggered by the cardholder code, not by an
  expired card number — entering a real past date typically causes a
  form-validation error before MP sees it.

## Payment status outcome codes (cardholder name)

The cardholder name (first + last) controls MP's simulated outcome.
Always pair with the appropriate document number from the third
column.

| Outcome | Cardholder name | Document |
|---------|-----------------|----------|
| **Approved** | `APRO` | DNI 12345678 |
| Rejected — generic error | `OTHE` | DNI 12345678 |
| **Pending payment** | `CONT` | (any) |
| Rejected — call to authorize | `CALL` | (any) |
| Rejected — insufficient funds | `FUND` | (any) |
| Rejected — invalid CVV | `SECU` | (any) |
| Rejected — expired card | `EXPI` | (any) |
| Rejected — form error | `FORM` | (any) |
| Rejected — missing card_number | `CARD` | (any) |
| Rejected — invalid installments | `INST` | (any) |
| Rejected — duplicate payment | `DUPL` | (any) |
| Rejected — card disabled | `LOCK` | (any) |
| Rejected — card type not allowed | `CTNA` | (any) |
| Rejected — too many PIN attempts | `ATTE` | (any) |
| Rejected — blacklisted | `BLAC` | (any) |
| Not supported | `UNSU` | (any) |
| Amount-rule trigger | `TEST` | (any) |

## Mapping smoke sub-flows to card + code

The following table maps each smoke checklist sub-flow to the
recommended card + cardholder combo. When a sub-flow has multiple
sub-cases, the table lists each separately.

### Staging smoke (`staging-smoke-checklist.md`)

| Sub-flow | Card | Holder | Document |
|----------|------|--------|----------|
| 1.1 Annual checkout happy path | Visa credit `4509…3704` | `APRO` | DNI 12345678 |
| 1.2 Monthly checkout happy path | Visa credit `4509…3704` | `APRO` | DNI 12345678 |
| 1.4 Plan upgrade (delta charge) | Visa credit `4509…3704` | `APRO` | DNI 12345678 |
| 1.7 Addon purchase | Mastercard credit `5031…0604` | `APRO` | DNI 12345678 |
| 1.10 Failed payment webhook (past_due) | Visa credit `4509…3704` | `FUND` | (any) |
| 2.9 MP error handling — insufficient funds | Visa credit `4509…3704` | `FUND` | (any) |
| 2.9 MP error handling — invalid CVV | Visa credit `4509…3704` | `SECU` | (any) |
| 2.9 MP error handling — call to authorize | Visa credit `4509…3704` | `CALL` | (any) |
| 2.9 MP error handling — duplicate payment | Visa credit `4509…3704` | `DUPL` | (any) |
| 3.9.b D2 failure-redirect | Visa credit `4509…3704` | `OTHE` | DNI 12345678 |
| 3.9.c D3 pending-redirect | Visa credit `4509…3704` | `CONT` | (any) |

For any sub-flow not listed above, default to **Visa credit `4509…3704`
+ `APRO`** unless you are specifically testing a rejection path.

### Production smoke (`prod-smoke-checklist.md`)

Prod smoke uses **real cards**, not test cards. This reference is NOT
applicable to Flow 1 / 2 / 3 of the prod checklist. The prod smoke
test user is expected to use a real card the executor owns (refunded
at the end of each run).

## Dispute / chargeback testing

MP sandbox does **not** trigger real chargebacks automatically. There
are two ways to exercise the dispute flow:

### Manual dispute via MP merchant dashboard

1. Complete a successful payment with the `APRO` card (any test card
   + cardholder `APRO` + DNI 12345678).
2. Log into the MP sandbox merchant dashboard.
3. Navigate to the payment detail.
4. Trigger the "Initiate dispute" or "Force chargeback" action (the
   exact label varies by dashboard version).
5. The hospeda webhook will receive `chargebacks` and / or
   `payment.dispute` events depending on the action taken.
6. Verify the dispute handler logs the event but does NOT
   auto-resolve (per ADR-008 manual-in-v1 decision — see engram
   `spec/spec-143/checkpoint-post-t143-42`).

### Synthetic dispute via webhook replay

For CI-side verification (Workstream A), the e2e suite includes
`chargeback.test.ts` which constructs the `chargebacks` payload
directly via the `webhookEventFixtures.chargebackOpened()` helper.
The manual smoke variant above is the only way to confirm the path
end-to-end against real MP.

## Trial-period notes

MP does not have a native "trial" concept for preapprovals. Hospeda's
trial system is implemented locally: the sub row carries
`status='trialing'` with `trial_end` set, and the cron flips it to
`incomplete` / `active` / `cancelled` per the conversion policy.

When smoking trial flows (staging 2.1.a / 2.1.b / 2.1.c), you do NOT
need a special test card — the trial is created without an upfront
charge. Only the conversion sub-flow (2.1.c) actually authorizes a
recurring charge, and that uses the standard `APRO` cardholder.

## Refund testing notes

MP sandbox refunds are immediate (no card-issuer delay simulation).

To smoke the refund flow (staging 2.7):

1. Complete a successful payment with `APRO`.
2. Trigger a refund via the admin panel (or, while
   `bug/refund-flow-gaps` is open, also trigger via MP merchant
   dashboard).
3. Verify the refund appears in MP dashboard within seconds.
4. Verify `payments.refunded_amount` updates in hospeda's DB (this
   step currently FAILS — engram `bug/refund-flow-gaps` documents the
   gap; update the column manually as part of the smoke until the bug
   is fixed).

## Card rotation policy

MP rotates the sandbox card numbers periodically (typically twice a
year). To stay current:

- Before every major billing release, run a quick verification:
  attempt a `$1 APRO` checkout in staging. If it returns `rejected`
  without an obvious reason, the card number is likely stale.
- Source of truth: the official MP developer docs `Tarjetas de prueba`
  page. Always cross-check the numbers in this file against the live
  docs at release time.
- Update this file's cards table when MP rotates. Bump the file's
  T-143-52 entry in `state.json` with a `lastValidatedAt` timestamp
  pointing at the rotation date.

## Cross-references

- Spec: `.claude/specs/SPEC-143-billing-testing-coverage/spec.md`
- Task state: `.claude/tasks/SPEC-143-billing-testing-coverage/state.json`
- Staging smoke: `staging-smoke-checklist.md` (T-143-20, T-143-36, T-143-45)
- Production smoke: `prod-smoke-checklist.md` (T-143-22)
- Billing runbooks (incident response): `billing-runbooks.md` (T-143-49+,
  Phase 4 polish — still pending at the time of this write)
- Engram entries referenced:
  - `bug/refund-flow-gaps` — refund handler gaps
  - `spec/spec-143/checkpoint-post-t143-42` — dispute manual-in-v1 decision

## Last validated

| Date | Validator | MP docs URL | Notes |
|------|-----------|-------------|-------|
| 2026-05-19 | Initial authoring | MLA tarjetas de prueba (es) | First version. Run a validation smoke before next major release. |
