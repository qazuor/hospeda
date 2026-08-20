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
- **G-2** — Gastronomy and experience follow **byte-identical** logic. No
  `if (domain === …)` is introduced anywhere in the provisioning, checkout,
  or publish path.
- **G-3** — `commerce-listing` carries a free trial resolved by the **same**
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

**There is no `trial_days` column.** The value lives in
`billing_plans.metadata` as **two** fields — `metadata.trialDays` and
`metadata.hasTrial` — and both are classified `'commercial'`, so the database
wins and a `.ts` edit alone moves nothing. Migrations `0017` and `0051` already
did exactly this for the tourist plans and are the pattern to copy.

Each vertical's enabled plan gets `hasTrial: true` and `trialDays: 30`, matching
all five accommodation plans (owner tiers and tourist-vip alike).

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

#### Naming stays

The shared machinery keeps its `commerce_*` names — the link table, the
visibility reconciler, the listing services. Those cover both verticals and are
parameterised by domain; splitting the **billing** domain is not a reason to
rename working code, and a rename cascade would bury the change that matters.

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

**`metadata.monthlyPriceArs` is removed entirely** — from
`model-c-field-split.ts`, from the seed baseline, and from existing rows via a
data-migration. Verified safe: nothing reads it at runtime, because HOS-39
promoted that value to a typed column. The stale `$5.000` it still carries for
`commerce-listing` (against the real `$15.000`) is exactly the kind of
contradiction a dead field accumulates.

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

## 7. Data model / contracts

| Change | Kind | Carril |
| --- | --- | --- |
| `RoleGrantReason` gains a commerce-listing-created member | enum | schemas |
| `LimitKey` gains `MAX_GASTRONOMIES` and `MAX_EXPERIENCES` | enum — **capability, code wins** | billing config. `RESOURCE_NAMES` in `limit-check.ts` is an exhaustive `Record<LimitKey, string>`, so the compiler demands their Spanish names |
| `product_domain` value `commerce` → `gastronomy` + `experience` | data + config | seed data-migration; only 3 expired subscriptions carry the old value |
| Two new plan catalogues (gastronomy, experience), premium tier only | plan config + seed | code declares the tiers; **values are `'commercial'`, so the DB wins** |
| Two new addons, `limitIncrease: 1`, one per vertical | addon config | mirrors `extra-accommodations-5` |
| `metadata.monthlyPriceArs` removed | field-split + seed + existing rows | verified unread at runtime |
| `complex-*` plans removed; `tourist-plus` / `owner-test-daily` deactivated | seed data-migration | see §6.9 |
| `metadata.hasTrial` → `true` and `metadata.trialDays` → `30` on each vertical's plan (**not** a `trial_days` column) | seed **data** | `packages/seed/src/data-migrations/` — dual-write rule: baseline **and** numbered migration. Copy `0017` / `0051` |
| `commerce_leads` table retired | structural, **deferred one release** | `packages/db/src/migrations/` |
| New protected route: create commerce listing | API | `createProtectedRoute` |
| **New admin route: moderate a commerce listing** (§6.7) | API | `createAdminRoute`, one per domain, one shared implementation |
| Removed admin route: `approve-and-provision` | API | — |
| Removed public route: `commerce/leads` create | API | — |

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
  MercadoPago preapproval plans.
- **AC-17** — No plan, price or trial value is asserted from the TypeScript
  config alone. Every such assertion reads the database, because those fields
  are classified `'commercial'` and the database wins.

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
