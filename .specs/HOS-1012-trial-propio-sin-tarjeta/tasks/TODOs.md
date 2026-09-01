# HOS-1012: Hospeda-owned free trial — no card, own clock, starts at publish

## Progress: 0/30 tasks (0%)

**Average Complexity:** 2.6/3 (max)
**Critical Path:** T-001 → T-003 → T-010 → T-011 → T-012 → T-013 (6 steps)
**Parallel Tracks:** 3 identified (publish/eligibility · notifications · retirement)

> The trial stops being MercadoPago's and becomes a Hospeda state again: no card on day 1,
> no preapproval, and MercadoPago is never told a trial exists. All of HOS-937 is preserved —
> that is the paid path and it is needed either way.

---

### Setup Phase

- [ ] **T-001** (complexity: 2) — Add the `first_publish` eligibility reason and the trial offset constants
  - Recover the shape from commit `fed220c25` rather than re-deriving it. Frozen-array test over the nine offsets.
  - Blocked by: none
  - Blocks: T-003, T-007, T-030

- [ ] **T-002** (complexity: 3) — Add the nine notification types and clear the frozen guards they trip
  - A new enum value has already broken five frozen guards across three packages here. Run the four CI guards `check:guards` does NOT run.
  - Blocked by: none
  - Blocks: T-014, T-015

### Core Phase

- [ ] **T-003** (complexity: 3) — Create the local trial subscription creator (no MercadoPago object)
  - Model it on `subscription-comp-create.service.ts`, not on the checkout. `isEntitlementGrantingStatus` already covers `trialing`, so entitlement resolution does not change.
  - Blocked by: T-001
  - Blocks: T-004, T-008, T-010, T-022

- [ ] **T-004** (complexity: 2) — Unit-test the trial creator, mutation-verified
  - Blocked by: T-003
  - Blocks: none

- [ ] **T-005** (complexity: 3) — Scope trial eligibility to the product domain (D-2, absorbs HOS-931)
  - Route the comparison through `subscriptionMatchesDomain()` — the only place allowed to compare a domain. Keep the `pending_provider`/`abandoned` exclusion (HOS-230).
  - Blocked by: none
  - Blocks: T-006, T-007

- [ ] **T-006** (complexity: 3) — Test per-domain eligibility including the fail-open/fail-closed asymmetry
  - Blocked by: T-005
  - Blocks: none

- [ ] **T-007** (complexity: 3) — Restore `first_publish` in the publish eligibility resolver
  - Recover from `fed220c25` (171 lines deleted from this file). Restore the eligibility branch only — not the trial deps.
  - Blocked by: T-001, T-005
  - Blocks: T-008

- [ ] **T-008** (complexity: 3) — Start the trial INSIDE the publish transaction — no saga, no compensation
  - **The old implementation must NOT be recovered verbatim.** It called `startTrial` before the transaction (external MP call, 8s timeout), compensated with `cancelTrial`, and logged `CRITICAL: manual reconciliation required` when the compensation also failed. That saga existed only because the trial lived in MercadoPago.
  - Blocked by: T-003, T-007
  - Blocks: T-009, T-029

- [ ] **T-009** (complexity: 3) — G-2: prove publish and trial-start commit together, mutated both ways
  - Blocked by: T-008
  - Blocks: none

- [ ] **T-010** (complexity: 3) — Replace `reconcileExpiredTrials`' body with local expiry
  - `blockExpiredTrials` does not exist; only its constants kept the name. Reuse advisory lock 1004 and the 200-row batch; replace the provider-mirroring body.
  - Blocked by: T-003
  - Blocks: T-011, T-013, T-017

- [ ] **T-011** (complexity: 3) — Unpublish the owner's accommodations on expiry, reusing the `/unpublish` path
  - Blocked by: T-010
  - Blocks: T-012, T-013

- [ ] **T-012** (complexity: 2) — T-3: schedule ISR revalidation for every listing unpublished by expiry
  - Without this, Cloudflare keeps serving a page that is gone from the DB.
  - Blocked by: T-011
  - Blocks: T-013

- [ ] **T-013** (complexity: 3) — Test the expiry job end to end
  - Blocked by: T-010, T-011, T-012
  - Blocks: none

- [ ] **T-014** (complexity: 3) — Write the three pre-expiry email templates with genuinely different copy
  - Shipping one template three times passes every structural check and fails the requirement silently.
  - Blocked by: T-002
  - Blocks: T-016, T-025

- [ ] **T-015** (complexity: 3) — Write the five win-back email templates
  - No commercial hook: OQ-1 is open and must not be assumed.
  - Blocked by: T-002
  - Blocks: T-017, T-025

### Integration Phase

- [ ] **T-016** (complexity: 3) — Move the pre-expiry cron offsets from 3,1 to 10,5,1
  - Blocked by: T-014
  - Blocks: T-020

- [ ] **T-017** (complexity: 3) — Add the post-expiry win-back query and dispatch
  - Blocked by: T-015, T-010
  - Blocks: T-020

- [ ] **T-018** (complexity: 2) — Re-check live subscription state immediately before every dispatch
  - A snapshot taken at schedule time mails someone who paid an hour ago.
  - Blocked by: none
  - Blocks: T-020

- [ ] **T-019** (complexity: 2) — Make the idempotency key carry the offset
  - Blocked by: none
  - Blocks: T-020

- [ ] **T-021** (complexity: 2) — Stop sending any trial to MercadoPago
  - No `freeTrialDays`, no `free_trial`, no `start_date`. HOS-937's paid path is otherwise untouched.
  - Blocked by: none
  - Blocks: T-022, T-024, T-026, T-027

- [ ] **T-022** (complexity: 3) — Supersede the trial row on activation — same transaction, never mutate
  - Mutating the trial row into a paid one would require it to acquire an `mp_subscription_id` mid-life: exactly the correlation problem HOS-937 spent ~4.750 lines solving.
  - Blocked by: T-003, T-021
  - Blocks: T-023

### Testing Phase

- [ ] **T-020** (complexity: 3) — Test the full nine-email schedule
  - Blocked by: T-016, T-017, T-018, T-019
  - Blocks: none

- [ ] **T-023** (complexity: 3) — Prove two entitlement-granting rows never coexist past the transaction
  - `reconcileDuplicateSubscriptions` is a backstop, not the design — a test that relies on it is asserting the wrong thing.
  - Blocked by: T-022
  - Blocks: T-026, T-027

- [ ] **T-024** (complexity: 3) — G-1: static guard that no checkout can send a trial to MercadoPago
  - Anchor on the payload shape, not a function name. Verify with a positive control.
  - Blocked by: T-021
  - Blocks: none

- [ ] **T-025** (complexity: 3) — G-4: prove the nine templates are translated, not merely present
  - The parity guard passes when all three locales hold the same Spanish string.
  - Blocked by: T-014, T-015
  - Blocks: none

### Cleanup Phase

- [ ] **T-026** (complexity: 2) — Retire `trial-window-derivation.ts` and its CI guard script
  - T-4: HOS-936's PR #3071 still merges. It is deleted when the Hospeda-owned trial is LIVE, not before.
  - Blocked by: T-021, T-023
  - Blocks: none

- [ ] **T-027** (complexity: 2) — Retire `trial-promise-verification.ts` and the pre-checkout warning dialog
  - Also retires `TRIAL_NOT_GRANTED_BY_PROVIDER`. Removing an enum value trips frozen inventories the same way adding one does.
  - Blocked by: T-021, T-023
  - Blocks: none

- [ ] **T-028** (complexity: 1) — Delete `requireActiveSubscription()`, which is mounted nowhere
  - Positive-control the "mounted nowhere" claim before deleting.
  - Blocked by: none
  - Blocks: none

### Docs Phase

- [ ] **T-029** (complexity: 2) — T-6: lift the "sin tarjeta" copy ban in both places
  - If only one of CLAUDE.md / HOS-941 R-1 is updated, the copy keeps lying, now in the other direction.
  - Blocked by: T-008
  - Blocks: none

- [ ] **T-030** (complexity: 3) — T-2: ship a seed data-migration if the trial length or `hasTrial` changes
  - Editing `plans.config.ts` passes every local test and changes nothing live.
  - Blocked by: T-001
  - Blocks: none

---

## Dependency Graph

```
Level 0: T-001, T-002, T-005, T-018, T-019, T-021, T-028
Level 1: T-003, T-006, T-007, T-014, T-015, T-024, T-030
Level 2: T-004, T-008, T-010, T-016, T-022, T-025
Level 3: T-009, T-011, T-017, T-023, T-029
Level 4: T-012, T-020, T-026, T-027
Level 5: T-013
```

## Suggested Start

Begin with **T-001** (complexity: 2) — no dependencies, on the critical path, and unblocks
three tasks. It is also the cheapest place to recover `fed220c25` from history, which the
next several tasks all draw on.

**T-028** (complexity: 1) is free at any moment: it is dead code with no dependents.

## Smoke gate

Per spec §11 this is billing **CORE**. The issue needs BOTH `status-needs-smoke-staging`
and `status-needs-smoke-prod`, and neither satisfies the other: staging covers the flows
end to end, production covers real cron timing and the unpublish→revalidate chain against
Cloudflare. Apply both labels before opening the completing PR.

## Open questions carried from the spec

- **OQ-1** — Do the win-back emails carry a commercial hook? Undecided; T-015 deliberately
  ships without one and leaves the seam.
- **OQ-2** — Trial length per vertical. D-2 makes it possible; whether gastronomy and
  experiences get one, and of what length, is a product decision (related: HOS-1004).
- **OQ-3** — What happens to trials already running when this ships. Production holds 2
  `trialing` rows, both owner test data; staging generates real ones. Decide before the
  staging deploy, not after.
