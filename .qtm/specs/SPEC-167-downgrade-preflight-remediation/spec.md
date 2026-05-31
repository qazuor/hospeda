# SPEC-167 — Downgrade preflight + excess remediation

**Status:** draft (implementation deferred — created during SPEC-143 smoke, to be tackled after the F-B1/F-B2/F-A1/F-E1 fixes)
**Type:** feature · **Complexity:** medium · **Base:** staging
**Origin:** SPEC-143 local smoke findings F-F1 / F-F2 (engram `spec-143/smoke-grupo-f-downgrade`)

## 1. Problem

Today a plan downgrade **grandfathers** everything the host already has. A host on `owner-pro`
(3 accommodations, 15 photos/accommodation, rich text + video, 3 active promotions) who
downgrades to `owner-basico` (1 accommodation, 5 photos, 0 promotions, no rich/video) keeps
**all** of it published and publicly visible. Only *new* actions (create, upload, premium edit)
are gated; existing over-limit content stays.

Verified during SPEC-143 smoke (Grupo F):
- 3 accommodations remain published/visible when the plan allows 1 (F-F1).
- Rich description / embedded video / photos beyond the new cap persist and stay public; only
  new edits are blocked (F-F2).

This is internally consistent (enforcement is create-time only) but means a host gets PRO-level
visibility and premium content while paying for BASICO indefinitely — the limit/entitlement is
decorative for existing content, there is no upgrade incentive, and it is a revenue leak.

## 2. Goal

Make a downgrade **preflight-checked**: when a host requests to move to a lower plan, verify that
their current usage fits the target plan's limits and entitlements. If it does not, do **not**
silently grandfather — block the downgrade and either let the host remove the excess themselves
and retry, or offer to remove it automatically.

## 3. Desired behavior (from user, 2026-05-27)

When a host requests a downgrade and would end up over the target plan:

- **Block** the downgrade (do not schedule/apply it) until the account fits the target plan.
- **Inform** the host exactly what is in excess (which accommodations, how many photos per
  accommodation, which active promotions, which accommodations use premium description/video).
- **Offer two remediation paths:**
  1. *"Remove it for me"* — the system removes the excess automatically (policy TBD), then the
     downgrade proceeds.
  2. *"I'll remove it"* — the host deletes/trims the excess and retries the downgrade.

Same philosophy for premium content (F-F2): detect what would no longer be allowed under the
target plan (rich text, embedded video, photos beyond cap) and require it be removed/trimmed
(or auto-removed) before the downgrade.

## 4. Excess dimensions to check

| Dimension | Limit/entitlement | Excess condition |
|-----------|-------------------|------------------|
| Accommodations | `MAX_ACCOMMODATIONS` | owned active count > target cap |
| Photos per accommodation | `MAX_PHOTOS_PER_ACCOMMODATION` | any accommodation gallery+featured count > target cap |
| Active promotions | `MAX_ACTIVE_PROMOTIONS` | active promotions count > target cap |
| Rich description | `CAN_USE_RICH_DESCRIPTION` | any accommodation description contains markdown (gate regex) |
| Embedded video | `CAN_EMBED_VIDEO` | any accommodation description contains a video URL (gate regex) |

(Other entitlements that have no enforced surface today are out of scope.)

## 5. Open design decisions (lock before implementing)

1. **Enforcement point.** Downgrades are currently **scheduled** (`plan-change.ts` writes a
   `scheduledPlanChange`, applied by the `apply-scheduled-plan-changes` cron at cycle end).
   The preflight at request-time leaves a gap: the host can re-exceed between request and apply.
   Decide: enforce at **request-time only**, **apply-time only** (cron re-checks and remediates),
   or **both** (recommended for correctness — request-time for UX, apply-time as the real gate).
2. **Auto-delete semantics (destructive).** "Remove it for me" deletes the host's content.
   Decide: soft-delete + restore-on-re-upgrade vs hard removal; and *which* items are removed
   (most-recent-first, least-viewed, or host explicitly selects which N to keep). Auto-deleting
   accommodations is high-stakes — losing customer data is unacceptable, so reversibility is
   strongly preferred.
3. **Premium content remediation (F-F2).** For rich/video: strip to plain / remove video, or
   require the host to edit it down? For photos over cap: which photos are removed? Prefer
   "hide/keep-data" over destructive strip where feasible.
4. **Scheduled-change recheck.** When `apply-scheduled-plan-changes` runs and the host is now
   over the target (re-exceeded after the request, or never remediated): defer + notify, or
   auto-remediate per the chosen policy.

## 6. Affected surfaces (estimate)

- `apps/api/src/routes/billing/plan-change.ts` — request-time preflight on the downgrade branch.
- `apps/api/src/services/subscription-downgrade.service.ts` — usage-vs-target-plan diff helper +
  remediation.
- `apps/api/src/routes/.../apply-scheduled-plan-changes` cron — apply-time recheck.
- Self-serve UI (web) — the "you're over the new plan" modal with the two remediation choices.
- Admin билling pause/downgrade ops — mirror behavior if admins can downgrade on behalf.

## 6b. Related concern folded in — revalidation on plan-state change (F-E1)

SPEC-143 smoke F-E1: when a host self-pauses (`subscription-pause.service.ts`), the service
flips `accommodations.owner_suspended` but does **not** schedule any public-page revalidation,
unlike `accommodation.service` which calls `getRevalidationService()?.scheduleRevalidation(...)`
on create/update/delete. So the host's already-cached public pages (Cloudflare ISR in prod) keep
showing the listing as visible until the cache TTL expires, even though fresh reads now 404.

The same gap applies to the downgrade flow (this spec) and any other plan-state change that
should hide/alter public content. Resolve with a **shared revalidation trigger** invoked from:
- pause / resume (suspend / un-suspend the owner's accommodations),
- downgrade apply (when excess content is removed/hidden),

following the existing `scheduleRevalidation` pattern. Build the affected-accommodations context
(slug, destination) and schedule per-accommodation (or batch).

Note (separate, broader, NOT in this spec): the API's own in-memory response cache
(`apps/api/src/middlewares/cache.ts`, 300s TTL) is invalidated by TTL only — no data-change
invalidation in any flow. That is a general caching choice (≤5min staleness) and is out of scope
here; `scheduleRevalidation` targets the web/Cloudflare ISR layer, not this in-memory cache.

## 7. Out of scope

- Changing the scheduled-vs-immediate downgrade model itself.
- Upgrades (no excess possible on upgrade).
- Entitlements with no enforced surface.

## 8. Constraints

- **Billing-core**: any change to the downgrade/plan-change flow requires the staging billing
  smoke before merging to staging (per root CLAUDE.md billing rule).
- Non-destructive by default: prefer reversible soft-delete / hide-keep-data over hard removal.
- Branch from `staging`, PR to `staging`. Own worktree (`spec-167-downgrade-preflight-remediation`).
