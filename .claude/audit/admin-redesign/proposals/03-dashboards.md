---
proposal: dashboards
status: DRAFT (in active discussion)
version: 0.3
date-started: 2026-05-22
last-updated: 2026-05-22
depends-on: 01-information-architecture.md (v0.7+), 02-config-schema.md (v0.2+)
related: 03b-endpoint-verification.md
scope: V1 = widgets with EXISTING backing data sources. Aspirational widgets moved to 99-future-enhancements.md
---

# Per-Role Dashboards — V1 (real data only)

> **Scope rule**: every widget below maps to a **data source that already exists** in the codebase (an API endpoint or computable from existing entities). Widgets requiring new backend (bookings, occupancy, revenue per-host, Sentry integration, audit log, etc.) are tracked in `99-future-enhancements.md`.

## How to read this doc

Each widget specifies:
- **Type** (kpi / list / chart / callout / etc. — per schema §7)
- **Backing source** (existing endpoint or computation)
- **Scope** (own / all / toggle)
- **Permissions**

When a source is uncertain (likely exists but not confirmed by audit), it's marked **🟡 verify**.

---

## 1. Principles

### 1.1 V1 = real data only

- Every widget maps to an existing API call or aggregable from existing entities.
- "Coming Soon" placeholders are NOT included.
- When a useful widget needs a small new aggregator endpoint (e.g., "drafts + reviews + conversations all in one"), it's flagged separately so we decide whether to include it.

### 1.2 Scoped means per-user, when the entity supports it

For HOST, KPIs use the `*_VIEW_OWN` permission and the corresponding API endpoint with `ownerId={userId}` filter. Per audit, this works for:
- `accommodations` (confirmed — `/me/accommodations` page already uses this)
- `conversations` (confirmed — sidebar uses `useUnreadCount()` scoped)
- `reviews` (confirmed — `REVIEW_VIEW_OWN` permission exists)
- `subscriptions` / `invoices` / `billing` (confirmed — `BILLING_VIEW_OWN` permission)

### 1.3 Reuse the existing 6-KPI dashboard for ADMIN+

The current `/dashboard` route already loads `useDashboardStats()` for 6 global counts (accommodations, destinations, events, posts, attractions, users) — wired and working. ADMIN+ dashboard PRESERVES these as the first row.

---

## 2. HOST dashboard — "Mi negocio"

V1 widgets (all backed by existing endpoints).

```ts
hostDashboard: {
  widgets: [
    // KPIs (3)
    {
      id: 'kpi-my-accommodations',
      type: 'kpi',
      label: { es: 'Mis alojamientos', en: 'My listings', pt: 'Meus alojamentos' },
      scope: 'own',
      permissions: ['ACCOMMODATION_VIEW_OWN'],
      config: {
        source: 'accommodation.count.own',
        // GET /api/v1/admin/accommodations?ownerId={userId}&pageSize=1 → pagination.total
      },
    },
    {
      id: 'kpi-consultas-pendientes',
      type: 'kpi',
      label: { es: 'Consultas pendientes', en: 'Pending inquiries', pt: 'Consultas pendentes' },
      scope: 'own',
      permissions: ['CONVERSATION_VIEW_OWN'],
      config: {
        source: 'conversation.count.own.pending-owner',
        // GET /api/v1/admin/conversations?ownerId={uid}&conversationStatus=PENDING_OWNER&pageSize=1
        // NOTE: "Unanswered" is not a real status — use PENDING_OWNER per endpoint verification (03b §1)
      },
    },
    {
      id: 'kpi-mi-plan',
      type: 'kpi',
      label: { es: 'Estado de mi plan', en: 'My plan status', pt: 'Status do meu plano' },
      scope: 'own',
      permissions: ['SUBSCRIPTION_VIEW_OWN'],
      config: {
        source: 'subscription.list.own.active.first',
        // GET /api/v1/protected/billing/subscriptions?pageSize=1 → pick active
        // NOTE: no /me endpoint exists — list-and-pick approach per endpoint verification (03b §3)
        format: 'badge',
      },
    },

    // Action list (1)
    {
      id: 'list-consultas-pendientes',
      type: 'list',
      label: { es: 'Consultas pendientes de tu respuesta', en: 'Inquiries pending your reply', pt: 'Consultas pendentes de sua resposta' },
      scope: 'own',
      permissions: ['CONVERSATION_VIEW_OWN'],
      config: {
        source: 'conversation.list.own.pending-owner',
        // GET /api/v1/admin/conversations?ownerId={uid}&conversationStatus=PENDING_OWNER&pageSize=5&sort=updated_at_desc
        limit: 5,
        emptyState: { variant: 'positive', message: { es: '¡Estás al día!', en: 'All caught up!', pt: 'Tudo em dia!' } },
        actionPerItem: { route: '/consultas/{id}', label: { es: 'Responder', en: 'Reply', pt: 'Responder' } },
      },
    },

    // Subscription (2)
    {
      id: 'subscription-status',
      type: 'callout',
      label: { es: 'Estado de mi suscripción', en: 'My subscription', pt: 'Minha assinatura' },
      scope: 'own',
      permissions: ['SUBSCRIPTION_VIEW_OWN'],
      config: {
        source: 'subscription.list.own.active.first',
        // same list-and-pick approach as kpi-mi-plan
        showNextCharge: true,
        variantWhen: { expiringSoon: 'warning', expired: 'danger', active: 'info' },
      },
    },
    {
      id: 'plan-usage-accommodations',
      type: 'kpi',
      label: { es: 'Uso de mi plan', en: 'Plan usage', pt: 'Uso do plano' },
      scope: 'own',
      permissions: ['SUBSCRIPTION_VIEW_OWN'],
      config: {
        source: 'billing.usage.own.accommodations',
        // GET /api/v1/protected/billing/usage → confirmed exists per 03b §4
        format: 'fraction',
        warningAt: 0.8,
      },
    },
  ],
}
```

**6 widgets** (verification pass: 7 → 6 after dropping 2 review widgets).

### Removed from V1 (in `99-future-enhancements.md` §2)

- Próximos check-ins calendar — no booking system
- Ocupación promedio — no booking system
- Ingresos del mes (per-host) — no per-host revenue tracking
- Welcome callout with dynamic next-action — no resolver service
- **`kpi-resenas-pendientes` (NEW: dropped 2026-05-22)** — accommodation reviews are one-way ratings with NO reply concept. No "unanswered" state exists. Per endpoint verification (03b §2)
- **`list-resenas-recientes` (NEW: dropped 2026-05-22)** — same as above. If "recent reviews" without a reply concept is desired (just informational list of latest reviews), can be re-evaluated, but it doesn't fit the "needs my attention" framing of the dashboard
- **"Unanswered" framing across HOST widgets (RENAMED)** — replaced with "pending owner" via `conversationStatus=PENDING_OWNER` filter. Future enhancement: build a unified "needs my attention" cross-entity counter

---

## 3. EDITOR dashboard — "La redacción"

V1 widgets (backed by existing data).

```ts
editorDashboard: {
  widgets: [
    // KPIs (4)
    {
      id: 'kpi-posts-mes',
      type: 'kpi',
      label: { es: 'Posts publicados este mes', en: 'Posts published this month', pt: 'Posts deste mês' },
      scope: 'all',
      permissions: ['POST_VIEW_ALL'],
      config: { source: 'post.count.published.month' },
    },
    {
      id: 'kpi-borradores',
      type: 'kpi',
      label: { es: 'Borradores pendientes', en: 'Pending drafts', pt: 'Rascunhos pendentes' },
      scope: 'all',
      permissions: ['POST_VIEW_ALL'],
      config: { source: 'post.count.drafts' },
    },
    {
      id: 'kpi-eventos-proximos',
      type: 'kpi',
      label: { es: 'Eventos próximos', en: 'Upcoming events', pt: 'Próximos eventos' },
      scope: 'all',
      permissions: ['EVENT_VIEW_ALL'],
      config: {
        source: 'event.count.upcoming',
        // GET /api/v1/admin/events?startDateAfter={now}&pageSize=1
        // NOTE: no "upcoming" status enum — date-based filter per endpoint verification (03b §7)
      },
    },
    {
      id: 'kpi-suscriptores',
      type: 'kpi',
      label: { es: 'Suscriptores newsletter', en: 'Newsletter subscribers', pt: 'Inscritos do newsletter' },
      scope: 'all',
      permissions: ['NEWSLETTER_SUBSCRIBER_VIEW'],
      config: { source: 'newsletter.subscribers.count.active' },
    },

    // Last campaign metric
    {
      id: 'kpi-newsletter-last-open-rate',
      type: 'kpi',
      label: { es: 'Open rate último envío', en: 'Last newsletter open rate', pt: 'Open rate último envio' },
      scope: 'all',
      permissions: ['NEWSLETTER_CAMPAIGN_VIEW'],
      config: {
        source: 'newsletter.last-campaign.open-rate',  // existing CampaignMetricsPanel data
        format: 'percentage',
      },
    },

    // Action lists (3)
    {
      id: 'list-borradores',
      type: 'list',
      label: { es: 'Borradores recientes', en: 'Recent drafts', pt: 'Rascunhos recentes' },
      scope: 'all',
      permissions: ['POST_VIEW_ALL'],
      config: {
        source: 'post.list.drafts',  // GET /api/v1/admin/posts?status=draft
        limit: 5,
        emptyState: { variant: 'positive', message: { es: 'Sin borradores pendientes', en: 'No pending drafts', pt: 'Sem rascunhos' } },
      },
    },
    {
      id: 'list-eventos-proximos',
      type: 'list',
      label: { es: 'Eventos próximos', en: 'Upcoming events', pt: 'Próximos eventos' },
      scope: 'all',
      permissions: ['EVENT_VIEW_ALL'],
      config: {
        source: 'event.list.upcoming',
        // GET /api/v1/admin/events?startDateAfter={now}&pageSize=5&sort=start_date_asc
        limit: 5,
      },
    },
    {
      id: 'list-campanias-programadas',
      type: 'list',
      label: { es: 'Campañas programadas', en: 'Scheduled campaigns', pt: 'Campanhas agendadas' },
      scope: 'all',
      permissions: ['NEWSLETTER_CAMPAIGN_VIEW'],
      config: {
        source: 'newsletter.campaigns.scheduled',
        limit: 3,
      },
    },
  ],
}
```

**8 widgets**. Removed from V1: editorial calendar cross-content (needs aggregator), top posts by engagement (verify analytics).

### Removed from V1 (in `99-future-enhancements.md` §2)

- Calendario editorial cross-content (posts + events + newsletter unified by date) — needs new aggregator endpoint. **Decision point**: could be added if we're willing to build the small aggregator. Default = defer.
- Top posts by engagement — depends on whether analytics endpoints expose post-level engagement metrics. Verify before locking.

---

## 4. ADMIN / SUPER_ADMIN dashboard

Same dashboard config shared by both roles. V1 builds on the EXISTING dashboard (6 global KPIs already wired in `useDashboardStats()`) + adds billing/subscription widgets.

```ts
adminDashboard: {
  widgets: [
    // Existing 6 KPIs (already wired in current /dashboard)
    {
      id: 'kpi-total-accommodations',
      type: 'kpi',
      label: { es: 'Alojamientos', en: 'Listings', pt: 'Alojamentos' },
      scope: 'all',
      permissions: ['ACCOMMODATION_VIEW_ALL'],
      config: { source: 'accommodation.count.all' },  // existing /api/v1/admin/accommodations?pageSize=1
    },
    {
      id: 'kpi-total-destinations',
      type: 'kpi',
      label: { es: 'Destinos', en: 'Destinations', pt: 'Destinos' },
      scope: 'all',
      permissions: ['DESTINATION_VIEW_ALL'],
      config: { source: 'destination.count.all' },
    },
    {
      id: 'kpi-total-events',
      type: 'kpi',
      label: { es: 'Eventos', en: 'Events', pt: 'Eventos' },
      scope: 'all',
      permissions: ['EVENT_VIEW_ALL'],
      config: { source: 'event.count.all' },
    },
    {
      id: 'kpi-total-posts',
      type: 'kpi',
      label: { es: 'Posts', en: 'Posts', pt: 'Posts' },
      scope: 'all',
      permissions: ['POST_VIEW_ALL'],
      config: { source: 'post.count.all' },
    },
    {
      id: 'kpi-total-attractions',
      type: 'kpi',
      label: { es: 'Atracciones', en: 'Attractions', pt: 'Atrações' },
      scope: 'all',
      permissions: ['ATTRACTION_VIEW'],
      config: { source: 'attraction.count.all' },
    },
    {
      id: 'kpi-total-users',
      type: 'kpi',
      label: { es: 'Usuarios', en: 'Users', pt: 'Usuários' },
      scope: 'all',
      permissions: ['USER_VIEW_ALL'],
      config: { source: 'user.count.all' },
    },

    // Billing additions (3)
    {
      id: 'kpi-active-subscriptions',
      type: 'kpi',
      label: { es: 'Suscripciones activas', en: 'Active subscriptions', pt: 'Assinaturas ativas' },
      scope: 'all',
      permissions: ['SUBSCRIPTION_VIEW_ALL'],
      config: { source: 'subscription.count.active' },
    },
    {
      id: 'kpi-mrr',
      type: 'kpi',
      label: { es: 'Ingresos recurrentes (MRR)', en: 'MRR', pt: 'Receita recorrente (MRR)' },
      scope: 'all',
      permissions: ['BILLING_METRICS_VIEW'],
      config: {
        source: 'billing.metrics.mrr',  // existing /api/v1/admin/billing/metrics endpoint
        format: 'currency',
      },
    },
    {
      id: 'chart-revenue-monthly',
      type: 'chart',
      label: { es: 'Revenue mensual (últimos 12 meses)', en: 'Monthly revenue (last 12)', pt: 'Receita mensal (últimos 12)' },
      scope: 'all',
      permissions: ['BILLING_METRICS_VIEW'],
      config: {
        source: 'billing.metrics.revenue.12m',  // 🟡 verify endpoint supports time series
        chartType: 'line',
        format: 'currency',
      },
    },

    // List (1)
    {
      id: 'list-upcoming-events',
      type: 'list',
      label: { es: 'Próximos eventos destacados', en: 'Featured upcoming events', pt: 'Próximos eventos destacados' },
      scope: 'all',
      permissions: ['EVENT_VIEW_ALL'],
      config: {
        source: 'event.list.featured.upcoming',
        // GET /api/v1/admin/events?isFeatured=true&startDateAfter={now}&pageSize=5
        // NOTE: isFeatured flag confirmed; upcoming via startDateAfter per endpoint verification (03b §8)
        limit: 5,
      },
    },
  ],
}
```

**10 widgets**: 6 existing + 3 billing + 1 list. ADMIN sees all 10 (no super-only widgets in V1). SUPER_ADMIN dashboard = same.

### Removed from V1 (in `99-future-enhancements.md` §2)

- Churn KPI — no churn metric computed today
- Conversions KPI — definition + tracking missing
- System status callout — depends on platform health endpoint (uncertain)
- Sentry errors widget (super-only) — no integration
- Failed crons widget (super-only) — cron list exists, "failed-only" filter uncertain
- Audit log preview (super-only) — no audit log system
- **`list-top-hosts` (NEW: dropped 2026-05-22)** — qzpay-hono subscription routes don't expose ordering by revenue. Per endpoint verification (03b §11). To add later: build a hospeda-side aggregator that joins users + subscriptions and sorts by plan value

### Confirmed endpoints (verification complete)

- `billing.metrics.mrr` ✅ — `/api/v1/admin/billing/metrics` overview includes MRR (03b §9)
- `billing.metrics.revenue.12m` ✅ — same endpoint supports `months` query param, returns `revenueTimeSeries` array (03b §10)
- `event.list.featured.upcoming` 🟡 → ✅ — `isFeatured` flag exists; "upcoming" derived via `startDateAfter={now}` (03b §8)

---

## 5. SUPER_ADMIN dashboard

**Same as `adminDashboard`** above. No super-only widgets in V1 (all the super-only ones — Sentry, audit log, failed crons — require code that doesn't exist).

V1 difference between ADMIN and SUPER_ADMIN dashboards: **zero**.

When the post-V1 features ship (audit log, Sentry integration, failed-crons widget), they'll be added to `adminDashboard` with permissions that ADMIN lacks (`onMissing: 'hide'`) — exposing them only to SUPER_ADMIN automatically.

---

## 6. Data sources reference

Per IA §13 schema config field `source`. V1 source IDs map to existing endpoints. **Verification complete per `03b-endpoint-verification.md`** — all 🟡 flags resolved.

| Source ID | Existing endpoint | Verification |
|-----------|-------------------|--------------|
| `accommodation.count.own` | `GET /api/v1/admin/accommodations?ownerId={uid}&pageSize=1` | ✅ |
| `accommodation.count.all` | `GET /api/v1/admin/accommodations?pageSize=1` | ✅ (current dashboard already uses) |
| `conversation.count.own.pending-owner` | `GET /api/v1/admin/conversations?ownerId={uid}&conversationStatus=PENDING_OWNER&pageSize=1` | ✅ (renamed from `unanswered` per 03b §1) |
| `conversation.list.own.pending-owner` | same endpoint, `&pageSize=5&sort=updated_at_desc` | ✅ |
| ~~`review.count.own.unanswered`~~ | ~~no reply concept~~ | ❌ DROPPED widget per 03b §2 |
| ~~`review.list.own.recent`~~ | ~~no "needs attention" framing fits~~ | ❌ DROPPED widget per 03b §2 |
| `subscription.list.own.active.first` | `GET /api/v1/protected/billing/subscriptions?pageSize=1` | ✅ (replaces `subscription.status.own` — no `/me` endpoint per 03b §3) |
| `billing.usage.own.accommodations` | `GET /api/v1/protected/billing/usage` | ✅ (replaces `subscription.usage.own.accommodations` per 03b §4) |
| `post.count.published.month` | `GET /api/v1/admin/posts?status=ACTIVE&createdAfter={month-start}&pageSize=1` | ✅ per 03b §5 |
| `post.count.drafts` | `GET /api/v1/admin/posts?status=DRAFT&pageSize=1` | ✅ per 03b §6 |
| `post.list.drafts` | `GET /api/v1/admin/posts?status=DRAFT&pageSize=5&sort=updated_at_desc` | ✅ |
| `event.count.upcoming` | `GET /api/v1/admin/events?startDateAfter={now}&pageSize=1` | ✅ (changed from `status=upcoming` per 03b §7 — no such status) |
| `event.list.upcoming` | `GET /api/v1/admin/events?startDateAfter={now}&pageSize=5&sort=start_date_asc` | ✅ |
| `event.list.featured.upcoming` | `GET /api/v1/admin/events?isFeatured=true&startDateAfter={now}&pageSize=5` | ✅ per 03b §8 |
| `newsletter.subscribers.count.active` | `GET /api/v1/admin/newsletter/subscribers?status=active&pageSize=1` | ✅ |
| `newsletter.last-campaign.open-rate` | `GET /api/v1/admin/newsletter/campaigns?status=sent&pageSize=1&sort=sent_at_desc` + metrics from response | ✅ |
| `newsletter.campaigns.scheduled` | `GET /api/v1/admin/newsletter/campaigns?status=scheduled&pageSize=3` | ✅ |
| `billing.metrics.mrr` | `GET /api/v1/admin/billing/metrics` → read MRR from overview | ✅ per 03b §9 |
| `billing.metrics.revenue.12m` | `GET /api/v1/admin/billing/metrics?months=12` → read `revenueTimeSeries` array | ✅ per 03b §10 |
| `subscription.count.active` | `GET /api/v1/admin/subscriptions?status=active&pageSize=1` | ✅ |
| ~~`subscription.list.top-revenue.month`~~ | ~~no ordering by revenue~~ | ❌ DROPPED widget per 03b §11 |

**Verification status**: COMPLETE. 3 widgets dropped due to missing backend capability; 3 endpoint paths/filters corrected.

---

## 7. Empty / loading / error states (unchanged from v0.1)

- **Loading**: skeleton matching widget shape.
- **Empty**: configurable `emptyState` per widget (variant: positive / neutral / callout + i18n message).
- **Error**: red callout with retry + "Reportar problema" link.

---

## 8. Refresh behavior (unchanged from v0.1)

- 60s stale time + refetchOnWindowFocus.
- Manual "Actualizar" button at dashboard top.
- No real-time push in V1.

---

## 9. Per-role dashboard summary

| Role | Dashboard config ID | Widgets V1 | Notes |
|------|---------------------|:----------:|-------|
| HOST | `hostDashboard` | **6** | Scoped to user's accommodations + own pending conversations + own subscription (review widgets dropped per 03b verification) |
| EDITOR | `editorDashboard` | 8 | Global counts on content + newsletter metrics. Events filter changed from `status=upcoming` to `startDateAfter={now}` |
| ADMIN | `adminDashboard` | **10** | Existing 6 KPIs + 3 billing + 1 list (top-hosts dropped per 03b verification) |
| SUPER_ADMIN | `adminDashboard` (shared) | 10 (same) | Zero V1 super-only widgets — all super-only ones need new code |

---

## Open questions

### A. Verify endpoints flagged 🟡 [RESOLVED 2026-05-22]

Verification audit complete — see `03b-endpoint-verification.md`. Result:

- ✅ **8 endpoints confirmed working** with documented paths and filters
- 🟡 **3 endpoints needed filter/path changes** (conversations PENDING_OWNER instead of unanswered; events startDateAfter instead of status=upcoming; subscription list-and-pick instead of /me)
- ❌ **3 widgets dropped** (`kpi-resenas-pendientes`, `list-resenas-recientes`, `list-top-hosts`) — backing capability doesn't exist

Updated widget counts: HOST 7→6, EDITOR 8→8 (with filter changes), ADMIN/SUPER_ADMIN 11→10.

### B. Editorial calendar cross-content widget — build aggregator or defer? [OPEN]

The "Calendario editorial cross-content" widget would need a new aggregator endpoint composing posts + events + newsletter by date. Two options:

- **(a) Defer** — moved to `99-future-enhancements.md`. EDITOR dashboard stays at 8 widgets.
- **(b) Build the small aggregator in V1** — reasonable scope addition, the EDITOR's mental model centers on the calendar.

Default = (a) defer. Promote to (b) only if EDITOR feedback says the calendar is essential.

### C. SMS/Push notification toggles UX [DEFERRED to settings doc 04]

Cross-referenced — see settings doc 04 §2.3.

---

## Decisions log

| Date | Decision | Section |
|------|----------|---------|
| 2026-05-22 | V1 = widgets with EXISTING backing data only. Aspirational widgets moved to `99-future-enhancements.md` | §1.1 |
| 2026-05-22 | Reuse existing dashboard 6 KPIs (`useDashboardStats()` already wired) as ADMIN+ base | §1.3, §4 |
| 2026-05-22 | HOST dashboard = 7 widgets (down from 10): 4 KPIs scoped to user + 2 action lists + subscription status + plan usage | §2 |
| 2026-05-22 | HOST: removed Próximos check-ins, Ocupación, Ingresos del mes, dynamic welcome (no backing code) | §2 |
| 2026-05-22 | EDITOR dashboard = 8 widgets: 5 KPIs + 3 action lists. Editorial calendar cross-content widget deferred to Open Q-B | §3 |
| 2026-05-22 | ADMIN/SUPER_ADMIN dashboard = 11 widgets shared: 6 existing global KPIs + 3 billing + 2 lists | §4, §5 |
| 2026-05-22 | V1: ZERO super-only widgets. All super-only proposals (Sentry, audit log, failed crons) require new code → moved to future | §5 |
| 2026-05-22 | If an endpoint flagged 🟡 doesn't exist, DROP the widget — don't build new endpoints in V1 for dashboards | §6, Open Q-A |
| 2026-05-22 | Data sources reference table (§6) lists each source ID + existing endpoint mapping with 🟡 flags for items needing verification | §6 |
| 2026-05-22 | Endpoint verification audit completed (`03b-endpoint-verification.md`) — all 🟡 flags resolved | Open Q-A |
| 2026-05-22 | HOST: dropped `kpi-resenas-pendientes` + `list-resenas-recientes` — accommodation reviews are one-way ratings, no reply concept exists (per 03b §2) | §2 |
| 2026-05-22 | HOST: renamed "unanswered" framing to "pending owner" — use `conversationStatus=PENDING_OWNER` filter (per 03b §1) | §2 |
| 2026-05-22 | HOST: subscription status/usage uses list-and-pick approach — no `/me` endpoint exists in qzpay-hono (per 03b §3, §4). Source `subscription.list.own.active.first` + `billing.usage.own.accommodations` (`/protected/billing/usage`) | §2 |
| 2026-05-22 | EDITOR + ADMIN: events "upcoming" derived via `startDateAfter={now}` — no `status=upcoming` enum exists (per 03b §7, §8) | §3, §4 |
| 2026-05-22 | ADMIN: dropped `list-top-hosts` — qzpay-hono doesn't expose subscription sorting by revenue (per 03b §11) | §4 |
| 2026-05-22 | Final widget counts after verification: HOST 6, EDITOR 8, ADMIN/SUPER_ADMIN 10 | §9 |

---

## Change log

| Date | Version | Change |
|------|---------|--------|
| 2026-05-22 | 0.1 | Initial draft — included aspirational widgets (check-ins, occupancy, host revenue, Sentry, audit log preview, etc.) without backing code |
| 2026-05-22 | 0.2 | **Reality pass** — full rewrite scoped to V1 widgets with existing data sources. HOST 10→7, EDITOR 8→8 (1 deferred), ADMIN 8→11 (reusing existing KPIs, removing aspirational). Zero super-only V1 widgets (all moved to future). Data sources reference table added (§6) with 🟡 flags for items needing verification audit. Reduced widget count significantly while remaining honest about what works today. |
| 2026-05-22 | 0.3 | **Endpoint verification applied** — based on focused audit (`03b-endpoint-verification.md`). HOST 7→6 (dropped 2 review widgets — reviews have no reply concept), EDITOR 8→8 (events upcoming filter changed to date-based), ADMIN/SUPER_ADMIN 11→10 (dropped top-hosts list — no revenue ordering). Conversations "unanswered" renamed to "pending owner". Subscription endpoints corrected to list-and-pick + `/protected/billing/usage`. Open Q-A resolved. Data sources table (§6) fully verified. |
