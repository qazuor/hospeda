---
spec-id: SPEC-009
title: Admin ISR/Regeneration Management
type: feature
complexity: high
status: draft
created: 2026-02-13T12:00:00.000Z
updated: 2026-02-13T12:00:00.000Z
depends-on: SPEC-005
---

## SPEC-009: Admin ISR/Regeneration Management

## 1. Overview

Admin panel feature for managing page regeneration (ISR - Incremental Static Regeneration) of the public web application. Provides super admin users with visibility into which pages need regeneration, tools to trigger manual regeneration, and configuration of automated regeneration schedules.

This spec implements the admin-side management of the rendering/caching strategy defined in SPEC-005 Section 8.3.

## 2. Goals

- Give super admins visibility into page regeneration status
- Allow manual triggering of page regeneration (individual or batch)
- Configurable regeneration intervals per entity type
- Queue system for tracking pending regenerations
- Audit log of all regeneration events
- Webhook infrastructure for on-demand revalidation from content edits

## 3. User Stories

### US-001: View Regeneration Dashboard

**As a** super admin
**I want** to see which pages need regeneration
**So that** I can ensure the public site is up to date

**Given** a super admin navigates to the regeneration management section
**When** the dashboard loads
**Then** they see:

- Summary statistics (total pages, fresh, stale, pending, errored)
- Filterable table of all tracked pages with status
- Last regeneration time per page
- Next scheduled regeneration time
- Visual indicator for stale pages (amber) and errored pages (red)

### US-002: Manually Regenerate Pages

**As a** super admin
**I want** to trigger regeneration of specific pages
**So that** I can immediately update content after critical edits

**Given** a super admin selects one or more pages in the dashboard
**When** they click "Regenerar ahora"
**Then** the selected pages are added to the regeneration queue
**And** a progress indicator shows regeneration status
**And** on completion, the page status updates to "fresh"

### US-003: Bulk Regeneration

**As a** super admin
**I want** to regenerate all pages of a certain type
**So that** I can refresh content after major changes

**Given** a super admin clicks "Regenerar todo" with a type filter
**When** regeneration is triggered
**Then** all pages of that type are queued for regeneration
**And** progress shows X/N completed
**And** any failures are highlighted with error details

### US-004: Configure Regeneration Intervals

**As a** super admin
**I want** to configure how often pages auto-regenerate
**So that** I can balance freshness vs build costs

**Given** a super admin navigates to regeneration settings
**When** they modify interval values
**Then** the new intervals apply to the cron schedule
**And** changes are logged in the audit trail

## 4. Architecture

### 4.1 Page Registry

Every pre-rendered page is tracked in a registry:

```typescript
// pageRegenerationRegistry table
{
  id: uuid,
  path: string,                    // e.g. "/es/alojamientos/hotel-ejemplo/"
  entityType: "accommodation" | "destination" | "event" | "post" | "listing" | "static",
  entityId: string | null,         // FK to related entity (null for listing/static pages)
  locale: "es" | "en" | "pt",
  status: "fresh" | "stale" | "pending" | "regenerating" | "error",
  lastRegeneratedAt: DateTime | null,
  lastTriggeredAt: DateTime | null,
  nextScheduledAt: DateTime | null,
  staleSince: DateTime | null,     // When the page became stale (content changed)
  staleReason: string | null,      // What triggered the staleness
  errorMessage: string | null,     // Last error if status is "error"
  retryCount: number,              // Number of failed regeneration attempts
  createdAt: DateTime,
  updatedAt: DateTime
}

// pageRegenerationConfig table
{
  id: uuid,
  entityType: string,
  intervalMinutes: number,         // Auto-regeneration interval
  maxRetries: number,              // Max retries on failure (default: 3)
  priority: number,                // Queue priority (1=highest)
  enableAutoRegeneration: boolean, // default: true
  updatedAt: DateTime
}

// pageRegenerationLog table (audit)
{
  id: uuid,
  pageId: uuid,                    // FK to registry
  action: "regenerated" | "queued" | "failed" | "skipped" | "config_changed",
  trigger: "manual" | "webhook" | "cron" | "on-demand",
  triggeredBy: string | null,      // User ID for manual triggers
  duration_ms: number | null,      // How long regeneration took
  errorMessage: string | null,
  metadata: JSONB,                 // Additional context
  createdAt: DateTime
}
```

### 4.2 Webhook System

When content is edited in the admin panel, a webhook marks affected pages as stale:

```typescript
// Webhook triggers (integrated into existing admin CRUD operations)
// Each entity update triggers:
1. Mark entity's detail page as stale
2. Mark related listing pages as stale (e.g., /alojamientos/ index)
3. Mark cross-entity pages as stale (e.g., destination page showing accommodations)
4. Queue immediate regeneration if configured for on-demand

// Example: Accommodation "hotel-ejemplo" is edited
// Pages marked stale:
// - /es/alojamientos/hotel-ejemplo/
// - /en/alojamientos/hotel-ejemplo/
// - /pt/alojamientos/hotel-ejemplo/
// - /es/alojamientos/ (listing page)
// - /es/destinos/concepcion-del-uruguay/ (parent destination)
```

### 4.3 Regeneration Queue

```typescript
// Queue processing order:
1. Manual triggers (highest priority)
2. Webhook triggers (on-demand, content edits)
3. Cron triggers (scheduled intervals)

// Concurrency: Max 5 parallel regenerations to avoid overloading
// Rate limiting: Max 100 regenerations per minute
// Retry: Exponential backoff on failure (1m, 5m, 15m)
```

### 4.4 Vercel Integration

For Vercel-hosted sites, regeneration uses Vercel's on-demand ISR API:

```typescript
// Trigger revalidation via Vercel API
POST https://hospeda.com/api/revalidate
Headers: { "x-revalidate-token": REVALIDATION_SECRET }
Body: { "path": "/es/alojamientos/hotel-ejemplo/" }
```

The API endpoint in the web app validates the token and calls `Astro.revalidate()` or equivalent.

## 5. API Endpoints

```
// Admin endpoints (SUPER_ADMIN role required)
GET    /api/v1/admin/regeneration/dashboard    → Dashboard stats
GET    /api/v1/admin/regeneration/pages        → List pages with filters
POST   /api/v1/admin/regeneration/regenerate   → Trigger regeneration (single or batch)
POST   /api/v1/admin/regeneration/regenerate-all → Regenerate all pages of a type
GET    /api/v1/admin/regeneration/config       → Get regeneration config
PUT    /api/v1/admin/regeneration/config       → Update regeneration config
GET    /api/v1/admin/regeneration/log          → Audit log with filters
GET    /api/v1/admin/regeneration/queue        → Current queue status

// Internal webhook endpoint (on web app, not admin API)
POST   /api/revalidate                         → ISR revalidation endpoint (token-protected)
```

## 6. Admin UI Components

### 6.1 Regeneration Dashboard Page

```
/admin/regeneration/
├── Summary Cards (total, fresh, stale, pending, errored)
├── Quick Actions ("Regenerar todo", "Limpiar errores")
├── Page Table
│   ├── Filters (entity type, status, locale, date range)
│   ├── Columns: Path, Type, Status, Last Regen, Stale Since, Actions
│   ├── Row actions: "Regenerar", "Ver log", "Forzar"
│   └── Bulk actions: Select multiple → "Regenerar seleccionados"
├── Queue Monitor (live)
│   ├── Currently processing
│   ├── Pending in queue
│   └── Recent completions
└── Recent Activity (last 20 log entries)
```

### 6.2 Configuration Page

```
/admin/regeneration/config/
├── Interval Settings (per entity type)
│   ├── Accommodations: [input] minutes (default: 1440 = 24h)
│   ├── Destinations: [input] minutes (default: 1440 = 24h)
│   ├── Events: [input] minutes (default: 360 = 6h)
│   ├── Blog Posts: [input] minutes (default: 1440 = 24h)
│   └── Listing Pages: [input] minutes (default: 60 = 1h)
├── Queue Settings
│   ├── Max concurrent: [input] (default: 5)
│   ├── Max per minute: [input] (default: 100)
│   └── Max retries: [input] (default: 3)
├── Automation Toggles
│   ├── Enable auto-regeneration: [toggle]
│   ├── Enable webhook triggers: [toggle]
│   └── Enable cron schedule: [toggle]
└── Save button
```

## 7. Stale Page Detection

### 7.1 Change-to-Page Mapping

When an entity is modified, these pages become stale:

| Entity Changed | Pages Marked Stale |
|---|---|
| Accommodation (edit) | Detail page (all locales), listing pages, parent destination page |
| Accommodation (create) | Listing pages, parent destination page, homepage (if featured) |
| Accommodation (delete/deactivate) | Detail page, listing pages, parent destination page |
| Destination (edit) | Detail page (all locales), destination listing, homepage (if featured) |
| Event (edit) | Detail page (all locales), event listing, parent destination page |
| Event (create) | Event listing, parent destination page, homepage (if featured) |
| Event (expired) | Detail page, event listing (cron detects) |
| Blog Post (edit) | Detail page (all locales), blog listing, related entity pages |
| Blog Post (publish) | Blog listing, homepage (if featured), related entity pages |
| Review (created) | Accommodation/destination detail page (rating change) |
| Tag/Amenity (edit) | All entities using that tag/amenity (batch stale) |
| Pricing plan (edit) | Pricing pages (all locales) |
| Site-wide config | All pages (full regeneration) |

### 7.2 Cascade Rules

- When a parent entity changes, child pages are NOT automatically stale (e.g., editing a destination doesn't stale its accommodations)
- When a shared resource changes (tag, amenity), ALL referencing pages are stale
- Homepage is only stale when featured content changes

## 8. Monitoring & Alerts

- Admin notification when > 50 pages are stale for > 2 hours
- Admin notification on 3+ consecutive regeneration failures
- Dashboard widget showing regeneration health score
- Log retention: 30 days (configurable)

## 9. Performance Considerations

- Page registry queries must be indexed on (entityType, status, locale)
- Queue processing uses database-backed job queue (not in-memory)
- Regeneration requests are debounced (multiple edits within 30s = single regeneration)
- Batch operations process in chunks of 10

## 10. Security

- All admin endpoints require SUPER_ADMIN role
- Revalidation webhook endpoint requires secret token
- Rate limiting on regeneration triggers (prevent abuse)
- Audit log for all manual actions

## 11. Out of Scope

- CDN cache purging (handled by Vercel automatically)
- A/B testing of regenerated pages
- Preview/staging regeneration
- Multi-site regeneration management
- Custom regeneration scripts per page

## 12. Dependencies

- SPEC-005: Defines the ISR strategy and page rendering decisions
- Admin panel: UI integration
- Vercel hosting: ISR revalidation API
- Cron infrastructure: Scheduled regeneration jobs

---

**Status**: Draft - awaiting review
