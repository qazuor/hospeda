---
spec-id: SPEC-121
title: E2E MercadoPago Secrets Bootstrap and Nightly Suite Reactivation
type: ops
complexity: low
status: draft
created: 2026-05-14T00:00:00Z
effort_estimate_hours: 2-4
tags: [e2e, ci, mercadopago, ops, nightly, carve-out]
extracted_from: SPEC-092 (94/99 closed; this spec absorbs the 5 operational leftovers)
depends_on: [SPEC-103]
first_allocated_via_engram_protocol: true
priority: low
---

# SPEC-121: E2E MercadoPago Secrets Bootstrap and Nightly Suite Reactivation

## Context

SPEC-092 (End-to-End Test Suite for Pre-Beta Validation) closed at 94/99. All code work is done — 55 e2e test files in `apps/e2e/tests/` on origin/staging, CI workflows shipped (`.github/workflows/e2e-pr.yml`, `.github/workflows/e2e-nightly.yml`). The 5 remaining tasks are NOT code work — they are externally blocked operational items that should not keep SPEC-092 squatting in `in-progress` for months.

This spec carves out the operational leftovers so SPEC-092 can be cleanly closed.

This is also the **first spec allocated under the engram-backed SPEC registry protocol** (see `~/.claude/CLAUDE.md` § "Spec Number Allocation"). Number 121 was reserved via engram before this directory was created.

## Scope

### T-121-01: MercadoPago sandbox account + seller test user
**Owner**: qazuor (manual) — MP dashboard work, no code artifact possible.

Create a dedicated MP sandbox account for E2E nightly testing. Generate a seller test user. Capture the credentials (public key, access token in `APP_USR-` format — see engram `gotcha_mercadopago_credentials`).

**Note**: per engram `gotcha_mercadopago_test_credentials_architecture`, test-user tokens cannot call `/v1/customers` and signup-via-MP-customer-sync will hit HTTP 401 in the E2E flow. The real MP customer-sync path is validated manually in staging; the E2E suite uses the documented `providerSyncErrorStrategy: "log"` graceful fallback (already in qzpay-hono).

### T-121-02: Configure MP credentials in GitHub Secrets
**Owner**: qazuor (manual) — GitHub Settings → Secrets and variables → Actions. Blocked by T-121-01.

Keys to set:
- `MP_SANDBOX_PUBLIC_KEY`
- `MP_SANDBOX_ACCESS_TOKEN`
- `MP_SANDBOX_SELLER_USERNAME`
- `MP_SANDBOX_SELLER_PASSWORD`

The nightly workflow at `.github/workflows/e2e-nightly.yml` already references these.

### T-121-03: Re-enable the nightly cron after SPEC-103 stabilises
**Owner**: qazuor + agent. Blocked by SPEC-103 (already closed at 67/95).

The `cron` trigger in `.github/workflows/e2e-nightly.yml` was disabled on 2026-05-12 because the suite was failing every night since the VPS migration sprint. With SPEC-103 closed, re-enable the cron and run a "manual" first nightly to confirm the suite passes.

### T-121-04: 7-night flake measurement
**Owner**: agent. Blocked by T-121-03.

Run 7 consecutive nightly runs, collect pass/fail/duration per test. Identify tests with >2% flake rate.

### T-121-05: Quarantine list + documentation
**Owner**: agent. Blocked by T-121-04.

Add an explicit "Quarantine" section to `apps/e2e/README.md` listing tests > 2% flake rate, with `test.fixme(condition, reason)` annotations referencing this spec. Pattern is documented but the actual list cannot exist until T-121-04 produces metrics.

## Acceptance Criteria

- [ ] MP sandbox account active and credentials captured (T-121-01)
- [ ] GitHub Secrets set for all 4 MP keys (T-121-02)
- [ ] Nightly cron re-enabled and passing in `.github/workflows/e2e-nightly.yml` (T-121-03)
- [ ] 7 consecutive nightly runs collected with flake metrics (T-121-04)
- [ ] Quarantine list documented in `apps/e2e/README.md` (T-121-05)
- [ ] SPEC-092 status confirmed as `completed` in engram + repo index

## Out of Scope

- New E2E test development — that lives in dedicated specs as they arise.
- MP production credentials — that is SPEC-109 (MercadoPago Production Readiness).
- Test fixes if the suite fails after re-enable — would be a follow-up depending on findings.

## Risks

| Risk | Mitigation |
|---|---|
| MP changes the test-user `/v1/customers` block | Watch engram `gotcha_mercadopago_test_credentials_architecture` for updates; the graceful fallback already handles this. |
| Nightly stays red after re-enable | Time-box investigation to 1 session; if root cause is broader than SPEC-103 leftovers, escalate to a new spec. |
| Quarantine list balloons | If > 10% of tests need quarantine, treat that as a test-quality regression and open a follow-up. |

## Related

- SPEC-092 (closed) — the parent that carved this out
- SPEC-103 (closed) — blocker for T-121-03 (nightly was disabled while SPEC-103 stabilised the VPS migration)
- SPEC-109 (open) — MercadoPago production credentials, separate concern
- `apps/e2e/README.md` — runbook
- `.github/workflows/e2e-nightly.yml` — the workflow this spec reactivates
- engram observation `spec/hospeda/SPEC-092/status` — audit context
- engram observations `gotcha_mercadopago_credentials` + `gotcha_mercadopago_test_credentials_architecture` — MP gotchas to apply during T-121-01
