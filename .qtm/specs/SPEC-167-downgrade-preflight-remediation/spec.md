---
spec-id: SPEC-167
title: Downgrade Over-Limit Remediation (grandfather + restrict)
type: feature
complexity: medium
status: draft
created: 2026-05-27T00:00:00Z
rewritten: 2026-06-03T00:00:00Z
parent: SPEC-193
depends_on: [SPEC-143, SPEC-145, SPEC-194]
relates_to: [SPEC-167-was-preflight-block]
blocks: [real-money-go-live]
priority: medium
base: staging
worktree: spec-167-downgrade-preflight-remediation
---

# SPEC-167: Downgrade Over-Limit Remediation (grandfather + restrict)

> **Policy decision (2026-06-03, owner-confirmed under master SPEC-193, decision O-2).** The original spec
> proposed a **preflight hard-block** (don't let the host downgrade until they fit the target plan). After
> reviewing the industry standard (downgrades are deferred to period end; data is never destroyed; access
> is not abruptly blocked — grandfather existing + enforce going-forward), the policy is changed to
> **grandfather + restrict**. The hard-block is dropped. This rewrite reflects that.

## 1. Problem

Today a plan downgrade **grandfathers everything** with no restriction. A host on `owner-pro`
(3 accommodations, 15 photos, rich text + video, 3 promotions) who downgrades to `owner-basico`
(1 accommodation, 5 photos, 0 promotions, no rich/video) keeps **all** of it published and publicly
visible indefinitely. Only *new* actions are gated. Verified in SPEC-143 smoke (Grupo F, F-F1/F-F2):
3 accommodations stay public when the plan allows 1; rich/video persist and stay public.

This is a **revenue leak** (PRO-level visibility while paying BASICO, no upgrade incentive) but the fix is
NOT to block the downgrade or destroy data — it is to **restrict** the over-cap resources in a reversible
way and gate going-forward.

## 2. Policy: grandfather + restrict (O-2)

When a downgrade is **applied** (at period end, by the `apply-scheduled-plan-changes` cron) and the host
exceeds the target plan:

- **Do NOT hard-block the downgrade.** The downgrade proceeds (the host asked for it; they keep the higher
  plan until period end via the existing scheduled model).
- **Quantity over cap (accommodations, active promotions): restrict the excess, reversibly.** On apply, the
  over-cap items move to a **restricted state** (accommodations → unpublished/`owner_suspended`-style lock;
  promotions → deactivated), reversible if the host re-upgrades. The host **chooses which N to keep active**
  (default: keep the N most-recently-updated / most-viewed, restrict the rest). Nothing is deleted.
- **Premium content (rich text, embedded video, photos over cap): grandfather, read-only.** Existing content
  stays public and intact, but becomes **read-only for new edits** of those fields (consistent with how
  `gateRichDescription`/`gateVideoEmbed` already gate PATCH). Photos over cap are **hidden/kept-data**, not
  deleted; the host can pick which to keep visible.
- **Block creating/publishing new over the cap** (this is SPEC-145 enforcement, going-forward).
- **Inform the host** before and after: a "your account will exceed the new plan — here's what gets
  restricted and how to choose" notice, with the ability to select which resources stay active.

The principle (master INV-5): **never destroy data, never hard-block the downgrade; restrict reversibly.**

## 3. Excess dimensions

| Dimension | Limit/entitlement | Excess condition | Remediation on apply |
|-----------|-------------------|------------------|----------------------|
| Accommodations | `MAX_ACCOMMODATIONS` | owned active count > target cap | restrict (unpublish/lock) excess, host picks which to keep; reversible |
| Active promotions | `MAX_ACTIVE_PROMOTIONS` | active count > target cap | deactivate excess, reversible |
| Photos per accommodation | `MAX_PHOTOS_PER_ACCOMMODATION` | gallery+featured > target cap | hide over-cap photos (keep data), host picks which to keep |
| Rich description | `CAN_USE_RICH_DESCRIPTION` | description contains markdown | grandfather, read-only for new edits |
| Embedded video | `CAN_EMBED_VIDEO` | description contains a video URL | grandfather, read-only for new edits |

## 4. Resolved design decisions (were "open" — now locked by O-2)

1. **Enforcement point → apply-time (the real gate) + request-time UX notice.** The downgrade is scheduled;
   the restriction happens when the cron applies it. Request-time only shows the host a preview of what will
   be restricted. No hard-block at request-time.
2. **Restriction semantics → reversible, non-destructive.** Soft state change (unpublish/lock/hide), never
   hard delete. Restored automatically on re-upgrade (or manually by the host once back under cap).
3. **Which items → host chooses; sensible default.** The host selects which N to keep active; default keeps
   the most-recently-updated/most-viewed, restricts the rest.
4. **Scheduled-change recheck → apply-time computes the excess fresh** and restricts per policy (the host may
   have changed usage between request and apply). No deferral, no block — restrict and notify.

## 5. Affected surfaces

- `apps/api/src/services/subscription-downgrade.service.ts` — usage-vs-target diff helper (read-only;
  computes excess; no blocking).
- `apps/api/src/cron/jobs/apply-scheduled-plan-changes.ts` — apply-time restriction of the excess per policy
  (coordinates with SPEC-194 T-194-07 idempotency and the state-machine INV-4).
- `apps/api/src/routes/billing/plan-change.ts` — request-time preview (what will be restricted), NOT a block.
- Self-serve UI (web) — "you'll exceed the new plan" preview + "choose what to keep" selector.
- Admin downgrade ops — mirror the restriction behavior.
- Accommodation/promotion restrict + restore primitives (reversible state).

## 6. Public-page cache revalidation (folded in — was 145 D-5 / F-E1)

When a host self-pauses (`subscription-pause.service.ts`) the service flips
`accommodations.owner_suspended` but does NOT call `getRevalidationService()?.scheduleRevalidation(...)`,
unlike `accommodation.service` on create/update/delete. So already-cached public pages (Cloudflare ISR in
prod) keep showing the listing until the TTL expires. The same gap applies to this downgrade-restrict flow.

**Resolve with a shared revalidation trigger** invoked from: pause/resume (suspend/un-suspend owner's
accommodations) and downgrade-apply (when excess is restricted/hidden), following the existing
`scheduleRevalidation` pattern (build affected-accommodation context — slug, destination — schedule
per-accommodation or batch).

Note (out of scope, broader): the API in-memory response cache (`middlewares/cache.ts`, 300s TTL) is
TTL-only invalidated; that is a separate caching choice (≤5min staleness). `scheduleRevalidation` targets
the web/Cloudflare ISR layer.

## 7. Out of scope

- The hard-block preflight (dropped per O-2).
- Changing the scheduled-vs-immediate downgrade model.
- Upgrades (no excess possible).
- Destructive deletion of host content (explicitly forbidden by INV-5).
- Entitlements with no enforced surface.

## 8. Constraints

- **Billing-core**: any change to the downgrade/plan-change flow requires the staging billing smoke before
  merging to staging (root CLAUDE.md billing rule).
- Non-destructive, reversible by default (INV-5).
- Branch from `staging`, PR to `staging`. Own worktree (`spec-167-downgrade-preflight-remediation`).

## 9. Cross-references

- Master: SPEC-193 (decision O-2, invariant INV-5). Coordinates with SPEC-145 (going-forward enforcement +
  the post-downgrade-restriction e2e T-145-11), SPEC-194 (state-machine INV-4 + scheduled-change idempotency
  T-194-07). Origin: SPEC-143 smoke F-F1/F-F2/F-E1 (engram `spec-143/smoke-grupo-f-downgrade`).
