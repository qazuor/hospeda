---
audit: code-structure
status: complete
date: 2026-05-21
agent: Explore
---

# 01 — Admin code structure inventory

Exhaustive route inventory of `apps/admin` (TanStack Start, file-based routing in `src/routes/`).

## 1. Route tree

### Auth routes (`/auth`)
- `/` — root redirect (authed → dashboard, unauthed → signin)
- `/auth/index` — sign-in entry
- `/auth/signin` — email/password sign in
- `/auth/signup` — account creation
- `/auth/callback` — OAuth callback
- `/auth/change-password` — force-change password flow (first login)
- `/auth/forbidden` — access denied page

### Authenticated (`_authed` layout, guarded)

#### Core entities
- **`/accommodations`** — list
  - `$id` view, `$id_.edit`, `$id_.amenities`, `$id_.gallery`, `$id_.pricing`, `$id_.reviews`
  - `new` create
- **`/destinations`** — list
  - `$id` view, `$id_.edit`, `$id_.accommodations`, `$id_.attractions`, `$id_.events`
  - `new` create
- **`/events`** — list
  - `$id` view, `$id_.edit`, `$id_.attendees`, `$id_.tickets`
  - `new` create
  - `/events/locations` — venues sub-CRUD (`index`, `$id`, `$id_.edit`, `$id_.events`, `new`)
  - `/events/organizers` — organizers sub-CRUD (`index`, `$id`, `$id_.contact`, `$id_.edit`, `$id_.events`, `new`)
- **`/posts`** — blog posts list
  - `$id` view, `$id_.edit`, `$id_.seo`, `$id_.sponsorship`
  - `new` create

#### Content catalogs (`/content`)
- `/accommodation-amenities` — CRUD (`index`, `$id`, `$id_.edit`, `new`)
- `/accommodation-features` — CRUD
- `/destination-attractions` — CRUD

#### Billing & monetization (`/billing`) — LARGEST subsystem
- `/plans` — subscription plans (read-only; writes intentionally disabled)
- `/subscriptions` — active subscriptions
- `/addons` — add-ons / upsells
- `/payments` — transactions & status
- `/invoices` — invoice list with download
- `/promo-codes` — discount codes
- `/owner-promotions` — host promotional credits
- `/sponsorships` — sponsorship revenue
- `/settings` — billing config (trial, payments, webhooks, notifications)
- `/metrics` — system usage stats (per-customer drill-down disabled, backend missing)
- `/exchange-rates` — manual FX rates override
- `/cron` — scheduled job management
- `/webhook-events` — webhook delivery log
- `/notification-logs` — email history with filters

#### Newsletter (`/newsletter`)
- `/campaigns` — `index`, `$campaignId`, `new`
  - Heavy: 788-line CampaignEditor, MetricsPanel, Preview, FailedDeliveriesDialog, SendConfirmDialog
- `/subscribers` — `index` with filters + stats bar

#### User & access (`/access`)
- `/users` — `index`, `$id`, `$id_.edit`, `$id_.activity`, `$id_.permissions`, `new`
- `/roles` — role definitions
- `/permissions` — permission catalog

#### System & ops
- `/revalidation` — 3-tab ISR cache mgmt (Config, Logs, Manual)
- `/analytics` — `/business`, `/usage`, `/debug`
- `/conversations` — `index` (filters: status, guest email, accommodation) + `$id` thread

#### User profile (`/me`)
- `/profile` — name, email, avatar
- `/settings` — preferences & integrations
- `/change-password` — password change
- `/tags` — personal tags
- `/accommodations` — user's accommodations (owner-only)

#### Admin settings (`/settings`)
- `/critical` — maintenance mode, feature flags
- `/seo` — platform-wide SEO defaults

#### Sponsor dashboards
- `/sponsor` — sponsor's own view (`index`, `/sponsorships`, `/invoices`, `/analytics`)
- `/sponsors` — admin view of all sponsors (`index`, `$id`, `$id_.edit`, `new`)

#### Tag management (`/tags`)
- `/internal` — internal-only tags CRUD
- `/post-tags` — blog post tags CRUD
- `/system` — system category tags CRUD
- `/user-moderation` — user-generated tag moderation
- `/entity-attribution/$type/$id` — tags attributed to a specific entity

#### Misc
- `/notifications` — notification center
- `/dashboard` — KPI overview (lazy-loaded via `dashboard.lazy.tsx`)
- `/dev/icon-comparison` — dev-only icon library browser (1095 lines)

**Total: 131+ route files.**

## 2. Feature areas (clusters)

| Area | Complexity | Status | Notes |
|------|-----------|--------|-------|
| **Accommodations** | LARGE | Complete | List, view, edit + 4 tabs |
| **Destinations** | MEDIUM-LARGE | Complete | + cross-entity tabs |
| **Events & ticketing** | MEDIUM-LARGE | Complete | + venues + organizers sub-CRUDs |
| **Blog (posts)** | MEDIUM | Complete | + SEO + sponsorship tabs |
| **Billing** | LARGE (14 routes) | MOSTLY complete with gaps | Plan writes & customer drill-down disabled |
| **Newsletter** | MEDIUM | Complete (very polished) | 788-line editor |
| **User access** | MEDIUM | Complete | users + roles + permissions |
| **Tag system** | SMALL-MEDIUM | Complete | 4 taxonomies separate |
| **Sponsor (tenant + admin)** | SMALL | Complete | Dual view |
| **Conversations** | SMALL-MEDIUM | Complete | Inbox with unread badge |
| **System/ops** | SMALL-MEDIUM | Specialized | Revalidation, analytics, debug |
| **User profile/settings** | MEDIUM | Complete but fragmented | 6 routes under `/me`, mixed storage |
| **Platform settings** | SMALL | Disperso | 3 routes, mixed API/localStorage |
| **Content catalogs** | SMALL | Complete | 3 catalog CRUDs |

## 3. Dead or orphan code

Three documented "intentional pauses", no actual rot:

1. **`/billing/metrics.tsx:6-11`** — per-customer drill-down disabled. Backend endpoints `/api/v1/admin/billing/customers/search` and `/customers/:id/usage` do not exist. Placeholder banner shown.
2. **`/billing/plans.tsx` ~line 315** — "Plan write operations are intentionally disabled". Plans are read-only here; mutation happens elsewhere.
3. **`/dashboard.lazy.tsx:92`** — "Coming Soon" for audit log. i18n key `admin-dashboard.comingSoon.auditLog`. No route exists.

No broken imports, no abandoned files, no incomplete stubs beyond intentional Coming-Soon UI.

## 4. What's missing (vs. typical hospitality admin)

1. **Audit log / activity trail** — system-wide log of admin actions (who deleted what, when). Coming Soon in dashboard.
2. **Host onboarding wizard** — step-by-step KYC, bank setup. Lives in tourist funnel but not admin.
3. **Bulk messaging / templates** — pre-written templates, bulk email to hosts.
4. **Analytics deep dives** — booking trends, revenue charts, occupancy forecasts.
5. **Inventory / availability mgmt** — calendar blocks, seasonal rates.
6. **Customer support tickets** — issue tracking, escalation. Only `/conversations` exists.
7. **Content moderation queue** — flag/approve user-generated content. Absent.
8. **Payment reconciliation tools** — bank statement matching, dispute resolution.
9. **Host compliance dashboard** — tax docs, insurance, document expiry alerts.
10. **Real-time notifications / activity feed** — only toasts today.

## 5. Top 3 surprises

1. **Newsletter is exceptionally polished** — 788-line editor + metrics panel + delivery retry. Heavier engineering than the rest.
2. **Billing has 14 dedicated routes** — full monetization subsystem with multi-tenant tiers, usage metering, webhook integrations.
3. **Revalidation tool is bespoke** — 518-line 3-tab UI for ISR cache mgmt. Rare level of granular control.

## Summary

131+ route files across 16 major feature areas. **No dead code**. Mature, production-grade. The intentional gaps are documented. Focus axes: monetization (billing 14 rutas), content (newsletter + posts + destinations), event management.
