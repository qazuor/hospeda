# Design: Admin-initiated Subscription Pause / Resume (SPEC-143 #29)

Status: DESIGN COMPLETE — ready to implement.
Author: SPEC-143 follow-up session 2026-05-25.

## All decisions locked

- Architecture: **Option A** (extend qzpay).
- Semantics: **sync**.
- Formalization: **stay in SPEC-143**.
- Pause = 2 orthogonal dimensions: **billing** (`status=paused`) +
  **service suspension** (`pauseSuspendsService` scope, `ownerSuspended` V3 flag).
- Actors: **both** admin + host self-serve, this iteration.
  - Host self-pause: always full (billing + service suspension).
  - Admin pause: `suspendService` boolean chooses full vs billing-only.
- Visibility mechanism: **V3** (denormalized `ownerSuspended` flag).
- Edit-lock: **accommodations only** (profile stays editable); also blocks
  CREATE of new accommodations while suspended.
- MP capability: **confirmed** — qzpay mercadopago adapter already implements
  pause/resume; MP preapproval supports `{status:paused|authorized}`.
- Provider propagation: **option (i)** — core `pause`/`resume` call the payment
  adapter alongside the storage update (so MP actually stops charging).
- Auto-resume: indefinite, no cron (v1).

## Decisions locked (2026-05-25)

- **Architecture: Option A** — extend qzpay (qzpay-mercadopago + qzpay-hono),
  then wire Hospeda hooks. User will `/add-dir` the qzpay package sources.
  Remember the package's own release workflow must be run for the version bump.
- **Semantics: sync** — admin route PUTs MP and flips local status immediately;
  webhook arrives as a confirming no-op.
- **Formalization: stay inside SPEC-143** — this design doc + direct
  implementation, no separate SPEC-NNN.
- **Pause is NOT just a billing hold** — see the use case below. It must also
  remove the owner's listings from public view while preserving all config.
  This is the load-bearing requirement and the reason addon "leave intact"
  was rejected.

## Use case (the real intent)

A seasonal host (e.g. rents only in summer) wants to stop paying in the off
season WITHOUT losing their account or listing configuration. Pause must:

- Stop billing (MP preapproval paused — no charges during the pause).
- Take the owner's accommodation listings OFF the public site (a paused host
  is not selling, so their listings must not appear in public search / detail).
- Preserve EVERYTHING: account config, accommodation data, media, pricing,
  amenities. Nothing is deleted or downgraded.
- On resume: billing restarts and the listings come back exactly as they were.

So pause has TWO dimensions:
1. Billing — MP preapproval status (handled by the qzpay extension, Option A).
2. Public visibility — the owner's accommodations must disappear from public
   surfaces for the duration of the pause, then reappear unchanged on resume.

Dimension 2 is NEW work: today public visibility of an accommodation depends
ONLY on its own `visibility` (PUBLIC/PRIVATE/RESTRICTED) +
`lifecycleState` (`accommodation.permissions.ts:117`). There is zero coupling
to the owner's billing/subscription status. The public list/detail endpoints
never look at the owner's plan.

## Data model — two orthogonal dimensions (decided 2026-05-25)

Pause is two independent things, not one:

| Actor / mode | Billing (stop charging) | Service suspension (hidden + edit-locked) |
|--------------|-------------------------|-------------------------------------------|
| Host self-pause | always | always |
| Admin "full" | yes | yes |
| Admin "billing-only" | yes | no |

Model:
- **`subscription.status = 'paused'`** — the BILLING dimension. Set on every
  pause regardless of mode. Driven by the MP preapproval pause (Option A).
- **`subscription.pauseSuspendsService: boolean`** — source of truth for the
  SCOPE of the pause. `true` for host self-pause and admin-full; `false` for
  admin-billing-only. Resume reads this to know what to revert. Stored as a
  dedicated column (preferred) or in subscription metadata.
- **Denormalized `ownerSuspended` flag on accommodations (V3)** — set in bulk
  across the owner's accommodations ONLY when `pauseSuspendsService = true`.
  Cleared on resume. Drives two enforcement points:
  1. Public query filter — suspended accommodations disappear from the site
     (the V3 hot-path-cheap boolean filter).
  2. Accommodation update path — rejects edits while suspended, so the host
     cannot edit a listing during a service-suspending pause (matches "dejan
     de poder editarse en el admin").

Account config and all accommodation data are never mutated — only the
`ownerSuspended` boolean flips. Resume clears it and everything is back exactly
as it was. This is the "preserve everything" guarantee.

### Flows

- **Host self-pause** (`POST /protected/.../subscriptions/me/pause` or similar):
  always full. Sets billing paused + `pauseSuspendsService=true` + flips
  `ownerSuspended=true` on all the host's accommodations.
- **Admin pause** (`POST /admin/billing/subscriptions/:id/pause`): body carries
  `suspendService: boolean`. `true` → same as host self-pause. `false` →
  billing paused only, `ownerSuspended` untouched, listings stay live + editable.
- **Resume** (both surfaces): MP preapproval → authorized, status → active, and
  IF `pauseSuspendsService` was true, clear `ownerSuspended` on the owner's
  accommodations. Then reset `pauseSuspendsService`.

### Model sub-decisions (resolved 2026-05-25)
- **Edit-lock scope: accommodations only.** The host can still edit their
  profile/account during a service-suspending pause; only accommodation
  writes (update + create) are blocked.
- **New accommodations while suspended: blocked.** Single rule — a
  service-suspended owner cannot write accommodations at all (no update, no
  create). Consistent with "not selling right now".
- **Canonical scope lives on the subscription** (`pauseSuspendsService` +
  `status`), denormalized to accommodations (`ownerSuspended`) for the public
  query + edit-lock. No separate user-level flag.

## Visibility dimension — options (the mechanism behind "ownerSuspended")

How do a paused owner's listings leave public view, then return unchanged?

### V1 — Mutate accommodation state on pause, restore on resume
- On pause: snapshot each accommodation's current `visibility` / `lifecycleState`
  into metadata, then set them to a hidden state. On resume: restore from the
  snapshot.
- Pro: reuses the existing public-visibility filter; public queries unchanged.
- Con: mutates the user's data (tension with "preserve everything"); needs a
  snapshot+restore that is fragile if the owner edits during pause; bulk update
  of N accommodations per pause/resume; race conditions.

### V2 — Filter public queries by the owner's subscription status
- Don't touch any accommodation. The public list/detail/by-destination/similar
  endpoints exclude accommodations whose owner has a `paused` (or non-active)
  subscription.
- Pro: zero data mutation — perfectly preserves config; resume is automatic;
  no snapshot.
- Con: every public accommodation query needs the owner's billing status (join
  or lookup). Touches many endpoints (list, getBySlug, getById,
  getByDestination, similar, getTopRatedByDestination, getSummary, stats).
  Performance cost on the hot public path.

### V3 — Denormalized owner-active flag + single filter (hybrid)
- Maintain a denormalized boolean (e.g. on the user, or stamped onto each of
  the owner's accommodations) set false on pause, true on resume. Public queries
  filter on that one indexed flag.
- Pro: public query stays fast (one boolean, no join); no per-accommodation
  state snapshot (the flag is binary, not the full visibility value).
- Con: denormalization must stay in sync; pause/resume still does a bulk flag
  update across the owner's accommodations (but a flag, not a state restore).

### Connection to entitlements (worth considering)
A paused owner stops paying, so conceptually they lose the `publish_accommodations`
entitlement during the pause. If the public path filtered on "owner currently
holds publish_accommodations", pause (which clears plan entitlements) would hide
listings as a natural side effect. But the public path does not check owner
entitlements today, so this is effectively V2 with an entitlement lookup instead
of a status lookup — same performance tradeoff.

### Recommendation
Lean **V3**: it satisfies "preserve everything" (no visibility mutation, just a
binary gate) while keeping the public hot path cheap (indexed boolean, no join).
The bulk flag update on pause/resume is simple and idempotent. But this is the
key thing to discuss — V2 is cleaner conceptually if the public query cost is
acceptable, and V1 is the least new infrastructure if we accept data mutation.

## 1. Problem

Finding #29 from the SPEC-143 smoke surfaced that the `paused` subscription
status is a defined-but-half-wired state:

- The status value exists (`SubscriptionStatusEnum.PAUSED = 'paused'`,
  `packages/schemas/src/enums/subscription-status.enum.ts:13`).
- The webhook path can RECEIVE a pause: MercadoPago `paused` is mapped to
  `SubscriptionStatusEnum.PAUSED` (`apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts:79`),
  and the notification side is already built (paused + reactivated email
  templates exist, `shouldSendPausedEmail` / `shouldSendReactivationEmail`
  transition guards exist).
- But there is NO admin write path that puts a subscription into `paused`
  or brings it back to `active`. An admin cannot pause a subscriber from the
  panel today. The state can only be reached if MercadoPago itself pauses the
  preapproval and notifies us.

So #29 is: give admins a first-class "pause this subscription" / "resume this
subscription" operation, consistent with the existing cancel / change-plan /
extend-trial operations.

## 2. What exists today (verified)

### 2.1 Admin billing route assembly
`apps/api/src/routes/billing/admin/index.ts`:
- Hospeda custom routes mount FIRST (metrics, settings, notifications,
  customer-addons, subscription-events, addons, plans, promo-codes).
- The qzpay-hono `createAdminRoutes()` factory mounts LAST and provides the
  generic subscription operations. Per the file header (lines 13-17) the
  factory provides: `subscriptions list/get/cancel/change-plan/extend-trial`,
  `payments list/get/refund`, `invoices list/get/pay/void`, entitlements +
  limits management, promo-codes catalog, dashboard.
- **Pause / resume are NOT in that list.** A repo-wide grep for
  `subscriptions.pause` / `resume` / `onBeforeSubscriptionPause` returns
  nothing. So neither the factory routes nor the lifecycle hooks exist yet.

### 2.2 Auth model
`adminBillingAuthMiddleware` (`index.ts:60-107`) gates by path suffix:
- All requests need `BILLING_READ_ALL`.
- Subscription writes (`/cancel`, `/force-cancel`, `/change-plan`,
  `/extend-trial`) need `MANAGE_SUBSCRIPTIONS`.
- Money-move paths (`/refund`, `/pay`, `/void`, entitlements, limits) need
  `BILLING_MANAGE`.

Pause/resume are subscription-management operations, so they fit the
`MANAGE_SUBSCRIPTIONS` bucket. The middleware's `isSubscriptionWrite` suffix
list would need `/pause` and `/resume` added.

### 2.3 Cancel lifecycle = the pattern to copy
The custom `subscription-cancel.ts` route was REMOVED and re-expressed as
qzpay-hono hooks (`index.ts:18-21`). The hooks live in
`apps/api/src/routes/billing/admin/qzpay-admin-hooks.ts`:
- `onBeforeSubscriptionCancel` (67-195): validates state, revokes linked addon
  entitlements, can abort by returning `{ ok: false, reason }`.
- `onAfterSubscriptionCancel` (202-245): marks addon purchases canceled,
  inserts audit log, clears entitlement cache. Best-effort side effects.
- Hook execution order: before-hook → adapter calls MercadoPago → after-hook.

The established direction is clear: NEW subscription operations should be
expressed as qzpay-hono routes + Hospeda hooks, NOT as bespoke Hospeda routes.
That is the whole reason the custom cancel route was deleted.

### 2.4 Webhook + notifications already cover the inbound side
`subscription-logic.ts` `processSubscriptionUpdated()` already maps an MP
`paused` / back-to-`active` transition to the local subscription and fires
`sendSubscriptionPausedNotification` / `sendSubscriptionReactivatedNotification`.
Templates `SUBSCRIPTION_PAUSED` and `SUBSCRIPTION_REACTIVATED` exist. So if an
admin pause ultimately flows through MP and comes back as a webhook, the
notification + status-sync machinery is already done.

## 2c. qzpay current state (verified 2026-05-25 against /home/qazuor/projects/PACKAGES/qzpay)

Big finding: pause/resume is ALREADY largely built in qzpay. The gap is smaller
than the original estimate, but there is one architectural wrinkle.

- **mercadopago adapter — DONE**: `subscription.adapter.ts:131-147` implements
  `pause(id)` (`preapprovalApi.update({status:'paused'})`) and `resume(id)`
  (`{status:'authorized'}`). So MP natively supports it and the adapter wraps it.
- **core — PARTIAL**: `billing.ts:1391-1399` implements
  `billing.subscriptions.pause(id)` / `.resume(id)`, emits `subscription.paused`
  / `subscription.resumed` events (`events.types.ts:40-41`), and has helpers
  `canBePaused` / `canBeResumed` (`subscription.helper.ts:376-390`). BUT these
  core methods ONLY do `storage.subscriptions.update({status})` — they do NOT
  call the payment adapter. The adapter is only wired on CREATE
  (`billing.ts:1271-1273`, "paid mode wires the preapproval at the provider").
  Same is true of core `cancel` (`billing.ts:1375-1390`): storage-only.
- **hono — MISSING**: `admin.routes.ts` has force-cancel/cancel/change-plan/
  extend-trial (422-554) but NO `/pause` or `/resume` routes and no
  `onBefore/AfterSubscriptionPause/Resume` hook points.

### The architectural wrinkle: core mutations don't propagate to MP
`billing.subscriptions.cancel/pause/resume` update only the local storage row;
they never call `paymentAdapter.subscriptions.*`. This matches finding #27's
observation that admin cancel is effectively local/webhook-driven, not a
synchronous MP call. For CANCEL that may be intentional (MP-initiated cancel
arrives via webhook). But our pause goal is "stop charging" — if the core pause
only flips the local row and never PUTs MP, **MercadoPago keeps charging the
preapproval**. So pause/resume MUST propagate to MP, unlike the current cancel.

This is a real design decision for the qzpay extension:
- **(i)** Make core `pause`/`resume` call `paymentAdapter.subscriptions.pause/
  resume(providerSubscriptionId)` before/around the storage update (the
  provider id is on the subscription row, `billing.ts:376`). Mirrors how CREATE
  wires the provider. Correct for "stop charging".
- **(ii)** Keep core storage-only and do the MP call at the hono route layer
  (route calls `adapter.pause` then `billing.subscriptions.pause`). Keeps core
  consistent with cancel, but splits the provider call out of core.

Recommendation: **(i)** — pause/resume are inherently provider operations
(the whole point is to stop MP charging), so the propagation belongs in core
next to the storage update, guarded by `if (paymentAdapter?.subscriptions)`
exactly like create. This also makes the emitted events truthful.

### Revised Layer Q scope (much smaller than first estimate)
- adapter: nothing — already done.
- core: add provider propagation to `pause`/`resume` (option i). Small.
- hono: add `/pause` + `/resume` routes (copy cancel pattern, 439-480) +
  `onBefore/AfterSubscriptionPause/Resume` hook types. Small-medium.
- release both via the package workflow; bump in hospeda.

## 3. MercadoPago mechanics

MercadoPago preapproval (the subscription primitive) supports pausing natively:
`PUT /preapproval/:id` with `{ "status": "paused" }` suspends collection, and
`{ "status": "authorized" }` resumes it. This is the same surface the cancel
flow uses (`{ "status": "cancelled" }`). So pause/resume is a status-update on
the existing preapproval, not a new MP object. No new MP integration shape is
required — it is the same call site as cancel with a different target status.

Caveat to verify on staging: MP only allows `paused` on a recurring
preapproval that is currently `authorized` (active). A subscription in
`pending`, `cancelled`, or `paused` cannot be paused again; resume only applies
to a `paused` one. The before-hook must enforce these preconditions.

## 4. The core architectural decision

The MP call is trivial. The real decision is WHERE the pause/resume operation
lives, because qzpay-hono does not expose it today. Two options:

### Option A — Extend qzpay (qzpay-mercadopago + qzpay-hono), then wire hooks
- `qzpay-mercadopago`: add `subscriptions.pause(id)` / `.resume(id)` that PUT
  the preapproval status. (Bumps to a new 2.x release.)
- `qzpay-hono`: add `/subscriptions/:id/pause` + `/resume` routes to
  `createAdminRoutes`, with `onBeforeSubscriptionPause/Resume` +
  `onAfterSubscriptionPause/Resume` hook points. (Bumps to a new 1.x release.)
- `hospeda`: implement the 4 hooks (precondition checks, audit log,
  notifications, addon implications), add `/pause` + `/resume` to the auth
  middleware suffix list, smoke on staging.
- Pros: consistent with the cancel pattern; logic lives in the shared billing
  library where every qzpay consumer benefits; matches the explicit direction
  set when the custom cancel route was deleted.
- Cons: requires a coordinated 2-package qzpay release + version bump in
  hospeda, exactly like the webhook-signature saga. Slower; cross-repo.
- Impact on existing code: additive. No change to existing routes/hooks.

### Option B — Custom Hospeda routes (resurrect the bespoke pattern)
- Add `apps/api/src/routes/billing/admin/subscription-pause.ts` with
  `POST /subscriptions/:id/pause` + `/resume`, mounted before the qzpay tier.
- Call MP through the lowest-level adapter handle hospeda already has, or
  through a thin qzpay-core method if one is reachable without a release.
- Pros: no qzpay release; ships entirely within this repo; fastest path.
- Cons: directly contradicts the decision that removed `subscription-cancel.ts`;
  re-introduces bespoke subscription-mutation logic that duplicates what should
  be qzpay's responsibility; the audit-log + addon + notification wiring would
  be hand-rolled instead of reusing the hook contract.
- Impact on existing code: adds a sibling route; risk of path-collision with the
  qzpay tier (mitigated by mount order, same as the other custom routes).

### Recommendation
**Option A**, for the same reasons the cancel route was migrated to hooks:
keep subscription-mutation logic in qzpay, keep hospeda thin. The cost is the
qzpay release cycle, which is a known, already-walked path (webhook saga).
If speed-to-staging matters more than architectural consistency this iteration,
Option B is viable as a documented, temporary exception — but it should be
explicitly acknowledged as debt to fold back into qzpay later.

## 5. Semantics decision: sync vs webhook-driven

Cancel is split today: `/cancel` is webhook-driven (waits for MP to confirm),
`/force-cancel` is synchronous (updates local DB immediately). Finding #27
clarified that distinction.

For pause/resume we should decide the same axis:
- **Sync**: the admin route PUTs MP, and on a successful response immediately
  updates the local subscription to `paused`/`active`. The webhook later
  arrives as a confirming no-op (the `shouldSendPausedEmail` guard already
  prevents a duplicate email because previous===new).
- **Webhook-driven**: the admin route only PUTs MP; the local status flips when
  the webhook arrives. Simpler, but the admin UI shows a lag and depends on
  webhook delivery (which has had reliability issues — see the polling-fallback
  saga).

Recommendation: **sync** (mirror `force-cancel`), because admin actions should
have immediate, observable effect in the panel, and because the webhook path
has documented delivery gaps that polling only partially closes.

## 6. Scope estimate (Option A + sync)

qzpay-mercadopago:
- `subscriptions.pause(id)` / `.resume(id)` (PUT preapproval status). ~small.
- unit tests against the MP stub. ~small.

qzpay-hono:
- 2 routes in `createAdminRoutes`; 4 hook points. ~small-medium.

hospeda:
- 4 hook implementations in `qzpay-admin-hooks.ts` (precondition validation,
  audit-log rows reusing the cancel pattern, notification calls reusing the
  existing paused/reactivated helpers, decide addon behavior on pause).
- add `/pause` + `/resume` to `isSubscriptionWrite` in the auth middleware.
- admin UI: pause/resume buttons on the subscription detail view (mirrors the
  cancel button) — separate from the API work, can be a follow-up.
- staging smoke section in the smoke checklist.

Open sub-question: what happens to addon entitlements while paused? Cancel
revokes them. Pause is temporary — do we suspend addon entitlements for the
pause window, or leave them intact? Leaning "leave intact" (pause is a billing
hold, not a downgrade), but this is a product call.

## 6b. Implementation plan (layered)

### Layer Q — qzpay extension (needs `/add-dir` of qzpay sources + release)
- Q1. `qzpay-mercadopago`: `subscriptions.pause(id)` / `.resume(id)` → PUT
  preapproval `{status:'paused'}` / `{status:'authorized'}`. Unit tests vs MP stub.
- Q2. `qzpay-hono`: add `/subscriptions/:id/pause` + `/resume` to
  `createAdminRoutes`, with `onBeforeSubscriptionPause/Resume` +
  `onAfterSubscriptionPause/Resume` hook points. Tests.
- Q3. Release both packages via the package's own release workflow; bump
  versions in `apps/api/package.json`.

### Layer S — schema (hospeda, independent of Layer Q, can start first)
- S1. Drizzle: `billing_subscriptions.pause_suspends_service boolean` column.
- S2. Drizzle: `accommodations.owner_suspended boolean default false` + index
  for the public-query filter. push + `apply-postgres-extras`.
- S3. Zod schemas: admin pause body `{ suspendService: boolean }`; resume body.

### Layer H — hospeda wiring
- H1. Pause/resume service: orchestrates MP (via qzpay) + sets subscription
  fields + bulk-flips `owner_suspended` across the owner's accommodations when
  `suspendService`. Sync semantics.
- H2. Implement the 4 qzpay-admin hooks (precondition checks, audit log reusing
  cancel pattern, notification calls reusing existing paused/reactivated
  helpers, the bulk flag update).
- H3. Admin route: appears from the factory after the version bump; add
  `/pause` + `/resume` to `isSubscriptionWrite` in `adminBillingAuthMiddleware`.
- H4. Self-serve protected route: `POST /protected/billing/subscriptions/me/pause`
  + `/resume` (always full pause). Reuses the H1 service.
- H5. Public query filter: exclude `owner_suspended = true` accommodations in
  every public read path (list, getBySlug, getById, getByDestination, similar,
  getTopRatedByDestination, getSummary, stats).
- H6. Accommodation write enforcement: reject update + create when the owner is
  service-suspended (accommodations only; profile stays editable).

### Layer U — UI (follow-up, after API is green)
- U1. Admin subscription detail: pause/resume buttons + `suspendService` toggle.
- U2. Web account: self-serve pause/resume for the host.

### Layer V — validation
- V1. Unit + integration tests for the service + enforcement.
- V2. Staging smoke (real MP sandbox): pause stops billing, listing disappears,
  edit blocked; resume restores. Both admin modes + self-serve.

## 7. Open decisions

RESOLVED 2026-05-25:
1. Architecture → **Option A** (extend qzpay).
2. Semantics → **sync**.
3. Addon/visibility during pause → **listings leave public view, all config
   preserved** (seasonal-host use case). NOT "leave intact". The HOW is the
   visibility-dimension options above (V1/V2/V3) — still open.
5. Formalization → **stay in SPEC-143**.

STILL OPEN:
- **Visibility mechanism: V1 (mutate+restore) / V2 (filter by owner status) /
  V3 (denormalized flag)?** Recommendation: V3. THE key remaining decision.
- **MP capability confirmation**: confirm `PUT /preapproval/:id {status:paused}`
  works for both the annual and monthly recurring preapprovals we create. You
  own the MP integration.
- **Auto-resume / max pause window?** MP pause is indefinite. Recommendation:
  indefinite for v1, no cron.
- **Who can pause?** Admin-only (this feature) via `MANAGE_SUBSCRIPTIONS`, or
  also self-serve by the owner from their account? The use case ("a host
  decides to pay only in summer") implies the OWNER wants to self-pause. If so
  there is a protected-tier route too, not just admin. Recommendation: ship
  admin-initiated first (the #29 scope), design the data model so a self-serve
  protected route can reuse the same service later.
