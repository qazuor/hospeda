---
title: Consolidate sponsors onto the generic Sponsorship model (deprecate PostSponsor)
linear: HOS-107
statusSource: linear
created: 2026-07-08
updated: 2026-07-08
type: refactor
areas:
  - db
  - api
  - web
  - admin
  - content
related:
  - HOS-38
---

# Consolidate sponsors onto the generic Sponsorship model (deprecate PostSponsor)

> **Status**: SCOPED — Phase-1 spec only. The owner decided the direction on 2026-07-08 (consolidate on System B, "rich product"). **Not implemented.** Backlog / low priority; picked up later. This document records the full audit, findings, decisions, and the phased plan so implementation can start cold.
>
> This spec resolves the open **Q2 of [HOS-38](https://linear.app/hospeda-beta/issue/HOS-38)** ("PostSponsor vs Sponsorship canonical?") and is the prerequisite backbone that HOS-38 (sponsor self-service dashboard) plugs into.

## 1. Origin

While auditing the state of the Partners and Sponsors features (2026-07-08), we found Hospeda ships **two coexisting, unreconciled sponsor systems**. The owner had already flagged this as HOS-38 Q2 but deferred the decision. This spec makes the decision (consolidate on B) and plans the full consolidation.

Context note (not part of this spec's work): the same investigation surfaced a **production bug in the unrelated Partners feature** — the public `/partners` directory returned 500 on every call (`subscription_status` compared against uppercase `'ACTIVE'` while the enum is lowercase `'active'`). Fixed separately in **PR #2181** (branch `feat/partners-sponsors`). It is mentioned here only as a **lesson**: this codebase has tables where two enums use different casing conventions, and the bug slipped past strict TS + mocked unit tests. See §6 risk R-4.

## 2. The two systems (current state)

### 2.1 System A — `PostSponsor` / `PostSponsorship` (old, post-only)

| Layer | State | Location |
|-------|-------|----------|
| DB | `post_sponsors` (brand: name, type `ClientTypeEnum`, description, logo, contactInfo, socialNetworks, lifecycleState, adminInfo, audit) + `post_sponsorships` (join: sponsorId→post_sponsors, postId→posts, message, description, paid `PriceType`, paidAt, fromDate/toDate, isHighlighted, lifecycleState) | `packages/db/src/schemas/post/post_sponsor.dbschema.ts`, `post_sponsorship.dbschema.ts`; created in `0000_baseline.sql:682,700` |
| Schemas | Full parallel set | `packages/schemas/src/entities/postSponsor/`, `postSponsorship/` |
| Services | Full CRUD | `packages/service-core/src/services/postSponsor/`, `postSponsorship/` |
| API | Admin CRUD only | `apps/api/src/routes/postSponsor/admin/*` (`/api/v1/admin/post-sponsors`) |
| **Web (public)** | **The ONLY sponsor data rendered publicly** — "Contenido patrocinado" banner | `apps/web/src/components/post/PostSponsorshipBanner.astro`, used at `apps/web/src/pages/[lang]/publicaciones/[slug].astro:478`, fed by `PostService` (`post.service.ts:99`, `sponsorship: { sponsor: true }`) |
| Admin | CRUD works | `apps/admin/src/features/sponsors/` → `/api/v1/admin/post-sponsors` |
| Seed | Example fixtures exist | `packages/seed/src/data/postSponsor/` (5), `data/postSponsorship/` (5), `example/postSponsors.seed.ts`, `example/postSponsorships.seed.ts` |

Model in one line: **a sponsor brand (not a system user) sponsors a specific post, for a period, with a message.** Editorial/simple.

### 2.2 System B — `Sponsorship` / `SponsorshipLevel` / `SponsorshipPackage` (new, polymorphic, rich)

| Layer | State | Location |
|-------|-------|----------|
| DB | `sponsorships` (sponsorUserId→users, targetType `event|post`, targetId, levelId→sponsorship_levels, packageId→sponsorship_packages, `sponsorshipStatus` `pending|active|expired|cancelled` default `pending`, lifecycleState, startsAt/endsAt, `paymentId` free text, logoUrl, linkUrl, couponCode/couponDiscountPercent, analytics jsonb {impressions,clicks,couponsUsed}) + `sponsorship_levels` (bronze/silver/gold/standard/premium, targetType, price, benefits[], isActive) + `sponsorship_packages` (includedPosts, includedEvents, eventLevelId, price) | `packages/db/src/schemas/sponsorship/*.dbschema.ts`; `0000_baseline.sql:747,774,795`; enums `enums.dbschema.ts:39-41` |
| Schemas | Full set + dedicated enums | `packages/schemas/src/entities/sponsorship/`; `enums/sponsorship-status.enum.ts`, `sponsorship-target-type.enum.ts`, `sponsorship-tier.enum.ts` |
| Services | CRUD + real ownership logic | `packages/service-core/src/services/sponsorship/sponsorship.service.ts` (`_beforeCreate` auto-slug + validates `level.targetType === data.targetType`; `_beforeUpdate` blocks `sponsorshipStatus` change without `SPONSORSHIP_STATUS_MANAGE`; `_executeSearch`/`_executeCount` force `lifecycleState = ACTIVE`), `sponsorship.permissions.ts` (`isSponsor(actor, entity) = entity.sponsorUserId === actor.id`) |
| API | Admin CRUD + **protected self-facing** | admin: `/api/v1/admin/sponsorships`, `/sponsorship-levels`, `/sponsorship-packages`; protected: `/api/v1/protected/sponsorships` (create, getById, list, getAnalytics, update, softDelete); public: only level/package catalogs |
| **Web (public)** | **NONE.** No rendering anywhere | — |
| Admin | Substantial CRUD | `apps/admin/src/features/sponsorships/` (`SponsorshipsTab.tsx` 337 LOC, `CreateSponsorshipDialog.tsx` 379, levels/packages tabs), `routes/_authed/billing/sponsorships.tsx`, `routes/_authed/posts/$id_.sponsorship.tsx` (211) |
| Seed | Catalogs only | `data/sponsorshipLevel/` (5 required), `data/sponsorshipPackage/` (3 required). **NO seed for the `sponsorships` entity itself → table is empty on a fresh DB.** |

Model in one line: **a sponsor user sponsors a post OR an event, at a tier/package, for a period, with tracked metrics and status.** Product-grade.

## 3. Findings from the audit (the debt on B)

System B is where we're consolidating, but it is **not finished**. Everything below must be paid down as part of this spec (mostly Phase 3):

- **F-1 (security) — ownership gap in the protected list.** `SponsorshipService._executeSearch`/`_executeCount` force `lifecycleState = ACTIVE` but do **NOT** force `sponsorUserId = actor.id` for an actor holding only `SPONSORSHIP_VIEW_OWN` (not `_ANY`). `checkCanList` only validates the actor has *one of* the two permissions; the executed query is not re-scoped by owner. `sponsorship.query.schema.ts:26,88` even exposes `sponsorUserId` as an optional caller filter. **Consequence:** if the `SPONSOR` role were activated today, a sponsor user could list other sponsors' data. This is a hard blocker before Phase 4 (self-service dashboard) and must be fixed in Phase 3.
- **F-2 — no expiry cron.** There is no `sponsorship-expiry.job.ts`. An anticipatory composite index `sponsorships_lifecycleState_endsAt_idx` exists (added by SPEC-063-gaps T-016 / GAP-034 with the comment "anticipatory composite for a future sponsorship-expiry cron"), but the job was never written. `apps/api/src/cron/jobs/partner-expiry.job.ts` is the pattern to copy ("Mirrors the sponsorship expiry pattern" — ironically the mirror shipped, the original didn't). Today a `sponsorship` with `endsAt` in the past stays `active` forever unless an admin edits it.
- **F-3 — no real billing link.** `ProductTypeEnum.SPONSORSHIP` exists as an enum value but is **not consumed anywhere** (only its own test references it). `packages/billing/src/` has zero references to sponsorship. `sponsorships.paymentId` is free `text`, not a FK to `billing_payments`/`billing_subscriptions`. Per HOS-38 Q4 the owner deferred "how a sponsor is charged" to a later spec; this spec does NOT build billing integration.
- **F-4 — no seed for the entity.** The `sponsorships` table has no example fixtures, so it is empty on a fresh DB and the future dashboard/banner can't be exercised without hand-creating rows. Add example seed in Phase 3 (mirror the partner seed pattern just added in PR #2181).
- **F-5 — SPONSOR role already half-built (more than HOS-38 assumed).** `RoleEnum.SPONSOR` exists (`packages/schemas/src/enums/role.enum.ts:25`) with a full permission block (`rolePermissions.seed.ts:1141-1168`: SPONSORSHIP_VIEW/UPDATE/SOFT_DELETE/RESTORE/UPDATE_VISIBILITY `_OWN`, USER_BOOKMARK_COLLECTION_*, BILLING_VIEW_OWN, SUBSCRIPTION_VIEW_OWN) — inherited from SPEC-156. A test user `sponsor@local.test` is documented. But the role is `enabled: false` in admin IA (`apps/admin/src/config/ia/roles/sponsor.ts`, T-014), and no route guard/login wiring is active. So the role scaffolding exists; only activation + the F-1 fix are missing.
- **F-6 — entitlement isolation not considered.** Accommodation billing filters entitlements by `product_domain` (SPEC-239). Sponsorship is a separate commercial domain; confirm during implementation that turning a user into a sponsor does NOT pollute their accommodation/commerce entitlements (may need a `product_domain`-style guard or simply that sponsorship never touches `loadEntitlements`). Validate, don't assume.

## 4. Decisions

### 4.1 Owner decision (2026-07-08): consolidate on B, deprecate A

**Chosen: "rich product".** A sponsor can auspiciar **posts AND events**, with levels, packages, and metrics, and (eventually) a read-only self-service panel. System A (`PostSponsor`/`PostSponsorship`) is deprecated and removed. Rationale: B is where the refactor was heading, is strictly a superset of A's capability, and is the backbone HOS-38 already assumes.

### 4.2 Inherited HOS-38 decisions (must be honored)

The owner already resolved these on 2026-07-07 for the sponsor self-service area; they constrain Phase 4:

- Sponsor is a **first-class user role** (build it; partly exists — see F-5).
- The self-service dashboard lives in **`apps/web`** (external end-user), NOT `apps/admin`. The broken `apps/admin/_authed/sponsor/*` + `features/sponsor-dashboard/` scaffolding is **removed**.
- The dashboard is **read-only** — no create/edit/cancel/purchase from the sponsor side. All management stays admin-side.
- Sponsor assignment is **admin-driven** (no self-signup).
- Billing integration (Q4) and metric instrumentation (Q5) are **deferred** (Q5 → PostHog / SPEC-140).

## 5. Open design questions to resolve at implementation start

These emerged from the audit and are **not yet decided**. Resolve them in Phase 1 (validate against live schema) before writing migration code — they materially change the data migration:

- **OQ-1 (the big one) — sponsor identity: brand-without-user.** System A's `PostSponsor` is a **brand entity that is NOT a system user** (name, logo, contact, social) — the banner renders it with no login. System B ties a sponsorship to `sponsorUserId → users` (a real user, for ownership + the self-service dashboard). **How do you migrate a brand that has no user?** Options to decide:
  - (a) Make `sponsorships.sponsorUserId` nullable and treat "display-only" sponsorships (logo/linkUrl, no owner) as distinct from "owned" ones (a user, eligible for the dashboard). B already has `logoUrl`/`linkUrl` on the row, so the banner can render without a user.
  - (b) Auto-create a placeholder/`SPONSOR` user per migrated brand.
  - (c) Add a first-class `SponsorBrand` entity that a `sponsorship` optionally references, separating "who is displayed" from "who owns the record".
  - Verify `sponsorUserId` nullability in the live schema first; the answer drives the whole migration.
- **OQ-2 — `PriceType`/`paid` vs B's `paymentId`.** A tracks `paid` (PriceType) + `paidAt` on the join; B has free-text `paymentId` + tier/package pricing. Decide how A's paid amounts map (or if they're dropped as historical).
- **OQ-3 — `isHighlighted` / `message` / `description` fields.** Map A's per-post `message`, `description`, `isHighlighted` onto B's row (B has none of these three by name — `message` likely → a new column or reuse; confirm). May require adding columns to `sponsorships`.
- **OQ-4 — targetType default for migrated rows.** All A rows are post-scoped → `targetType = 'post'`, `targetId = postId`. Straightforward, but confirm every `post_sponsorship.postId` still resolves to a live post.

## 6. Phased plan

Each phase is a separate PR (or PR set) and gates on the prior. Worktree created at Phase 1 start (branch `spec/HOS-107-...`).

### Phase 0 — Decisions + spec (this pass) ✅
Direction chosen (B), findings + open questions recorded. No code.

### Phase 1 — Validate model + resolve OQ-1..OQ-4 (design)
- Confirm live schema: `sponsorUserId` nullability, exact columns on `sponsorships`, whether `message`/`isHighlighted` have homes.
- Resolve OQ-1..OQ-4 with the owner. Adjust the schema plan (nullable `sponsorUserId`, or new columns, or a `SponsorBrand` entity) accordingly. Any schema change → Drizzle migration (`db:generate`) + follow the three-carril rules.
- Deliverable: a finalized data-migration mapping table (A columns → B columns), ready to code.

### Phase 2 — Data migration + web banner on B
- Write the seed data-migration / SQL to move `post_sponsors` + `post_sponsorships` → `sponsorships` per the Phase-1 mapping (three-carril rules; this is seed DATA → `packages/seed/src/data-migrations/` if it touches live rows, plus baseline edits).
- Migrate the public banner: `PostSponsorshipBanner.astro` + `publicaciones/[slug].astro:478` + `PostService` (`post.service.ts:99`) to read the sponsorship from System B instead of `post_sponsorship`. **Add a `transforms.ts` function** for it — the current code casts raw (`as Record<string, unknown>`), violating the project's own transform convention (fix while here).
- Keep A running in parallel until the banner is verified on B (no big-bang cutover).

### Phase 3 — Deprecate/remove A + pay down B's debt
- Remove System A end to end: `post_sponsors`/`post_sponsorships` tables (drop migration), schemas, services (`postSponsor/`, `postSponsorship/`), admin routes (`/admin/post-sponsors`), `apps/admin/src/features/sponsors/`, and the A seed (`data/postSponsor/`, `data/postSponsorship/`). Update the drift guard / dual-write ledger as needed.
- **F-1 fix (security):** force `sponsorUserId = actor.id` in `_executeSearch`/`_executeCount` for `VIEW_OWN`-only actors (mirror the existing `lifecycleState = ACTIVE` force). Add a regression test.
- **F-2:** write `sponsorship-expiry.job.ts` (copy `partner-expiry.job.ts`), register in cron registry + manifest; moves `sponsorshipStatus active→expired` when `endsAt` passes. Uses the existing anticipatory index.
- **F-4:** add example `sponsorships` seed (mirror the partner seed from PR #2181; non-deterministic ids unless a fixture is referenced by id).
- **F-6:** verify entitlement isolation (sponsorship must not pollute accommodation/commerce `loadEntitlements`).

### Phase 4 — Sponsor self-service dashboard (absorbs HOS-38)
- Activate the `SPONSOR` role (flip `enabled`, add web route guard + login wiring; admin-driven assignment, no self-signup — F-5).
- Build the **read-only** dashboard in `apps/web` (summary, my-sponsorships, metrics, invoices-or-"coming soon") consuming `/api/v1/protected/sponsorships/*` (now correctly owner-scoped after F-1). i18n + CSS Modules (web conventions).
- Remove the dead admin scaffolding `apps/admin/_authed/sponsor/*` + `features/sponsor-dashboard/` (HOS-38 Phase 3).
- Metrics: show existing columns only; defer instrumentation to SPEC-140 (HOS-38 Q5). Invoices: read-only or "coming soon" (HOS-38 Q4).
- On completion, close HOS-38.

## 7. Risks & tradeoffs

| # | Risk | Mitigation |
|---|------|------------|
| R-1 | Touching the only working public sponsor surface (banner) can regress live content | Phase 2 keeps A alive until B renders the banner correctly; no big-bang cutover |
| R-2 | Brand-without-user (OQ-1) is a genuine model mismatch, not a rename | Resolve OQ-1 in Phase 1 *before* coding migration; the row already carries logoUrl/linkUrl so display is possible without a user |
| R-3 | Data loss migrating A's `paid`/`message`/`isHighlighted` | OQ-2/OQ-3 decide mapping vs drop explicitly; historical data preserved or consciously discarded |
| R-4 | Enum-casing footgun (same class as the partners bug in PR #2181) | Any new/changed sponsorship filter must be exercised by an **integration** test against real Postgres, not a mocked unit test |
| R-5 | Activating SPONSOR role with F-1 unfixed leaks cross-sponsor data | F-1 is a Phase-3 gate; Phase 4 must not start until it's fixed + tested |

## 8. Out of scope (explicit)

- Sponsor self-signup / onboarding (admin-driven assignment only — HOS-38).
- Any sponsor-side mutation or self-service checkout (read-only dashboard — HOS-38).
- Real billing integration for sponsorships (F-3 / HOS-38 Q4 — separate spec).
- Banner impression/click instrumentation (HOS-38 Q5 → SPEC-140 PostHog).

## 9. Acceptance criteria (for the eventual implementation)

- [ ] OQ-1..OQ-4 resolved and recorded; data-migration mapping finalized.
- [ ] All `post_sponsorship` data migrated into `sponsorships`; no orphaned rows.
- [ ] Public banner renders from System B (with a proper `transforms.ts` function), verified on real data.
- [ ] System A removed entirely (tables, schemas, services, admin routes, features/sponsors, seed); CI green.
- [ ] F-1 fixed: a `VIEW_OWN`-only sponsor sees only their own rows (integration test with two users).
- [ ] `sponsorship-expiry` cron active; a past-`endsAt` sponsorship flips `active→expired`.
- [ ] Example `sponsorships` seed present; fresh DB shows sponsored content out of the box.
- [ ] Entitlement isolation verified (F-6).
- [ ] (Phase 4) Read-only sponsor dashboard in `apps/web`; dead admin scaffolding removed; HOS-38 closed.

## 10. Cross-references

- [HOS-38](https://linear.app/hospeda-beta/issue/HOS-38) — Sponsor self-service area (this spec resolves its Q2 and provides its backbone; HOS-38 becomes Phase 4).
- PR #2181 — Partners public-directory fix + seed (same investigation; enum-casing lesson, R-4).
- `packages/db/src/schemas/post/post_sponsor*.dbschema.ts`, `sponsorship/*.dbschema.ts` — the two models.
- `apps/web/src/components/post/PostSponsorshipBanner.astro` — the only public surface (Phase 2 migrates it).
- `apps/api/src/cron/jobs/partner-expiry.job.ts` — pattern for F-2.
- SPEC-156 — origin of the `SPONSOR` role/permissions (F-5).
- SPEC-140 — PostHog analytics (metric instrumentation deferral).
- SPEC-239 — product_domain entitlement isolation precedent (F-6).

## 11. Next action

Deferred to backlog. When picked up: re-open HOS-107 (Backlog → In Progress), create the implementation worktree (`spec-hos-107-sponsors-consolidation`), resolve OQ-1..OQ-4 with the owner, then `/task-master:task-from-spec` to generate the Phase 1-4 breakdown.
