---
proposal: dashboards
status: DRAFT (in active discussion)
version: 0.2
date-started: 2026-05-22
last-updated: 2026-05-22
depends-on: 01-information-architecture.md (v0.7+), 02-config-schema.md (v0.2+)
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
    // KPIs (4)
    {
      id: 'kpi-my-accommodations',
      type: 'kpi',
      label: { es: 'Mis alojamientos', en: 'My listings', pt: 'Meus alojamentos' },
      scope: 'own',
      permissions: ['ACCOMMODATION_VIEW_OWN'],
      config: {
        source: 'accommodation.count.own',  // GET /api/v1/admin/accommodations?ownerId={userId}&pageSize=1 → pagination.total
      },
    },
    {
      id: 'kpi-consultas-sin-responder',
      type: 'kpi',
      label: { es: 'Consultas sin responder', en: 'Unanswered inquiries', pt: 'Consultas sem resposta' },
      scope: 'own',
      permissions: ['CONVERSATION_VIEW_OWN'],
      config: {
        source: 'conversation.count.own.unanswered',  // same pattern as the sidebar useUnreadCount()
      },
    },
    {
      id: 'kpi-resenas-pendientes',
      type: 'kpi',
      label: { es: 'Reseñas sin responder', en: 'Unanswered reviews', pt: 'Avaliações sem resposta' },
      scope: 'own',
      permissions: ['REVIEW_VIEW_OWN'],
      config: {
        source: 'review.count.own.unanswered',
      },
    },
    {
      id: 'kpi-mi-plan',
      type: 'kpi',
      label: { es: 'Estado de mi plan', en: 'My plan status', pt: 'Status do meu plano' },
      scope: 'own',
      permissions: ['SUBSCRIPTION_VIEW_OWN'],
      config: {
        source: 'subscription.status.own',  // active/trial/past-due/etc.
        format: 'badge',
      },
    },

    // Action lists (2)
    {
      id: 'list-consultas-recientes',
      type: 'list',
      label: { es: 'Consultas recientes sin responder', en: 'Recent unanswered inquiries', pt: 'Consultas recentes sem resposta' },
      scope: 'own',
      permissions: ['CONVERSATION_VIEW_OWN'],
      config: {
        source: 'conversation.list.own.unanswered',
        limit: 5,
        emptyState: { variant: 'positive', message: { es: '¡Estás al día!', en: 'All caught up!', pt: 'Tudo em dia!' } },
        actionPerItem: { route: '/consultas/{id}', label: { es: 'Responder', en: 'Reply', pt: 'Responder' } },
      },
    },
    {
      id: 'list-resenas-recientes',
      type: 'list',
      label: { es: 'Reseñas recientes', en: 'Recent reviews', pt: 'Avaliações recentes' },
      scope: 'own',
      permissions: ['REVIEW_VIEW_OWN'],
      config: {
        source: 'review.list.own.recent',
        limit: 3,
        emptyState: { variant: 'neutral', message: { es: 'No hay reseñas nuevas', en: 'No new reviews', pt: 'Sem novas avaliações' } },
      },
    },

    // Subscription callouts (2)
    {
      id: 'subscription-status',
      type: 'callout',
      label: { es: 'Estado de mi suscripción', en: 'My subscription', pt: 'Minha assinatura' },
      scope: 'own',
      permissions: ['SUBSCRIPTION_VIEW_OWN'],
      config: {
        source: 'subscription.status.own',
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
        source: 'subscription.usage.own.accommodations',  // "3 de 5 alojamientos publicados"
        format: 'fraction',
        warningAt: 0.8,
      },
    },
  ],
}
```

**7 widgets** (vs 10 originally proposed). Removed: welcome-host (dynamic next-action), kpi-ocupacion, kpi-ingresos-mes, proximos-checkins-calendar.

### Removed from V1 (in `99-future-enhancements.md` §2)

- Próximos check-ins calendar — no booking system
- Ocupación promedio — no booking system
- Ingresos del mes (per-host) — no per-host revenue tracking
- Welcome callout with dynamic next-action — no resolver service

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
      config: { source: 'event.count.upcoming' },
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

    // Lists (2)
    {
      id: 'list-top-hosts',
      type: 'list',
      label: { es: 'Top hosts por suscripción', en: 'Top hosts by subscription', pt: 'Top hosts por assinatura' },
      scope: 'all',
      permissions: ['SUBSCRIPTION_VIEW_ALL', 'USER_VIEW_ALL'],
      config: {
        source: 'subscription.list.top-revenue.month',  // 🟡 verify endpoint
        limit: 5,
      },
    },
    {
      id: 'list-upcoming-events',
      type: 'list',
      label: { es: 'Próximos eventos destacados', en: 'Featured upcoming events', pt: 'Próximos eventos destacados' },
      scope: 'all',
      permissions: ['EVENT_VIEW_ALL'],
      config: {
        source: 'event.list.featured.upcoming',  // 🟡 verify "featured" flag exists
        limit: 5,
      },
    },
  ],
}
```

**11 widgets**: 6 existing + 3 billing + 2 lists. ADMIN sees all 11 (no super-only widgets in V1). SUPER_ADMIN dashboard = same.

### Removed from V1 (in `99-future-enhancements.md` §2)

- Churn KPI — no churn metric computed today
- Conversions KPI — definition + tracking missing
- System status callout — depends on platform health endpoint (uncertain)
- Sentry errors widget (super-only) — no integration
- Failed crons widget (super-only) — cron list exists, "failed-only" filter uncertain
- Audit log preview (super-only) — no audit log system

### 🟡 Items to verify before locking

- `billing.metrics.revenue.12m` — does `/api/v1/admin/billing/metrics` return time series or only point-in-time?
- `subscription.list.top-revenue.month` — does an ordering by revenue exist?
- `event.list.featured.upcoming` — does an event "featured" flag exist?

If any of these don't exist, drop the widget (don't build new endpoints in V1).

---

## 5. SUPER_ADMIN dashboard

**Same as `adminDashboard`** above. No super-only widgets in V1 (all the super-only ones — Sentry, audit log, failed crons — require code that doesn't exist).

V1 difference between ADMIN and SUPER_ADMIN dashboards: **zero**.

When the post-V1 features ship (audit log, Sentry integration, failed-crons widget), they'll be added to `adminDashboard` with permissions that ADMIN lacks (`onMissing: 'hide'`) — exposing them only to SUPER_ADMIN automatically.

---

## 6. Data sources reference

Per IA §13 schema config field `source`. V1 source IDs map to existing endpoints:

| Source ID | Existing endpoint | Notes |
|-----------|-------------------|-------|
| `accommodation.count.own` | `GET /api/v1/admin/accommodations?ownerId={uid}&pageSize=1` | pagination.total |
| `accommodation.count.all` | `GET /api/v1/admin/accommodations?pageSize=1` | already used in current dashboard |
| `conversation.count.own.unanswered` | `GET /api/v1/admin/conversations?ownerId={uid}&status=unanswered&pageSize=1` | 🟡 verify status filter |
| `conversation.list.own.unanswered` | `GET /api/v1/admin/conversations?ownerId={uid}&status=unanswered&pageSize=5&sort=updated_at_desc` | |
| `review.count.own.unanswered` | `GET /api/v1/admin/reviews?ownerId={uid}&status=unanswered&pageSize=1` | 🟡 verify |
| `review.list.own.recent` | `GET /api/v1/admin/reviews?ownerId={uid}&pageSize=3&sort=created_at_desc` | |
| `subscription.status.own` | `GET /api/v1/protected/subscriptions/me` (qzpay-hono) | 🟡 verify path |
| `subscription.usage.own.accommodations` | `GET /api/v1/protected/subscriptions/me/usage` | 🟡 verify path |
| `post.count.published.month` | `GET /api/v1/admin/posts?status=published&publishedAfter={month-start}&pageSize=1` | 🟡 verify date filter |
| `post.count.drafts` | `GET /api/v1/admin/posts?status=draft&pageSize=1` | |
| `post.list.drafts` | `GET /api/v1/admin/posts?status=draft&pageSize=5&sort=updated_at_desc` | |
| `event.count.upcoming` | `GET /api/v1/admin/events?status=upcoming&pageSize=1` | 🟡 verify status enum |
| `event.list.upcoming` | `GET /api/v1/admin/events?status=upcoming&pageSize=5` | |
| `newsletter.subscribers.count.active` | `GET /api/v1/admin/newsletter/subscribers?status=active&pageSize=1` | |
| `newsletter.last-campaign.open-rate` | `GET /api/v1/admin/newsletter/campaigns?status=sent&pageSize=1&sort=sent_at_desc` + read metrics from response | |
| `newsletter.campaigns.scheduled` | `GET /api/v1/admin/newsletter/campaigns?status=scheduled&pageSize=3` | |
| `billing.metrics.mrr` | `GET /api/v1/admin/billing/metrics/mrr` | 🟡 confirm exact path |
| `billing.metrics.revenue.12m` | `GET /api/v1/admin/billing/metrics/revenue?range=12m` | 🟡 verify time series support |
| `subscription.count.active` | `GET /api/v1/admin/subscriptions?status=active&pageSize=1` | |

**Items flagged 🟡 need verification** before locking the V1 widget set. If a source doesn't exist, drop the widget — don't build new endpoints for it.

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
| HOST | `hostDashboard` | 7 | Scoped to user's accommodations + own conversations + own reviews + own subscription |
| EDITOR | `editorDashboard` | 8 | Global counts on content + newsletter metrics |
| ADMIN | `adminDashboard` | 11 | Existing 6 KPIs + 3 billing + 2 lists |
| SUPER_ADMIN | `adminDashboard` (shared) | 11 (same) | Zero V1 super-only widgets — all super-only ones need new code |

---

## Open questions

### A. Verify endpoints flagged 🟡 [OPEN]

Need a focused audit on:
- conversations / reviews `status=unanswered` filter support
- subscription.usage.own endpoint location (web app vs admin)
- billing metrics time-series endpoint
- event `featured` flag
- post date filter support

Action: spawn a small audit before implementation spec. If any endpoint doesn't exist, drop the widget (DO NOT build new endpoints in V1 just for dashboards).

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

---

## Change log

| Date | Version | Change |
|------|---------|--------|
| 2026-05-22 | 0.1 | Initial draft — included aspirational widgets (check-ins, occupancy, host revenue, Sentry, audit log preview, etc.) without backing code |
| 2026-05-22 | 0.2 | **Reality pass** — full rewrite scoped to V1 widgets with existing data sources. HOST 10→7, EDITOR 8→8 (1 deferred), ADMIN 8→11 (reusing existing KPIs, removing aspirational). Zero super-only V1 widgets (all moved to future). Data sources reference table added (§6) with 🟡 flags for items needing verification audit. Reduced widget count significantly while remaining honest about what works today. |
