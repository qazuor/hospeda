---
title: Commerce self-checkout — the owner completes and pays for their own listing
linear: HOS-166
statusSource: linear
created: 2026-07-15
type: feature
areas:
  - billing
  - api
  - web
---

# HOS-166 — Commerce self-checkout

## 1. Summary

Today a commerce listing (gastronomy / experience) only reaches the public site
if an admin does **everything**: approves the lead, creates the listing, assigns
the owner, and starts the subscription on the owner's behalf from the admin
panel. The owner is a passenger.

This spec moves the whole post-approval journey to the owner. The admin's job
shrinks to exactly one action — **approve the lead** — which creates the user and
nothing else. From there:

```
lead → admin approves (creates ONLY the user + credentials email)
     → owner logs in
     → owner changes password (forced)
     → owner completes their profile
     → owner CREATES and fills their OWN listing (DRAFT / hidden)
     → owner hits publish
     → owner PAYS
     → listing goes live
```

Scope is **gastronomy + experience only** (D-5).

## 2. Problem

Three concrete gaps, all verified against the current code:

1. **There is no owner-facing checkout.** `apps/api/src/routes/commerce/` contains
   only `admin/` and `public/` directories — **no `protected/` tier exists**. The
   only way to start a commerce subscription is
   `apps/api/src/routes/commerce/admin/start-subscription.ts:144`, built with
   `createAdminRoute` and gated on `PermissionEnum.COMMERCE_EDIT_ALL`
   (`start-subscription.ts:151`). An owner can never call it.
2. **There is no owner-facing listing creation.** The owner web surface
   (`apps/web/src/pages/[lang]/mi-cuenta/comercio/`) has exactly two pages —
   `index.astro` and `[vertical]/[id]/editar.astro`. There is no create page, and
   the empty state literally instructs the owner to wait for staff:
   `"Todavía no tenés comercios asignados. Un administrador debe crear tu ficha."`
   (`packages/i18n/src/locales/es/commerce.json:52`, rendered at
   `index.astro:51`).
3. **The lead and the listing are not connected at all.** `approve-and-provision`
   creates only the user (`apps/api/src/routes/commerce/admin/approve-and-provision.ts:115-123`).
   The listing is created by a completely disconnected admin action
   (`POST /admin/gastronomies` + `POST /:id/assign-owner`). No FK, no
   orchestration.

The business cost: every single commerce listing requires manual staff work end
to end, which does not scale and makes "gastronomy goes self-service" a rewrite
rather than a deletion.

## 3. Goals

- **G-1** — The owner creates, fills, and publishes their own listing without
  staff involvement after lead approval.
- **G-2** — The owner pays for their own subscription through a protected,
  owner-scoped checkout route that mirrors the accommodation `start-paid` flow.
- **G-3** — A listing becomes publicly visible only when it is **paid AND
  complete**. A paid-but-empty listing must never reach the public site.
- **G-4** — Nothing downstream of lead approval reads `commerce_leads`. The lead
  is a door, not a dependency (D-4 — see §6.1).
- **G-5** — The admin retains full reactive control (can hide/unpublish any
  listing at any time via the existing `visibility` / `lifecycleState` fields).

## 4. Non-goals

- **NG-1 — No proactive moderation.** Resolved by the owner (OQ-1, Linear comment
  2026-07-15): a completed listing goes live directly. No moderation queue, no
  pending-moderation state machine, no admin review UI, no owner notification.
  See §6.5 for the cheap seam left open.
- **NG-2 — No trial.** `COMMERCE_LISTING_PLAN.hasTrial` is `false`
  (`packages/billing/src/config/plans.config.ts:544`). Card-first trials are
  HOS-171's problem. This spec must not depend on HOS-171 landing, and must not
  block on it (D-6).
- **NG-3 — No plan picker.** One plan, binary billing (D-7). See §6.4.
- **NG-4 — No multi-domain entitlement refactor.** SPEC-239 decision #3 stands.
- **NG-5 — No changes to `reconcileCommerceListingVisibility`'s trigger sites.**
  The three existing callers stay as they are (see §6.5).
- **NG-6 — Editor / proveedores / partner / sponsor are out of scope.** See §4.1.
- **NG-7 — The admin route is not deleted.** `admin/start-subscription.ts` stays
  as a staff escape hatch (support case: owner cannot pay, staff pays for them).
  It is not the path this spec builds on.

### 4.1 Why the other verticals are excluded (D-5)

| Vertical | Status | Why not here |
|---|---|---|
| **Editor / proveedores** (`host_trades`, `/mi-cuenta/directorio-proveedores/`) | Different pipeline | They **apply**; staff does the rest. No billing, no listing of their own, no checkout. Nothing in this spec applies. |
| **Partner** | Shipped and working (tables, service, `/partners`, billing `send-link`, expiry cron) | Has **no user role, by design** — a partner is a brand, not an actor. Self-service would require inventing that role. Its own spec. |
| **Sponsor** | Half-built | Contradicts HOS-38 / HOS-107 (admin-driven assignment, read-only dashboard), has two competing systems and an open scoping bug. Blocked until HOS-107 orders the model. |

## 5. Current baseline

Everything below is verified against the working tree on `spec/HOS-171-billing-docs`.

### 5.1 What already works and must not be touched

| Thing | Location | Note |
|---|---|---|
| `initiateCommerceMonthlySubscription` | `apps/api/src/services/subscription-checkout.service.ts:818-821` | **Already actor-agnostic.** Takes a bare `customerId: string` — no `Actor`, no ownership concept. Stamps `product_domain='commerce'` and upserts the link row in one transaction (`:861-881`). **Needs ZERO changes.** |
| Visibility reconciler | `packages/service-core/src/services/commerce/commerce-visibility.ts:129-186` | Maps `active`/`trialing` → `PUBLIC`/`ACTIVE`, anything else → `PRIVATE`/`INACTIVE` (`:30`, `:136-142`). Idempotent (`:154-163`). |
| Reconciler trigger sites (3) | `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts`, `apps/api/src/cron/jobs/dunning.job.ts`, `apps/api/src/cron/jobs/finalize-cancelled-subs.ts` | All go through `reconcileCommerceListingForSubscription` (`apps/api/src/services/commerce-reconcile.service.ts:72`). |
| Link table | `packages/db/src/schemas/commerce/commerce_listing_subscription.dbschema.ts:53-56` | `uniqueIndex` on `(entity_type, entity_id)` — one link row per listing. |
| `commerce_leads.domain` | `packages/db/src/schemas/commerce/commerce_lead.dbschema.ts:26` | `varchar(50)`, deliberately open — new verticals need no migration. |
| Forced password change | `apps/api/src/routes/index.ts:356` | `mustChangePasswordGate()` on **all** `/api/v1/protected/*`. |

### 5.2 The template to mirror

`apps/api/src/routes/billing/start-paid.ts` is the reference for the new route:

- `createCRUDRoute` (`:430`) — not `createAdminRoute`.
- `customerId` from context, set by `billingCustomerMiddleware`
  (`:116` → `c.get('billingCustomerId')`; middleware at
  `apps/api/src/middlewares/billing-customer.ts:67`, sets it at `:110-114`).
- `idempotencyKeyMiddleware` (`:462`).
- Return URL built against `HOSPEDA_SITE_URL` (`:73`, `:296`).

Web checkout pattern: `apps/web/src/components/billing/PlanPurchaseButton.client.tsx`
+ `checkout-pending.ts` (sessionStorage) + `CheckoutStatusPoller.client.tsx` (HOS-151).

### 5.3 What the admin route does that an owner route must NOT

`apps/api/src/routes/commerce/admin/start-subscription.ts`:

| Line | Admin behavior | Why it is wrong for an owner |
|---|---|---|
| `:144`, `:151` | `createAdminRoute` + `COMMERCE_EDIT_ALL` | Owner has `COMMERCE_EDIT_OWN`, never `COMMERCE_EDIT_ALL`. |
| `:77-120` (`resolveListingOwnerId`) | Resolves `customerId` **from the target listing's `ownerId`** | The owner route must resolve the customer from the **caller**. |
| — | **Never compares `actor.id` against `ownerId`** | Relaxing the permission alone would let any authenticated user pay for **anyone's** listing. The ownership check is a *separate, mandatory* control (see §6.3). |
| `:66-68` | `back_url` → `HOSPEDA_ADMIN_URL` | Owner must return to the site. |

### 5.4 Corrections to the issue's stated premises (verified)

The Linear issue and its "Trabajo técnico" section carry two claims about the
checkout precondition that do not match the code. The **conclusion** (credentials →
change password → *then* pay) is correct and non-negotiable, but the stated
mechanism is wrong, and the wrong mechanism would lead to the wrong implementation.

- ❌ **"`billing_customers` is created by the first-login Better Auth hook"** →
  **FALSE.** It is created in the `user.create.after` **databaseHook** — i.e. at
  user *creation*, not login (`apps/api/src/lib/auth.ts:623-660`, calling
  `syncService.ensureCustomerExists` at `:647`). And the commerce provisioning
  path creates the user through `auth.api.signUpEmail`
  (`apps/api/src/lib/commerce-ports.ts:65`), so that hook **fires at
  approve-and-provision time** — the row generally exists before the owner ever
  logs in.
- ❌ **"without it checkout 422s"** → **FALSE for `start-paid`.** It returns
  **400** `'No billing account found'` (`start-paid.ts:118-122`). The **422** is
  the *admin commerce* route (`admin/start-subscription.ts:180-185`).
- ⚠️ **But the customer row is not guaranteed.** The `ensureCustomerExists` call
  is wrapped in a best-effort `try/catch` that swallows the error and only logs
  (`auth.ts:652-660`). So the row can legitimately be missing.

**The real sequencing constraint** (stronger, and enforced by code, not by
convention): `mustChangePasswordGate()` is applied to **every**
`/api/v1/protected/*` route (`apps/api/src/routes/index.ts:356`), and provisioned
owners are created with `mustChangePassword = true`
(`apps/api/src/lib/commerce-ports.ts:88`). Any protected call from a
freshly-provisioned owner — including *create listing* and *start-subscription* —
returns **403 `PASSWORD_CHANGE_REQUIRED`** (`apps/api/src/middlewares/must-change-password.ts:65`,
`:89`, `:114`) until they change it.

So: the email cannot link straight to payment, and the ordering holds — but
because of the password gate, not because of the billing customer. Consequence
for the design: the new route must **not** assume the customer row exists; it
should `ensureCustomerExists` itself (§6.3), which is what
`apps/api/src/routes/host-onboarding/protected/start.ts` already does.

### 5.5 Other verified baseline facts

- **`COMMERCE_OWNER` cannot create a listing today.** The role grants
  `COMMERCE_EDIT_OWN` but **not** `COMMERCE_CREATE`
  (`packages/seed/src/required/rolePermissions.seed.ts:1053-1056`;
  `COMMERCE_CREATE` exists at `packages/schemas/src/enums/permission.enum.ts:910`).
  This is a hard blocker for D-2 and requires a seed data-migration (§7.4).
- **SPEC-239 decision #5 is codified in a schema.**
  `GastronomyOwnerUpdateInputSchema` (`packages/schemas/src/entities/gastronomy/gastronomy.crud.schema.ts:125-139`)
  picks only operational fields, and its JSDoc explicitly lists
  `name`, `slug`, `description`, `destinationId` as **"NOT permitted for owner
  (admin-only)"** (`:119-123`). This is the exact object D-1 kills.
- **The doors already point at the right routes.** `discovery-doors.ts:137`
  (`publicar-restaurante`) and `:148` (`publicar-experiencia`) — done in HOS-134.
  The only `contacto` hrefs left are the *aliados* door (`:174`, `:185`, `:196`),
  all `comingSoon: true`. **Only the copy is wrong**: `account.json:104` and `:109`
  both read `"Contanos y te contactamos"`, and the code comments at
  `discovery-doors.ts:133-136` / `:146` still assert these are "lead forms, not
  publish flows".
- **The "lead approved → complete and publish" notification does not exist.**
  `LeadNotificationPort` (`commerce-lead.service.ts:55`) is **dead code**: it only
  fires `notifyNewLead` (`:243-245`) and `create-lead.ts` constructs the service
  **without a notifier**, so the `else` branch logs
  `'No notifier configured; skipping ops notification'` (`:257`) on every lead.
- **The credentials email has no payment step.**
  `packages/notifications/src/templates/commerce/commerce-owner-credentials.tsx`
  shows the temp password + a single `Activar mi cuenta` CTA to the
  change-password page (`:63`). Nothing about completing or paying.
- **The commerce plan is isolated from accommodation.**
  `COMMERCE_LISTING_PLAN` (`plans.config.ts:533-551`) is deliberately excluded
  from `ALL_PLANS` (`:511-523`), `hasTrial: false` (`:544`), `entitlements: []` /
  `limits: []` (`:549-550`) — visibility is driven by the link table + reconciler,
  never by the entitlement engine.

## 6. Proposed design

### 6.1 ⭐ D-4 — THE GOLDEN RULE: the lead is a DOOR, not a DEPENDENCY

**This is the single most important constraint in this spec. Read it before
writing any code, and enforce it in review.**

Approving a lead does **exactly two things**:

1. Creates the user.
2. Gives that user the `COMMERCE_OWNER` role.

That is the entire contract. **Nothing downstream may read `commerce_leads`, and
nothing may gate on `lead.status === 'approved'`** in order to complete, publish,
or pay for a listing.

**Why this matters more than it looks.** If any downstream step consults the
lead, the admin becomes structurally welded into the flow forever. Respecting the
rule, the day gastronomy goes 100% self-service the change is a *deletion*:
registration creates the `COMMERCE_OWNER` directly, the approval step is removed,
and **nothing below it is touched**. Violate the rule and that day becomes a
rewrite.

**Lead data PRE-FILLS. It never CONDITIONS.** The create form may be pre-populated
from the lead (`businessName` → `name`, `destinationId`, `contactName`, `email`,
`phone`) as a **convenience**. An owner with no lead at all — or a lead in any
status — must be able to complete the exact same flow by typing the data in.

#### Anti-patterns to reject in review

Any of these means the PR is wrong, regardless of whether tests pass:

| ❌ Anti-pattern | Why it's fatal |
|---|---|
| `if (lead.status !== 'approved') throw ...` in the create-listing service | Welds the admin in. This is the rule, verbatim inverted. |
| A `leadId` FK on `gastronomies` / `experiences` | Makes the listing structurally require a lead. |
| Checkout resolving the plan/price/entitlement via the lead | Billing must never know leads exist. |
| The reconciler reading `commerce_leads` | Visibility must derive from subscription + completeness only. |
| The create form 404ing / erroring when no lead exists | Pre-fill must degrade to an empty form, silently. |
| `CommerceLeadService` imported anywhere in the create/publish/pay path | The import itself is the smell — grep for it. |
| Deriving `COMMERCE_OWNER` authority from the lead rather than from the role | The role is the only durable authority. |

**Positive contract:** the create/complete/publish/pay path knows about exactly
three things — the **actor**, the **role** (`COMMERCE_OWNER` + `COMMERCE_CREATE` /
`COMMERCE_EDIT_OWN`), and the **listing**. It has never heard of a lead.

**Enforcement (test, not vibes):** a static guard test asserts that no file under
the create/publish/checkout path imports `CommerceLeadService` or references
`commerce_leads`. Cheap to write, and it makes the rule survive the next
contributor who has not read this document. See AC-14.

### 6.2 D-1 — SPEC-239 decision #5 is deliberately REVERSED

> **SPEC-239 decision #5 (dead as of this spec):** *"Owner edits operational only:
> schedule, contact, social, media, menu, short description. **Admin controls
> identity/core**: name, slug, summary/description, location, destination, `type`,
> subscription data, lifecycle/visibility/moderation, featured."*

**This is now false. The owner loads their own identity** — name, slug,
description, location, destination.

**This is a deliberate reversal, NOT an oversight. Do not "restore" it.**

**The reasoning:** SPEC-239's decision #5 was coherent *only* under its decision
#1 (`admin-sells-and-creates`) — if the admin creates the listing anyway, the
admin may as well own the identity fields. This spec removes decision #1's
premise. Once the admin's only action is approving a lead, **somebody has to type
the identity in**, and the lead carries only `businessName` / `contactName` /
`email` / `phone` / `destinationId` — nowhere near enough for a public listing
(no summary, no description, no type, no hours, no media). The only remaining
candidate is the owner.

**What survives from decision #5:** the admin keeps `lifecycle` / `visibility` /
`moderation` / `isFeatured` / `ownerId` — the *control* fields. The reversal is
scoped to **identity**, not to control. G-5 depends on this.

**Concretely:** `GastronomyOwnerUpdateInputSchema`
(`gastronomy.crud.schema.ts:125-139`) must widen to include `name`, `slug`,
`description`, `destinationId`, and its JSDoc "NOT permitted for owner
(admin-only)" list (`:119-123`) must be corrected — that comment is the fossil of
decision #5 and will otherwise mislead the next reader. The equivalent experience
schema gets the same treatment.

> **Slug caveat.** `slug` is owner-settable at *create* time but must stay unique
> and must not become a free rename vector after publish (it is the public URL).
> Recommendation: derive the slug server-side from `name` on create (the
> accommodation precedent), keep it owner-visible, and leave post-publish renames
> to staff. This is the conservative default; see OQ-3.

### 6.3 The new protected checkout route

```
POST /api/v1/protected/commerce/listings/:entityType/:entityId/start-subscription
```

This creates the missing `apps/api/src/routes/commerce/protected/` tier.

| Aspect | Decision | Rationale |
|---|---|---|
| Factory | `createCRUDRoute` | Mirrors `start-paid.ts:430`. **Not** `createAdminRoute`. |
| Permission | `COMMERCE_EDIT_OWN` | The role already has it (`rolePermissions.seed.ts:1056`). |
| **Ownership check** | **`actor.id === listing.ownerId`, else 403** | **Mandatory and independent of the permission.** `COMMERCE_EDIT_OWN` says "may edit *a* listing of their own" — it does not identify *which*. The admin route never makes this comparison (§5.3), so relaxing the permission alone would let any `COMMERCE_OWNER` pay for **any** listing. This check is the whole security boundary. |
| `customerId` | From `billingCustomerMiddleware` — **the CALLER** | Never `resolveListingOwnerId`. The caller pays for themselves, full stop. |
| Missing customer | `ensureCustomerExists({userId: actor.id, email, name})`, then proceed | Per §5.4 the row is best-effort. Self-heal rather than 400 — precedent: `host-onboarding/protected/start.ts`. Only error if creation itself fails. |
| Return URL | `HOSPEDA_SITE_URL` + locale + commerce success path | Never `HOSPEDA_ADMIN_URL`. Mirrors `start-paid.ts:73`. |
| Idempotency | `idempotencyKeyMiddleware({operation: 'hospeda.commerce_start_subscription'})` | Mirrors `start-paid.ts:462`. Double-click must not double-charge. |
| **Completeness gate** | **422 if the listing is not complete** | G-3's first line of defense. Never sell a subscription for a listing that cannot legally go live. |
| Already subscribed | 409 if an `active`/`trialing` link row exists | The unique index (`commerce_listing_subscription.dbschema.ts:53-56`) enforces one link row; fail loudly rather than silently overwrite a paying subscription. |
| Service call | `initiateCommerceMonthlySubscription({customerId, planSlug, entityType, entityId, billing, urls})` | **Unchanged** (§5.1). |

**Middleware order:** `auth → actor → mustChangePasswordGate (global, routes/index.ts:356)
→ billing → billingCustomer → idempotencyKey → handler`.

### 6.4 D-7 — Plan resolution: one plan, no picker, no hardcoded slug

Commerce billing is binary: one plan (`commerce-listing`,
`product_domain='commerce'`). The owner hits **publish** and goes to the only plan
that applies. **There is no plan picker** — building one would be inventing a
choice that does not exist.

**But do not hardcode the slug in the checkout route.** Route it through:

```ts
resolveCommercePlanSlug({ entityType }: { entityType: CommerceEntityType }): string
```

Today it returns a constant for both verticals (reading
`env.HOSPEDA_COMMERCE_PLAN_ID` exactly as `admin/start-subscription.ts:163` does,
with the same 503 when unset). ~10 lines. It is **cheap insurance**, not
speculation: it gives a single, greppable, test-covered seam for the day pricing
diverges by vertical, instead of a slug literal smeared across route + web +
tests.

**Why not go further and build N plans with capabilities now?** Because
differentiated plans (plus/vip with different *capabilities*) require the
multi-domain entitlement refactor SPEC-239 explicitly avoided (decision #3): the
entitlement engine is global-per-customer and accommodation-keyed, and
`loadEntitlements()` filters to `product_domain = 'accommodation'`. Commerce
capabilities would have to flow through that engine, which means refactoring it —
a large, risky change whose cost buys nothing today, since `COMMERCE_LISTING_PLAN`
ships with `entitlements: []` / `limits: []` (`plans.config.ts:549-550`) precisely
because commerce visibility is decided by the link table, not by entitlements.
**YAGNI** — pay it the day a second commerce plan actually exists.

### 6.5 G-3 — Visibility is now "paid AND complete"

**The reconciler's trigger sites do not change** (NG-5) and neither does its
transition table's *shape*. What changes is the predicate.

Today (`commerce-visibility.ts:136-142`):

```
isActive = status ∈ {active, trialing}
desired  = isActive ? PUBLIC/ACTIVE : PRIVATE/INACTIVE
```

Problem: subscription status is the **only** input. An owner who somehow pays for
an empty listing gets it published by the webhook. The completeness gate on the
checkout route (§6.3) makes that hard, but the reconciler also fires from the
dunning cron and finalize-cancelled-subs, and it is the **last** thing standing
between a paid row and the public site. Defense in depth belongs here.

New predicate:

```
shouldBePublic = subscriptionActive AND listingComplete AND NOT moderationRejected
```

**Implementation shape.** `CommerceEntityModel.findById`
(`commerce-visibility.ts:75-79`) currently returns only
`{id, visibility, lifecycleState}`. Rather than widening that structural contract
(which every implementer must then satisfy), inject a resolver alongside the
model:

```ts
interface ReconcileInput {
  entityType: string;
  entityId: string;
  subscriptionStatus: string;
  tx?: DrizzleClient;
  /** Resolves publish-readiness. Returns { complete, missing }. */
  resolveCompleteness: (entityId: string, tx?: DrizzleClient) =>
    Promise<{ complete: boolean; missing: readonly string[] }>;
}
```

wired in `apps/api/src/services/commerce-reconcile.service.ts` next to the
existing `resolveCommerceEntityModel` (`:41`). The reconciler stays idempotent
(`:154-163`) and keeps its "write only on change" behavior.

**Incomplete + paid ⇒ stays PRIVATE**, and logs loudly with `missing` — that is a
money-taken-nothing-delivered state and must be visible in logs, not silent.

**The moderation seam (OQ-1 / NG-1).** Owner resolved: **no proactive
moderation** — the admin filtered at the lead, there is a real card behind it, and
the admin can pull a listing reactively at any time. So **no machinery is built**.

But the seam is free, and the owner explicitly asked to leave the door open: the
entity **already carries `moderationState`** (`...BaseModerationFields`, spread at
`gastronomy.schema.ts:80`). The reconciler simply **reads** it and treats anything
other than `REJECTED` as publishable — with `APPROVED` as the default. That costs
one condition today and means that if a vertical later turns out to need review
(experiences is the likely candidate — a restaurant is a verifiable physical
place, an "experience" is amorphous), turning it on is a **config flag**, not an
architecture change. Building the queue/UI/notifications is the expensive part and
is explicitly not done.

### 6.6 The "complete" contract

**This is real design work and the most likely place to get it wrong.**
"Complete" cannot mean "passes the Create schema" — the create schema is
deliberately permissive: `slug`, `ownerId` and **`destinationId` are all
`.optional()`** (`gastronomy.crud.schema.ts:46-54`). A listing that satisfies
Create can still be unpublishable garbage.

So completeness is a **separate, explicit publish-readiness contract**, defined
per vertical and evaluated by a pure function:

```ts
resolveListingCompleteness({ entityType, listing }): { complete: boolean; missing: readonly string[] }
```

**Required for publish — shared (both verticals):**

| Field | Rule | Why |
|---|---|---|
| `name` | non-empty | It is the listing. |
| `summary` | non-empty, ≥ min length | Renders in cards/lists. |
| `description` | non-empty, ≥ min length | Renders on the detail page. |
| `destinationId` | non-null | Optional at create (`:54`); without it the listing is unreachable by browse/filter. |
| `ownerId` | non-null | Ownership + billing anchor. |
| `type` | non-null | Drives filtering and the public taxonomy. |
| `media.featuredImage` | present | A listing with no image is not a listing. |
| `contactInfo` | ≥ 1 reachable channel (phone **or** email) | The entire point is being contactable. |

**Required for publish — gastronomy-specific:**

| Field | Rule |
|---|---|
| `openingHours` | ≥ 1 day with ≥ 1 shift defined |
| `priceRange` | non-null |

**Deliberately NOT required:** `menuUrl`, `richDescription`, `socialNetworks`,
`amenityIds`, `featureIds`, gallery beyond the featured image, SEO fields, i18n
variants. These are quality, not viability — gating on them would block owners
from ever paying, which is the opposite of this spec's goal.

> Experience-specific required fields are left to the implementer to mirror from
> the experience schema (this spec does not enumerate them — **unverified**, the
> experience entity's field set was not audited for this document). The shared
> block above is binding for both.

**Where it lives:** `packages/service-core/src/services/commerce/commerce-completeness.ts`,
pure, no DB access, unit-testable, consumed by **three** callers so the definition
never forks:

1. The protected checkout route (§6.3) — 422 with `missing`.
2. The reconciler (§6.5) — keeps it PRIVATE.
3. The web owner surface (§8) — renders the "what's missing" checklist.

One definition, three consumers. A second definition anywhere is a bug.

## 7. Data model / contracts

### 7.1 New endpoint

```
POST /api/v1/protected/commerce/listings/:entityType/:entityId/start-subscription
```

- **Params:** `entityType: z.enum(['gastronomy','experience'])`, `entityId: uuid`
  (mirrors `admin/start-subscription.ts:41-48`).
- **Body:** none.
- **Response:** `StartPaidSubscriptionResponseSchema` (reused verbatim) —
  `{ checkoutUrl, localSubscriptionId, expiresAt }`.
- **Status codes:**

| Code | Condition |
|---|---|
| `201` | Preapproval created; `checkoutUrl` returned. |
| `403` | `PASSWORD_CHANGE_REQUIRED` (global gate, `routes/index.ts:356`). |
| `403` | Caller lacks `COMMERCE_EDIT_OWN`, **or** `actor.id !== listing.ownerId`. |
| `404` | Listing not found. |
| `409` | An `active`/`trialing` subscription already exists for this listing. |
| `422` | Listing incomplete — body carries `missing: string[]`. |
| `503` | Billing unavailable, or `HOSPEDA_COMMERCE_PLAN_ID` unset (mirrors `admin/start-subscription.ts:164-169`). |

### 7.2 Owner listing creation (protected)

A protected create endpoint per vertical (or one generic commerce create),
gated on `COMMERCE_CREATE`, which **forces `ownerId = actor.id`** server-side —
never accepts it from the body. Pre-fill is a **web-layer** concern (§8); the API
takes plain listing data and has never heard of a lead (§6.1).

Created listings start `visibility: PRIVATE`, `lifecycleState: DRAFT`/`INACTIVE`
(D-3: complete first, pay after).

> **Quota.** Nothing currently caps how many listings one `COMMERCE_OWNER` may
> create, and creation is now self-service and free until publish. Since billing
> is per-listing (the link table is unique per entity), N draft listings cost
> nothing and each needs its own subscription to go live — so this is not a
> revenue leak, but it is an abuse surface (DB rows). Recommendation: no cap in
> v1, revisit if abused. Flagged rather than silently ignored.

### 7.3 Schema changes

- `GastronomyOwnerUpdateInputSchema` (`gastronomy.crud.schema.ts:125-139`) —
  widen with `name`, `slug`, `description`, `destinationId`; correct the JSDoc at
  `:119-123` (D-1, §6.2). Same for the experience equivalent.
- New: `CommerceListingCompletenessSchema` → `{ complete: boolean; missing: string[] }`.

### 7.4 Migrations

**Seed data-migration (MANDATORY — dual-write rule).** `COMMERCE_OWNER` lacks
`COMMERCE_CREATE` (`rolePermissions.seed.ts:1053-1056`). Per the project's seed
dual-write rule, the same PR must do **both**:

1. **Baseline** — add `PermissionEnum.COMMERCE_CREATE` to the `COMMERCE_OWNER`
   array in `packages/seed/src/required/rolePermissions.seed.ts` (so a fresh DB is
   built correct).
2. **Data-migration** — `pnpm db:seed:make grant-commerce-create-to-commerce-owner`
   (so already-seeded staging/prod receive the same delta).

Editing only the baseline is a silent bug: fresh DBs work, staging/prod owners get
403 on create forever. The CI drift guard enforces this.

**No structural (Carril 1) migration is expected.** No new tables, no new columns
— `moderationState` already exists on the entity (`gastronomy.schema.ts:80`),
`commerce_leads.domain` is already open (`commerce_lead.dbschema.ts:26`), and the
link table already has its unique index.

### 7.5 Notifications

- **Rework** `commerce-owner-credentials.tsx` — today it ends at
  `Activar mi cuenta` → change-password (`:63`). It must present the full path:
  *credentials → change password → complete your listing → publish → pay*. It must
  **not** link straight to payment (§5.4 — the protected route 403s until the
  password changes).
- **New** "lead approved → complete and publish" notification. Note the existing
  `LeadNotificationPort` (`commerce-lead.service.ts:55`) is **dead** — it only has
  `notifyNewLead` (`:243-245`) and `create-lead.ts` never injects a notifier
  (`:257` logs the skip on every lead). Either revive it properly or wire the new
  notification through the provisioning path, which already has a live notifier
  port (`approve-and-provision.ts:108-113`). Do not extend dead code by accident.

### 7.6 i18n (es / en / pt)

| File | Change |
|---|---|
| `account.json` | `:104`, `:109` — replace `"Contanos y te contactamos"` with publish/pay framing. Also the `description` at `:103`, `:108` ("contanos sobre tu local y te contactamos para publicarlo"). |
| `commerce.json` | `:52` — replace `"Un administrador debe crear tu ficha."` with a create CTA. New keys: create form, completeness checklist + per-field `missing` labels, draft / pending-payment states, publish CTA. |
| `billing.json` | Commerce checkout copy, success/pending states, 409/422 errors. |

Also update the now-false code comments at `discovery-doors.ts:133-136` and `:146`
("these are LEAD forms, not publish flows") — they will actively mislead.

## 8. UX / UI behavior

**Doors** (`apps/web/src/config/discovery-doors.ts`) — routing is already correct
(`:137`, `:148`); **only copy changes** (§7.6).

**`/mi-cuenta/comercio/`** — the owner surface, which today has **zero references
to billing or subscription**:

1. **Empty state** → a **create** CTA, not "wait for an admin" (`commerce.json:52`).
2. **Create page** (new) — pre-filled from the lead when one exists, **empty and
   fully usable when it does not** (§6.1). Submits as DRAFT.
3. **Editor** (existing `[vertical]/[id]/editar.astro`) — widened for identity
   fields (D-1, §6.2).
4. **Completeness checklist** — driven by `resolveListingCompleteness`'s `missing`
   (§6.6). The publish CTA is **disabled while incomplete**, with the missing items
   named. Never a bare disabled button.
5. **Publish + pay CTA** — enabled once complete. Mirrors
   `PlanPurchaseButton.client.tsx` + `checkout-pending.ts` (sessionStorage) +
   `CheckoutStatusPoller.client.tsx` (HOS-151 — the poller exists precisely because
   webhook-only activation strands users).
6. **States** — the listing card must distinguish, with context:
   - `DRAFT — incomplete` (what's missing)
   - `DRAFT — complete, not published` (pay CTA)
   - `PENDING PAYMENT` (checkout started, not confirmed — poller active)
   - `PUBLISHED` (link to the public page)
   - `SUSPENDED` (payment lapsed — dunning; recover CTA)

## 9. Acceptance criteria

**Ownership + security**

- **AC-1** — *Given* an authenticated `COMMERCE_OWNER` who owns listing L,
  *when* they POST `/protected/commerce/listings/gastronomy/{L}/start-subscription`
  on a complete L, *then* 201 with a `checkoutUrl`, and the preapproval's customer
  is **the caller's** billing customer.
- **AC-2** — *Given* `COMMERCE_OWNER` A and listing L owned by B, *when* A posts
  start-subscription for L, *then* **403** and no MP preapproval and no
  `commerce_listing_subscriptions` row are created. *(The check the admin route
  never makes — §5.3.)*
- **AC-3** — *Given* a freshly-provisioned owner with `mustChangePassword = true`,
  *when* they call **any** protected commerce route, *then* **403
  `PASSWORD_CHANGE_REQUIRED`**; *and* after changing their password the same call
  succeeds.
- **AC-4** — *Given* an owner whose `billing_customers` row is missing (the
  `auth.ts:652-660` best-effort path failed), *when* they start a subscription,
  *then* the customer is created on the fly and checkout proceeds — no 400/422.

**Completeness (G-3)**

- **AC-5** — *Given* a listing missing `destinationId` (or any §6.6 required
  field), *when* the owner starts a subscription, *then* **422** and the body's
  `missing` array names every missing field.
- **AC-6** — *Given* an incomplete listing that nonetheless has an `active`
  subscription, *when* the reconciler runs from any of its three trigger sites,
  *then* the listing stays `PRIVATE`/`INACTIVE` and a warning naming `missing` is
  logged.
- **AC-7** — *Given* a complete listing, *when* its subscription goes `active`,
  *then* the reconciler flips it to `PUBLIC`/`ACTIVE`.
- **AC-8** — *Given* a complete, published listing, *when* its subscription lapses
  to any non-`active`/`trialing` status, *then* it returns to `PRIVATE`/`INACTIVE`
  and its data is preserved.
- **AC-9** — *Given* a listing with `moderationState = REJECTED` and an `active`
  subscription, *when* the reconciler runs, *then* it stays `PRIVATE`. *(Seam only
  — no moderation UI/queue exists; §6.5.)*

**D-4 — the golden rule**

- **AC-10** — *Given* a `COMMERCE_OWNER` with **no `commerce_leads` row at all**,
  *when* they create, complete, publish and pay for a listing, *then* every step
  succeeds identically to an owner who came from a lead.
- **AC-11** — *Given* an owner whose lead is `pending` / `rejected` / deleted,
  *when* they run the full flow, *then* it succeeds — lead status is never read.
- **AC-12** — *Given* a lead exists for the owner, *when* they open the create
  form, *then* the fields are pre-filled from it; *and when* they overwrite any
  pre-filled value, *then* the submitted value wins.

**Plan + idempotency**

- **AC-13** — *Given* any commerce checkout, *when* the plan slug is resolved,
  *then* it comes from `resolveCommercePlanSlug({entityType})` and no slug literal
  appears in the route/web/tests; *and* an unset `HOSPEDA_COMMERCE_PLAN_ID` yields
  503.
- **AC-14** — *Given* the create/publish/checkout source path, *when* the static
  guard test runs, *then* it fails if any file imports `CommerceLeadService` or
  references `commerce_leads`. *(Enforces §6.1.)*
- **AC-15** — *Given* an owner double-submits the publish CTA with the same
  idempotency key, *when* both requests land, *then* exactly one preapproval and
  one link row exist.
- **AC-16** — *Given* a listing with an `active` subscription, *when* the owner
  starts another, *then* 409 and the existing subscription is untouched.

**Permissions + seed**

- **AC-17** — *Given* a fresh DB, *when* seeded, *then* `COMMERCE_OWNER` has both
  `COMMERCE_CREATE` and `COMMERCE_EDIT_OWN`.
- **AC-18** — *Given* an already-seeded DB (staging/prod shape), *when*
  `pnpm db:seed:migrate` runs, *then* `COMMERCE_OWNER` gains `COMMERCE_CREATE`
  idempotently.
- **AC-19** — *Given* an owner editing their own listing, *when* they submit
  `name` / `slug` / `description` / `destinationId`, *then* the values persist
  (D-1); *and when* they submit `lifecycleState` / `visibility` / `isFeatured` /
  `ownerId`, *then* those are rejected/stripped (§6.2 — control fields stay admin).

**Isolation**

- **AC-20** — *Given* a user who is both an accommodation host and a
  `COMMERCE_OWNER`, *when* their commerce subscription is `active` / lapses /
  cancels, *then* their accommodation entitlements are entirely unaffected
  (`product_domain` isolation holds).

**Web**

- **AC-21** — *Given* an owner with an incomplete listing, *when* they open
  `/mi-cuenta/comercio/`, *then* the publish CTA is disabled and the missing
  fields are named; *and when* the last one is filled, *then* it enables.
- **AC-22** — *Given* the doors, *when* rendered in es/en/pt, *then* no
  "Contanos y te contactamos" framing remains for gastronomy/experience.

## 10. Risks

- **R-1 — D-4 erosion.** The single biggest risk. A well-meaning contributor adds
  "if the lead isn't approved, don't let them publish" as a *safety* measure and
  silently welds the admin back in forever. **Mitigation:** §6.1's explicit
  anti-pattern table + the AC-14 static guard.
- **R-2 — Paid-but-invisible.** An owner pays, the listing is incomplete, it stays
  PRIVATE (AC-6) — correct, but the owner has been charged for nothing visible.
  The 422 gate (§6.3) makes this hard, but the race (complete → pay → owner
  deletes a required field) is real. **Mitigation:** log loudly; consider blocking
  edits that would un-complete a published listing. Deliberately not solved in v1
  — flagged.
- **R-3 — Ownership check omitted.** If the implementer only relaxes the
  permission (the obvious reading of "make the admin route protected"), any owner
  can pay for any listing. **Mitigation:** AC-2 is the guard; §5.3 spells out that
  the admin route never makes this comparison.
- **R-4 — Placeholder price ships.** `monthlyPriceArs = 500000`
  (`plans.config.ts:541`) is a PLACEHOLDER nobody confirmed. Shipping self-checkout
  means **real customers are charged this number**. **This is a launch blocker, not
  a nice-to-have** — see OQ-2.
- **R-5 — Completeness definition forks.** Three consumers (§6.6). If web
  reimplements the checklist client-side, they drift and the UI lies.
  **Mitigation:** one pure function in service-core, surfaced via `missing`.
- **R-6 — Slug squatting / rename.** Owner-settable slugs (D-1) are public URLs.
  **Mitigation:** derive server-side from `name`, staff-only renames (§6.2, OQ-3).
- **R-7 — No moderation + real money.** NG-1 accepts that anything payable is
  publishable. The card is the filter. Accepted by the owner; the reactive lever
  (`visibility`/`lifecycle`) and the OQ-1 seam are the mitigations.
- **R-8 — Dead notifier extended by accident.** `LeadNotificationPort` looks alive
  and is not (§7.5). **Mitigation:** called out explicitly.

## 11. Open questions

- **OQ-1 — Moderation.** ✅ **RESOLVED** (owner, Linear comment 2026-07-15): **no
  proactive moderation.** A completed listing goes live directly. Rationale: the
  admin filtered at the lead, a real card is involved, and the admin keeps reactive
  control via `visibility`/`lifecycle`. No moderation machinery is built (NG-1);
  the cheap per-vertical flag seam stays open (§6.5).
- **OQ-2 — The real price. ⛔ OPEN — LAUNCH BLOCKER.**
  `COMMERCE_LISTING_PLAN.monthlyPriceArs = 500000` (ARS 5.000) is a **PLACEHOLDER**
  (`plans.config.ts:541`). Its own comment says *"the owner must confirm / override
  the real commerce-listing price via the admin UI"* (`:525-527`) — **nobody ever
  confirmed it.** Until now that was harmless (only an admin could start a
  subscription, and would notice). With self-checkout, this number is what real
  merchants are charged. Needs an owner decision before go-live, in the DB
  (commercial field, DB-wins — the seed never overwrites it once set) or in the
  baseline.
- **OQ-3 — Slug policy.** Owner-settable at create, derived from `name`,
  staff-only rename post-publish? (§6.2 recommendation.) Confirm.
- **OQ-4 — Draft quota.** Cap on drafts per `COMMERCE_OWNER`? Recommendation: none
  in v1 (§7.2). Confirm.

## 12. Implementation notes

- `initiateCommerceMonthlySubscription` needs **zero** changes
  (`subscription-checkout.service.ts:818-821`). If a PR modifies it, that is a
  signal the actor is being resolved in the wrong layer.
- The reconciler's three trigger sites stay untouched (NG-5). Only the predicate
  and the injected completeness resolver change.
- The admin route survives as a staff escape hatch (NG-7); it can keep resolving
  the owner from the listing — that is correct *for an admin*.
- **Suggested slicing** (chained PRs; each independently green):
  1. Seed: `COMMERCE_CREATE` → `COMMERCE_OWNER` (baseline + data-migration).
  2. `resolveListingCompleteness` (pure, unit-tested) + `resolveCommercePlanSlug`.
  3. Schema widening (D-1) + owner create endpoint.
  4. Protected start-subscription route (+ ownership check, AC-2).
  5. Reconciler predicate + completeness injection.
  6. Web: create page, checklist, publish+pay CTA, states.
  7. Notifications + i18n + doors copy.
  8. AC-14 guard test.
- **Smoke labels:** this touches the billing surface, so
  `status-needs-smoke-staging` applies (real MP sandbox checkout). Whether it is
  billing **CORE** (→ also `status-needs-smoke-prod`) is arguable: it adds a new
  checkout entry point without changing start-paid, webhooks, or crons. Given R-4
  (real money at a placeholder price) and HOS-159 (MP webhooks not arriving in
  prod), **recommend prod smoke too**.
- **Dependency note:** HOS-159 (MP webhooks never arrive in prod; activation only
  via polling) directly affects this flow — commerce activation is webhook-driven
  through the reconciler. If HOS-159 is unresolved at ship time, commerce listings
  may not auto-publish after payment. **Verify HOS-159's state before smoke.**

## 13. Linear

Canonical tracking:
HOS-166
