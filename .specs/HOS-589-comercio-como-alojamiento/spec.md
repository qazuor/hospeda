---
title: Commerce works exactly like accommodation — self-service listing, no admin gate, free trial
linear: HOS-589
statusSource: linear
created: 2026-08-19
type: feature
areas:
  - web
  - api
  - db
  - billing
  - auth
---

# Commerce works exactly like accommodation — self-service listing, no admin gate, free trial

## 1. Summary

Make a commerce listing — **both** gastronomy and experience — follow the exact
same path an accommodation already follows: a signed-in person creates their
listing, the owner role is granted inside that same transaction, they check out
with a free trial, and the listing goes live. **No admin approval anywhere, for
either domain.**

Moderation becomes reactive: if a published listing should not be there, an
admin marks it rejected — which the visibility reconciler already honours — and
refunds if money changed hands.

This spec covers two Linear issues that were decided together because splitting
them produces two incompatible half-migrations:

- **HOS-589** — the admin gate and the owner-provisioning path.
- **HOS-590** — the free trial for the `commerce-listing` plan.

## 2. Problem

Three separate problems share one root: **commerce grew its own parallel
mechanism for something accommodation already solved.**

### 2.1 The admin approval is the only thing that creates a commerce owner

The blocker is not the listing's `moderation_state`. It is a step *before* the
listing exists: the public form writes a `commerce_leads` row in `pending`, an
admin resolves it from the panel inbox, and **that approval is the only code
path in the entire repository that grants `RoleEnum.COMMERCE_OWNER`** —
`packages/service-core/src/services/commerce/commerce-owner-provisioning.service.ts:321`,
gated on `PermissionEnum.COMMERCE_EDIT_ALL`.

Verified by exhaustive search: `RoleEnum.COMMERCE_OWNER` appears in exactly
three places in production source, and the other two are permission-check reads
(`apps/api/src/lib/auth.ts:135`, `apps/api/src/utils/role-permissions-cache.ts:147`).

So a person cannot list their business without a human in the loop, and the
human is in the loop for a reason that has nothing to do with judging the
business: they are there to mint an account.

### 2.2 The trial exists for accommodation and not for commerce

`commerce-listing` is the only sellable plan with `trial_days = 0`; the five
accommodation plans all have 30. That is not a config oversight — the commerce
checkout hardcodes it:

```ts
// apps/api/src/services/subscription-checkout.service.ts:696-698
// HOS-191: commerce listings are always no-trial (trialDays: 0) ...
```

`initiateCommerceMonthlySubscription` is a structurally separate function that
never calls `resolveCheckoutFreeTrialDays`, the resolver both accommodation
paths use.

### 2.3 The two verticals are drifting

Gastronomy and experience already share a `domain` discriminator end-to-end, but
every behavioural difference proposed on top of it (a gate for one and not the
other, different copy, a different checkout condition) buys a permanent
maintenance cost. The cheapest commerce is commerce with **no branch at all**.

## 3. Goals

- **G-1** — A signed-in person can create a gastronomy or experience listing
  with no admin involvement, and the `COMMERCE_OWNER` role is granted as an
  effect of that creation.
- **G-2** — Gastronomy and experience follow **byte-identical** logic. No
  `if (domain === …)` is introduced anywhere in the provisioning, checkout,
  or publish path.
- **G-3** — `commerce-listing` carries a free trial resolved by the **same**
  canonical function the accommodation paths use, not a second copy of the rule.
- **G-4** — The public entry points keep their indexable surface: two landing
  pages that push to sign-in, mirroring `/publicar/`.
- **G-5** — An admin can take a published listing down, and that action already
  works through the existing reconciler predicate.

## 4. Non-goals

- **NG-1** — Building an automatic refund on rejection. Marking a listing
  rejected and refunding stay two deliberate actions (see R-2).
- **NG-2** — Building a moderation queue or a report-abuse flow for published
  commerce listings. Flagged as a real gap in §11, not solved here.
- **NG-3** — Changing how accommodation works. This spec moves commerce toward
  accommodation, never the reverse.
- **NG-4** — Touching the alliance-lead flow (`alliance_leads`), which is a
  different funnel with different semantics and deliberately does *not*
  provision on approval.

## 5. Current baseline

### 5.1 How an accommodation owner enters today — the model to copy

| Step | Where | Notes |
| --- | --- | --- |
| Public landing | `apps/web/src/pages/[lang]/publicar/index.astro` | Marketing page. CTA is **auth-aware** via a `client:only` island (`HostLandingCta`): signed-in → the form, signed-out → sign-in. No server-side session check. Marketing prose shared with `/suscriptores/propietarios/` through `owners.*` i18n keys — explicitly "no copy duplication". |
| Create form | `apps/web/src/pages/[lang]/publicar/nueva.astro` | `prerender = false`. Middleware does **not** auto-protect `/publicar/*`; the page runs its own in-page auth guard (`buildLoginRedirect`), same pattern as `/mi-cuenta/*`. Runs `GET /host-onboarding/precheck` first and **fails open** — the real limit is enforced server-side on create. |
| Draft + role | `POST /api/v1/protected/host-onboarding/start` → `AccommodationService.createForOnboarding` | `createProtectedRoute` — any authenticated `USER`, no special permission. Grants the role **inside the create transaction**: `grantRole({ userId, role: RoleEnum.HOST, grantedBy: null, reason: RoleGrantReason.ACCOMMODATION_CREATED })` at `packages/service-core/src/services/accommodation/accommodation.service.ts:1463-1472`. Idempotent on the `(user_id, role)` PK. |
| Publish | `AccommodationService.publish` | Explicit act invoked by the owner. Gate order inside: billing eligibility **first** (H-99 — a missing subscription is the one rejection the host cannot fix by editing), then the completeness guard, then flip `lifecycleState` to `ACTIVE`. |
| Trial | at checkout | `resolveCheckoutFreeTrialDays` (`packages/service-core/src/services/billing/addon/trial.types.ts:436-457`), called only by `initiatePaidMonthlySubscription` / `initiatePaidAnnualSubscription`. |

`grantRole` (`packages/service-core/src/services/user-role/user-role.service.ts:185-238`)
**is** a generic, idempotent primitive. What is *not* generic is the call site:
it is inlined in `AccommodationService`'s own transaction, so commerce needs its
own analogous call, not a reuse of shared glue that does not exist.

### 5.2 How a commerce owner enters today

1. Public form → `POST /api/v1/public/commerce/leads`
   (`apps/api/src/routes/commerce/public/create-lead.ts:66`, `createPublicRoute`
   — **anonymous**, honeypot-only spam guard) → `CommerceLeadService.createLead`
   writes a row with `status` defaulting to `'pending'`.
2. Admin resolves it → `approveAndProvision`
   (`commerce-lead.service.ts:552-642`): gate on `COMMERCE_EDIT_ALL`,
   idempotency check on `provisionedUserId`, call the provisioner, stamp
   `status: 'approved'` / `handledAt` / `handledById` / `provisionedUserId`.
3. `provisionCommerceOwner` generates a temp password, calls `CreateUserPort`
   with `role: RoleEnum.COMMERCE_OWNER`, and emails credentials — **skipping the
   email entirely when the address already had an account** (`alreadyExisted`),
   since no password was set for it.
4. The owner fills the listing and checks out.

### 5.3 Publishing is *derived* for commerce, not an act

There is **no owner-invoked `publish()` for commerce.** Visibility is
recalculated by `reconcileCommerceListingVisibility`
(`packages/service-core/src/services/commerce/commerce-visibility.ts:192-274`),
whose predicate is line 223:

```ts
const shouldBePublic = subscriptionActive && complete && !moderationRejected;
```

- `subscriptionActive` — `ACTIVE_STATUSES = new Set(['active', 'trialing'])`
  (line 46). **`trialing` is already accepted.**
- `complete` — injected `resolveCompleteness`, business logic kept deliberately
  outside the data-access contract.
- `moderationRejected` — `entity.moderationState === ModerationStatusEnum.REJECTED`
  (line 210). The condition is *not rejected*, **not** *approved*: a `PENDING`
  listing publishes fine.

Both verticals are wired: `resolveCommerceEntityModel`
(`apps/api/src/services/commerce-reconcile.service.ts:54-70`) resolves
`'gastronomy'` (line 56) **and** `'experience'` (line 62). The doc comment on
`ReconcileCommerceListingVisibilityInput.entityType` still says *"current
values: `'gastronomy'`"* — that comment is stale and should be corrected as part
of this work.

### 5.4 What already exists and must not be rebuilt

- `domain: 'gastronomy' | 'experience'` is plumbed end-to-end: prop →
  payload → schema field (`CommerceLead.client.tsx:63-64`, `:128`), with two
  Astro pages wiring the same component
  (`[lang]/publicar-restaurante/index.astro`, `[lang]/publicar-experiencia/index.astro`).
- Multi-role landed and is **in production**: PR #2543 (`[HOS-296] feat(auth):
  replace the single user role with a multi-role relation`), merged to `staging`
  2026-07-30 and shipped in the 445-commit release. An account can hold `HOST`
  **and** `COMMERCE_OWNER` simultaneously, so granting the commerce role to an
  existing account no longer costs them anything. This dissolves the original
  blocker recorded on HOS-296.
- Commerce self-checkout landed (HOS-166, PRs #2456 / #2465 / #2470).

## 6. Proposed design

### 6.1 Grant the role where the listing is created

Mirror `createForOnboarding` exactly: inside the transaction that creates the
commerce listing, call

```ts
grantRole({
    userId: actor.id,
    role: RoleEnum.COMMERCE_OWNER,
    grantedBy: null,
    reason: RoleGrantReason.<COMMERCE_LISTING_CREATED>
})
```

The route is a `createProtectedRoute` requiring only an authenticated session —
**no `COMMERCE_*` permission**, exactly as host onboarding requires no
`ACCOMMODATION_*` permission. `grantRole` is idempotent, so a second listing is
a no-op on the role.

`RoleGrantReason` needs a new member for this cause. It is an audit reason, not
a gate.

### 6.2 Delete the provisioning path

Once §6.1 lands, the following have no remaining caller and should be removed
rather than left dormant:

- `CommerceOwnerProvisioningService` in full — temp-password generation, the
  `CreateUserPort` call with an explicit role, the credentials email, and the
  `alreadyExisted` / `credentialsSent` branches.
- `CommerceLeadService.approveAndProvision` and its admin route
  (`apps/api/src/routes/commerce/admin/approve-and-provision.ts`).
- The `CommerceOwnerProvisioner` port on `CommerceLeadService`.
- The admin lead inbox as a **required** step.

Leaving dead code here is not neutral: an exported provisioning service with no
callers reads as an active mechanism, which is the exact failure mode recorded
as F-57 in the same smoke that produced this spec.

### 6.3 Retire `commerce_leads`

With approval gone, four columns lose their meaning: `status`, `handledAt`,
`handledById`, `provisionedUserId`. The table's remaining purpose (marketing
capture) is not what it was built for.

**Decision:** retire the lead flow. The two public pages survive as landings
(§6.5), and the table is dropped in a **later** release than the one that stops
writing to it — per the standing rule that a `DROP COLUMN`/`DROP TABLE` ships in
the release *after* the code stops using it (F-03 / HOS-601 measured an
8-minute outage from violating exactly this).

Existing rows are administrative records; see OQ-2 for what happens to the
pending ones.

### 6.4 Route commerce checkout through the canonical trial resolver

`initiateCommerceMonthlySubscription` stops hardcoding `trialDays: 0` and calls
`resolveCheckoutFreeTrialDays`, the same function the accommodation paths use.

This is deliberately **not** "change the 0 to 30". Hospeda has an established,
repeatedly-costly pattern of a canonical helper coexisting with unmigrated
hand-written call sites — `normalizeStoredSubscriptionStatus`,
`isEntitlementGrantingStatus` (which left add-on sales dead in production for
months), `resolveSafeExternalUrl` (which produced the partner XSS). That family
is tracked as HOS-679. Adding a second place where trial days are decided would
enrol this work in it.

The plan's `trial_days` moves to 30 in `billing_plans`. Per the standing rule,
**the database wins for commercial fields** — the `.ts` constant alone moves
nothing — so this needs a seed data-migration, not just a baseline edit.

No reconciler change is required: `trialing` is already in `ACTIVE_STATUSES`.
That branch is presently unreachable for commerce and becomes live.

### 6.5 The public entry, mirroring `/publicar/`

- `/{lang}/publicar-restaurante/` and `/{lang}/publicar-experiencia/` keep their
  URLs and stay **public landings** — hero, benefits, how-it-works, FAQ, pricing
  — with the lead form replaced by an **auth-aware CTA island**, the same
  pattern as `HostLandingCta`.
- Both CTAs push to **one shared create page** carrying the `domain`. Unlike
  accommodation, which has a single door, commerce has two landings and one
  form — justified because `domain` is already plumbed and the two listing
  shapes share most fields.
- The create page follows `nueva.astro`: `prerender = false`, its own in-page
  auth guard via `buildLoginRedirect`, no middleware entry.
- Marketing copy should follow the `owners.*` precedent — shared keys, not
  duplicated prose.

### 6.6 Moderation becomes reactive

No new mechanism. An admin sets `moderationState = REJECTED`; the next
reconcile pass flips the listing to `PRIVATE` / `INACTIVE` through the existing
line-223 predicate. Refund, if any, is a separate deliberate action.

The predicate stays `!moderationRejected` — it is **not** tightened to
"approved", because tightening it would reintroduce the admin gate this spec
removes.

## 7. Data model / contracts

| Change | Kind | Carril |
| --- | --- | --- |
| `RoleGrantReason` gains a commerce-listing-created member | enum | schemas |
| `billing_plans.commerce-listing.trial_days` 0 → 30 | seed **data** | `packages/seed/src/data-migrations/` (dual-write rule: baseline **and** numbered migration) |
| `commerce_leads` table retired | structural, **deferred one release** | `packages/db/src/migrations/` |
| New protected route: create commerce listing | API | `createProtectedRoute` |
| Removed admin route: `approve-and-provision` | API | — |
| Removed public route: `commerce/leads` create | API | — |

No new columns. `moderationState`, `visibility`, `lifecycleState` and
`hasActiveSubscription` already exist on both `gastronomies` and `experiences`
and keep their current semantics.

## 8. UX / UI behavior

- Signed-out visitor on either landing → CTA reads as "publicá tu negocio" and
  goes to sign-in with a return URL.
- Signed-in visitor → CTA goes straight to the create form.
- After creating, the person lands in the editor to complete the listing, then
  checks out. The listing becomes visible when the reconciler observes an
  active-or-trialing subscription **and** a complete listing.
- The HOS-305 explainer (`apps/web/src/components/gastronomy/CommerceLeadProcess.tsx`,
  a single hardcoded 4-step `PROCESS_STEPS` array shared by both domains)
  currently narrates admin approval in step 2 ("nuestro equipo lo revisa y lo
  aprueba… 24 a 48 horas") and step 4. **That copy becomes false and must be
  rewritten**, once, for the new flow — it does **not** need domain branching,
  which is the point of G-2.

## 9. Acceptance criteria

- **AC-1** — A signed-in account with no commerce role can create a gastronomy
  listing and an experience listing, and holds `COMMERCE_OWNER` afterwards,
  without any admin action.
- **AC-2** — Creating a second listing does not error and does not duplicate the
  role grant.
- **AC-3** — An account that already holds `HOST` retains it after being granted
  `COMMERCE_OWNER`.
- **AC-4** — A commerce checkout produces a subscription with the plan's trial
  days resolved by `resolveCheckoutFreeTrialDays`; a static guard fails if
  `initiateCommerceMonthlySubscription` reintroduces a literal trial-days value.
- **AC-5** — A listing whose subscription is `trialing` and whose data is
  complete is reconciled to `PUBLIC` / `ACTIVE`.
- **AC-6** — Setting `moderationState = REJECTED` on a published listing
  reconciles it to `PRIVATE` / `INACTIVE` on the next pass, for both domains.
- **AC-7** — A static guard fails CI if any `if (domain === 'experience')` (or
  equivalent branch) appears in the provisioning, checkout, or visibility path.
  This is the machine-checkable form of G-2 and is the criterion most likely to
  erode without one.
- **AC-8** — An anonymous request to the create-listing route is rejected by the
  route factory, not by an in-handler check.
- **AC-9** — `grep` finds no remaining reference to `CommerceOwnerProvisioningService`
  or `approveAndProvision` in production source.

## 10. Risks

- **R-1 — Anyone with an account becomes a commerce owner.** This is deliberate
  and matches accommodation exactly, where any authenticated `USER` becomes a
  `HOST` by creating a draft. The listing is worthless until paid and complete,
  so the abuse ceiling is a `DRAFT` row.
- **R-2 — "Unpublish and refund" is two actions, and one of them is broken.**
  Rejection does not trigger a refund. The refund path has **HOS-597 open at
  Urgent**: the same refund applies its logic three times, which on a *partial*
  refund would return too much. If reactive moderation is the safety net, that
  bug sits on its critical path.
- **R-3 — Within the trial there is nothing to refund**, and the MercadoPago
  trial the person consumed does not come back — it is per
  `(payer, preapproval_plan)` (HOS-522). So "reject and refund" is a no-op for
  the first 30 days, and the person cannot re-trial the same plan.
- **R-4 — MercadoPago's 60-character `reason` limit** already broke coupons
  once. Adding a trial to commerce changes what is sent; verify the composed
  string.
- **R-5 — Nobody is watching.** Today an admin sees every applicant before a
  listing exists. Afterwards, nothing surfaces a bad listing unless someone
  reports it. See OQ-1.

## 11. Open questions

- **OQ-1** — Is there any moderation queue or report path for **published**
  commerce listings? Not verified. If there is none, R-5 has no mitigation and
  reactive moderation depends on somebody noticing by accident.
- **OQ-2** — What happens to the existing `commerce_leads` rows still in
  `pending`? Options: contact them out-of-band, provision them one last time
  before the path is deleted, or let them lapse.
- **OQ-3** — Does commerce need a precheck equivalent to
  `GET /host-onboarding/precheck` (already have a draft? limit reached?), or
  does the create route's own server-side enforcement suffice?
- **OQ-4** — How many trial days for commerce? Copying accommodation's 30 is
  the coherent default; a different number is a commercial decision.

## 12. Implementation notes

- The doc comment on `ReconcileCommerceListingVisibilityInput.entityType`
  (*"current values: `'gastronomy'`"*) is **stale** — `experience` has been
  wired since `resolveCommerceEntityModel` gained its second case. Fix it in
  this work; a comment that understates coverage is how a future reader
  concludes a domain is unsupported and builds a second path.
- Order of work matters: §6.1 (grant at creation) must land **before** §6.2
  (delete provisioning), or there is a window with no way to become a commerce
  owner at all.
- The `commerce_leads` drop ships one release **after** the code stops writing
  to it. Drizzle projects an explicit column list, so a live container reading a
  dropped column 500s until the new image serves — measured at 8 minutes of
  404s on the accommodation catalogue (HOS-601).

## 13. Linear

Canonical tracking:

- **HOS-589** — this spec's primary issue (the gate and provisioning).
- **HOS-590** — the free trial (§6.4). Tracked separately, specified here.

Related: HOS-296 (multi-role, shipped — the precondition), HOS-166 (commerce
self-checkout, shipped), HOS-305 (the copy this invalidates), HOS-679 (the
canonical-helper-drift family §6.4 avoids joining), HOS-597 (the refund bug on
R-2's critical path), HOS-522 (the MercadoPago per-payer trial).
