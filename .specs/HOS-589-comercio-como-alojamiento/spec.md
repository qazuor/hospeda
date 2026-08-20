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
refunds if money changed hands. **That reject action does not exist yet for
commerce and is built here** (§6.7); removing the gate before publication
without adding the one after it would leave commerce with no control at all.

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

`commerce-listing` carries `metadata.trialDays = 0` while the five active
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
- **G-2** — Gastronomy and experience follow **one code path**. They differ only
  in the data that path reads — which plan, which limit key, which domain — never
  in what it does. No `if (domain === …)` is introduced anywhere in the
  provisioning, checkout, or publish path.
  *(Stated as behaviour rather than "identical code" on purpose: §6.8 gives each
  vertical its own plan and cap, so a lookup by domain is expected and correct.
  AC-7 draws the line.)*
- **G-3** — Each vertical's plan carries a free trial resolved by the **same**
  canonical function the accommodation paths use, not a second copy of the rule.
- **G-4** — The public entry points keep their indexable surface: two landing
  pages that push to sign-in, mirroring `/publicar/`.
- **G-5** — An admin can take a published listing down. The reconciler already
  honours a rejected listing; what does **not** exist is any way to reject one
  (§6.7), so this goal includes building that.
- **G-6** — The header's publish CTA offers all three listing types, and stops
  hiding itself from people who already hold one of them (§6.10).
- **G-7** — A commerce subscription belongs to the **owner**, not to the
  listing, and each vertical carries its own cap — the accommodation shape,
  applied to gastronomy and experience (§6.8).

## 4. Non-goals

- **NG-1** — Building an automatic refund on rejection. Marking a listing
  rejected and refunding stay two deliberate actions (see R-2).
- **NG-2** — Building a **report-abuse flow** (a way for the public to flag a
  listing) or a moderation **queue** / inbox. This spec builds the admin's
  ability to reject a listing, not a system for discovering which ones deserve
  it. That gap is stated plainly in R-5.
- **NG-3** — Changing how accommodation **behaves**. This spec moves commerce
  toward accommodation, never the reverse. It does, unavoidably, **generalise
  machinery accommodation currently owns alone** — the usage badge's hardcoded
  limit key (§6.11), the plans endpoint's allow-only-accommodation filter (§6.12),
  the two domain predicates (§13). Every one of those keeps accommodation's
  observable behaviour byte-identical: same badge, same `/public/plans` response
  with no parameter, same entitlement set. Widening a parameter is in scope;
  changing an answer is not.
  **One accommodation surface does change its answer**, and it is not one of
  those three: §6.9 removes the three `complex-*` plans, which empties the
  `complex` category that `/suscriptores/planes/comparar/` reads directly. That
  page renders a narrower table afterwards (AC-28). It is in scope, it is
  deliberate, and NG-3 does not cover it — the exemption is for the plan
  catalogue cleanup, not a fourth act of generalisation.
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
- **The create route exists** (`apps/api/src/routes/commerce/protected/create.ts`),
  and so does the whole owner area at `/mi-cuenta/comercio/` (SPEC-249 / HOS-166,
  documented in `apps/web/docs/commerce-owner-self-service.md`). Neither is built
  here. What changes in them is §6.1 and §6.11 — and in both cases the change is
  a **removal**, not a construction.

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

The target is a `createProtectedRoute` requiring only an authenticated session —
**no `COMMERCE_*` permission**, exactly as host onboarding requires no
`ACCOMMODATION_*` permission. `grantRole` is idempotent, so a second listing is
a no-op on the role.

`RoleGrantReason` needs a new member for this cause. It is an audit reason, not
a gate.

#### The route already exists, and it is gated three times over

`apps/api/src/routes/commerce/protected/create.ts` was built by HOS-166. It
declares two `createProtectedRoute`s — `protectedCreateGastronomyListingRoute`
(:110) and `protectedCreateExperienceListingRoute` (:179) — over a shared
handler, which is the correct reading of G-2: one path, two declarations, no
behavioural branch.

Its own header states the problem (`:36-40`):

> Gated on `COMMERCE_CREATE` at **BOTH** the route (`requiredPermissions`) AND
> the service (`GastronomyService`/`ExperienceService`'s `_canCreate` →
> `checkGastronomyCanCreate`/`checkExperienceCanCreate`). `COMMERCE_OWNER` holds
> this permission as of the HOS-166 PR-A seed grant.

So **the same door is bolted three times**: `requiredPermissions` at :117 and
:186, the service's `_canCreate`, and the web page's `hasCommerceNavAccess`
(§6.11). Each of the three independently turns away the signed-in person who has
no commerce role — which is everyone this spec is for. Opening one leaves the
other two closed, and the failure looks different at each layer (a redirect, a
403 from the factory, a 403 from the service), so a partial fix reads as a
different bug each time.

The work is therefore **not** "build a route". It is: drop `requiredPermissions`
on both declarations, drop the permission check from `_canCreate`, drop the web
gate, and add the `grantRole` call inside the create transaction.

**The admin create route is unaffected.** `_canCreate` is shared, but the admin
route carries its own `requiredPermissions`, so relaxing the service predicate
does not widen the admin path. Say it here because the alternative — an
implementer refusing to touch `_canCreate` for fear of opening admin — leaves the
second bolt in place.

Note also AC-8 is already satisfied today and is a **regression** criterion, not
a new one: it exists to catch someone replacing the factory's auth with an
in-handler check while stripping the permission gates.

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
- `GET /api/v1/protected/commerce/leads/mine`
  (`apps/api/src/routes/commerce/protected/my-lead.ts`, HOS-257) and the
  `prefill` prop it feeds on `CommerceCreateForm.client.tsx`. It reads the
  caller's own provisioned `commerce_leads` row to pre-fill the create form —
  a convenience that becomes meaningless once nobody files a lead, and
  unreadable once §6.3 drops the table. It is a pre-fill, never a gate, so
  removing it costs the owner nothing but a few keystrokes they no longer save.

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

**There is no `trial_days` column.** The value lives in
`billing_plans.metadata` as **two** fields — `metadata.trialDays` and
`metadata.hasTrial` — and both are classified `'commercial'`, so the database
wins and a `.ts` edit alone moves nothing. Migrations `0017` and `0051` already
did exactly this for the tourist plans and are the pattern to copy.

Each vertical's enabled plan gets `hasTrial: true` and `trialDays: 30`, matching
all five accommodation plans (owner tiers and tourist-vip alike).

No reconciler change is required: `trialing` is already in `ACTIVE_STATUSES`.
That branch is presently unreachable for commerce and becomes live.

#### It is three hardcodes, not one — and the first is not cosmetic

`initiateCommerceMonthlySubscription` states "no trial" in three coupled places,
and changing only the one named above leaves a checkout that says trial and
charges on day one:

| Where | What it does |
| --- | --- |
| `subscription-checkout.service.ts:711` | `trialDays: 0` passed to `resolveCheckoutMpPlanId` |
| `:767` | `trialGranted: false` passed to `createPendingProviderSubscription` |
| `:696-698` | the HOS-191 comment asserting commerce is always no-trial |

The first one is load-bearing. `resolveCheckoutMpPlanId`
(`apps/api/src/services/billing/mp-plan-provisioning.service.ts:451`) resolves
the MercadoPago **preapproval plan** from `(commercial plan, amount, currency,
interval, trialDays)`, so the zero does not merely record "no trial" — it selects
the no-trial MP plan to subscribe against. Passing 30 mints a different
preapproval plan at MercadoPago. That is the same mechanism §6.8 relies on for
AC-16, and it is why §13 insists the change lands before anyone can buy.

The accommodation paths are the shape to copy end to end: `resolvePlanTrialConfig`
→ `resolveCheckoutFreeTrialDays` (`:461`, `:1194`) → `freeTrialDays` handed to
both the MP plan resolver and the pending subscription (`:560`, `:1272`) →
`...(freeTrialDays !== undefined && { trialGranted: true as const })` (`:598`,
`:1304`). Three call sites move together there; three must move together here.

**The partner path is deliberately excluded.** It repeats the identical pair at
`:912` / `:954` and stays no-trial. A guard written against the string rather
than against the function would break it.

### 6.5 The public entry, mirroring `/publicar/`

- `/{lang}/publicar-restaurante/` and `/{lang}/publicar-experiencia/` keep their
  URLs and stay **public landings** — hero, benefits, how-it-works, FAQ, pricing
  — with the lead form replaced by an **auth-aware CTA island**, the same
  pattern as `HostLandingCta`.
- Both CTAs push to the create page that **already exists** —
  `apps/web/src/pages/[lang]/mi-cuenta/comercio/nuevo/[vertical].astro`, shipped
  by HOS-166 — carrying the vertical in the path. Do **not** build a second one.
  There is also already a vertical chooser at `comercio/nuevo/index.astro`, which
  the landings bypass because they know their own vertical.
- That page already follows `nueva.astro` (`prerender = false`, its own in-page
  auth guard, no middleware entry). It diverges in two ways that this work has to
  close, both in §6.11: it **gates on already holding the commerce role**, and it
  redirects an anonymous visitor to `auth/signin` with **no return URL** where
  accommodation uses `buildLoginRedirect`.
- Marketing copy should follow the `owners.*` precedent — shared keys, not
  duplicated prose.

### 6.6 Moderation becomes reactive

An admin sets `moderationState = REJECTED`; the next reconcile pass flips the
listing to `PRIVATE` / `INACTIVE` through the existing line-223 predicate.
Refund, if any, is a separate deliberate action.

The predicate stays `!moderationRejected` — it is **not** tightened to
"approved", because tightening it would reintroduce the admin gate this spec
removes.

### 6.7 Build `moderate()` for commerce — the reject action does not exist

**This is the part of the plan that has no code today**, and it was found by
looking rather than assumed:

- There is **no report / flag / denuncia path anywhere in the repository**.
- `moderate()` exists on `PostService`, `AccommodationService` (line 1979),
  `EntityCommentService`, `EventService` and every review service. It does
  **not** exist on the gastronomy or experience listing services.
- It cannot be done through the generic admin PATCH either: the write schemas
  strip the field on purpose. `gastronomy.crud.schema.ts:127` lists
  `visibility`, `moderationState`, `isFeatured` and `ownerId` as
  **"intentionally excluded"**, and a test freezes it —
  *"should strip `moderationState` (control field — admin-only)"*.

So the reconciler honours `REJECTED` while **nothing in the system can write
it**. The branch is live and unreachable — structurally the same defect as
`trialing` in §6.4, found the same way.

Removing the pre-publication gate without building the post-publication one
leaves commerce with **no control at all**, so this ships together with the
rest.

Design: mirror `AccommodationService.moderate` exactly — same
`ContentModerationChangeInput` shape, same `checkCanModerate(actor)` guard, same
`ServiceOutput` return — on the shared commerce listing service so gastronomy
and experience inherit one implementation (G-2). Expose it as one admin route
per domain alongside the existing CRUD routes.

The write schemas stay as they are: `moderationState` remains admin-only and
unreachable from the owner's own update payload.

The route pattern to mirror is `apps/api/src/routes/accommodation/admin/moderate.ts`
(with `post/admin/moderate.ts` as the second reference).

**Two things this section still leaves open, named rather than left implicit:**

- **Where the admin clicks it.** A route with no control is reachable only by a
  hand-crafted request. `apps/admin` already carries full CRUD for both verticals
  (`src/routes/_authed/gastronomies/` and `_authed/experiences/`: index, detail,
  edit, new, gallery, seo), so the reject control belongs on the detail route of
  each. Without it, R-5 is worse than stated — not merely no signal that a listing
  needs rejecting, but no button once you know.
- **A naming trap.** `useModerateReviewMutation` already exists on the commerce
  admin hooks (`apps/admin/src/features/commerce/hooks/createCommerceEntityHooks.ts:171`)
  and moderates **reviews of** a listing, not the listing. Anyone grepping
  "moderate" under commerce finds it first and can reasonably conclude the work is
  already done. It is not related.

### 6.8 Commerce billing becomes per-owner, mirroring accommodation

Decided 2026-08-19, after measuring that **production holds zero live commerce
subscriptions** — 3 rows in `billing_subscriptions` and 5 in the link table, all
`expired`, none for experiences. The data-migration cost is zero, and it will
never be this cheap again: once commerce ships self-service with a trial, the
same change means cancelling and recreating MercadoPago preapprovals for people
who are already paying.

**Today the two models are opposites.** Accommodation: one subscription per
**owner**, covering N listings up to `max_accommodations` (1 / 3 / 10).
Commerce: one subscription per **listing**, guaranteed by
`UNIQUE(entity_type, entity_id)`, with no cap of any kind. Two restaurants are
two independent MercadoPago subscriptions.

Commerce moves to the accommodation shape:

- **One subscription per owner, per vertical.**
  `commerce_listing_subscriptions` keeps its unique constraint, but its meaning
  changes: it maps each listing to its vertical's subscription for that owner,
  instead of standing in for a subscription of its own.
- **Three product domains, not two.** `product_domain` today holds
  `accommodation` / `commerce` / `partner`. The `commerce` value is retired and
  replaced by **`gastronomy`** and **`experience`**, so each vertical is
  independently subscribable and independently capped. An owner can hold an
  accommodation plan, a gastronomy plan and an experience plan at once, and each
  counts its own listings.
- **Three limit keys**: the existing `MAX_ACCOMMODATIONS`, plus new
  `MAX_GASTRONOMIES` and `MAX_EXPERIENCES`. A single pooled cap was considered
  and rejected: it cannot express *"one restaurant and one excursion"* — someone
  would be free to spend both slots on restaurants.
- **Extra listings are bought as an addon**, one per vertical, mirroring
  `extra-accommodations-5` (`packages/billing/src/config/addons.config.ts:59-73`):
  recurring, `limitIncrease: 1`, with `affectsLimitKey` pointing at that
  vertical's key. An `AddonDefinition` carries exactly one `affectsLimitKey`, so
  two definitions is the shape the existing model already implies.

#### Three keys is data, not a behavioural branch

G-2 forbids branching **behaviour** by domain — `if (domain === 'experience')
{ require approval }`. Resolving which limit key to check through a
`Record<domain, LimitKey>` lookup is not that: it is one code path reading a
different value. AC-7's guard must be written to catch the former without
outlawing the latter, or it will block the correct implementation.

#### What the split buys, beyond expressiveness

Each vertical becomes a **distinct MercadoPago preapproval plan**. Since MP's
free trial is scoped to `(payer, preapproval_plan)`, an owner who used their 30
days on gastronomy still receives 30 days when they later add an experience —
they are buying a different plan, not the same one twice.

That removes the HOS-522 collision from this design entirely, rather than
mitigating it with copy. A single pooled commerce plan would have reintroduced
it: the second vertical would silently start charging on day one while the page
promised a trial.

#### The checkout route is keyed by listing, and that is the thing that changes

`POST /api/v1/protected/commerce/listings/:entityType/:entityId/start-subscription`
(`apps/api/src/routes/commerce/protected/start-subscription.ts`, HOS-166) puts
the listing **in the path**, because today the listing is what gets subscribed.
Under the per-owner model the entity in the path stops being the subscription's
subject and becomes the thing attached to the owner's subscription for that
vertical.

Its answer therefore forks three ways where today it forks once:

1. The owner has no subscription for this vertical → start one, attach this
   listing. Today's behaviour.
2. The owner has one and is **under** the cap → attach the listing and open **no
   checkout at all**. This is AC-14, and it is the case that does not exist today.
3. The owner has one and is **at** the cap → refuse, and point at that vertical's
   extra-listing addon (§6.11).

Case 2 is where a per-listing model quietly survives a rename: leaving the route
opening a checkout for the second listing would produce a second MercadoPago
preapproval and the owner would be charged twice for a plan that already covers
them.

#### Naming stays

The shared machinery keeps its `commerce_*` names — the link table, the
visibility reconciler, the listing services. Those cover both verticals and are
parameterised by domain; splitting the **billing** domain is not a reason to
rename working code, and a rename cascade would bury the change that matters.

#### The cap is the product, and every layer under it resolves unknown to *unlimited*

The `max_gastronomies: 1` above is the entire commercial substance of this
section: one listing for $15.000. The machinery that would enforce it fails open
at four separate points, and **not one of them raises an error** — the symptom of
a mis-wired cap is silent unlimited listings, which is indistinguishable from
working correctly until someone counts rows.

| # | Layer | Behaviour on "I don't know" |
| --- | --- | --- |
| 1 | `apps/api/src/routes/commerce/protected/create.ts` | Runs **no** entitlement middleware and **no** limit enforcement at all — today there is no cap to enforce. Seeding `max_gastronomies: 1` without wiring the middleware does nothing whatsoever. |
| 2 | `getRemainingLimit` (`middlewares/entitlement.ts:1088-1097`) | `!limits.has(key)` → returns `-1`, *"Limit not defined - treat as unlimited"*. |
| 3 | `loadEntitlements` (SPEC-239) | Filters to `product_domain = 'accommodation'`, so on a commerce route `userLimits` carries the **accommodation** plan's keys — which never include `MAX_GASTRONOMIES`. Feeds straight into layer 2. Several paths set an **empty** `Map` (`entitlement.ts:704, 737, 870`), which via layer 2 is unlimited for every key. |
| 4 | `enforceAccommodationLimit` (`middlewares/limit-enforcement.ts:126-136`) | On a count failure it logs and calls `next()` — *"Continue - don't block on count failure"*. |

Layer 2 collides with a choice made earlier in this very section. §6.8 deliberately
leaves the other limit keys **absent** rather than `-1`, because absent reads as
"this plan does not meter that". That reasoning is sound and stays — but it means
the engine cannot distinguish *"this plan does not meter gastronomies"* from
*"the wrong plan got loaded"*. Both are `-1`.

Add the precheck's deliberate fail-open to `create_direct` (OQ-3) and the cap has
**five** ways to silently not exist and zero ways to announce it.

Two consequences for the implementation:

- **The wiring is the deliverable, not the seed value.** AC-13 must be asserted
  against a request that actually traverses the middleware stack, with the
  commerce plan loaded — not against `checkLimit` in isolation, which passes
  whatever context the test hands it.
- **The accommodation stack cannot be copied literally.** Accommodation's create
  route stacks `requireEntitlement(EntitlementKey.PUBLISH_ACCOMMODATIONS)` and
  *then* `enforceAccommodationLimit()`, in that order and for a stated reason
  (SPEC-145 T-004: the entitlement gate runs before the count is consulted).
  §6.8 states that **neither vertical grants any entitlement today**, so there is
  nothing to put in the first half of that pattern. Either each vertical's plan
  gains a publish entitlement of its own — making the shape a true mirror — or the
  spec states plainly that commerce runs the limit check with no entitlement gate
  ahead of it, and why that is acceptable. Leaving it unsaid produces a copy of the
  accommodation stack with a hole where its first gate was.

#### How commerce enters the limit engine without breaking SPEC-239

SPEC-239 isolated commerce from the entitlement engine on purpose:
`loadEntitlements` filters through the named predicate
`isAccommodationSubscription`, so a commerce subscription cannot pollute a
host's accommodation entitlements.

**Parameterise that predicate by domain rather than removing it.** A commerce
route loads the commerce subscription's limits into the same context keys; an
accommodation route keeps loading accommodation's. The two sets are never merged,
so the isolation is preserved by construction — the guarantee gets stronger, not
weaker, because the domain becomes explicit at the call site instead of implicit
in one hardcoded predicate.

That the isolation is a *named predicate* rather than a condition scattered
across queries is what makes this affordable.

#### What ships now, and what is only prepared

Each vertical's catalogue is built for the full three-tier shape — basic /
professional / premium, each with its own entitlements and limits, exactly like
accommodation. **Only the premium tier of each is enabled**, and it declares
**one limit and nothing else**: `max_gastronomies: 1` for the gastronomy plan,
`max_experiences: 1` for the experience plan. Everything else is included
without a ceiling.

The enabled tier keeps the current `$15.000`, so **nobody paying today sees a
change**: one listing for the same money. What changes is that the plan is now
the owner's rather than the listing's, which is what makes a cap meaningful at
all.

Note the deliberate choice: the other limit keys are **not declared at all**
rather than declared as `-1`. Both produce unlimited, but an absent key reads as
"this plan does not meter that", which is what is true here.

Growth path, needing no code change: when more tiers are enabled, premium's cap
rises and the basic tier keeps 1. The cap is a `'commercial'` field — the
database wins — so it moves by data-migration. Adding entitlements to the tiers
is a later, separate decision; neither vertical grants any today.

### 6.9 Plan catalogue cleanup

Three cleanups the owner called for on 2026-08-19, verified against production:

| Plan | Live subscriptions | Action |
| --- | --- | --- |
| `complex-basico` / `complex-pro` / `complex-premium` | **0** | Remove outright |
| `tourist-plus` | 2, both `cancelled` | **Deactivate + soft-delete only** |
| `owner-test-daily` | 1, `cancelled` | **Deactivate + soft-delete only** |

`tourist-plus` and `owner-test-daily` are **not** hard-deleted: historical
subscriptions point at them, and removing the row would leave that history
referencing a plan that no longer exists.

Removing the three `complex-*` plans empties the `complex` category outright, and
one page reads it directly: `/suscriptores/planes/comparar/` merges owner **and**
complex plans into one table (`comparar/index.astro:55`,
`filterPlansByCategory(fetchResult.plans, 'complex')`). Afterwards that second
fetch always returns `[]`. The expected outcome is simply a narrower table, but
it must be **checked, not assumed** — an empty category is a state that page has
never been rendered in. It also leaves `PlanCategory`'s `'complex'` member with
no data behind it, which is the seam HOS-684 pulls on when it removes
`max_properties`.

**`metadata.monthlyPriceArs` is removed** — but not where the first draft said,
and not by touching the file it named.

The read side is safe, and precisely so: `plan.crud.ts:53` documents the mapping
as `monthlyPriceArs ← monthly billing_prices.unitAmount`. The DTO never reads the
metadata mirror. HOS-39 promoted the value to a typed column and HOS-73 finished
the job. The stale `$5.000` it still carries for `commerce-listing` (against the
real `$15.000`) is exactly the kind of contradiction a dead field accumulates
once nothing reads it.

The **write** side is where the first draft was wrong:

- **Do not touch `model-c-field-split.ts`.** Its only related entry is
  `monthlyPriceArs: 'commercial'` at line 136, and that entry classifies the
  **typed column** `billing_plans.monthly_price_ars` — the live price of every
  plan — not the mirror. Its own JSDoc says it was "promoted off the
  `metadata.monthlyPriceArs` jsonb mirror". There is no mirror entry to delete;
  deleting the one that is there declassifies the real price for the whole
  catalogue.
- **Three write sites keep putting it back**, and the first draft named only one
  of them:

  | Where | Line |
  | --- | --- |
  | `PlanService.createPlan` — into `metadata` | `plan.crud.ts:446` |
  | `PlanService.updatePlan` — into `updatedMeta` | `plan.crud.ts:601-602` |
  | The seed baseline — into `metadata` | `billingPlans.seed.ts:449` |

  Each of the three writes the value to the typed column and to
  `billing_prices.unitAmount` on the same call (`:467`/`:480`, `:620-621`/`:636`,
  `billingPlans.seed.ts:442`). **Only the metadata line is removed from each**;
  the other two writes are the live ones.

Without all three, the data-migration cleans the rows and the **next admin price
edit on any plan whatsoever** — not just a commerce plan — writes the mirror
straight back. That is the difference between a field that is removed and a field
that is briefly absent.

**`max_properties` removal is tracked separately.** It is not used by any active
plan, but it is wired through roughly fifteen production files — the `LimitKey`
enum, `limits.config.ts`, the three complex plans, the `extra-properties-5`
addon, an enforcement middleware that self-describes as a placeholder,
`usage-tracking.service.ts`, the exhaustive `Record<LimitKey, string>` in
`limit-check.ts`, an admin dashboard label, two web modules, six i18n keys, and
two guard tests. That is a refactor, not a cleanup, and it has no dependency on
commerce; bundling it here would bury the change that matters under a mechanical
sweep.

### 6.10 The header CTA becomes a three-way chooser

`apps/web/src/layouts/Header.astro` renders a single "Publicar" CTA (line 226)
pointing at `/publicar/`. With three listing types it becomes a dropdown
offering accommodation, gastronomy and experience, each going to its landing.

Two existing behaviours need rework, not just extra entries:

1. **It hides itself from people who already publish.** Line 115:
   *"Hide the 'Publicar' nav CTA for users who are already HOST (or higher)"*,
   with the condition reading accommodation entitlements
   (`PUBLISH_ACCOMMODATIONS` / `EDIT_ACCOMMODATION_INFO`, line 161). Someone who
   already owns a cabin is exactly the person who might now want to list their
   restaurant, and today the control disappears for them. The hide rule has to
   become per-option, or go away.
2. **It collapses to an icon below 480px** (line 592) and the header has three
   distinct breakpoint layouts (wide ≥1280 / narrow 1025-1279 / mobile <1025).
   A dropdown has to survive all three, and the mobile menu
   (`MobileMenu.client.tsx:216`) builds the same funnel separately — both
   surfaces need the three options or they diverge.

### 6.11 The owner's management surface — it exists, and it blocks this spec

`/mi-cuenta/comercio/` is **not** a gap to fill: HOS-166 built it, and
`apps/web/docs/commerce-owner-self-service.md` documents it. Four pages exist —
the listing index (`comercio/index.astro`), the vertical chooser
(`comercio/nuevo/index.astro`), the create form (`comercio/nuevo/[vertical].astro`)
and the operational editor (`comercio/[vertical]/[id]/editar.astro`). Writing
this spec as if the surface had to be built would have produced a duplicate
create page next to a working one.

What it needs is five specific changes, one of which is blocking.

#### The blocking one: the create page requires the role it is supposed to grant

`comercio/nuevo/[vertical].astro:46` reads:

```ts
if (!hasCommerceNavAccess({ roles: user.roles })) {
    return Astro.redirect(buildUrl({ locale, path: 'mi-cuenta' }));
}
```

So a signed-in person **without** `COMMERCE_OWNER` is redirected away from the
only page that would have granted it. §6.1 grants the role inside the create
transaction; that transaction is unreachable from the web until this guard goes.
The same shape guards the index and the editor, and there it is correct — those
pages list and edit listings that must already exist. **Only the create page's
role gate is removed**; its authentication guard stays, and it stops discarding
the return URL (`buildLoginRedirect`, as `nueva.astro` does).

This mirrors accommodation exactly: `publicar/nueva.astro` requires a session and
nothing else, and `/mi-cuenta/propiedades/` requires `hasAccommodationsNavAccess`.
The door is open; the room behind it is not.

#### A quota badge per vertical, where today there is none

`propiedades/index.astro:230-244` renders "N de M propiedades" from
`GET /api/v1/protected/billing/usage/{limitKey}`, parsed by
`apps/web/src/lib/host/usage-badge.ts` (`parseUsageResponse`, lines 97-120),
with an upgrade CTA once `threshold !== 'ok'`. `comercio/index.astro` has no
such badge, because until §6.8 there was no cap to report.

The index gains **one badge per vertical the owner actually holds a listing in**,
each reading its own limit key. Two verticals means two independent readings, not
one merged number — the same reason §6.8 refused a pooled cap. `usage-badge.ts`
hardcodes `MAX_ACCOMMODATIONS_LIMIT_KEY` at line 33; it takes the key as an
argument instead.

#### The addon page locks out the person who needs it

`/mi-cuenta/addons/` (`addons/index.astro:82-90`) refuses to show the catalogue
unless the caller holds a subscription in `active` / `trial` / `trialing` — and
that lookup resolves the **accommodation** subscription. A commerce-only owner,
who is exactly who buys `extra-gastronomies-1`, currently sees the upgrade CTA
instead of the product. The gate becomes per-domain, resolved from the addon's
own `affectsLimitKey`, so the vertical's addon is offered to the owner of that
vertical's subscription.

Purchase mechanics are untouched: `AddonsPurchasePanel.client.tsx` →
`POST /api/v1/protected/billing/addons/{slug}/purchase` → MercadoPago, exactly as
`extra-accommodations-5` works today.

#### The subscription dashboard is binary and has to become three-way

`mi-cuenta/suscripcion/index.astro:27-40` already accepts `?domain=commerce` to
scope the view to a commerce subscription instead of the accommodation one
(HOS-259) — the multi-subscription idea is built. What is not built is a third
value: the union is literally `'accommodation' | 'commerce'` at line 35, and the
heading branches on it. It becomes `accommodation | gastronomy | experience`,
and an owner holding two or three sees them all rather than one at a time.

#### The nav needs no new group, only a permission mapping

`apps/web/src/config/navigation.ts:281-296` already declares the `comercio`
group, gated on `PermissionEnum.COMMERCE_EDIT_OWN`. Nothing is added there. What
must be checked is `PERMISSION_ROLE_MAP` in `apps/web/src/lib/nav-gating.ts:76-119`
— the SSR approximation of permission-to-role — because a freshly granted
`COMMERCE_OWNER` renders server-side before the client knows its exact
permissions. A coverage test already fails on a missing entry (`nav-gating.ts:67-74`),
so this is checked by CI rather than by hand.

#### One behaviour disappears: "Publicar y pagar" per listing

`CommerceListingActions.client.tsx` today starts a checkout **per listing** — the
per-listing subscription model §6.8 retires. Afterwards the first listing in a
vertical starts that vertical's subscription and every later one consumes quota,
so the per-listing CTA appears only when the owner has no subscription for that
vertical yet. That is the same shape as accommodation, where publishing the
second property never opens a checkout.

### 6.12 Where the two verticals are sold, and the strings that sell them

Two newly sellable product domains need somewhere to be sold and something to
say when a cap is hit. Neither exists, and neither appears by itself once the
plans are seeded.

#### Being a plan is not enough to be shown

The public catalogue hides them twice over, independently:

1. `apps/api/src/routes/billing/public/listPlans.ts:29-44` builds the set of
   every plan whose `product_domain` is **not** `accommodation` and subtracts it
   from the response. It is an allow-only-`accommodation` filter, so retiring the
   `commerce` value and introducing `gastronomy` / `experience` leaves the new
   plans exactly as invisible as the old one.
2. `packages/billing/src/config/plans.config.ts:515-560` keeps
   `COMMERCE_LISTING_PLAN` deliberately **out of `ALL_PLANS`** (SPEC-239's
   D-ISOLATION), so even the seed-time catalogue never carries it.

**Decision: scope the endpoint by product domain, not by category.**
`GET /api/v1/public/plans` takes an optional `?domain=` defaulting to
`accommodation`, and the filter becomes "this domain" instead of "not
accommodation". Every existing caller and the `pricing` edge-cache class keep
their current response byte-for-byte, and the isolation SPEC-239 bought is
preserved by construction rather than by a hardcoded exclusion — the same
argument §6.8 makes for parameterising `isAccommodationSubscription`.

`PlanCategory` (`'owner' | 'complex' | 'tourist'`, branched on by the web pages
through `fetch-plans.ts:117-125`) is **not** widened. A category is a tier
grouping *inside* one audience; the vertical is a different product. Conflating
them is how `COMMERCE_LISTING_PLAN` ended up declaring `category: 'owner'` purely
to satisfy a type it does not belong to.

#### One tier means a price block, not a comparison table

`/suscriptores/planes/comparar/` compares tiers. §6.8 enables exactly **one** tier
per vertical, so the commerce equivalent would be a table with a single column.
Do not build it.

The price is shown on the landing that already owns the audience —
`/{lang}/publicar-restaurante/` and `/{lang}/publicar-experiencia/`. Note that
§6.5's description of those pages is aspirational: today each is a **hero plus
the lead form** and nothing else. Removing the form per §6.5 therefore leaves a
hero on an empty page, so the benefits / how-it-works / price / FAQ blocks that
section assumes are **work in this spec**, not existing content to preserve.

The `/suscriptores/` pricing pair for each vertical arrives when its second and
third tiers are enabled. That is the same "built for three, ships with one"
posture §6.8 takes, applied to the sales surface.

#### The strings, in three locales

Two new limit keys need two families of i18n entries, and the two families
behave differently:

- **`billing.limit.<key>.*`** — the at-limit UI: `title`, `message_one`,
  `message_other`, `cta`, plus the nested `atLimitPanel.{title, body_one,
  body_other, primaryCta, secondaryCta}`. Copy the shape of
  `billing.limit.max_accommodations.*` (`packages/i18n/src/locales/{es,en,pt}/billing.json:278-290`).
  **This family is gated by code**: `apps/web/src/lib/billing-limit-error.ts:50-57`
  holds a hand-written `Set<string>` of "keys that have dedicated entries", and a
  key absent from it falls through to `billing.limit.generic.*` **no matter what
  the locale files contain**. Both new keys go in that Set. This is the single
  most likely way the strings ship and are never seen.
- **`billing.comparison.limitLabel.<key>`** — one flat label per key
  (`{es,en,pt}/billing.json:544-559`). No allowlist gates it; `getLimitName`
  (`apps/web/src/lib/billing-i18n.ts:164-169`) concatenates and falls back to
  `LIMIT_METADATA[key].name`. Note this family currently has **no production call
  site** — the comparison table uses curated `billing.comparison.row.*` labels
  instead. Fill it anyway: it is the fallback path's only Spanish, and it costs
  two lines per locale.

The usage badge needs its own strings too: `host.properties.usage.label` is
pluralised per vertical, so gastronomy and experience each need theirs (§6.11).

#### Nothing today would catch a missing string

Verified: **no guard ties `LimitKey` to i18n coverage.**
`packages/billing/test/limits.test.ts:19-84` enforces that `LIMIT_METADATA` is
exhaustive over `LimitKey`, but it reads a TypeScript record of English strings
and never opens a locale file. `packages/i18n/test/key-coverage.test.ts` enforces
es ↔ en ↔ pt parity, which catches a key added to one locale and forgotten in
the others but is blind to a key missing from all three.

So two limit keys can ship with zero translated strings, silently degrading to
generic English-shaped copy, and CI stays green. **Add the guard** — assert that
every `LimitKey` has a `billing.limit.<key>.title` and a
`billing.comparison.limitLabel.<key>` in `es`, and that
`KNOWN_LIMIT_KEYS` covers every `LimitKey` — reusing the exhaustiveness pattern
`limits.test.ts` already established. The cross-locale guard then covers `en` and
`pt` for free.

### 6.13 What happens to the rows that already say `commerce`

Inventoried against production on 2026-08-20, excluding soft-deleted rows.

| Table | Rows carrying `commerce` | Shape |
| --- | --- | --- |
| `billing_subscriptions` | **3**, all `expired`, `deleted_at` null | all on plan `86861c88-…`, all created `2026-07-08 03:18:39` within 22 ms |
| `commerce_listing_subscriptions` | **5**, all `entity_type = 'gastronomy'`, all `expired` | table has **no** `deleted_at` |

The one timestamp is the tell: this is a single seed run, not customers. The
three `billing_customers.external_id` values resolve to
`gastro-owner-julieta@local.test`, `gastro-owner-rodrigo@local.test` and
`gastro-owner-valentina@local.test` — fixtures. **Zero experience rows exist**,
so the `experience` domain is born empty.

Two facts change the plan:

#### The link table has its own `product_domain`, and the spec did not say so

`commerce_listing_subscriptions.productDomain` is a **separate column** with a
hardcoded default of `'commerce'`
(`packages/db/src/schemas/commerce/commerce_listing_subscription.dbschema.ts:35`),
not a join through the subscription. The checkout stamps the domain in **three**
places on one purchase — the subscription
(`subscription-checkout.service.ts:772`), the link row (`:785`) and
`domainMetadata` (`:778`, which carries entity coordinates and is unaffected).
Any migration that rewrites one column and not the other leaves the two
disagreeing, which nothing in the code would notice.

#### These rows are not migrated. They are deleted — by a migration of their own

`0059-purge-test-and-commerce-example.ts:125-127` already hard-deletes exactly
those three accounts and the gastronomies they own. It has **not run in
production** (the ledger's newest entry is `0057`, 2026-08-18). But it does not
reach the billing rows, and it cannot: `billing_customers` has **no foreign key
to `users`** — the link is `external_id`, a plain uuid — and
`commerce_listing_subscriptions` has **no foreign key to the listing**, only
`subscription_id → billing_subscriptions ON DELETE CASCADE`.

So after 0059 runs, all 8 rows survive as orphans pointing at deleted users and
deleted listings. **Decision: a new numbered migration deletes them**, deleting
the 3 subscriptions and letting the FK cascade take the 5 link rows.

It is a *new* migration, not an edit to 0059, because the `seed_migrations`
ledger stores a `checksum` per applied migration
(`packages/db/src/schemas/seed-migrations/seed_migration.dbschema.ts:25-50`) —
editing a file that already applied anywhere corrupts that environment's ledger.
And it must be **order-independent**: 0059 may run before or after it, and the
deletion is correct either way because it selects the three subscription ids by
their customers' `external_id`, not by joining a table 0059 may already have
emptied.

#### The domain rewrite still ships, for the environments that are not production

Staging and local carry rows these three ids do not describe, so the
`commerce` → `gastronomy` / `experience` rewrite is written normally and is
simply a no-op on an empty set. Its rule:

- A subscription's new domain is read from **its link row's `entity_type`** —
  the only place the vertical is recorded. Both columns are rewritten in the same
  statement pair.
- A subscription with **no** link row is left at `commerce` and reported, never
  guessed. Guessing would put an owner on the wrong vertical's cap; leaving it is
  inert, because the link row *is* the attachment to a listing, so a subscription
  without one grants nothing to anybody in any domain.

#### The unique index survives untouched

`commerce_listing_subs_entity_uniq` is `UNIQUE(entity_type, entity_id)`. Read it
precisely: it guarantees one **subscription per listing**, and has never
forbidden one subscription covering several listings. Production already has one
doing exactly that — julieta's single subscription covers two gastronomies —
which is the per-owner shape §6.8 is moving to. The constraint needs no
migration, and §6.8's phrase "one subscription per listing, guaranteed by
`UNIQUE(entity_type, entity_id)`" describes the *intent* of the old checkout, not
a constraint that would resist the new one.

## 7. Data model / contracts

| Change | Kind | Carril |
| --- | --- | --- |
| `RoleGrantReason` gains a commerce-listing-created member | enum | schemas |
| `LimitKey` gains `MAX_GASTRONOMIES` and `MAX_EXPERIENCES` | enum — **capability, code wins** | billing config. `RESOURCE_NAMES` in `limit-check.ts` is an exhaustive `Record<LimitKey, string>`, so the compiler demands their Spanish names |
| `product_domain` value `commerce` → `gastronomy` + `experience` | data + config | seed data-migration; only 3 expired subscriptions carry the old value |
| Two new plan catalogues (gastronomy, experience), premium tier only | plan config + seed | code declares the tiers; **values are `'commercial'`, so the DB wins** |
| Two new addons, `limitIncrease: 1`, one per vertical | addon config | mirrors `extra-accommodations-5` |
| `metadata.monthlyPriceArs` mirror removed | 3 write sites + existing rows | `plan.crud.ts:446`, `:601-602`, `billingPlans.seed.ts:449`. **Not** `model-c-field-split.ts` — its entry governs the typed column (§6.9) |
| `complex-*` plans removed; `tourist-plus` / `owner-test-daily` deactivated | seed data-migration | see §6.9 |
| `metadata.hasTrial` → `true` and `metadata.trialDays` → `30` on each vertical's plan (**not** a `trial_days` column) | seed **data** | `packages/seed/src/data-migrations/` — dual-write rule: baseline **and** numbered migration. Copy `0017` / `0051` |
| `commerce_leads` table retired | structural, **deferred one release** | `packages/db/src/migrations/` |
| Existing protected create route loses its `COMMERCE_CREATE` gates | API | `commerce/protected/create.ts:117,186` **and** the services' `_canCreate` — the route is not new (§6.1) |
| **New admin route: moderate a commerce listing** (§6.7) | API | `createAdminRoute`, one per domain, one shared implementation |
| Removed admin route: `approve-and-provision` | API | — |
| Removed public route: `commerce/leads` create | API | — |
| Removed protected route: `commerce/leads/mine` + the form's `prefill` | API + web | `my-lead.ts` (HOS-257) — dies with the table (§6.2) |
| `start-subscription` gains the under-cap and at-cap answers | API | today it always opens a checkout (§6.8) |
| Role gate removed from the commerce **create** page (§6.11) | web | `comercio/nuevo/[vertical].astro:46` — blocking; the index and editor keep theirs |
| `usage-badge.ts` takes the limit key as an argument | web | today `MAX_ACCOMMODATIONS_LIMIT_KEY` is hardcoded at line 33 |
| Addon-page eligibility gate becomes per-domain | web | `addons/index.astro:82-90` resolves the accommodation subscription only |
| Subscription-dashboard domain union becomes three-way | web | `mi-cuenta/suscripcion/index.astro:35` is `'accommodation' \| 'commerce'` |
| `GET /public/plans` gains `?domain=`, filter stops being allow-only-accommodation | API | `listPlans.ts:29-44`; default preserves today's response |
| Two new plans join `ALL_PLANS`' seeding path per domain | plan config | they are excluded twice today, independently (§6.12) |
| `billing.limit.*` + `billing.comparison.limitLabel.*` for both new keys, es/en/pt | i18n | plus `KNOWN_LIMIT_KEYS` in `billing-limit-error.ts:50-57` — code, not just JSON |
| New guard: every `LimitKey` has its i18n entries and its allowlist slot | test | nothing enforces this today (§6.12) |
| Price / benefits / FAQ blocks on both landings | web | they are hero + lead form today, nothing else |
| `commerce_listing_subscriptions.product_domain` rewritten alongside the subscription's | seed data-migration | a **second** column the spec previously missed (§6.13) |
| New migration deleting the 3 orphan commerce subscriptions | seed data-migration | order-independent w.r.t. `0059`; the 5 link rows go by FK cascade |

No new columns. `moderationState`, `visibility`, `lifecycleState` and
`hasActiveSubscription` already exist on both `gastronomies` and `experiences`
and keep their current semantics.

## 8. UX / UI behavior

- The header's publish control offers **three** options — alojamiento,
  gastronomía, experiencia — instead of a single link, on every breakpoint and
  in the mobile menu (§6.10). It no longer vanishes for someone who already
  publishes one of the three.
- Signed-out visitor on either landing → CTA reads as "publicá tu negocio" and
  goes to sign-in with a return URL.
- Signed-in visitor → CTA goes straight to the create form.
- After creating, the person lands in the editor to complete the listing, then
  checks out. The listing becomes visible when the reconciler observes an
  active-or-trialing subscription **and** a complete listing.
- The owner manages everything from the `/mi-cuenta/comercio/` area that already
  exists (§6.11). Its listing index gains a quota reading **per vertical**, and
  its create page stops demanding the very role that creating grants.
- An owner who fills a vertical's quota is offered that vertical's extra-listing
  addon — the other vertical's quota is unaffected and is never shown as spent.
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
  days resolved by `resolveCheckoutFreeTrialDays`, and the resolved value reaches
  **all three** consumers: the MercadoPago plan resolver, the pending
  subscription's `trialGranted`, and the stored trial end. A static guard fails if
  `initiateCommerceMonthlySubscription` reintroduces a literal at any of them —
  `trialDays: 0`, `trialGranted: false`, or a numeric trial-days literal — and
  the guard is scoped to that function so the partner path's identical, deliberate
  literals do not trip it.
- **AC-5** — A listing whose subscription is `trialing` and whose data is
  complete is reconciled to `PUBLIC` / `ACTIVE`.
- **AC-6** — Setting `moderationState = REJECTED` on a published listing
  reconciles it to `PRIVATE` / `INACTIVE` on the next pass, for both domains.
- **AC-7** — A static guard fails CI if a conditional **on behaviour** keyed by
  the vertical appears in the provisioning, checkout, or visibility path. It must
  **not** flag a `Record<domain, …>` lookup, which is how §6.8 resolves the
  per-vertical plan and limit key — the guard forbids taking a different action
  per domain, not reading a different value. This is the machine-checkable form
  of G-2 and is the criterion most likely to erode without one.
  **It must be an AST check, not a `grep` for `if (domain === 'experience')`.**
  Anchoring on one spelling is this repo's most repeated guard failure, and here
  there are at least six escapes: `==`, the Yoda order `'experience' === domain`,
  a `switch`, a ternary, assigning `domain` to an intermediate variable before
  branching, and branching on `entityType` instead of `domain`. The guard fails
  when a conditional's test transitively depends on the vertical and the branches
  differ in what they *do*; a member read keyed by it is allowed.
  **Verify the guard by mutation**: introduce each of those six forms in turn and
  confirm the guard fails on each. A guard that has only ever been run against
  clean code has not been shown to catch anything.
- **AC-8** — An anonymous request to the create-listing route is rejected by the
  route factory, not by an in-handler check.
- **AC-9** — `grep` finds no remaining reference to `CommerceOwnerProvisioningService`
  or `approveAndProvision` in production source.
- **AC-10** — An admin can reject a published gastronomy listing and a published
  experience listing through a dedicated route, and a non-admin actor cannot.
  Both domains resolve to one implementation.
- **AC-11** — `moderationState` is still stripped from the owner-facing update
  payload; the existing "should strip `moderationState`" test keeps passing
  unchanged.
- **AC-12** — The header publish control renders all three options at every
  breakpoint and inside the mobile menu, and is present for an account that
  already holds `HOST` and for one that already holds `COMMERCE_OWNER`.
- **AC-13** — An owner at their gastronomy cap is refused a second gastronomy
  listing, **and is still allowed an experience listing** — proving the two caps
  count independently rather than sharing one pool.
- **AC-14** — Creating a second listing in a vertical the owner is already
  subscribed to does **not** start a second subscription; it counts against the
  existing one's cap.
- **AC-15** — Buying the vertical's extra-listing addon raises that cap by one
  and leaves the other vertical's cap untouched.
- **AC-16** — An owner who consumed the free trial on gastronomy still receives
  a trial when they later subscribe to experience, because the two are distinct
  MercadoPago preapproval plans. **This splits into two checks that must not be
  confused for each other.** CI can assert only the mechanism: that the two
  checkouts resolve two *different* `preapproval_plan_id`s. That is necessary and
  **not sufficient** — whether MercadoPago actually grants the second trial to the
  same payer is provider behaviour, and the e2e suite's MP stub cannot show it
  (the HOS-522 finding came from a positive control in production, not from a
  test). The second half is a **staging smoke against the real MP sandbox**, filed
  in the checklist per the standing billing rule. Marking AC-16 done on the ID
  comparison alone is the failure this wording exists to prevent.
- **AC-17** — No plan, price or trial value is asserted from the TypeScript
  config alone. Every such assertion reads the database, because those fields
  are classified `'commercial'` and the database wins.
  **Stated honestly: this one is a review criterion, not a predicate.** Nothing
  enforces it continuously, so a later PR can reintroduce the practice unnoticed.
  It is kept because it is the rule that makes the assertions in AC-15, AC-24 and
  AC-29 meaningful, and it is paired with AC-29, which *is* mechanically checkable
  and covers the case that actually bit (a value that reappears after a
  migration). Do not read AC-17 as guarded.
- **AC-18** — A signed-in account holding **no** commerce role can open
  `/mi-cuenta/comercio/nuevo/gastronomy` and submit it. An anonymous visitor on
  the same URL is sent to sign-in with a return URL that lands them back on that
  same vertical's form, not on `/mi-cuenta`.
- **AC-19** — The commerce listing index reports the two verticals' quotas
  **independently**: an owner at their gastronomy cap still reads their
  experience quota as available. The two numbers are never summed.
- **AC-20** — An owner holding a gastronomy subscription and **no** accommodation
  subscription is offered the extra-gastronomies addon on `/mi-cuenta/addons/`,
  not the upgrade CTA.
- **AC-21** — The subscription dashboard resolves `accommodation`, `gastronomy`
  and `experience`, and an owner holding two of them can reach both.
- **AC-22** — `GET /api/v1/public/plans` with no `domain` parameter returns
  exactly what it returns today; with `?domain=gastronomy` it returns that
  vertical's plan and no accommodation plan. No response ever mixes domains.
- **AC-23** — A guard fails CI if any `LimitKey` lacks a
  `billing.limit.<key>.title` or a `billing.comparison.limitLabel.<key>` entry in
  `es`, or is missing from `KNOWN_LIMIT_KEYS` in `billing-limit-error.ts`.
- **AC-24** — Hitting the gastronomy cap shows the gastronomy at-limit copy, not
  the `billing.limit.generic.*` fallback, in all three locales.
- **AC-25** — After the migrations run, no row in `billing_subscriptions` or in
  `commerce_listing_subscriptions` carries `product_domain = 'commerce'`, and the
  two columns agree on every surviving row.
- **AC-26** — The reject action is invocable from the admin panel's gastronomy and
  experience detail routes, not only from the API.
- **AC-27** — A signed-in account with **no** commerce permission receives a 2xx
  from `POST` create-listing for both verticals. Asserted at the route **and**
  against the service predicate directly, because the two gates fail identically
  from the caller's side and a fix to one alone would look like a fix to both.
- **AC-28** — `/suscriptores/planes/comparar/` renders correctly with **zero**
  plans in the `complex` category, which is the state §6.9 leaves it in.
- **AC-29** — After the cleanup, editing **any** plan's price through the admin
  panel does not reintroduce `metadata.monthlyPriceArs` on the edited row, and
  the typed `monthly_price_ars` column plus `billing_prices.unitAmount` still
  receive the new value. Asserted through `updatePlan`, not by reading the seed.
- **AC-30** — The cap is asserted end-to-end: a real request to the commerce
  create route, traversing the middleware stack, with the owner's gastronomy plan
  loaded. A test that calls `checkLimit` with a hand-built context proves nothing,
  because every layer beneath it resolves an unknown key to unlimited.
- **AC-31** — An owner with **no accommodation subscription** is still capped on
  gastronomy. This is the case layer 3 fails open on today, and it is the normal
  case for a commerce-only owner.

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
- **R-6 — The cap can ship not working, and look fine.** Five layers between the
  seeded `max_gastronomies: 1` and a refused second listing resolve an unknown to
  *unlimited*, none of them raising (§6.8). The failure is not an outage — it is
  giving the product away, discovered by counting rows weeks later. This is why
  AC-30 insists on an end-to-end assertion and why AC-13 alone is insufficient.

- **R-5 — Nobody is watching, and that is not solved here.** §6.7 gives an admin
  the *ability* to reject a listing. Nothing gives them the *signal* that one
  needs rejecting: there is no report path (verified — the search returns
  nothing) and no queue. Today an admin sees every applicant before a listing
  exists; afterwards, a bad listing surfaces only if somebody happens to look.
  Accepting this is part of accepting reactive moderation, and it is the one
  risk this spec mitigates but does not remove.

## 11. Open questions

- **OQ-1 — RESOLVED (2026-08-19).** *Is there a moderation queue or report path
  for published commerce listings?* **No, and there is not even a reject
  action.** Verified: no report/flag path exists anywhere; `moderate()` is
  implemented for posts, accommodations, comments, events and reviews but not
  for commerce listings; and the write schemas deliberately strip
  `moderationState`. Building the reject action moved **into scope** as §6.7.
  Discovering *which* listing to reject stays out of scope — see R-5.
- **OQ-2 — RESOLVED (2026-08-19).** *What happens to the `commerce_leads` rows
  still pending?* **Nothing — there are none.** Production holds **3 rows, all
  `approved`**, created between 2026-08-13 and 2026-08-19. Nobody is waiting on
  a decision, so retiring the flow strands no applicant.
- **OQ-3 — RESOLVED by §6.8 (2026-08-19).** *Does commerce need a precheck?*
  **Yes, and it is the accommodation one.** The first answer was no — a precheck
  exists to report remaining quota, and commerce had none. Introducing
  `MAX_GASTRONOMIES` / `MAX_EXPERIENCES` creates exactly the quota that made the
  precheck worth building, so the six decisions of `deriveOnboardingDecision`
  (`apps/api/src/services/onboarding-precheck.ts:18-24`) map straight across,
  parameterised by vertical.
  Two properties of the original must survive: it stays **read-only** — the real
  limit is enforced by middleware on the create route, never by the precheck —
  and it **fails open** to `create_direct`, so a precheck outage cannot block a
  legitimate creation.
- **OQ-4 — RESOLVED (2026-08-19).** *How many trial days?* **30**, matching all
  five accommodation plans. One rule platform-wide; a second number would have
  to be carried through copy, emails and the plans page.

## 12. Implementation notes

- The doc comment on `ReconcileCommerceListingVisibilityInput.entityType`
  (*"current values: `'gastronomy'`"*) is **stale** — `experience` has been
  wired since `resolveCommerceEntityModel` gained its second case. Fix it in
  this work; a comment that understates coverage is how a future reader
  concludes a domain is unsupported and builds a second path.
- Order of work matters twice:
  - §6.1 (grant at creation) must land **before** §6.2 (delete provisioning), or
    there is a window with no way to become a commerce owner at all.
  - §6.7 (the reject action) must land **before or with** the removal of the
    approval gate, never after. Between those two points commerce would have no
    control in either direction.
  - The vocabulary widening (§13, release A) lands **before** any row carries a
    new `product_domain` value. Reversing that order makes the code revert the
    outage.
- One thing is not an order but an **atomicity** requirement: the three gates on
  the create path (§6.1's `requiredPermissions` and `_canCreate`, §6.11's page
  guard) open in **one** change. Opening two of three leaves the flow exactly as
  broken while looking fixed, and the remaining failure surfaces as a different
  error at a different layer, which reads as a new bug rather than the same one.
- The `commerce_leads` drop ships one release **after** the code stops writing
  to it. Drizzle projects an explicit column list, so a live container reading a
  dropped column 500s until the new image serves — measured at 8 minutes of
  404s on the accommodation catalogue (HOS-601).

## 13. Rollback

### There is no rollback mechanism. In either carril

Verified, not assumed:

- A seed data-migration is `{ meta, up }` and nothing else
  (`packages/seed/src/data-migrations/types.ts:350-360`). There is no `down` in
  the interface and no revert path in the runner.
- `seed_migrations` is append-only: `ledger.ts:112-129` exposes a read and an
  insert, and the schema file states the rows are "inserted once… and never
  mutated".
- `packages/db/CLAUDE.md` says it outright for the structural carril:
  *"Migrations are forward-only - no rollback support."* drizzle-kit generates no
  down files here, and the two filenames matching `*down*` are `markdown`.
- `hops db-seed-migrate` has `--status` and `--allow-destructive`. It has no
  revert flag.

The repository's actual convention is to **author a new forward migration whose
`up()` undoes the earlier one** — precedent `0024-restore-example-data-nonprod.ts:124`
("reverts the un-gated 0023 soft-delete") and `0011_restrip…` correcting
`0008_strip…`.

So a rollback plan here is not "how do we revert". It is: **make the code
revertible, and write the undo before it is needed.**

### The code revert is the outage, unless it ships in two releases

`isCommerceSubscription` (`subscription-product-domain.ts:120-126`) is fail-closed
on `productDomain === 'commerce'` **exactly**. If one release both widens the
vocabulary and rewrites the rows, then reverting that release lands on code whose
predicate returns `false` for every commerce subscription — the reconciler stops
seeing them as commerce, and every commerce listing goes dark. The revert would
cause the incident it was meant to end.

Split it, exactly as §6.3 splits the `commerce_leads` drop and for the same
reason (F-03 / HOS-601):

| Release | Contains | Revertible to |
| --- | --- | --- |
| **A** | Code only: every exact match on `'commerce'` widened to accept `commerce \| gastronomy \| experience`. No row changes. | trivially — it is a no-op while no row carries the new values |
| **B** | The data rewrite (§6.13) and the rest of this spec. | A, which understands **both** vocabularies |
| **C** | Retire `commerce` from `ProductDomainEnum`, narrow the predicates back, drop `commerce_leads`. | not revertible past B — ship it only once B has soaked |

`isAccommodationSubscription` must be widened in the same pass. Both predicates
matter: `listPlans.ts`'s filter, the reconciler and `loadEntitlements` all read
one of them.

### The undo migration, written up front

Committed alongside the forward one, not improvised during an incident:

- It maps `gastronomy` / `experience` back to `commerce` on **both**
  `billing_subscriptions.product_domain` and
  `commerce_listing_subscriptions.product_domain` (§6.13 — two columns, one
  purchase).
- It is bounded by `created_at < (select applied_at from seed_migrations where
  name = '<the forward migration>')`. Every row carrying the new values at the
  moment B applies is one B created, because those values did not exist before;
  a row created *after* B is a real sale, and folding it back to `commerce` would
  put a live owner on the wrong vertical's cap.
- It **never writes `NULL`**. `isAccommodationSubscription` treats `null` and
  `undefined` as accommodation (`subscription-product-domain.ts:77-95`), so a
  nulled column is the one value that leaks a commerce subscription into a host's
  entitlement set — the exact thing SPEC-239 exists to prevent. Every other
  unrecognised value fails closed in both domains, which makes the failure mode of
  a botched rewrite **a dark listing, never a granted entitlement**.

### Three things this plan cannot undo, and what follows

- **MercadoPago preapproval plans.** `resolveCheckoutMpPlanId` provisions a plan
  per `(commercial plan, amount, interval, trialDays)`, so enabling the trial
  mints a *new* MP plan and anyone already subscribed stays on the old one. No
  local migration moves them. **This is why the whole change ships before anyone
  can buy**: §6.13 counts zero live commerce subscriptions today, and §6.8 already
  makes the point that it will never be this cheap again.
- **Role grants.** `grantRole` has no ungrant in this flow, so a reverted release
  leaves accounts holding `COMMERCE_OWNER`. Harmless — multi-role shipped, and the
  role by itself publishes nothing — but one-way.
- **The `commerce_leads` drop.** Deferred to release C by §6.3 and irreversible
  once applied. It is last for that reason, and nothing else in this spec may be
  sequenced behind it.

### The rehearsal

Both migrations — forward and undo — run against staging first, which per §6.13
is the only environment with rows that are not the three seed fixtures. The
sequence rehearsed is forward → verify AC-25 → undo → verify the rows read
`commerce` again → forward. `hops db-seed-migrate --target=staging --status`
before each step; it applies nothing and is the only read-only view of the ledger.

## 14. Linear

Canonical tracking:

- **HOS-589** — this spec's primary issue (the gate and provisioning).
- **HOS-590** — the free trial (§6.4). Tracked separately, specified here.

Related: HOS-296 (multi-role, shipped — the precondition), HOS-166 (commerce
self-checkout, shipped), HOS-305 (the copy this invalidates), HOS-679 (the
canonical-helper-drift family §6.4 avoids joining), HOS-597 (the refund bug on
R-2's critical path), HOS-522 (the MercadoPago per-payer trial).

### This is an epic. Proposed split

Ten design sections in one pull request cannot be reviewed, and §13 requires the
work to arrive in three releases regardless. The split below is ordered by the
constraints already established — §12's two hard orders and §13's release
boundaries — not by convenience. HOS-589 becomes the parent; HOS-590 is issue 5.

| # | Issue | Covers | Blocked by | Release |
| --- | --- | --- | --- | --- |
| 1 | Widen the domain vocabulary | `ProductDomainEnum` gains both verticals; `isAccommodationSubscription` / `isCommerceSubscription` accept all three; `/public/plans` gains `?domain=` | — | **A** |
| 2 | Build `moderate()` for commerce | §6.7 · AC-10, AC-11, AC-26 | — | B |
| 3 | Grant the role at creation, and unblock the create page | §6.1 + §6.11's blocking gate · AC-1, AC-2, AC-3, AC-8, AC-18 | — | B |
| 4 | The per-vertical billing model | §6.8 · three limit keys, two catalogues, two addons, the precheck (OQ-3), the parameterised entitlement predicate · AC-13, AC-14, AC-15 | 1 | B |
| 5 | The free trial (**HOS-590**) | §6.4 · AC-4, AC-5, AC-16 | 4 | B |
| 6 | The owner's management surface | §6.11's remainder · AC-19, AC-20, AC-21 | 4 | B |
| 7 | The sales surface and its strings | §6.12 · AC-22, AC-23, AC-24 | 4 | B |
| 8 | The three-way publish CTA | §6.10 · AC-12 | 3 | B |
| 9 | Data migrations and plan-catalogue cleanup | §6.9 + §6.13 + the undo migration · AC-25 | 1, 4 | B |
| 10 | Delete the provisioning path | §6.2 + the lead route + the HOS-305 copy · AC-9 | **2, 3** | B |
| 11 | Contract | retire `commerce` from the enum, narrow the predicates, drop `commerce_leads` · §6.3, §13 release C | all | **C** |

Issue 10's two blockers are §12's two hard orders, encoded so the board enforces
them instead of a reader remembering them: the role must be grantable (3) and the
listing must be rejectable (2) before the approval path is removed. Issues 5, 6, 7
and 9 are independent of each other and can run in parallel once 4 lands.

Issue 1 is deliberately inert — it changes no row and no answer — which is what
makes it safe to merge and soak ahead of everything else.

### Smoke gates

HOS-589 carries `status-needs-smoke-staging` and, because issues 4, 5 and 9 touch
the billing core, `status-needs-smoke-prod`. Neither may be removed, and the
issue may not be marked Done, until the corresponding sections of the staging and
prod smoke checklists are signed off.
