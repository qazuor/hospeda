---
title: Partner mentions log — record manual promotion actions and show them to the partner
linear: HOS-377
statusSource: linear
created: 2026-08-02
type: feature
areas:
  - web
  - api
  - db
  - admin
---

# Partner mentions log — record manual promotion actions and show them to the partner

## 1. Summary

Half of what a partner pays for is manual work the Hospeda team does off-platform:
mentions on social media, press appearances, email-newsletter inclusions, WhatsApp
campaigns. Today the partner has no way to know whether that work happened. This spec
adds a **mentions log**: an admin-entered record per partner of channel + date + link
to the publication + optional internal note, shown to the partner as a verifiable
history. It explicitly does **not** add analytics (reach, impressions, clicks) for
those external channels — that data lives on Instagram/the email provider/WhatsApp,
not in Hospeda, and integrating those APIs was already rejected by the owner. The
partner's own measurable metrics (fiche views, carousel views) are a separate,
already-partially-existing concern that must render visually apart from this log.

## 2. Problem

`partners.tier` (`silver`/`gold`) is priced partly on the frequency/priority of manual
promotion actions the Hospeda team performs on the partner's behalf. Those actions
happen on third-party platforms Hospeda doesn't control, so there is no automatic
trace of them anywhere in the product. The partner currently has zero visibility into
whether the team followed through — no log, no notification, nothing beyond trusting
that ops did the work. This erodes the perceived value of the paid tiers and gives
the team no artifact to point to when a partner asks "did you actually do it."

## 3. Goals

- G-1: Let an admin record a manual promotion action for a partner: channel, date,
  URL to the publication, optional internal note.
- G-2: Make that recording quick to do at the moment the action happens, from the
  partner's admin detail page.
- G-3: Show the partner a chronological, verifiable history of these actions in their
  own account area, once that area exists (see R-1 — blocked by HOS-278 today).
- G-4: Show the partner's own measurable metrics (fiche views, carousel views) in a
  section that is visually and textually distinct from the mentions log, so the two
  are never confused.
- G-5: Design the data model so the same mechanism can be reused for sponsors later,
  without designing sponsors in now (they have the identical problem — see HOS-278
  §sponsor, currently postponed).

## 4. Non-goals

- NG-1: Integrating the Instagram, email-provider, or WhatsApp APIs to pull reach,
  impressions, or click data. Explicitly rejected by the owner — four integrations
  with expiring tokens for a feature serving a handful of partners.
- NG-2: Showing any number that represents reach, impressions, or clicks for a manual
  action, anywhere, under any label.
- NG-3: Building the partner↔user account link (HOS-278). This spec's admin side is
  independent of it; the partner-facing `/mi-cuenta` view depends on it and is
  explicitly blocked until it ships (see §10 R-1).
- NG-4: Building the partner's own fiche page `/partners/<slug>/` (HOS-294). The
  metrics section this spec asks to keep separate from the mentions log lives on that
  page once it exists; this spec does not create the page.
- NG-5: Extending this to service providers — they have a different problem
  (usage/ratings, tracked separately as HOS-376).
- NG-6: Building the generalized sponsor version now. HOS-278 explicitly postponed
  sponsor work pending a backend refactor (HOS-107); this spec only avoids modeling
  choices that would preclude reuse later (see §6).

## 5. Current baseline

### `partners.analytics` — verified dead

`packages/db/src/schemas/partner/partner.dbschema.ts` has:

```ts
export interface PartnerAnalytics {
    impressions?: number;
    clicks?: number;
}
// ...
analytics: jsonb('analytics').$type<PartnerAnalytics>().default({}),
```

A repo-wide search for `PartnerAnalytics` and `partners.analytics` found **zero**
references outside this schema file — no service, route, model method, or UI reads or
writes it. It is dead weight from an earlier, apparently abandoned design (a JSONB
counter blob, exactly the "impressions/clicks" shape the owner just rejected). It is
not being reused by this spec (see §6 for why) and should be flagged for removal in a
follow-up cleanup, not silently left beside a real mentions table that could be
confused for the same thing (§10 R-3).

### `partner_subscriptions` (SPEC-271)

`packages/db/src/schemas/partner/partner_subscription.dbschema.ts` is a link table
between a partner and its QZPay `billing_subscriptions` row (1:1, `UNIQUE(partner_id)`).
Not directly relevant to the mentions log's shape, but confirms the `partners` table's
established FK conventions (`partnerId` uuid references, cascade on delete for
partner-owned children).

### Log-table precedent: `social_publish_logs`

`packages/db/src/schemas/social/social_publish_logs.dbschema.ts` is the closest
existing pattern for "recording an external publish action with a channel, a status,
and a link back to the published artifact": `platform` (closed pg enum), `status`
(closed pg enum), free-text `message`, `externalPostUrl`, `createdAt` only — no
soft-delete columns and no audit FKs, explicitly documented as "append-only... Rows
are never deleted by application code" because it logs an automated dispatch pipeline
(Make.com callbacks).

`partner_mentions` is a different kind of record: an admin manually types it in, may
typo a date or paste the wrong link, and needs to fix it. It is closer in nature to
the `partners` row itself (admin-curated content with standard audit columns) than to
`social_publish_logs` (system-generated dispatch telemetry). §6 recommends borrowing
`social_publish_logs`'s column *shape* (closed channel enum, free-text note, external
URL) while using `partners`'s audit-column convention (soft delete + `createdById`/
`updatedById`/`deletedById`), not its append-only immutability. Other `*_log`/
`*_event` tables checked (`ai_request_log`, `app_log_entry`, `audit_log_entry`,
`billing_notification_log`, `billing_subscription_event`, `social_audit_log`,
`revalidation-log`, `user_search_history`) are all system-generated telemetry with the
same append-only shape — none fit an admin-curated, editable record better than
`social_publish_logs` does.

### Admin partner routes

`apps/api/src/routes/partners/admin/` holds one file per action (`create.ts`,
`update.ts`, `delete.ts`, `get.ts`, `list.ts`, `manual-payment.ts`,
`send-link.ts`, `list-plans.ts`), each built with `createAdminRoute` and gated by
`PermissionEnum.PARTNER_MANAGE`. `manual-payment.ts` is the closest template for a
partner sub-action: it takes `{id}` in the path, a small body (`note` only), calls a
`PartnerService` method, and writes an `auditLog()` entry. New mention routes should
follow this exact shape (`apps/api/src/routes/partners/admin/mentions/*.ts`).

`PartnerService` (`packages/service-core/src/services/partner/partner.service.ts`)
extends `BaseCrudService` and already has a non-CRUD action method
(`registerManualPayment`) alongside the standard hooks — a mentions sub-resource
would most naturally live as its own model/service (`PartnerMentionModel`,
`PartnerMentionService`) rather than bolted onto `PartnerService`, matching how
`partner_subscriptions` got its own dedicated schema instead of columns on `partners`.

`PermissionEnum` has `PARTNER_CREATE` / `PARTNER_UPDATE` / `PARTNER_DELETE` /
`PARTNER_VIEW_ALL` / `PARTNER_MANAGE` only — no `PARTNER_VIEW_OWN` or anything scoped
to "the partner viewing their own data," because no partner-owned self-service
surface exists yet (see next section).

### Partner has no owner and no contact channel — confirmed, not assumed

Per HOS-278: *"Ni `partner` ni `host_trade` tienen dueño. `sponsorship.sponsorUserId`
es el único que ya lo tiene."* Verified directly:

- `partners.dbschema.ts` has no `ownerUserId`/`userId` column of any kind.
- `partners.dbschema.ts` has no `email` or any contact-info column at all.
- `sponsorship.dbschema.ts` does have `sponsorUserId` (confirms the asymmetry).
- `alliance_lead.dbschema.ts` has a `email` column (captured at lead time), but it is
  never copied onto the resulting `partners` row today.

This means: (a) there is no user account to gate a `/mi-cuenta` view by today — that
depends on HOS-278 shipping the partner↔account link; (b) there is no stored address
to notify by email even if HOS-278 shipped a login-based link without also carrying
the lead's email onto the partner row. Both are real gaps, not implementation
shortcuts — see §10 R-1/R-2 and §11 OQ-2.

### `/mi-cuenta/aliados` today

`apps/web/src/config/discovery-doors.ts`: the `partner` option inside the `partner`
door has **no `acquiredPermission`**, by design — a documented consequence of HOS-277
NG-1 (partner is a lead-only flow, never auto-provisioned). The page comment
(`apps/web/src/pages/[lang]/mi-cuenta/aliados/index.astro`) states directly: partner
"is not-yet-implemented" and renders a "Próximamente" CTA. Confirms HOS-278's own
note: *"aunque el endpoint exista, esa página no puede mostrar 'aprobado'"* without
touching that config. This spec's partner-facing view is therefore built against a
page that, as of today, cannot even detect "this logged-in user is this partner."

### What's actually measurable: entity views + PostHog

`packages/db/src/schemas/entity-view/entity_view.dbschema.ts` is an append-only view
telemetry table (`entityType`, `entityId`, `visitorHash`, `isAuthenticated`,
`viewedAt`), reusing the shared `EntityTypeEnum`. That enum
(`packages/schemas/src/enums/entity-type.enum.ts`) currently has 11 values
(`ACCOMMODATION`, `DESTINATION`, `USER`, `POST`, `EVENT`, `CONVERSATION`, `REVIEW`,
`BILLING_SUBSCRIPTION`, `PAYMENT`, `EXPERIENCE`, `GASTRONOMY`) — **no `PARTNER`**. The
table's own file header still describes it as covering "ACCOMMODATION, POST, EVENT"
only (SPEC-159 scope); nothing in the codebase currently writes an entity-view row for
a partner fiche or the home carousel.

Separately, `apps/web` has PostHog wired client-side:
`apps/web/src/components/analytics/PostHogScript.astro` reads
`PUBLIC_POSTHOG_KEY`/`PUBLIC_POSTHOG_HOST` and boots the client SDK (gated by cookie
consent, `apps/web/src/lib/cookie-consent.ts`). PostHog autocapture would pick up page
views on a future `/partners/<slug>/` fiche and clicks on carousel logos without any
new schema, as custom/auto events — this is a real, already-integrated measurement
path distinct from `entity_views`.

So "views of the fiche and the carousel are measurable" is true, but via **two
different, not-yet-connected mechanisms** for partner specifically: extending
`entity_views`/`EntityTypeEnum` with `PARTNER` (consistent with how accommodations/
posts/events are counted, but requires HOS-294's fiche to exist first), or PostHog
custom events (works today for the carousel, which isn't a "page" `entity_views` would
naturally cover). See §11 OQ-5.

### Notifications

`packages/notifications/src/types/notification.types.ts`'s `NotificationType` enum has
no partner-mention-related value. `notification.service.ts`'s send path takes a
`recipientEmail` directly (not only a `userId` — see the `to: recipientEmail` call
around line 194) and separately uses `userId` for preference-based opt-out lookups.
Sending "you were mentioned" mail to a partner is therefore *technically* buildable
without HOS-278, IF the partner had a stored email — which it doesn't (see above). A
transactional-style notification (bypassing preference checks, like
`COMMERCE_OWNER_CREDENTIALS`) is the closest existing precedent if the owner wants
this. See §11 OQ-2.

## 6. Proposed design

### New table: `partner_mentions`, not the `analytics` JSONB column

Do not reuse `partners.analytics`. Reasons:

1. It's a growing, per-partner **list** of discrete events (channel + date + link +
   note) — a JSONB blob on the parent row is the wrong shape for something that needs
   to be paginated, filtered by channel/date, and individually edited/removed. It
   would become an unbounded array inside one row, exactly the anti-pattern a real
   table avoids.
2. Its existing shape (`impressions`/`clicks`) is precisely the "alcance" framing the
   owner just rejected. Repurposing it risks the exact confusion this spec exists to
   prevent — a stray `analytics` field sitting right next to the intentionally-named
   `partner_mentions` log.
3. The codebase already has a clean precedent for "child log-like table with FK to a
   parent + closed-enum channel + external link + free-text note + admin audit
   columns" once you combine `social_publish_logs`'s column shape with `partners`'s
   own audit-column convention (see §5). A dedicated table follows the existing
   convention better than resurrecting the dead column.

Recommendation: create `partner_mentions` as a standard audited table (matching
`partners`'s own audit-column shape: `createdAt`/`updatedAt`/`deletedAt` +
`createdById`/`updatedById`/`deletedById`), not an immutable append-only log like
`social_publish_logs` — because an admin typing this in by hand needs to be able to
fix a mistake (wrong date, wrong link) without leaving stale entries behind. Flagged
as a confirmable design choice, not asserted as final — see §11 OQ-6.

Flag the `partners.analytics` column for removal as a follow-up cleanup (separate PR,
not blocking this spec) once this ships, so there is exactly one place a partner's
"was I mentioned" story lives.

### Admin surface

New route group `apps/api/src/routes/partners/admin/mentions/` mirroring
`manual-payment.ts`'s shape: `create.ts` / `list.ts` / `update.ts` / `delete.ts`, each
using `createAdminRoute`, gated by `PermissionEnum.PARTNER_MANAGE` (reusing the
existing permission rather than adding a new one — see §11 OQ-4), each writing an
`auditLog()` entry like `manual-payment.ts` does. A new `PartnerMentionModel` +
`PartnerMentionService` in `service-core`, separate from `PartnerService` (mirrors how
`partner_subscriptions` got its own schema rather than columns bolted onto
`partners`).

In `apps/admin`, the partner detail page gets a "Menciones" section: a
newest-first list (channel badge, date, link-out icon, truncated note) plus a
"Registrar mención" form (channel select, date picker, URL field, optional note
textarea) — loaded and submitted at the moment the admin actually performs the
action, per the issue's stated goal ("carga desde el admin, en el momento en que se
hace la acción").

### Partner-facing surface (blocked on HOS-278)

Once HOS-278 links a partner to a user account, the natural home is under
`/mi-cuenta/aliados` (today a "Próximamente" placeholder for `partner` — see §5). Two
visually and textually separate blocks:

- **"Bitácora de menciones"**: chronological list, channel icon + date + "Ver
  publicación" link (opens the stored URL in a new tab) + note if present. Empty
  state reads "Todavía no registramos menciones" — never "sin estadísticas" or
  anything implying a metric is missing.
- **"Tus métricas"**: fiche views + carousel views, sourced per §11 OQ-5. Different
  heading, different visual treatment (e.g. stat tiles vs. a timeline), never sharing
  a component with the mentions block so the two can't visually blur together.

`gold` and `silver` partners see the **identical** view and identical data shape for
both blocks — the plan difference is operational (how often ops actually logs a
mention, and priority in scheduling), never a UI/report difference. No plan-based
gating logic belongs in this feature.

### Designed for sponsor reuse, not built for it

Keep `partner_mentions` scoped to partners now (simplest correct shape, matches
YAGNI). Because `sponsorship.sponsorUserId` already exists (unlike `partners`),
sponsors don't share partner's account-link blocker — but sponsor work is postponed
pending HOS-107, so there is nothing to build against yet. When sponsor work resumes,
the straightforward path is a parallel `sponsorship_mentions` table (or, if the
admin/API/UI code turns out to be near-identical, extracting a shared
`{entityType, entityId}`-keyed service) — a decision for that future spec, not this
one. Don't add a speculative `entityType` discriminator column to
`partner_mentions` today with no second consumer to validate it against.

## 7. Data model / contracts

`packages/db/src/schemas/partner/partner_mention.dbschema.ts` (new file):

- `id` — uuid PK.
- `partnerId` — uuid, FK → `partners.id`, `onDelete: 'cascade'`, not null.
- `channel` — closed pg enum (values TBD, see §11 OQ-1) or `varchar`, not null.
- `mentionedAt` — the date the action actually happened (distinct from `createdAt`,
  the date the admin logged it — these can differ if entered after the fact).
- `url` — `text`, nullability per §11 OQ-3 (issue text implies "always has a link,"
  but WhatsApp broadcasts may not have one).
- `internalNote` — `text`, nullable, admin-only (never rendered to the partner).
- Standard audit columns matching `partners`: `createdAt`, `updatedAt`, `deletedAt`,
  `createdById`/`updatedById`/`deletedById` (uuid FK → `users.id`,
  `onDelete: 'set null'`).
- Indexes: `(partnerId, mentionedAt desc)` for the primary "this partner's history,
  newest first" access pattern; `(partnerId, deletedAt)` if soft-delete filtering
  needs it.

New Zod schemas in `@repo/schemas`: `partnerMentionSchema`,
`createPartnerMentionSchema`, `updatePartnerMentionSchema`,
`searchPartnerMentionSchema`, and (if the closed-enum path is chosen per OQ-1) a
`PartnerMentionChannelEnum`.

New admin endpoints (all under `/api/v1/admin/partners/{partnerId}/mentions`,
`PermissionEnum.PARTNER_MANAGE`):

- `POST /` — create a mention.
- `GET /` — paginated list for one partner, newest-first.
- `PATCH /{id}` — correct a mention (per §11 OQ-6).
- `DELETE /{id}` — soft-delete a mistakenly-logged mention (per §11 OQ-6).

New protected endpoint (blocked until HOS-278, shape TBD once the partner↔account
link exists): `GET /api/v1/protected/partners/mine/mentions`, mirroring the
`GET /protected/commerce/leads/mine` precedent HOS-278 documents for the equivalent
commerce "mine" pattern.

Migration: structural table → carril 1 (`packages/db/src/migrations/` via
`pnpm db:generate` + `pnpm db:migrate`), not extras, not a seed data-migration (no
live seed data changes here).

## 8. UX / UI behavior

**Admin** (`apps/admin`, partner detail page): a "Menciones" section below the
existing partner fields — table of past entries (channel badge, date, external-link
icon that opens the URL in a new tab, truncated note with a tooltip/expand for the
full text) and a compact inline form to add a new one. No plan-based UI branching.

**Web** (`/mi-cuenta`, blocked until HOS-278 — see §6): two independent sections as
described in §6, with copy constraints from §9/AC-3 applying to every string on the
mentions block. `gold` and `silver` render the identical component tree; the only
difference between tiers is operational (how often ops logs entries), never a UI
affordance.

## 9. Acceptance criteria

- AC-1: An admin can record a mention for a partner (channel, date, URL, optional
  internal note) from the partner's admin detail page, at the moment the action
  happens.
- AC-2: Mentions render newest-first per partner, in both the admin list and (once
  HOS-278 unblocks it) the partner's `/mi-cuenta` view.
- AC-3: No string anywhere in this feature — admin or partner-facing — uses "alcance",
  "impresiones", "clics", or "estadísticas de campaña" to describe the mentions log.
  "Menciones" / "Bitácora" only.
- AC-4: `gold` and `silver` partners see byte-identical mentions UI and data shape;
  tier only affects how often ops populates it, never what's rendered.
- AC-5: The partner's own measurable metrics (fiche views, carousel views) render in a
  section visibly and textually separate from the mentions log — no shared heading,
  no shared component, no ambiguity about which block is which.
- AC-6: The `partner_mentions` schema and service are scoped cleanly enough (per §6)
  that a future sponsor equivalent doesn't require reshaping this table — documented
  in code comments, not necessarily built now.

## 10. Risks

- R-1: The partner-facing `/mi-cuenta` view cannot ship before HOS-278 links a
  partner to a user account — `/mi-cuenta/aliados`'s `partner` option has no
  `acquiredPermission` today and is hard-coded to render "Próximamente." Shipping
  order matters: admin-side logging can go out independently, the partner-visible
  half cannot.
- R-2: There is no stored contact email on `partners` today. If the owner decides
  (§11 OQ-2) that the partner should be notified when a mention is logged, that
  requires either carrying the lead's email onto the partner row or waiting for
  HOS-278's account link — "just add a notification" is not a same-spec addition
  without one of those.
- R-3: Leaving the dead `partners.analytics` JSONB column in place alongside a new,
  intentionally-named `partner_mentions` table invites future confusion about which
  one is the real data source. Recommend a follow-up cleanup PR to drop it once this
  ships (not bundled into this spec to keep it focused).
- R-4: `PartnerTierEnum` has a `BRONZE` value that neither HOS-377 nor HOS-278/294
  mention — the owner's framing is consistently "gold vs silver." If bronze partners
  exist or are expected, their treatment in the mentions cadence isn't defined
  anywhere. Non-blocking, but worth a one-line confirmation.

## 11. Open questions

- OQ-1 (owner, verbatim from the issue's "A definir"): closed list of channels, or
  free text? Recommend a closed pg enum (Instagram, newsletter/email, WhatsApp, press,
  other), matching the codebase's existing convention for this exact shape
  (`SocialPlatformPgEnum`), with an `OTHER` fallback so an unanticipated channel
  doesn't block logging. Final call is the owner's.
- OQ-2 (owner, verbatim from the issue): does the partner get notified when a new
  mention is registered? Technically buildable (`notification.service.ts` accepts a
  raw `recipientEmail`), but blocked on having *some* stored contact channel for the
  partner — either HOS-278's account link or a new `email` column carried over from
  `alliance_leads` at approval time. Needs an owner decision on which path, and
  whether it's in-scope for this spec or a fast-follow.
- OQ-3: is `url` required on every mention row? The issue's framing ("con el link
  para ir a comprobarlo") implies yes, but a WhatsApp broadcast to a list has no
  public URL to link. Needs a per-channel answer — possibly `url` required for
  Instagram/press/newsletter, optional for WhatsApp.
- OQ-4: which permission gates the admin mutation routes — reuse the existing
  `PermissionEnum.PARTNER_MANAGE` (as `manual-payment.ts` does for its own partner
  sub-action) or add a narrower `PARTNER_MENTION_MANAGE`? Recommend reusing
  `PARTNER_MANAGE` (YAGNI — no evidence yet that mention-logging needs a narrower
  role than the rest of partner admin).
- OQ-5: how are "fiche views" and "carousel views" actually measured once they need
  to render? Two real, non-exclusive options found in the codebase: (a) add `PARTNER`
  to `EntityTypeEnum` and start writing `entity_views` rows for the fiche once HOS-294
  ships it (consistent with how accommodations/posts/events are counted today), or
  (b) PostHog custom/autocapture events (already wired client-side via
  `PUBLIC_POSTHOG_KEY`), which fits the home carousel better since it isn't a
  standalone "page." Recommend (a) for the fiche and (b) for the carousel, but this
  is properly HOS-294's decision to finalize once the fiche page exists — flagged
  here only because the issue asked this spec to identify what's measurable and how.
- OQ-6: are mentions editable/soft-deletable by the admin after creation (this spec's
  working assumption, matching `partners`'s own audit-column convention — an admin
  fixing a wrong date or a pasted-wrong link), or should they be an immutable
  append-only log once written (matching `social_publish_logs`'s convention for
  system-generated records)? Recommend editable/soft-deletable since a human types
  this in and typos happen; confirm with the owner before implementation.
- OQ-7 (owner, verbatim from the issue): does this need to become a generalized
  mechanism for sponsors now, or is "designed to not preclude it" (§6) sufficient
  until HOS-107 unblocks sponsor work? Recommend deferring — sponsor work is
  explicitly postponed in HOS-278, and building a shared abstraction against a single
  consumer risks guessing the wrong shape.

## 12. Implementation notes

- Column shape borrows from `social_publish_logs` (closed-enum channel, free-text
  note, external URL as plain `text`); audit-column shape borrows from `partners`
  itself (soft delete + `createdById`/`updatedById`/`deletedById`) — see §6 for why
  these two precedents are combined rather than either one used wholesale.
- `apps/api/src/routes/partners/admin/manual-payment.ts` is the direct template for
  the new admin mention routes: `createAdminRoute`, `PermissionEnum.PARTNER_MANAGE`,
  an `auditLog()` call with `resourceType: 'partner-mention'`.
- New `PartnerMentionModel` (extends `BaseModel`) + `PartnerMentionService` in
  `packages/service-core/src/services/partner/`, kept separate from `PartnerService`
  (mirrors `partner_subscriptions` getting its own schema rather than columns bolted
  onto `partners`).
- Requires a real structural migration (`pnpm db:generate` + `pnpm db:migrate`) — new
  table, not an extras/data-migration change.
- File the `partners.analytics` column-removal cleanup as its own small follow-up
  once this ships (§10 R-3) — do not bundle it into this spec's migration to keep the
  diff focused on the new table.
- The partner-facing `/mi-cuenta` half of this spec cannot be implemented until
  HOS-278 ships the partner↔account link; sequence the admin-side work first so it
  can ship independently.

## 13. Linear

Canonical tracking:
HOS-377
