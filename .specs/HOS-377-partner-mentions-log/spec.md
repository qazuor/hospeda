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
  own account area (unblocked — HOS-278 shipped the ownership link, see §5).
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
- NG-3: Building the partner↔user account link — HOS-278 already shipped it
  (`partners.ownerUserId` + `GET /protected/partners/mine`). This spec consumes it,
  it does not build it.
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

### Partner ownership and contact — RESOLVED by HOS-278 (re-verified 2026-08-07)

> **This section originally recorded a hard blocker. It no longer holds.** The spec was
> written 2026-08-02, when `partners` had neither an owner nor a contact channel. HOS-278
> shipped both afterwards. Re-verified directly against the current branch:

- `partners.ownerUserId` **exists** — `packages/db/src/schemas/partner/partner.dbschema.ts:76`,
  a nullable `uuid` FK → `users.id` (`onDelete: 'set null'`), with
  `partners_ownerUserId_idx` and a `partnerOwner` relation (HOS-278 §6.5). Nullable on
  purpose: a null owner makes the ownership filter fail CLOSED, and hand-curated partners
  are meant to have no owner at all.
- `partners.contactInfo` **exists** — a `jsonb` column typed `ContactInfo` (HOS-278 D3),
  shallow-merged on update. `ContactInfoSchema`
  (`packages/schemas/src/common/contact.schema.ts:33`) carries `personalEmail`,
  `workEmail`, `whatsapp`, and a `preferredEmail` discriminator.
- `GET|PATCH /api/v1/protected/partners/mine` **already exists**
  (`apps/api/src/routes/partners/protected/mine.ts`) — the self-service read path this
  spec assumed it would have to wait for.

Consequence for this spec: the partner-facing half is **not blocked**. The original
shipping constraint ("admin-side first, web half later") is void — both halves can land
together. See §10 R-1/R-2, now closed.

### `/mi-cuenta/aliados` today

`apps/web/src/config/discovery-doors.ts`: the `partner` option inside the `partner`
door has **no `acquiredPermission`**, and never will — a permanent consequence of
HOS-277 NG-1 (partner is a lead-only flow, never auto-provisioned), not a gap awaiting
a fix.

That is not a blocker, because HOS-278 already solved this exact problem for
`serviceProvider` (AC-7): an approved provider gets no permission and no role change,
so the hub page instead fetches `GET /host-trades/mine` and treats **ownership of the
row as the gate**. The file's own doc comment spells this out. `partner` now has the
same two ingredients — `ownerUserId` on the row and a `/mine` endpoint — so the
partner-facing view follows that established pattern verbatim: fetch
`GET /protected/partners/mine`, and if it returns a row, the caller is that partner.
No permission, no `acquiredPermission`, no config change.

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

### One row per channel, batched at the form — not an array column (owner, 2026-08-07)

A single campaign usually runs across several networks at once, and the admin must be
able to log all of them in **one** submission rather than repeating the form per
network.

The tempting shape — one row with `channels text[]` holding
`[INSTAGRAM, FACEBOOK, TIKTOK]` — is **wrong**, and the URL is what breaks it. Each
network is a different publication with a different link. An array of channels would
need a parallel array of URLs kept positionally in sync, which is the same unbounded-
blob anti-pattern §6 rejected for `partners.analytics`, one level down. It also
destroys the only thing that makes this feature worth anything: *"con el link para ir a
comprobarlo"*. A partner shown `Instagram, Facebook, TikTok — 12/8` with one link
cannot verify two of the three.

So the storage stays **one row per channel**, and the batching lives in the form and
the endpoint:

- The admin form's channel field is a **multi-select**; picking N channels reveals
  **N URL inputs**, one per channel.
- `POST .../mentions` accepts an **array of entries** and creates N rows in a single
  transaction. One submit, N records.
- All rows created by that submit share a generated **`batchId`** (uuid, nullable).

`batchId` earns its column three times over:

1. The partner-facing view groups by it — *"Campaña del 12/8 — Instagram, Facebook,
   TikTok"* with the three links nested — instead of showing four loose entries dated
   the same day.
2. It makes the notification sane. The owner decided the partner is emailed **per
   mention**; taken literally with multi-channel that is four emails for one campaign,
   which is how a sender gets marked as spam. The rule is therefore **one email per
   batch**, listing every channel with its link. Without `batchId` there is nothing to
   group the send by.
3. It cannot be reconstructed later. Once rows are written without it, which entries
   were logged together is gone — no backfill can recover it, so the column has to
   exist from the first migration or never.

Per-channel URL requirements fall out of this for free (closing OQ-3): `url` is
required for the channels that produce a public permalink (`INSTAGRAM`, `FACEBOOK`,
`TWITTER`, `YOUTUBE`, `TIKTOK`, `NEWSLETTER`) and optional for `WHATSAPP` (a broadcast
to a list has no public URL) and `OTHER`. Enforced in the Zod entry schema, which can
see `channel` and `url` together per entry — an array-of-channels row could not have
expressed this rule at all.

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

### Partner-facing surface (unblocked — HOS-278 shipped)

The home is `/mi-cuenta/aliados`, gated by ownership of the `partners.ownerUserId` row
via `GET /protected/partners/mine`, following the `serviceProvider` pattern (§5). Two
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
- `channel` — closed pg enum `PartnerMentionChannelPgEnum`, not null. **One channel per
  row** — see §6 for why this is not an array.
- `batchId` — uuid, **nullable**, no FK. Shared by every row written in one admin
  submission; null for a single-channel entry. Groups the partner-facing view and the
  notification (§6).
- `mentionedAt` — the date the action actually happened (distinct from `createdAt`,
  the date the admin logged it — these can differ if entered after the fact).
- `url` — `text`, nullable at the DB level; required per-channel by the Zod entry
  schema (§6). The DB column stays nullable because `WHATSAPP`/`OTHER` legitimately
  have none, and a CHECK encoding the per-channel rule would have to be rewritten every
  time a channel is added.
- `internalNote` — `text`, nullable, admin-only (never rendered to the partner).
- Standard audit columns matching `partners`: `createdAt`, `updatedAt`, `deletedAt`,
  `createdById`/`updatedById`/`deletedById` (uuid FK → `users.id`,
  `onDelete: 'set null'`).
- Indexes: `(partnerId, mentionedAt desc)` for the primary "this partner's history,
  newest first" access pattern; `(batchId)` for grouping; `(partnerId, deletedAt)` if
  soft-delete filtering needs it.

`PartnerMentionChannelPgEnum` — closed list, decided by the owner 2026-08-07 (closes
OQ-1):

```
INSTAGRAM · FACEBOOK · TWITTER · YOUTUBE · TIKTOK · NEWSLETTER · WHATSAPP · OTHER
```

`PRESS` was considered in the original draft and **dropped** by the owner. `OTHER` is
the escape hatch so an unanticipated channel never blocks logging. Adding a channel
later is a one-value enum addition, which is exactly why the closed list was chosen
over free text (see the issue: "Instagram"/"IG"/"instagram" would be three channels and
group into nothing).

New Zod schemas in `@repo/schemas`: `PartnerMentionChannelEnum`, `partnerMentionSchema`,
`createPartnerMentionBatchSchema` (the array-of-entries body, carrying the per-channel
URL requirement as a refinement on each entry), `updatePartnerMentionSchema`,
`searchPartnerMentionSchema`.

New admin endpoints (all under `/api/v1/admin/partners/{partnerId}/mentions`,
`PermissionEnum.PARTNER_MANAGE` — closes OQ-4):

- `POST /` — create **one or more** mentions in a single transaction. Body:
  `{ mentionedAt, internalNote?, entries: [{ channel, url? }, ...] }`. Generates one
  shared `batchId` when `entries.length > 1`. Returns the created rows.
- `GET /` — paginated list for one partner, newest-first.
- `PATCH /{id}` — correct a single mention (closes OQ-6: editable).
- `DELETE /{id}` — soft-delete a mistakenly-logged mention (closes OQ-6).

New protected endpoint — **no longer blocked** (see §5):
`GET /api/v1/protected/partners/mine/mentions`, gated by ownership of the
`partners.ownerUserId` row exactly as `GET /protected/partners/mine` already is, in
the same route group (`apps/api/src/routes/partners/protected/`). Returns rows grouped
by `batchId`, newest-first, with `internalNote` stripped.

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
- AC-7: An admin can log a multi-network campaign in ONE submission — selecting N
  channels reveals N URL fields, and saving writes N rows in a single transaction
  sharing one `batchId`. Logging the same campaign must never require repeating the
  form per network.
- AC-8: A mention's `url` is required for `INSTAGRAM`, `FACEBOOK`, `TWITTER`,
  `YOUTUBE`, `TIKTOK` and `NEWSLETTER`, and optional for `WHATSAPP` and `OTHER` —
  enforced by the schema, with a regression test per branch of that rule.
- AC-9: The partner is emailed **once per batch**, not once per row. A four-network
  campaign produces exactly one email listing all four channels with their links. A
  test asserts the send count for a multi-entry submission is 1.
- AC-10: The partner-facing view renders a batch as ONE grouped entry (date + channel
  list + one link each), not as N loose entries sharing a date.
- AC-11: `internalNote` is never present in any partner-facing response payload —
  asserted at the endpoint, not only hidden in the UI.

## 10. Risks

- ~~R-1~~ **CLOSED (2026-08-07)**: the partner-facing view is no longer blocked.
  HOS-278 shipped `partners.ownerUserId` and `GET /protected/partners/mine`, and
  established the ownership-as-gate pattern for exactly this case (`serviceProvider`,
  AC-7). Both halves ship together. See §5.
- ~~R-2~~ **CLOSED (2026-08-07)**: `partners.contactInfo` (jsonb, `ContactInfo`) now
  carries `personalEmail`/`workEmail`/`preferredEmail`, so there is a real address to
  notify. **New residual risk in its place**: `contactInfo` is nullable and every field
  inside it is `nullish`, so a hand-curated partner can have no reachable address at
  all. The notification path must degrade silently (log and skip) rather than throw —
  a partner with no email must not make logging a mention fail.
- R-5: `batchId` must be generated server-side inside the transaction, not accepted
  from the client. A client-supplied batch id would let one partner's mention be
  grouped into another's batch, and the grouped partner-facing query is the read path
  that would surface it.
- R-3: Leaving the dead `partners.analytics` JSONB column in place alongside a new,
  intentionally-named `partner_mentions` table invites future confusion about which
  one is the real data source. Recommend a follow-up cleanup PR to drop it once this
  ships (not bundled into this spec to keep it focused).
- R-4: `PartnerTierEnum` has a `BRONZE` value that neither HOS-377 nor HOS-278/294
  mention — the owner's framing is consistently "gold vs silver." If bronze partners
  exist or are expected, their treatment in the mentions cadence isn't defined
  anywhere. Non-blocking, but worth a one-line confirmation.

## 11. Open questions

> **OQ-1 through OQ-4, OQ-6 and OQ-7 are RESOLVED** (owner, 2026-08-02 in the Linear
> issue and 2026-08-07 in session). They are kept below with their answers rather than
> deleted, so the reasoning stays readable. **OQ-5 is the only one still open**, and it
> belongs to HOS-294.

- ~~OQ-1~~ **RESOLVED (owner, 2026-08-07)**: closed pg enum, eight values —
  `INSTAGRAM`, `FACEBOOK`, `TWITTER`, `YOUTUBE`, `TIKTOK`, `NEWSLETTER`, `WHATSAPP`,
  `OTHER`. The draft's `PRESS` was dropped; the four extra networks were added. `OTHER`
  stays as the escape hatch. See §7.
- ~~OQ-2~~ **RESOLVED (owner, 2026-08-02, Linear)**: yes, the partner is emailed, and
  it is **in scope for this spec** — it is the moment the partner perceives they are
  getting what they pay for. Now buildable: `partners.contactInfo` supplies the address
  (§5) and `notification.service.ts` already accepts a raw `recipientEmail`. Follow the
  transactional precedent (`COMMERCE_OWNER_CREDENTIALS`), bypassing preference opt-outs.
  **Granularity: one email per `batchId`, not per row** — see §6 and AC-9.
- ~~OQ-3~~ **RESOLVED (2026-08-07)**: per-channel, not global. Required for
  `INSTAGRAM`/`FACEBOOK`/`TWITTER`/`YOUTUBE`/`TIKTOK`/`NEWSLETTER`; optional for
  `WHATSAPP` and `OTHER`. Enforced in Zod per entry, DB column nullable. See §6/AC-8.
- ~~OQ-4~~ **RESOLVED (2026-08-07)**: reuse `PermissionEnum.PARTNER_MANAGE`, as
  `manual-payment.ts` does. No evidence mention-logging needs a narrower role, and
  adding one now would be a permission with a single call site.
- OQ-5 (**STILL OPEN — HOS-294's call, not this spec's**): how are "fiche views" and
  to render? Two real, non-exclusive options found in the codebase: (a) add `PARTNER`
  to `EntityTypeEnum` and start writing `entity_views` rows for the fiche once HOS-294
  ships it (consistent with how accommodations/posts/events are counted today), or
  (b) PostHog custom/autocapture events (already wired client-side via
  `PUBLIC_POSTHOG_KEY`), which fits the home carousel better since it isn't a
  standalone "page." Recommend (a) for the fiche and (b) for the carousel, but this
  is properly HOS-294's decision to finalize once the fiche page exists — flagged
  here only because the issue asked this spec to identify what's measurable and how.
- ~~OQ-6~~ **RESOLVED (2026-08-07)**: editable and soft-deletable, per this spec's
  working assumption. A human types these in and typos happen; `social_publish_logs`'s
  append-only immutability is right for a machine-written dispatch log and wrong here.
  Standard audit columns, `PATCH` and soft-`DELETE` endpoints.
- ~~OQ-7~~ **RESOLVED (owner, 2026-08-02, Linear)**: defer. `partner_mentions` stays
  partner-scoped with a real FK, same criterion HOS-372 used for per-vertical media —
  dedicated before polymorphic. Sponsor is postponed behind HOS-107 and its model may
  change in that refactor; designing for a frozen case today is guessing. Do NOT add a
  speculative `entityType` discriminator.

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
- The partner-facing half is **no longer sequenced behind HOS-278** — that shipped.
  Both halves can land in the same cut. The `/mine` read path already exists in
  `apps/api/src/routes/partners/protected/`; the mentions endpoint joins that group
  rather than inventing a new gate.
- `POST .../mentions` writes N rows in ONE transaction and generates `batchId`
  server-side (R-5). The notification fires once per batch, after the transaction
  commits — never inside it, so a mail failure cannot roll back a logged mention.

## 13. Linear

Canonical tracking:
HOS-377
