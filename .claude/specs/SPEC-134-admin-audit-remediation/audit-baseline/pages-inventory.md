# SPEC-131 — Admin Pages Inventory (Phase 0)

- **Audit baseline SHA**: `1486e139d4a0e2f0d70900947c25a5ded87784e8` (`1486e139d`)
- **Branch**: `spec/SPEC-131-admin-app-visual-functional-audit`
- **Generated**: 2026-05-15
- **Source**: walk of `apps/admin/src/routes/_authed/` filtered by `createFileRoute(...)` exports.

> **Scope note**: SPEC-131 estimated ~42 pages. Reality is **110 leaf routes**. The audit volume estimate (16-32h) was based on the lower number — re-scoping decision needed before Phase 1 starts. See "Scope re-evaluation" section at the bottom.

## Inventory

| # | Route URL | File path | Purpose | Entity | Priority |
|---|-----------|-----------|---------|--------|----------|
| 1 | `/dashboard` | `apps/admin/src/routes/_authed/dashboard.tsx` | DASHBOARD | dashboard | critical |
| 2 | `/access/permissions` | `apps/admin/src/routes/_authed/access/permissions.tsx` | LIST | access | critical |
| 3 | `/access/roles` | `apps/admin/src/routes/_authed/access/roles.tsx` | LIST | access | critical |
| 4 | `/access/users` | `apps/admin/src/routes/_authed/access/users/index.tsx` | LIST | access | critical |
| 5 | `/access/users/$id` | `apps/admin/src/routes/_authed/access/users/$id.tsx` | VIEW | access | critical |
| 6 | `/access/users/$id/activity` | `apps/admin/src/routes/_authed/access/users/$id_.activity.tsx` | EDIT | access | critical |
| 7 | `/access/users/$id/edit` | `apps/admin/src/routes/_authed/access/users/$id_.edit.tsx` | EDIT | access | critical |
| 8 | `/access/users/$id/permissions` | `apps/admin/src/routes/_authed/access/users/$id_.permissions.tsx` | EDIT | access | critical |
| 9 | `/access/users/new` | `apps/admin/src/routes/_authed/access/users/new.tsx` | CREATE | access | critical |
| 10 | `/accommodations` | `apps/admin/src/routes/_authed/accommodations/index.tsx` | LIST | accommodations | critical |
| 11 | `/accommodations/$id` | `apps/admin/src/routes/_authed/accommodations/$id.tsx` | VIEW | accommodations | standard |
| 12 | `/accommodations/$id/amenities` | `apps/admin/src/routes/_authed/accommodations/$id_.amenities.tsx` | EDIT | accommodations | standard |
| 13 | `/accommodations/$id/edit` | `apps/admin/src/routes/_authed/accommodations/$id_.edit.tsx` | EDIT | accommodations | standard |
| 14 | `/accommodations/$id/gallery` | `apps/admin/src/routes/_authed/accommodations/$id_.gallery.tsx` | EDIT | accommodations | standard |
| 15 | `/accommodations/$id/pricing` | `apps/admin/src/routes/_authed/accommodations/$id_.pricing.tsx` | EDIT | accommodations | standard |
| 16 | `/accommodations/$id/reviews` | `apps/admin/src/routes/_authed/accommodations/$id_.reviews.tsx` | EDIT | accommodations | standard |
| 17 | `/accommodations/new` | `apps/admin/src/routes/_authed/accommodations/new.tsx` | CREATE | accommodations | standard |
| 18 | `/analytics/business` | `apps/admin/src/routes/_authed/analytics/business.tsx` | OTHER | analytics | standard |
| 19 | `/analytics/debug` | `apps/admin/src/routes/_authed/analytics/debug.tsx` | OTHER | analytics | standard |
| 20 | `/analytics/usage` | `apps/admin/src/routes/_authed/analytics/usage.tsx` | OTHER | analytics | standard |
| 21 | `/billing/addons` | `apps/admin/src/routes/_authed/billing/addons.tsx` | LIST | billing | critical |
| 22 | `/billing/cron` | `apps/admin/src/routes/_authed/billing/cron.tsx` | OTHER | billing | critical |
| 23 | `/billing/exchange-rates` | `apps/admin/src/routes/_authed/billing/exchange-rates.tsx` | LIST | billing | critical |
| 24 | `/billing/invoices` | `apps/admin/src/routes/_authed/billing/invoices.tsx` | LIST | billing | critical |
| 25 | `/billing/metrics` | `apps/admin/src/routes/_authed/billing/metrics.tsx` | LIST | billing | critical |
| 26 | `/billing/notification-logs` | `apps/admin/src/routes/_authed/billing/notification-logs.tsx` | LIST | billing | critical |
| 27 | `/billing/owner-promotions` | `apps/admin/src/routes/_authed/billing/owner-promotions.tsx` | LIST | billing | critical |
| 28 | `/billing/payments` | `apps/admin/src/routes/_authed/billing/payments.tsx` | LIST | billing | critical |
| 29 | `/billing/plans` | `apps/admin/src/routes/_authed/billing/plans.tsx` | LIST | billing | critical |
| 30 | `/billing/promo-codes` | `apps/admin/src/routes/_authed/billing/promo-codes.tsx` | LIST | billing | critical |
| 31 | `/billing/settings` | `apps/admin/src/routes/_authed/billing/settings.tsx` | SETTINGS | billing | critical |
| 32 | `/billing/sponsorships` | `apps/admin/src/routes/_authed/billing/sponsorships.tsx` | LIST | billing | critical |
| 33 | `/billing/subscriptions` | `apps/admin/src/routes/_authed/billing/subscriptions.tsx` | LIST | billing | critical |
| 34 | `/billing/webhook-events` | `apps/admin/src/routes/_authed/billing/webhook-events.tsx` | LIST | billing | critical |
| 35 | `/content/accommodation-amenities` | `apps/admin/src/routes/_authed/content/accommodation-amenities/index.tsx` | LIST | content | standard |
| 36 | `/content/accommodation-amenities/$id` | `apps/admin/src/routes/_authed/content/accommodation-amenities/$id.tsx` | VIEW | content | standard |
| 37 | `/content/accommodation-amenities/$id/edit` | `apps/admin/src/routes/_authed/content/accommodation-amenities/$id_.edit.tsx` | EDIT | content | standard |
| 38 | `/content/accommodation-amenities/new` | `apps/admin/src/routes/_authed/content/accommodation-amenities/new.tsx` | CREATE | content | standard |
| 39 | `/content/accommodation-features` | `apps/admin/src/routes/_authed/content/accommodation-features/index.tsx` | LIST | content | standard |
| 40 | `/content/accommodation-features/$id` | `apps/admin/src/routes/_authed/content/accommodation-features/$id.tsx` | VIEW | content | standard |
| 41 | `/content/accommodation-features/$id/edit` | `apps/admin/src/routes/_authed/content/accommodation-features/$id_.edit.tsx` | EDIT | content | standard |
| 42 | `/content/accommodation-features/new` | `apps/admin/src/routes/_authed/content/accommodation-features/new.tsx` | CREATE | content | standard |
| 43 | `/content/destination-attractions` | `apps/admin/src/routes/_authed/content/destination-attractions/index.tsx` | LIST | content | standard |
| 44 | `/content/destination-attractions/$id` | `apps/admin/src/routes/_authed/content/destination-attractions/$id.tsx` | VIEW | content | standard |
| 45 | `/content/destination-attractions/$id/edit` | `apps/admin/src/routes/_authed/content/destination-attractions/$id_.edit.tsx` | EDIT | content | standard |
| 46 | `/content/destination-attractions/new` | `apps/admin/src/routes/_authed/content/destination-attractions/new.tsx` | CREATE | content | standard |
| 47 | `/conversations` | `apps/admin/src/routes/_authed/conversations/index.tsx` | LIST | conversations | standard |
| 48 | `/conversations/$id` | `apps/admin/src/routes/_authed/conversations/$id.tsx` | VIEW | conversations | standard |
| 49 | `/destinations` | `apps/admin/src/routes/_authed/destinations/index.tsx` | LIST | destinations | critical |
| 50 | `/destinations/$id` | `apps/admin/src/routes/_authed/destinations/$id.tsx` | VIEW | destinations | standard |
| 51 | `/destinations/$id/accommodations` | `apps/admin/src/routes/_authed/destinations/$id_.accommodations.tsx` | EDIT | destinations | standard |
| 52 | `/destinations/$id/attractions` | `apps/admin/src/routes/_authed/destinations/$id_.attractions.tsx` | EDIT | destinations | standard |
| 53 | `/destinations/$id/edit` | `apps/admin/src/routes/_authed/destinations/$id_.edit.tsx` | EDIT | destinations | standard |
| 54 | `/destinations/$id/events` | `apps/admin/src/routes/_authed/destinations/$id_.events.tsx` | EDIT | destinations | standard |
| 55 | `/destinations/new` | `apps/admin/src/routes/_authed/destinations/new.tsx` | CREATE | destinations | standard |
| 56 | `/events` | `apps/admin/src/routes/_authed/events/index.tsx` | LIST | events | critical |
| 57 | `/events/$id` | `apps/admin/src/routes/_authed/events/$id.tsx` | VIEW | events | standard |
| 58 | `/events/$id/attendees` | `apps/admin/src/routes/_authed/events/$id_.attendees.tsx` | EDIT | events | standard |
| 59 | `/events/$id/edit` | `apps/admin/src/routes/_authed/events/$id_.edit.tsx` | EDIT | events | standard |
| 60 | `/events/$id/tickets` | `apps/admin/src/routes/_authed/events/$id_.tickets.tsx` | EDIT | events | standard |
| 61 | `/events/locations` | `apps/admin/src/routes/_authed/events/locations/index.tsx` | LIST | events | critical |
| 62 | `/events/locations/$id` | `apps/admin/src/routes/_authed/events/locations/$id.tsx` | VIEW | events | standard |
| 63 | `/events/locations/$id/edit` | `apps/admin/src/routes/_authed/events/locations/$id_.edit.tsx` | EDIT | events | standard |
| 64 | `/events/locations/$id/events` | `apps/admin/src/routes/_authed/events/locations/$id_.events.tsx` | EDIT | events | standard |
| 65 | `/events/locations/new` | `apps/admin/src/routes/_authed/events/locations/new.tsx` | CREATE | events | standard |
| 66 | `/events/new` | `apps/admin/src/routes/_authed/events/new.tsx` | CREATE | events | standard |
| 67 | `/events/organizers` | `apps/admin/src/routes/_authed/events/organizers/index.tsx` | LIST | events | critical |
| 68 | `/events/organizers/$id` | `apps/admin/src/routes/_authed/events/organizers/$id.tsx` | VIEW | events | standard |
| 69 | `/events/organizers/$id/contact` | `apps/admin/src/routes/_authed/events/organizers/$id_.contact.tsx` | EDIT | events | standard |
| 70 | `/events/organizers/$id/edit` | `apps/admin/src/routes/_authed/events/organizers/$id_.edit.tsx` | EDIT | events | standard |
| 71 | `/events/organizers/$id/events` | `apps/admin/src/routes/_authed/events/organizers/$id_.events.tsx` | EDIT | events | standard |
| 72 | `/events/organizers/new` | `apps/admin/src/routes/_authed/events/organizers/new.tsx` | CREATE | events | standard |
| 73 | `/me/accommodations` | `apps/admin/src/routes/_authed/me/accommodations/index.tsx` | LIST | me | standard |
| 74 | `/me/change-password` | `apps/admin/src/routes/_authed/me/change-password.tsx` | SETTINGS | me | standard |
| 75 | `/me/profile` | `apps/admin/src/routes/_authed/me/profile.tsx` | SETTINGS | me | standard |
| 76 | `/me/settings` | `apps/admin/src/routes/_authed/me/settings.tsx` | SETTINGS | me | standard |
| 77 | `/me/tags` | `apps/admin/src/routes/_authed/me/tags.tsx` | OTHER | me | standard |
| 78 | `/newsletter/campaigns` | `apps/admin/src/routes/_authed/newsletter/campaigns/index.tsx` | LIST | newsletter | standard |
| 79 | `/newsletter/campaigns/$campaignId` | `apps/admin/src/routes/_authed/newsletter/campaigns/$campaignId.tsx` | VIEW | newsletter | standard |
| 80 | `/newsletter/campaigns/new` | `apps/admin/src/routes/_authed/newsletter/campaigns/new.tsx` | CREATE | newsletter | standard |
| 81 | `/newsletter/subscribers` | `apps/admin/src/routes/_authed/newsletter/subscribers/index.tsx` | LIST | newsletter | standard |
| 82 | `/notifications` | `apps/admin/src/routes/_authed/notifications.tsx` | OTHER | notifications | standard |
| 83 | `/posts` | `apps/admin/src/routes/_authed/posts/index.tsx` | LIST | posts | critical |
| 84 | `/posts/$id` | `apps/admin/src/routes/_authed/posts/$id.tsx` | VIEW | posts | standard |
| 85 | `/posts/$id/edit` | `apps/admin/src/routes/_authed/posts/$id_.edit.tsx` | EDIT | posts | standard |
| 86 | `/posts/$id/seo` | `apps/admin/src/routes/_authed/posts/$id_.seo.tsx` | EDIT | posts | standard |
| 87 | `/posts/$id/sponsorship` | `apps/admin/src/routes/_authed/posts/$id_.sponsorship.tsx` | EDIT | posts | standard |
| 88 | `/posts/new` | `apps/admin/src/routes/_authed/posts/new.tsx` | CREATE | posts | standard |
| 89 | `/revalidation` | `apps/admin/src/routes/_authed/revalidation/index.tsx` | OTHER | revalidation | standard |
| 90 | `/settings/critical` | `apps/admin/src/routes/_authed/settings/critical.tsx` | SETTINGS | settings | standard |
| 91 | `/settings/seo` | `apps/admin/src/routes/_authed/settings/seo.tsx` | SETTINGS | settings | standard |
| 92 | `/sponsor` | `apps/admin/src/routes/_authed/sponsor/index.tsx` | LIST | sponsor | standard |
| 93 | `/sponsor/analytics` | `apps/admin/src/routes/_authed/sponsor/analytics.tsx` | OTHER | sponsor | standard |
| 94 | `/sponsor/invoices` | `apps/admin/src/routes/_authed/sponsor/invoices.tsx` | OTHER | sponsor | standard |
| 95 | `/sponsor/sponsorships` | `apps/admin/src/routes/_authed/sponsor/sponsorships.tsx` | LIST | sponsor | standard |
| 96 | `/sponsors` | `apps/admin/src/routes/_authed/sponsors/index.tsx` | LIST | sponsors | critical |
| 97 | `/sponsors/$id` | `apps/admin/src/routes/_authed/sponsors/$id.tsx` | VIEW | sponsors | standard |
| 98 | `/sponsors/$id/edit` | `apps/admin/src/routes/_authed/sponsors/$id_.edit.tsx` | EDIT | sponsors | standard |
| 99 | `/sponsors/new` | `apps/admin/src/routes/_authed/sponsors/new.tsx` | CREATE | sponsors | standard |
| 100 | `/tags/entity-attribution/$type/$id` | `apps/admin/src/routes/_authed/tags/entity-attribution/$type/$id.tsx` | VIEW | tags | standard |
| 101 | `/tags/internal` | `apps/admin/src/routes/_authed/tags/internal/index.tsx` | LIST | tags | standard |
| 102 | `/tags/internal/$id/edit` | `apps/admin/src/routes/_authed/tags/internal/$id_.edit.tsx` | EDIT | tags | standard |
| 103 | `/tags/internal/new` | `apps/admin/src/routes/_authed/tags/internal/new.tsx` | CREATE | tags | standard |
| 104 | `/tags/post-tags` | `apps/admin/src/routes/_authed/tags/post-tags/index.tsx` | LIST | tags | standard |
| 105 | `/tags/post-tags/$id/edit` | `apps/admin/src/routes/_authed/tags/post-tags/$id_.edit.tsx` | EDIT | tags | standard |
| 106 | `/tags/post-tags/new` | `apps/admin/src/routes/_authed/tags/post-tags/new.tsx` | CREATE | tags | standard |
| 107 | `/tags/system` | `apps/admin/src/routes/_authed/tags/system/index.tsx` | LIST | tags | standard |
| 108 | `/tags/system/$id/edit` | `apps/admin/src/routes/_authed/tags/system/$id_.edit.tsx` | EDIT | tags | standard |
| 109 | `/tags/system/new` | `apps/admin/src/routes/_authed/tags/system/new.tsx` | CREATE | tags | standard |
| 110 | `/tags/user-moderation` | `apps/admin/src/routes/_authed/tags/user-moderation/index.tsx` | LIST | tags | standard |

## Totals

**Total routes:** 110 | **LIST:** 30 | **VIEW:** 9 | **EDIT:** 38 | **CREATE:** 15 | **DASHBOARD:** 1 | **SETTINGS:** 6 | **OTHER:** 11 | **critical:** 30 | **standard:** 80

## Tooling status

| Tool | Status | Source | Notes |
|---|---|---|---|
| Lighthouse | ✅ Available | Global install (`lighthouse 10.9.4`) | Run via `npx lighthouse <url> --output=json`. No repo dep needed. |
| Playwright | ✅ Available | Claude MCP server (`mcp__playwright__*`) | All `browser_*` tools available — navigate, screenshot, evaluate, snapshot. No repo install needed. |
| axe-core | ✅ Available via MCP | Inject via `browser_evaluate` (CDN script tag) | No `@axe-core/playwright` npm dep needed for this audit; injection pattern is standard. Will codify the snippet in `audits/spec-131/_scripts/run-axe.md` when Phase 3 starts. |
| Auth fixture | ⏳ Deferred to Phase 1 start | — | Requires admin running on `localhost:3000`. First step of Phase 1 is to log in once via Playwright MCP, capture session cookie, save to `audits/spec-131/_fixtures/auth-cookie.json`. Subsequent runs load it via `browser_evaluate(document.cookie = ...)` or via context options. |

## Open questions (Phase 0 deferrals)

- `/newsletter/campaigns/$campaignId` classified as VIEW but may function as VIEW+EDIT in a single page — needs confirmation when Phase 1 visits it.
- `/tags/entity-attribution/$type/$id` uses dynamic `$type` parameter (not the usual `$id`). Behavior unclear without inspecting the route file. Will need ≥1 representative `$type` value for screenshots.
- Billing pages (`/billing/addons`, `/billing/cron`, etc.) classified LIST despite generic names — may include inline CRUD workflows not reflected in file structure. Phase 2 (visual+interaction) will surface this.

## Scope re-evaluation (BEFORE Phase 1 starts)

The spec estimated ~42 pages × 4 dimensions = 16-32h. Reality is **110 pages**, ~2.6× larger. Implications:

- **Responsive sweep (Phase 1):** 110 × 3 viewports = **330 screenshots** (was estimated ~126).
- **Visual+interaction (Phase 2):** 110 × ~6 states = up to **660 screenshots** (manual review proportional).
- **Accessibility (Phase 3):** 110 axe runs + 110 manual keyboard nav passes.
- **Performance (Phase 4):** 110 Lighthouse runs (× 3 for median = 330 runs).

Naive linear scaling pushes this to **40-80h**.

### Possible scope adjustments (decision needed from operator)

1. **Audit only the 30 critical-bucket routes** — ~10-20h, hits dashboards + access + billing + core entity LIST pages. EDIT/VIEW/CREATE for non-critical entities deferred to a follow-up spec.
2. **Audit one canonical page per entity-pattern** — e.g. for entities with the LIST/VIEW/EDIT/CREATE 4-pack (accommodations, destinations, events, posts, sponsors, content/*, tags/*), only audit one full set and assume the others share the same DataTable + form-shell components. Spot-check the rest. ~15-25h.
3. **Full 110-page audit as-is** — accept 40-80h estimate and proceed.
4. **Hybrid**: full audit for Phase 1 (responsive — cheap, automated) + Phase 3 (a11y — automated), but Phase 2 (visual+interaction) and Phase 4 (perf) limited to critical bucket.

Recommendation lives outside this file — to be decided in chat before Phase 1 starts.
