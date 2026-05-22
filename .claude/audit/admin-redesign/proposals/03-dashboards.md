---
proposal: dashboards
status: DRAFT (in active discussion)
version: 0.1
date-started: 2026-05-22
last-updated: 2026-05-22
depends-on: 01-information-architecture.md (v0.7+), 02-config-schema.md (v0.2+)
---

# Per-Role Dashboard Configuration

> **Living document.** Defines the exact widgets each role sees on their Inicio dashboard. Each widget is configured per the Zod schema in `02-config-schema.md` §7. Lockable decisions live in [Decisions log](#decisions-log).

## How to read this doc

- Every dashboard is a `Dashboard` object (per schema §7): `{ widgets: Widget[] }`.
- Widgets are ordered by **priority** — top of array = top of dashboard.
- The renderer does responsive layout (1-column mobile, 2-3 column desktop). For V1, no explicit `size` field — widgets are full-width unless renderer applies grid rules.
- Data sources are referenced by **dotted string IDs** (e.g., `'accommodation.count.own'`). The implementation layer maps these to API endpoints / services. Convention in §7.

---

## 1. Goals

- **Scoped, not global**: HOST sees THEIR business numbers; ADMIN sees platform totals. No widget shows "global count" to a scoped user.
- **Action-oriented**: the dashboard exists to surface what needs the user's attention TODAY. Not to dump every metric ever.
- **Per-role mental model honored**: HOST = "Mi negocio". EDITOR = "La redacción". ADMIN = "La plataforma". SUPER_ADMIN = "La plataforma + ops".
- **No surprises for non-tech HOST**: plain-Spanish labels, no acronyms (MRR → "Ingresos del mes"), explicit CTAs.

---

## 2. Universal patterns

Across roles, dashboards follow a consistent skeleton:

```
[Welcome / next-action callout]   ← optional, top
[KPI row]                          ← 3-5 KPIs
[Action items / lists]             ← things needing attention
[Charts / trends]                  ← only for ADMIN+
[Status callouts]                  ← contextual (e.g., suscripción status)
[Shortcuts]                        ← optional, bottom
```

Not every role has every block. HOST emphasizes action-items; ADMIN emphasizes charts.

---

## 3. HOST dashboard — "Mi negocio"

Mental model: "What's happening with MY business right now?". Designed for non-tech users.

### Widgets in priority order

```ts
hostDashboard: {
  widgets: [
    // 1. Welcome + next action
    {
      id: 'welcome-host',
      type: 'callout',
      label: { es: 'Bienvenido', en: 'Welcome', pt: 'Bem-vindo' },
      scope: 'own',
      permissions: ['ACCESS_PANEL_ADMIN'],
      config: {
        variant: 'welcome',
        showUserName: true,
        primaryAction: 'host.next-action.own',  // dynamic: most urgent pending action
      },
    },

    // 2. KPI row — scoped to user's accommodations
    {
      id: 'kpi-my-accommodations',
      type: 'kpi',
      label: { es: 'Mis alojamientos activos', en: 'My active listings', pt: 'Meus alojamentos ativos' },
      scope: 'own',
      permissions: ['ACCOMMODATION_VIEW_OWN'],
      config: {
        source: 'accommodation.count.own.active',
        delta: { period: 'month', source: 'accommodation.count.own.active.last-month' },
        icon: 'home',
      },
    },
    {
      id: 'kpi-consultas-mes',
      type: 'kpi',
      label: { es: 'Consultas del mes', en: 'Inquiries this month', pt: 'Consultas do mês' },
      scope: 'own',
      permissions: ['CONVERSATION_VIEW_OWN'],
      config: {
        source: 'conversation.count.own.month',
        delta: { period: 'month', source: 'conversation.count.own.last-month' },
        icon: 'message-circle',
      },
    },
    {
      id: 'kpi-ocupacion',
      type: 'kpi',
      label: { es: 'Ocupación promedio', en: 'Avg occupancy', pt: 'Ocupação média' },
      scope: 'own',
      permissions: ['ACCOMMODATION_VIEW_OWN'],
      config: {
        source: 'accommodation.occupancy.own.month',
        format: 'percentage',
        icon: 'percent',
      },
    },
    {
      id: 'kpi-ingresos-mes',
      type: 'kpi',
      label: { es: 'Ingresos del mes', en: 'Revenue this month', pt: 'Receita do mês' },
      scope: 'own',
      permissions: ['BILLING_VIEW_OWN'],
      config: {
        source: 'revenue.own.month',
        format: 'currency',
        delta: { period: 'month', source: 'revenue.own.last-month' },
        icon: 'dollar-sign',
      },
    },

    // 3. Action items — things needing my attention
    {
      id: 'consultas-sin-responder',
      type: 'list',
      label: { es: 'Consultas sin responder', en: 'Unanswered inquiries', pt: 'Consultas sem resposta' },
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
      id: 'resenas-nuevas',
      type: 'list',
      label: { es: 'Reseñas nuevas sin responder', en: 'New reviews', pt: 'Novas avaliações' },
      scope: 'own',
      permissions: ['REVIEW_VIEW_OWN'],
      config: {
        source: 'review.list.own.unanswered',
        limit: 3,
        emptyState: { variant: 'neutral', message: { es: 'No hay reseñas nuevas', en: 'No new reviews', pt: 'Sem novas avaliações' } },
      },
    },

    // 4. Calendar — próximos eventos en mis alojamientos
    {
      id: 'proximos-checkins',
      type: 'calendar',
      label: { es: 'Próximos check-ins', en: 'Upcoming check-ins', pt: 'Próximos check-ins' },
      scope: 'own',
      permissions: ['ACCOMMODATION_VIEW_OWN'],
      config: {
        source: 'booking.upcoming.own.7d',
        range: 7,
        emptyState: { message: { es: 'Sin check-ins próximos', en: 'No upcoming check-ins', pt: 'Sem check-ins próximos' } },
      },
    },

    // 5. Status — suscripción + límites
    {
      id: 'subscription-status',
      type: 'callout',
      label: { es: 'Estado de mi suscripción', en: 'My subscription', pt: 'Minha assinatura' },
      scope: 'own',
      permissions: ['BILLING_VIEW_OWN', 'SUBSCRIPTION_VIEW_OWN'],
      config: {
        source: 'subscription.status.own',
        showNextCharge: true,
        variantWhen: {
          expiringSoon: 'warning',
          expired: 'danger',
          active: 'info',
        },
        actionLabel: { es: 'Ver mi plan', en: 'View my plan', pt: 'Ver meu plano' },
        actionRoute: '/mi-facturacion',
      },
    },
    {
      id: 'plan-usage',
      type: 'kpi',
      label: { es: 'Uso de mi plan', en: 'Plan usage', pt: 'Uso do plano' },
      scope: 'own',
      permissions: ['SUBSCRIPTION_VIEW_OWN'],
      config: {
        source: 'subscription.usage.own.accommodations',
        format: 'fraction',  // "3 de 5 alojamientos"
        warningAt: 0.8,       // 80% triggers visual warning
      },
    },
  ],
}
```

### Layout (responsive)

- Mobile: full-width stack, each widget below the previous.
- Desktop: welcome callout full-width; KPIs in a 4-col row; lists side-by-side (2-col); calendar full-width; subscription + plan-usage side-by-side.

---

## 4. EDITOR dashboard — "La redacción"

Mental model: "What's happening in editorial this week?". Editor is power user with `Cmd+K`.

### Widgets in priority order

```ts
editorDashboard: {
  widgets: [
    // 1. KPI row — editorial output
    {
      id: 'kpi-posts-mes',
      type: 'kpi',
      label: { es: 'Posts publicados este mes', en: 'Posts published this month', pt: 'Posts deste mês' },
      scope: 'all',
      permissions: ['POST_VIEW_ALL'],
      config: {
        source: 'post.count.published.month',
        delta: { period: 'month', source: 'post.count.published.last-month' },
      },
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
      id: 'kpi-newsletter-open-rate',
      type: 'kpi',
      label: { es: 'Open rate último envío', en: 'Last newsletter open rate', pt: 'Open rate último envio' },
      scope: 'all',
      permissions: ['NEWSLETTER_CAMPAIGN_VIEW'],
      config: {
        source: 'newsletter.last-campaign.open-rate',
        format: 'percentage',
      },
    },
    {
      id: 'kpi-suscriptores',
      type: 'kpi',
      label: { es: 'Suscriptores', en: 'Subscribers', pt: 'Inscritos' },
      scope: 'all',
      permissions: ['NEWSLETTER_SUBSCRIBER_VIEW'],
      config: {
        source: 'newsletter.subscribers.count.active',
        delta: { period: 'month', source: 'newsletter.subscribers.count.last-month' },
      },
    },

    // 2. Calendario editorial cross-content (posts + events + newsletter)
    {
      id: 'calendario-editorial',
      type: 'calendar',
      label: { es: 'Calendario editorial', en: 'Editorial calendar', pt: 'Calendário editorial' },
      scope: 'all',
      permissions: ['POST_VIEW_ALL', 'EVENT_VIEW_ALL', 'NEWSLETTER_CAMPAIGN_VIEW'],
      config: {
        source: 'editorial.calendar.14d',
        range: 14,
        contentTypes: ['post', 'event', 'newsletter'],
      },
    },

    // 3. Action items — borradores + reviews pendientes
    {
      id: 'borradores-pendientes',
      type: 'list',
      label: { es: 'Borradores pendientes', en: 'Pending drafts', pt: 'Rascunhos pendentes' },
      scope: 'all',
      permissions: ['POST_VIEW_ALL'],
      config: {
        source: 'post.list.drafts',
        limit: 5,
        emptyState: { variant: 'positive', message: { es: 'Sin borradores pendientes', en: 'No pending drafts', pt: 'Sem rascunhos' } },
      },
    },
    {
      id: 'eventos-sin-publicar',
      type: 'list',
      label: { es: 'Eventos por publicar', en: 'Events to publish', pt: 'Eventos a publicar' },
      scope: 'all',
      permissions: ['EVENT_VIEW_ALL'],
      config: {
        source: 'event.list.unpublished',
        limit: 5,
      },
    },

    // 4. Top performers (engagement)
    {
      id: 'top-posts-semana',
      type: 'list',
      label: { es: 'Top posts esta semana', en: 'Top posts this week', pt: 'Top posts da semana' },
      scope: 'all',
      permissions: ['ANALYTICS_CONTENT_VIEW'],
      config: {
        source: 'post.list.top-engagement.week',
        limit: 5,
        showMetric: 'views',
      },
    },

    // 5. Próximas campañas newsletter programadas
    {
      id: 'proximas-campanias',
      type: 'list',
      label: { es: 'Próximas campañas', en: 'Upcoming campaigns', pt: 'Próximas campanhas' },
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

---

## 5. ADMIN dashboard — "Vista plataforma"

Mental model: "How is the platform doing?". Same dashboard for ADMIN and SUPER_ADMIN, with the "System ops" block tagged `onMissing: 'hide'` so ADMIN doesn't see it.

### Widgets in priority order

```ts
adminDashboard: {
  widgets: [
    // 1. KPI row — platform totals
    {
      id: 'kpi-mrr',
      type: 'kpi',
      label: { es: 'Ingresos recurrentes mensuales', en: 'MRR', pt: 'Receita recorrente mensal' },
      scope: 'all',
      permissions: ['ANALYTICS_VIEW_ALL', 'BILLING_VIEW_ALL'],
      config: {
        source: 'revenue.mrr',
        format: 'currency',
        delta: { period: 'month', source: 'revenue.mrr.last-month' },
      },
    },
    {
      id: 'kpi-churn',
      type: 'kpi',
      label: { es: 'Churn mensual', en: 'Monthly churn', pt: 'Churn mensal' },
      scope: 'all',
      permissions: ['ANALYTICS_VIEW_ALL', 'SUBSCRIPTION_VIEW_ALL'],
      config: {
        source: 'subscription.churn.month',
        format: 'percentage',
        delta: { period: 'month', source: 'subscription.churn.last-month' },
        invertDelta: true,  // higher churn = bad, show negative delta as red
      },
    },
    {
      id: 'kpi-usuarios-activos',
      type: 'kpi',
      label: { es: 'Usuarios activos', en: 'Active users', pt: 'Usuários ativos' },
      scope: 'all',
      permissions: ['USER_VIEW_ALL'],
      config: {
        source: 'user.count.active.month',
        delta: { period: 'month', source: 'user.count.active.last-month' },
      },
    },
    {
      id: 'kpi-conversiones',
      type: 'kpi',
      label: { es: 'Conversiones del mes', en: 'Conversions this month', pt: 'Conversões do mês' },
      scope: 'all',
      permissions: ['ANALYTICS_VIEW_ALL'],
      config: {
        source: 'conversion.count.month',
        delta: { period: 'month', source: 'conversion.count.last-month' },
      },
    },

    // 2. Revenue chart
    {
      id: 'chart-revenue',
      type: 'chart',
      label: { es: 'Revenue mensual', en: 'Monthly revenue', pt: 'Receita mensal' },
      scope: 'all',
      permissions: ['ANALYTICS_VIEW_ALL', 'BILLING_VIEW_ALL'],
      config: {
        source: 'revenue.monthly.12m',
        chartType: 'line',
        format: 'currency',
      },
    },

    // 3. Top hosts by revenue
    {
      id: 'top-hosts',
      type: 'list',
      label: { es: 'Top hosts por revenue', en: 'Top hosts by revenue', pt: 'Top hosts por receita' },
      scope: 'all',
      permissions: ['ANALYTICS_VIEW_ALL'],
      config: {
        source: 'host.list.top-revenue.month',
        limit: 5,
        showMetric: 'revenue',
      },
    },

    // 4. Próximos eventos importantes (cross-platform editorial calendar preview)
    {
      id: 'eventos-importantes',
      type: 'list',
      label: { es: 'Próximos eventos destacados', en: 'Featured upcoming events', pt: 'Próximos eventos destacados' },
      scope: 'all',
      permissions: ['EVENT_VIEW_ALL'],
      config: {
        source: 'event.list.featured.upcoming',
        limit: 5,
      },
    },

    // 5. System health callout (always visible for ADMIN+)
    {
      id: 'system-status',
      type: 'callout',
      label: { es: 'Estado del sistema', en: 'System status', pt: 'Status do sistema' },
      scope: 'all',
      permissions: ['LOG_VIEW', 'CRON_VIEW'],
      config: {
        source: 'platform.health.overall',
        variantWhen: { ok: 'success', degraded: 'warning', down: 'danger' },
        showLastIncident: true,
      },
    },

    // ── SUPER_ADMIN-only block (System ops, onMissing: 'hide') ──

    // 6. Sentry errors (last 24h)
    {
      id: 'sentry-errors-24h',
      type: 'list',
      label: { es: 'Errores Sentry (24h)', en: 'Sentry errors (24h)', pt: 'Erros Sentry (24h)' },
      scope: 'all',
      permissions: ['LOG_VIEW', 'DEBUG_VIEW'],
      onMissing: 'hide',
      config: {
        source: 'sentry.issues.24h',
        limit: 5,
      },
    },

    // 7. Failed crons
    {
      id: 'failed-crons',
      type: 'list',
      label: { es: 'Crons fallidos', en: 'Failed crons', pt: 'Crons com falha' },
      scope: 'all',
      permissions: ['CRON_VIEW', 'DEBUG_VIEW'],
      onMissing: 'hide',
      config: {
        source: 'cron.list.failed.recent',
        limit: 5,
      },
    },

    // 8. Audit log preview (recent admin actions)
    {
      id: 'audit-log-preview',
      type: 'feed',
      label: { es: 'Actividad reciente del staff', en: 'Recent staff activity', pt: 'Atividade recente do staff' },
      scope: 'all',
      permissions: ['AUDIT_LOG_VIEW'],
      onMissing: 'hide',
      config: {
        source: 'audit.feed.recent',
        limit: 10,
      },
    },
  ],
}
```

### How ADMIN vs SUPER_ADMIN differ

**Same widget config, different `onMissing` results**:

- ADMIN lacks `DEBUG_VIEW` and `AUDIT_LOG_VIEW` permissions → widgets 6, 7, 8 are hidden for them.
- SUPER_ADMIN has all permissions → sees all 8 widgets.

This means **one dashboard config serves both roles**. The cherry-pick rule does the heavy lifting.

---

## 6. SUPER_ADMIN dashboard

**Same as `adminDashboard` config above**. The 3 super-only widgets (6, 7, 8) appear automatically because SUPER_ADMIN has the required permissions.

Per IA doc §12 + §13 + §16: `adminDashboard` is referenced by both `ADMIN.dashboard` and `SUPER_ADMIN.dashboard`. No duplication.

---

## 7. Data sources convention

Widget `config.source` values follow a dotted convention:

```
<entity>.<aggregation>.<scope?>.<modifier?>
```

Examples:
- `accommodation.count.own.active` → count of active accommodations belonging to the user.
- `revenue.mrr` → platform MRR (no scope = `'all'` implied).
- `event.list.featured.upcoming` → list of featured events that are upcoming.
- `sentry.issues.24h` → Sentry issues from the last 24 hours.
- `editorial.calendar.14d` → editorial calendar items for the next 14 days.

### Source resolver

A central `resolveDataSource(sourceId, ctx)` function in `apps/admin/src/lib/dashboard-sources.ts` maps each source ID to an API endpoint or service call. Examples:

```ts
'accommodation.count.own.active' → GET /api/v1/protected/accommodations?ownerId={userId}&status=active&pageSize=1 → pagination.total
'revenue.mrr'                    → GET /api/v1/admin/billing/metrics/mrr
'sentry.issues.24h'              → external Sentry API (server-to-server)
'editorial.calendar.14d'         → custom aggregator endpoint composing posts + events + newsletter
```

For V1, the resolver is hardcoded. Phase 2 may make it a registry (DB-backed for "custom widget sources").

### Why string IDs instead of inline functions?

- The config is **declarative data** — adding a function would require importing it, breaking the "no logic in config" principle.
- String IDs are stable, lintable, refactorable.
- Permits future runtime config editing (DB-backed) without code changes.

---

## 8. Empty / loading / error states

Per Phase 2 audit finding ("loading states use 3 inconsistent patterns"), V1 standardizes:

- **Loading**: skeleton placeholder matching widget shape (KPI = greyed box with number-sized rectangle; List = 3 greyed rows; Chart = greyed rectangle).
- **Empty**: widget shows `config.emptyState` if defined, otherwise generic `"No hay datos"`.
- **Error**: red callout with retry button + "Reportar problema" link to support.

Empty state variants in `config.emptyState`:

```ts
emptyState: {
  variant: 'positive' | 'neutral' | 'callout',
  message: I18nLabel,
  icon?: string,
  actionLabel?: I18nLabel,
  actionRoute?: string,
}
```

`variant: 'positive'` for "all done" cases (e.g., "¡Estás al día!"); `'neutral'` for "nothing yet" (e.g., "No hay reseñas aún"); `'callout'` for empty-states with CTA (e.g., "Crear tu primer alojamiento").

---

## 9. Refresh behavior

- **Auto-refresh**: each widget queries with `staleTime: 60_000` (1 min) and `refetchOnWindowFocus: true`. Override per widget via `config.staleTime`.
- **Manual refresh**: a global "Actualizar" button at the dashboard top invalidates all queries with `queryKey: ['dashboard', role]`.
- **Real-time push**: not in V1. Post-V1 may add server-sent events for `consultas-sin-responder` etc.

---

## 10. Per-role dashboard summary

| Role | Dashboard config ID | Total widgets | What's emphasized |
|------|---------------------|:-------------:|-------------------|
| HOST | `hostDashboard` | 10 | Action items + revenue + subscription |
| EDITOR | `editorDashboard` | 8 | Editorial output + calendar + top performers |
| ADMIN | `adminDashboard` | 5 visible (8 total) | Platform KPIs + revenue chart + system status |
| SUPER_ADMIN | `adminDashboard` | 8 (all visible) | Same as ADMIN + Sentry + crons + audit log |

---

## Open questions

### A. Widget sizing in config [OPEN]

V1: renderer decides layout based on widget order + breakpoint. No size hint in config.

Alternative: add `config.size: 'sm' | 'md' | 'lg' | 'xl'` so config controls grid spans. Less work for renderer, more granular control for whoever edits the config.

Recommend: keep V1 simple (no size in config). Add in V2 if layout edge cases demand it.

### B. Welcome callout dynamism [OPEN]

The HOST `welcome-host` callout proposes a dynamic `primaryAction` driven by `host.next-action.own` (a server-computed "what should I do next" resolver). This is non-trivial to implement.

Alternative: drop the dynamic part and show a static "Bienvenido [nombre]" without a CTA, since the action lists below already surface pending items.

Recommend: drop for V1. Re-add when there's a real "next-action" service.

### C. `host.next-action.own`, `editorial.calendar.14d`, etc. — custom aggregators [OPEN]

Some data sources are composite (e.g., editorial calendar = posts + events + newsletter unified). These need dedicated API endpoints, not generic CRUD reads.

Recommend: list these endpoints explicitly in the implementation spec. For V1: build the aggregators as part of the dashboard SPEC.

### D. Cross-role dashboard sharing [PROPOSED]

`adminDashboard` is referenced by both `ADMIN` and `SUPER_ADMIN`. Should `hostDashboard` ever be referenced by another role? No — host data is fundamentally scoped to one user. Keep host dashboard exclusive to HOST.

---

## Decisions log

| Date | Decision | Section |
|------|----------|---------|
| 2026-05-22 | HOST dashboard widgets (10): welcome callout, 4 KPIs (accommodations/inquiries/occupancy/revenue), 2 action lists, calendar, subscription status, plan usage | §3 |
| 2026-05-22 | EDITOR dashboard widgets (8): 4 KPIs (posts/events/open rate/subscribers), editorial calendar, 2 action lists (drafts/unpublished events), top posts, upcoming campaigns | §4 |
| 2026-05-22 | ADMIN dashboard widgets (5 visible): 4 KPIs (MRR/churn/users/conversions), revenue chart, top hosts, featured events, system status. Plus 3 super-only widgets (Sentry, crons, audit log) hidden via `onMissing: 'hide'` | §5 |
| 2026-05-22 | SUPER_ADMIN reuses `adminDashboard` config — single dashboard config serves both roles via permission-based widget visibility | §6 |
| 2026-05-22 | Data sources referenced by dotted string IDs (`entity.aggregation.scope.modifier`), resolved by central `resolveDataSource()` registry | §7 |
| 2026-05-22 | Empty/loading/error states standardized: skeleton on load, configurable emptyState per widget, red callout + retry on error | §8 |
| 2026-05-22 | Refresh: 60s staleTime + refetchOnWindowFocus; manual "Actualizar" button at dashboard top; no real-time push in V1 | §9 |

---

## Change log

| Date | Version | Change |
|------|---------|--------|
| 2026-05-22 | 0.1 | Initial full draft. 4 dashboards configured (HOST, EDITOR, ADMIN, SUPER_ADMIN reusing ADMIN). 10+8+8 widgets total. Data source convention, empty/loading/error states, refresh behavior. 4 open questions (widget sizing, welcome dynamism, custom aggregators, cross-role sharing). |
