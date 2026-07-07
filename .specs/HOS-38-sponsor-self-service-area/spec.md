---
title: Sponsor Self-Service Area — Feature Audit + Scope Decision
linear: HOS-38
statusSource: linear
created: 2026-07-01
updated: 2026-07-07
type: improvement
areas:
  - web
  - api
  - auth
  - billing
  - admin
---

# Sponsor Self-Service Area — Feature Audit + Scope Decision

> Migrated from `.qtm/specs/SPEC-151-sponsor-self-service-area/spec.md` on 2026-07-01 as part of the Linear tracking migration. Canonical tracking is now HOS-38.
>
> **Status**: SCOPED — owner answered the Q1-Q5 scope decisions on 2026-07-07 (see §4). Work is **deferred to backlog / post-launch** (low priority); this revision only records the decisions and re-plans the phases. No implementation in this pass. The "follow-up F2" from the post-SPEC-143 billing audit was scoped as "1 broken endpoint in sponsor-dashboard hooks", but on inspection the entire sponsor self-service area is half-built (3 of 4 sub-pages are placeholders or broken). This spec audited that state; the owner has now chosen the destination.

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

**Key finding**: `protected/` tier exists for `sponsorship` with a list+analytics+CRUD surface that returns ONLY the actor's own sponsorships. This is exactly what the sponsor dashboard should be calling — but doesn't. Under the resolved scope (§4) the sponsor dashboard is **read-only**, so only the read half of this surface (list / get-by-id / get-analytics) is consumed; the create/update/soft-delete endpoints stay admin-only.

### 2.3 Admin app — three coexisting feature directories

| Directory | Status | Purpose |
|-----------|--------|---------|
| `apps/admin/src/features/sponsors/` | half-empty (only `index.ts`, `types.ts`, but `types.ts` not exported) | Admin-side CRUD of sponsors (the brands) |
| `apps/admin/src/features/sponsorships/` | partial (only `useSponsorshipQueries`) | Admin-side CRUD of sponsorships (the relations) |
| `apps/admin/src/features/sponsor-dashboard/` | partial (3 hooks + types) | Sponsor-FACING dashboard (a logged-in sponsor views their own data) |

The three are mixed in mental model:

- `sponsors/` + `sponsorships/` = **admin manages sponsors as a domain** (CRUD by platform admin).
- `sponsor-dashboard/` = **sponsor users view their own billing/sponsorships** (self-service, NOT admin gestionando).

> **Resolved-scope note (§4)**: the sponsor-facing dashboard moves to **`apps/web`**. The `apps/admin/src/features/sponsor-dashboard/` directory and the `_authed/sponsor/*` routes below become dead code and are removed during implementation (Phase 3). The admin keeps only the admin-managed views (`sponsors/`, `sponsorships/`, `/billing/sponsorships`).

### 2.4 Admin app — sponsor-facing pages (`routes/_authed/sponsor/*`)

| Route | Status | Backend it calls | Reality |
|-------|--------|------------------|---------|
| `/sponsor/` (index) | UI complete | `useSponsorSummaryQuery` → `GET /api/v1/admin/sponsorships?sponsorshipStatus=active` then reduces client-side | **Broken**: hits admin endpoint (returns ALL sponsorships in system) and aggregates incorrect totals as the actor's. Wrong data, wrong endpoint. |
| `/sponsor/sponsorships` | UI complete (16K LOC) | `useSponsorSponsorshipsQuery` → `GET /api/v1/admin/sponsorships?<filters>` | **Broken**: hits admin endpoint without sponsor-self filter. Lists all sponsorships in system. |
| `/sponsor/analytics` | stub (944 bytes) | `useSponsorAnalyticsQuery` returns hard-coded `[]` | **Placeholder**: no backend, no UI substance. Comment says "Pending: GET /api/v1/admin/sponsorships/:id/analytics" — but that endpoint exists at `/protected/sponsorships/:id/analytics`. |
| `/sponsor/invoices` | UI complete (12K LOC) | `useSponsorInvoicesQuery` → `GET /api/v1/protected/billing/invoices` | **Broken** (original F2): returns the actor's billing invoices, no sponsor filter. PDF download button is `disabled` in code. |

> These four admin pages are the scaffolding that motivated the audit. Under the resolved scope they are **not the target** — the read-only dashboard is rebuilt in `apps/web` (§5). They are removed in Phase 3, not fixed in place.

### 2.5 Admin app — admin-facing sponsor management pages

| Route | Status |
|-------|--------|
| `routes/_authed/billing/sponsorships.tsx` | Exists. Admin sees all sponsorships under the billing area. |
| `routes/_authed/posts/$id_.sponsorship.tsx` | Exists. Per-post sponsor assignment. |

These stay — all sponsorship management (create/edit/cancel/assign) remains an **admin-only** responsibility.

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

## 4. Scope decisions — RESOLVED (owner, 2026-07-07)

> These were open questions in the original audit. The owner answered them on 2026-07-07. The chosen direction is recorded per-question below, followed by the two additional constraints the owner added that reshape the feature.

### Decisions at a glance

| # | Question | Decision |
|---|----------|----------|
| **Q1** | Is "Sponsor" a first-class user role? | **A — Yes, build it.** A `Sponsor` becomes a real user role (does not exist today; must be designed + added). |
| **Location** | Where does the sponsor dashboard live? | **`apps/web`, NOT `apps/admin`.** A sponsor is an external end-user, like an accommodation owner — the self-service dashboard belongs in the web app. |
| **Nature** | What can the sponsor do? | **Read-only.** The sponsor only *views* (what they've sponsored, metrics, history). No create / edit / cancel / any action. All management stays admin-side. |
| **Q2** | PostSponsor vs Sponsorship canonical? | **B (default) — validate at implementation.** PostSponsor = brand entity, Sponsorship = contract. Confirm against the real schema before building. |
| **Q3** | Timing? | **B — Post-launch / backlog, low priority.** Not built now; recruit sponsors first, build the dashboard once real sponsors exist. |
| **Q4** | Billing integration? | **C — decide later.** The invoices view is read-only; *how* a sponsor is charged (billing-pipeline integration) is a separate spec. If no integration exists at build time, the invoices section shows "coming soon". |
| **Q5** | Analytics / tracking? | **B + C — show existing metrics read-only, defer instrumentation to SPEC-140 (PostHog).** Do not build a custom counter pipeline now. |

### 4.1 Q1 — Sponsor is a first-class user role: **YES (build it)**

A `Sponsor` will be a user role with its own permission set and a linked sponsor entity, so the user logs in (to the **web app**) and sees only their own data. This role does **not** exist today, so it must be designed and added (permissions, user↔sponsor link, route guard). How a user *becomes* a sponsor (assignment) is deliberately kept minimal — see §4.3.

### 4.2 Location — the dashboard lives in **`apps/web`**

The original audit found the scaffolding in `apps/admin` (`/_authed/sponsor/*`). That was the wrong home: `apps/admin` is staff-only, while a sponsor is an external customer. The resolved dashboard is built in **`apps/web`** (React islands / Astro per the web app's conventions), consuming the `/api/v1/protected/sponsorships/*` read endpoints. The admin scaffolding is removed (Phase 3).

### 4.3 Nature — **read-only**

The sponsor dashboard is a **view-only** surface. The sponsor can see:

- A summary of their sponsorship activity (active count, totals).
- The list of what they are sponsoring (their own sponsorships only).
- Metrics per sponsorship (impressions / clicks / CTR — subject to Q5).
- Their invoices (subject to Q4).

The sponsor **cannot** take any action: no starting a new sponsorship, no cancelling, no editing, no self-service purchase. Every mutation (assigning a sponsor to a post, creating/cancelling a contract, billing) stays an **admin** responsibility via the existing admin pages (§2.5). This is a hard constraint — it keeps the initial build small and avoids the whole billing-checkout / self-signup surface.

### 4.4 Q3 — timing: **post-launch / backlog (low priority)**

The owner explicitly rates this low-priority relative to other issues. No implementation happens in this pass. HOS-38 returns to **Backlog** after this spec update. Implementation is picked up later, once there are real sponsors to serve.

## 5. Proposed phases (for the eventual implementation)

> Not started in this pass. This is the plan for when the backlog item is picked up. Each phase gates on the prior.

### Phase 0 — Decisions + spec update ✅ (this pass, 2026-07-07)

Q1-Q5 answered, location + read-only constraints recorded, phases re-planned. No code.

### Phase 1 — Sponsor role (auth)

- Add a first-class `Sponsor` role: `PermissionEnum.SPONSOR_*` wiring, a user↔sponsor-entity link, and a route guard so a sponsor user can only read their own sponsorships.
- Sponsor assignment is **admin-driven** (an admin marks a user as a sponsor and links the sponsor entity) — no self-signup flow. Self-signup/onboarding is explicitly out of scope (§7).
- Confirm Q2 against the real schema here: which of `PostSponsor` / `Sponsorship` is the entity the user links to.

### Phase 2 — Web read-only dashboard (`apps/web`)

- New sponsor dashboard routes in `apps/web`, consuming the read half of `/api/v1/protected/sponsorships/*`:
  - **Summary** — derive from `GET /protected/sponsorships?sponsorshipStatus=active` (or a dedicated aggregate endpoint if the client-side reduce is too heavy — see Phase 3).
  - **My sponsorships** — `GET /protected/sponsorships?<filters>` (actor-scoped by the backend).
  - **Metrics** — `GET /protected/sponsorships/:id/analytics`. Per Q5, show existing columns only; no new instrumentation.
  - **Invoices** — per Q4: read-only view if a billing link exists, else "coming soon".
- Strictly read-only UI: no action buttons, no forms, no mutating calls.
- i18n for all strings (web app convention), vanilla CSS / CSS Modules (not Tailwind — web app rule).

### Phase 3 — Remove the dead admin scaffolding

- Remove `apps/admin/src/routes/_authed/sponsor/*` and the sidebar entries pointing there.
- Remove `apps/admin/src/features/sponsor-dashboard/`.
- Evaluate `apps/admin/src/features/sponsors/` + `sponsorships/` — keep only what the admin-managed views (`/billing/sponsorships`, per-post assignment) actually use; remove the rest.
- **Keep** `routes/_authed/billing/sponsorships.tsx` and `routes/_authed/posts/$id_.sponsorship.tsx` (admin management).

### Phase 4 — Backend gaps (only if Phase 2 surfaces them)

- A dedicated aggregate-summary endpoint (so the dashboard doesn't fetch N sponsorships to reduce client-side).
- Sponsor↔invoice link (only if Q4 is later escalated to "A — standard billing").

## 6. Risk + tradeoffs

| Path | Effort | Risk if wrong |
|------|--------|---------------|
| **Chosen: sponsor role + web read-only dashboard, post-launch** | ~1-2 weeks when picked up (role + web dashboard + admin cleanup) | Building for sponsors that may take time to arrive; but read-only + admin-driven assignment keeps the blast radius small and defers the expensive surfaces (billing checkout, self-signup, instrumentation). |
| Full self-service build-out (mutations, checkout) | 2-4 weeks | Not chosen — over-builds for hypothetical sponsors. |
| Delete area entirely | 1-2h | Not chosen — owner wants the feature, just later. |
| Status quo | 0h | UI shows fake/wrong data; embarrassing if tested with a real sponsor account. Mitigated because the broken admin pages are removed in Phase 3 regardless. |

## 7. Out of scope (explicit)

- **Sponsor self-signup / onboarding flow** (a user turning themselves into a sponsor) — assignment is admin-driven; a real signup/invite flow is a separate spec if ever needed.
- **Any sponsor-side mutation** (start/stop/edit a sponsorship, self-service purchase) — read-only by decision (§4.3); management stays admin-side.
- **Sponsor-side billing customer creation + checkout** (Q4 = A path) — separate spec.
- **Web app banner instrumentation** (incrementing impressions/clicks) — separate spec; deferred to SPEC-140 (PostHog) per Q5.
- **PostSponsor/PostSponsorship vs Sponsorship reconciliation refactor** (Q2 = A/C path) — separate spec; Phase 1 only *validates* the model, does not refactor it.

## 8. Acceptance criteria (for the eventual implementation)

To be finalized when the backlog item is picked up. Target for the chosen scope:

- [ ] A `Sponsor` role exists (permissions + user↔sponsor link + guard); a sponsor user can authenticate on the web app.
- [ ] `apps/web` exposes a read-only sponsor dashboard: summary, my-sponsorships, metrics, invoices.
- [ ] Every data call is actor-scoped via `/api/v1/protected/sponsorships/*`; a sponsor sees only their own data (verified with two test users: a sponsor and a non-sponsor).
- [ ] The dashboard has **no** mutating controls (no create/edit/cancel/purchase).
- [ ] Metrics show existing columns only (or "coming soon"); no custom instrumentation added.
- [ ] Invoices show a read-only view or "coming soon" (per Q4 at build time).
- [ ] The dead admin scaffolding (`_authed/sponsor/*`, `features/sponsor-dashboard/`) is removed; admin management pages remain.
- [ ] Spec marked complete and the Linear issue closed.

## 9. Cross-references

- `docs/billing/ui-audit-2026.md` — F2 origin
- `apps/admin/src/routes/_authed/sponsor/` — sponsor area (to be REMOVED, Phase 3)
- `apps/admin/src/features/sponsor-dashboard/` — dashboard feature (to be REMOVED, Phase 3)
- `apps/web/` — new home of the read-only sponsor dashboard (Phase 2)
- `apps/api/src/routes/sponsorship/protected/` — read backend the web dashboard consumes
- `apps/web/src/components/post/PostSponsorshipBanner.astro` — existing public banner (instrumentation deferred, Q5)
- SPEC-143 — billing testing coverage (parent context for F2 origin)
- SPEC-140 — analytics-stack-posthog (source for Q5 metrics)

## 10. Next action

Decisions are recorded; work is **deferred to backlog**. When picked up:

- Confirm Q2 against the live schema, then run `/task-master:task-from-spec` to generate the Phase 1-3 breakdown.
- Re-open HOS-38 (Backlog → In Progress) and implement per §5.

Estimated total when picked up: ~1-2 weeks (sponsor role + web read-only dashboard + admin cleanup).
