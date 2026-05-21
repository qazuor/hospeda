---
specId: SPEC-151
title: Sponsor Self-Service Area — Feature Audit + Scope Decision
status: draft
complexity: high
owner: qazuor
created: 2026-05-20
parent: (none)
related:
  - SPEC-143 (billing testing coverage — origin of follow-up F2)
  - SPEC-147 (user self-service subscription cancellation — adjacent surface)
---

# SPEC-151 — Sponsor Self-Service Area

> **Status**: DRAFT — needs scope decisions from owner before generating tasks. The "follow-up F2" from the post-SPEC-143 billing audit was scoped as "1 broken endpoint in sponsor-dashboard hooks", but on inspection the entire sponsor self-service area is half-built (3 of 4 sub-pages are placeholders or broken). This spec audits the current state and asks the owner to decide the destination.

## 1. Origin

During the post-SPEC-143 billing UI audit (`docs/billing/ui-audit-2026.md`), one of the four follow-ups was:

> **F2 — sponsor-dashboard endpoint** (1 call `/protected/billing/*`) — `apps/admin/src/features/sponsor-dashboard/hooks.ts` line 94. The comment says *"Expected endpoint: GET /api/v1/protected/billing/invoices?sponsorId=current"*.

The owner asked to "discuss the entire sponsors feature, not just the 1-call bug" — recognizing that the area was incomplete. This spec is that audit.

## 2. Current state — what exists today

### 2.1 Data model (5 entities in DB + schemas + services)

| Entity | DB table | Service | Purpose |
|--------|----------|---------|---------|
| `Sponsorship` | `sponsorship` | `SponsorshipService` | Generic sponsorship record (a sponsor pays to sponsor something) |
| `SponsorshipPackage` | `sponsorship_package` | `SponsorshipPackageService` | Catalog of available sponsorship offerings (price, duration, perks) |
| `SponsorshipLevel` | `sponsorship_level` | `SponsorshipLevelService` | Tier classification (bronze/silver/gold) |
| `PostSponsor` | `post_sponsor` | `PostSponsorService` | Sponsor entity attached to a post (the brand/company) |
| `PostSponsorship` | `post_sponsorship` | `PostSponsorshipService` | Join: which sponsor sponsors which post + period + metrics |

**Open question Q1**: PostSponsor vs Sponsorship — are these two distinct concepts (a sponsor at the post-level vs a generic sponsor record), or is one obsoleted by the other? The naming and split suggest a refactor in progress. Owner decision needed.

### 2.2 API routes (4 directories)

All under `apps/api/src/routes/`:

```
postSponsor/
├── admin/             (CRUD admin)
└── index.ts

sponsorship/
├── admin/             (CRUD admin: list/create/update/delete)
├── protected/         (sponsor-self-facing: list, get-by-id, get-analytics, create, update, soft-delete)
└── index.ts

sponsorship-package/
├── admin/             (CRUD admin)
├── public/            (read public: list available packages)
└── index.ts

sponsorship-level/
├── admin/             (CRUD admin)
├── public/            (read public: list levels)
└── index.ts
```

**Key finding**: `protected/` tier exists for `sponsorship` with a list+analytics+CRUD surface that returns ONLY the actor's own sponsorships. This is exactly what the sponsor dashboard should be calling — but doesn't.

### 2.3 Admin app — three coexisting feature directories

| Directory | Status | Purpose |
|-----------|--------|---------|
| `apps/admin/src/features/sponsors/` | half-empty (only `index.ts`, `types.ts`, but `types.ts` not exported) | Admin-side CRUD of sponsors (the brands) |
| `apps/admin/src/features/sponsorships/` | partial (only `useSponsorshipQueries`) | Admin-side CRUD of sponsorships (the relations) |
| `apps/admin/src/features/sponsor-dashboard/` | partial (3 hooks + types) | Sponsor-FACING dashboard (a logged-in sponsor views their own data) |

The three are mixed in mental model:
- `sponsors/` + `sponsorships/` = **admin manages sponsors as a domain** (CRUD by platform admin).
- `sponsor-dashboard/` = **sponsor users view their own billing/sponsorships** (self-service, NOT admin gestionando).

### 2.4 Admin app — sponsor-facing pages (`routes/_authed/sponsor/*`)

| Route | Status | Backend it calls | Reality |
|-------|--------|------------------|---------|
| `/sponsor/` (index) | UI complete | `useSponsorSummaryQuery` → `GET /api/v1/admin/sponsorships?sponsorshipStatus=active` then reduces client-side | **Broken**: hits admin endpoint (returns ALL sponsorships in system) and aggregates incorrect totals as the actor's. Wrong data, wrong endpoint. |
| `/sponsor/sponsorships` | UI complete (16K LOC) | `useSponsorSponsorshipsQuery` → `GET /api/v1/admin/sponsorships?<filters>` | **Broken**: hits admin endpoint without sponsor-self filter. Lists all sponsorships in system. |
| `/sponsor/analytics` | stub (944 bytes) | `useSponsorAnalyticsQuery` returns hard-coded `[]` | **Placeholder**: no backend, no UI substance. Comment says "Pending: GET /api/v1/admin/sponsorships/:id/analytics" — but that endpoint exists at `/protected/sponsorships/:id/analytics`. |
| `/sponsor/invoices` | UI complete (12K LOC) | `useSponsorInvoicesQuery` → `GET /api/v1/protected/billing/invoices` | **Broken** (original F2): returns the actor's billing invoices, no sponsor filter. PDF download button is `disabled` in code. |

### 2.5 Admin app — admin-facing sponsor management pages

| Route | Status |
|-------|--------|
| `routes/_authed/billing/sponsorships.tsx` | Exists. Admin sees all sponsorships under the billing area. |
| `routes/_authed/posts/$id_.sponsorship.tsx` | Exists. Per-post sponsor assignment. |

### 2.6 Web app

| Component | Purpose |
|-----------|---------|
| `apps/web/src/components/post/PostSponsorshipBanner.astro` | Renders sponsor info on a sponsored post (public-facing). |

## 3. Problem statement

The sponsor self-service area (`/_authed/sponsor/*`) is presented in the UI sidebar as if it were a working feature, but every page either calls the wrong endpoint, calls a placeholder, or filters by the wrong identity. A real sponsor logging in would see:

- Inflated/incorrect "active sponsorships" + "total impressions" + "investment" summary (data of all sponsors in the system, not theirs).
- A sponsorships list that shows EVERY sponsorship in the system, not just theirs.
- An empty analytics page.
- An invoices page that shows the actor's billing invoices (not sponsor-related).

Two layers compound the issue:

1. **Identity confusion** — the actor logged into admin is the platform admin OR a sponsor user. The current code assumes admin everywhere.
2. **Endpoint confusion** — there is a working `/protected/sponsorships/*` API surface, but the frontend uses `/admin/sponsorships/*` instead.

In short: the feature was bootstrapped without a coherent identity model and never wired to the right backend endpoints.

## 4. Scope decision points (Owner must answer)

The spec cannot proceed to tasks without these decisions. None are "implementation details" — they shape the whole feature.

### Q1 — Is the "Sponsor" a first-class user role today?

Three possibilities:

- **A. Yes** — A `Sponsor` is a user with a specific permission set + linked sponsor entity. They log into admin/sponsor URL and only see their data. Existing `PermissionEnum.SPONSOR_*` permissions are wired or need to be wired.
- **B. Not yet, but should be** — sponsor self-service is a future feature; today, only platform admins exist. We need to design + add the `Sponsor` role.
- **C. No, and don't bother** — sponsorships are managed exclusively by platform admins for now (no sponsor self-service). The `/_authed/sponsor/*` pages are dead code or aspirational and should be deleted/hidden.

**Default assumption if no answer**: B (not yet, but worth designing). If C, scope collapses to a delete + hide PR.

### Q2 — PostSponsor vs Sponsorship — which is canonical?

Looking at the schema/service code: it appears `Sponsorship` is the newer/cleaner abstraction (has protected tier, analytics endpoint, levels, packages), while `PostSponsor` + `PostSponsorship` look like an older post-specific concept that may have been generalized.

- **A. Sponsorship is canonical** — PostSponsor/PostSponsorship are vestigial; plan migration/deprecation.
- **B. Both are canonical** — PostSponsor = the BRAND entity (a company), Sponsorship = the contract relating that brand to a target (post, event, accommodation, etc.). Different roles, both stay.
- **C. Reverse** — PostSponsor is canonical and Sponsorship is a recent refactor that was never completed.

**Default assumption if no answer**: B (PostSponsor = brand entity, Sponsorship = contract). This needs validation against the actual schema relationships.

### Q3 — Is this pre-launch or post-launch work?

- **A. Pre-launch (must ship before public launch)** — block launch on having sponsor self-service. Adds 2-4 weeks of work. Unlikely useful given no sponsors are onboarded yet.
- **B. Post-launch v1.5 / v2** — ship Hospeda first, recruit sponsors after, then build the dashboard once we have real sponsors. Scope this as a backlog spec.
- **C. Now, but only the broken-endpoint fixes (no new features)** — make the existing pages correctly call `/protected/sponsorships/*` so they show real data; defer analytics / invoice PDF / sponsor signup flow.

**Default assumption if no answer**: B or C depending on how soon a sponsor is expected. C is the minimum-effort cleanup that takes the area from "broken" to "honestly showing what's there".

### Q4 — Billing integration for sponsors?

A sponsor pays. The current flow has zero integration with the billing system:

- `SponsorInvoice` (in `sponsor-dashboard/types.ts`) defines its own shape that has nothing to do with `billing_invoices`.
- The dashboard hits `/protected/billing/invoices` but the comment says it should be filtered by `sponsorId=current` — that's not a field on `billing_invoices`.
- No sponsorship records appear to be linked to billing customer / subscription / invoice rows.

Options:

- **A. Sponsorships are billed via standard subscriptions/invoices** — link `sponsorship_package` → `billing_plan`, sponsor user gets a `billing_customer`, invoices flow through the standard billing pipeline.
- **B. Sponsorships have their own ad-hoc payment flow** — manual invoicing, no billing integration. The `SponsorInvoice` type stays separate.
- **C. Decide later** — deprecate the sponsor invoice page UI for now (delete or "coming soon").

**Default assumption if no answer**: C (decide later), but if Q3 = A or C, must answer this now.

### Q5 — Analytics and tracking

The dashboard shows impressions, clicks, CTR. Today these come from `sponsorship.impressions` and `sponsorship.clicks` columns. But there's no instrumentation in the web app that increments these counters when a `PostSponsorshipBanner` is rendered/clicked.

- **A. Wire instrumentation now** — add tracking to the web Banner component, expose increment endpoints, integrate with PostHog (SPEC-140) if applicable.
- **B. Skip tracking — show "coming soon" on metrics** — hide impressions/clicks columns from the dashboard. Sponsorships table still works, just without metrics.
- **C. Defer to SPEC-140 (analytics-stack-posthog)** — PostHog will source these metrics anyway. Don't write our own counter pipeline.

**Default assumption if no answer**: B + C combined (hide metrics, defer to SPEC-140 when ready).

## 5. Proposed phases (assumes Q3 = C, "fix what's there + honest UI")

If owner picks the minimum-effort path, the work decomposes as follows. Each phase is gated on the prior.

### Phase 0 — Identity model decision (15min, just decisions, no code)

Answer Q1 + Q2. If Q1 = C, jump to Phase X (delete area).

### Phase 1 — Endpoint correction (~2h)

Switch the 4 dashboard hooks to the correct backend:

- `useSponsorSummaryQuery` → derive from `GET /api/v1/protected/sponsorships?sponsorshipStatus=active`. Backend already returns only the actor's records (assuming Q1 = A or B with sponsor role).
- `useSponsorSponsorshipsQuery` → `GET /api/v1/protected/sponsorships?<filters>`.
- `useSponsorAnalyticsQuery` → `GET /api/v1/protected/sponsorships/:id/analytics` (per-sponsorship; the dashboard summary may need a separate endpoint).
- `useSponsorInvoicesQuery` → depends on Q4. If Q4 = C, change the UI to show "coming soon".

Acceptance: dashboard pages render the actor's own data (verified locally with two test users — admin and sponsor).

### Phase 2 — UI honesty (~1h)

Remove or hide features that are placeholders:

- Disable PDF download button on invoices page (already `disabled` in code) — add visible "coming soon" tooltip.
- If Q5 = B/C, hide the impressions/clicks columns from sponsorships table.
- Remove "recent activity" card from dashboard if no API exists (`activityApiPending` flag).

### Phase 3 — Backend gaps (depends on prior answers)

Catch all the backend endpoints required by the dashboard that don't exist yet. Examples (depending on Q1-Q5):

- Aggregate-summary endpoint (so the dashboard doesn't fetch 1000 sponsorships to reduce client-side).
- Recent activity feed.
- Sponsor-invoice link (Q4 = A).

### Phase X — Delete area (only if Q1 = C)

- Remove `apps/admin/src/routes/_authed/sponsor/*` routes.
- Remove sidebar entries pointing there.
- Remove `apps/admin/src/features/sponsor-dashboard/`.
- Optionally remove `apps/admin/src/features/sponsors/` + `sponsorships/` if also dead.
- Keep `routes/_authed/billing/sponsorships.tsx` (admin-managed view).

Estimated effort: 1-2h.

## 6. Risk + tradeoffs

| Path | Effort | Risk if wrong |
|------|--------|---------------|
| Full feature build-out (Q3 = A) | 2-4 weeks | Building for hypothetical sponsors that may never come; bloats codebase |
| Fix-what's-there only (Q3 = C) | 4-6h | Sponsor self-service stays half-baked but at least not lying; cosmetic debt |
| Delete area (Q1 = C) | 1-2h | If sponsors come later, we rebuild from scratch; loses the existing UI scaffolding |
| Status quo | 0h | UI shows fake/wrong data; if anyone tests with a real sponsor account it embarrasses |

## 7. Out of scope (explicit)

- Sponsor onboarding flow (signup, OAuth invite, role assignment) — separate spec if ever needed.
- Sponsor-side billing customer creation (Q4 = A) — separate spec.
- Reporting / advanced analytics for sponsors — covered by SPEC-140 PostHog.
- PostSponsor/PostSponsorship vs Sponsorship reconciliation refactor (Q2) — separate spec if owner chooses A or C.
- Web app banner instrumentation — separate spec, depends on Q5.

## 8. Acceptance criteria (placeholder, depends on Q3)

Will be finalized once Q1-Q5 are answered.

If Q3 = C (minimum path):

- [ ] All 4 hooks in `apps/admin/src/features/sponsor-dashboard/hooks.ts` call `/api/v1/protected/sponsorships/*`.
- [ ] Two manual smokes pass: admin user sees admin pages (`/billing/sponsorships`); sponsor user sees only their own data on `/sponsor/*`.
- [ ] UI no longer claims metrics/PDF/activity that aren't backed by real data.
- [ ] Spec file marked `status: completed` and archived.

## 9. Cross-references

- `docs/billing/ui-audit-2026.md` — F2 origin
- `apps/admin/src/routes/_authed/sponsor/` — sponsor area
- `apps/admin/src/features/sponsor-dashboard/` — dashboard feature
- `apps/api/src/routes/sponsorship/protected/` — backend that the dashboard SHOULD be using
- SPEC-143 — billing testing coverage (parent context for F2 origin)
- SPEC-140 — analytics-stack-posthog (potential source for Q5)
- Engram topic: `spec-151/scope-decisions` (to be created once Q1-Q5 are answered)

## 10. Next action

**Owner**: Answer Q1-Q5. With those answers I can:
- Generate the task breakdown (`/task-master:task-from-spec`).
- Update this spec from `draft` to `in-progress`.
- Cut the worktree + branch.
- Begin implementation.

Estimated total: 1h (delete-only) to 4-6h (minimum fix) to 2-4 weeks (full build-out).
