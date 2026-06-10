---
id: SPEC-175
slug: admin-whats-new
title: Admin What's New / Release Notes Dialog
status: completed
owner: qazuor
created: 2026-05-29
relatedSpecs:
  - SPEC-174  # admin-welcome-tour — SIBLING: shares UserSettings.onboarding JSONB + protected dedicated-PATCH merge pattern
  - SPEC-154  # admin config-driven IA — the dashboard card is a widget in this system
  - SPEC-155  # role dashboards — the card lives on HOST/EDITOR/ADMIN/SUPER dashboards
  - SPEC-169  # role-permission own-scoping — REASON the admin users PATCH is unusable; forces protected-tier endpoint
tags: [admin, onboarding, whats-new, release-notes, config-driven, i18n, frontend, api, ux]
---

# SPEC-175 — Admin What's New / Release Notes Dialog

> ⛔ **DECISION PROTOCOL (read first, applies to the whole spec):** In every single case —
> without exception — if a change or decision is not *extremely* clear-cut, if there is even
> the slightest ambiguity, or if there is more than one viable option, **STOP and consult the
> owner (qazuor)**. Do not decide autonomously. See §14.

## 1. Summary

Add a curated **"What's New"** (release notes) feature to the admin panel (`apps/admin`). When
curated content is published, users see it through four integrated surfaces: an auto-opening
modal for highlighted entries, a badge counter in the topbar, a full-list panel, and a
dashboard card on every role's dashboard. The trigger is **published content**, not a
technical deploy or git SHA.

The feature serves non-technical users (HOST, EDITOR) and power users (ADMIN, SUPER_ADMIN)
equally: everyone learns about improvements relevant to their role without reading changelogs.

**Scope note:** persistence of "seen" state requires a backend change in `apps/api` and
`@repo/schemas`. This is not an admin-only feature — the endpoint lives in the protected tier
and is designed to also serve `apps/web` in a future v2.

## 2. Context & problem statement

### 2.1 The trigger is content, not a deploy

Deploys are frequent. A "What's New" entry appears only because someone authored and
published it in the curated data file. Git SHA, Sentry release identifiers, and deployment
timestamps play **no role** in determining what users see. This is a deliberate product
decision: deploy cadence and content cadence are independent.

### 2.2 What exists today (verified 2026-05-29)

- **Config-driven IA (SPEC-154)** lives in `apps/admin/src/config/ia/`: `schema.ts`
  (Zod, boot-validated), `dashboards.ts`, roles, sections, sidebars, tabs. The `I18nLabel`
  type (`{ es, en, pt }`) is defined in `schema.ts` as `I18nLabelSchema`.
- **Dashboard system (SPEC-155)**: `DashboardRenderer.tsx` dispatches widgets by type.
  `ListWidget` is the V1 primitive for top-N lists with per-row actions. Dashboard sources
  live in `apps/admin/src/lib/dashboard-sources/{host,editor,admin,super}.ts` and are
  registered as a side-effect import in `DashboardRenderer.tsx`.
- **Header** (`apps/admin/src/components/layout/header/Header.tsx`): `sticky top-0 z-40`,
  river-100 band, `NotificationIcon` button already present (drives notifications popover).
  Right-side slot order: `QuickCreate` | `CommandPalette` | Notifications | Profile | Settings |
  `AuthHeader`. A "What's New" badge icon fits between Notifications and Profile.
- **shadcn Dialog**: `apps/admin/src/components/ui/dialog.tsx`. shadcn Sheet:
  `apps/admin/src/components/ui/sheet.tsx`.
- **PostHog**: `apps/admin/src/lib/analytics/posthog-client.ts` with `trackEvent`.
- **TipTap** is already installed (`@tiptap/react ^2`, `@tiptap/starter-kit ^2`,
  `tiptap-markdown ^0.9.0`) — the existing admin rich-text editor. This is the strongly
  recommended sanitized markdown renderer (see §12 TBD-1).
- **No "What's New" infrastructure** exists anywhere in the repo.
- **No onboarding persistence**. `UserSettings` (JSONB column on `users`) does not yet have
  an `onboarding` namespace. SPEC-174 (sibling spec) adds `onboarding.adminTours` to the
  same namespace; SPEC-175 adds `onboarding.whatsNew` to the same object.

### 2.3 Why persistence goes through the protected tier (SPEC-169 constraint)

The naive path — `PATCH /api/v1/admin/users/{id}` — does not work:

- The admin PATCH requires `MANAGE_USERS`, assigned to no role in
  `packages/seed/src/required/rolePermissions.seed.ts` (not even SUPER_ADMIN).
- The admin GET requires `USER_READ_ALL`, which HOST and EDITOR do not hold (SPEC-169
  owner-scoping).

Therefore persistence must go through the **protected tier** (`/api/v1/protected/...`), where
ownership is implicit (`me` = actor). This is the same constraint that drives SPEC-174's
`PATCH /api/v1/protected/users/me/tour-progress`. See §4.D6.

### 2.4 Relationship to SPEC-174

SPEC-174 (admin-welcome-tour) and SPEC-175 share:

- The same `UserSettings.onboarding` JSONB namespace (additive, no migration).
- The same protected dedicated-PATCH-with-server-side-merge pattern.
- The same "no `.default({})`" caution on the JSONB column.

The two specs are independent features and can be implemented in any order. Their JSONB keys
are distinct (`onboarding.adminTours` vs `onboarding.whatsNew`) and do not interfere.

## 3. Goals / Non-goals

### Goals

1. Curated release notes surface in the admin with four integrated entry points.
2. Content is authored in the repo as a **typed, Zod-validated data file** — a typo
   breaks startup, not production.
3. **Role-based audience segmentation**: entries can target specific roles (HOST, EDITOR,
   ADMIN, SUPER_ADMIN). This is content routing, not authorization.
4. **Highlight entries auto-open a modal once** per user per entry (server-side lazy init
   covers both new and pre-existing users with no migration).
5. **Badge counter** in the topbar reflects unseen applicable entries in real time.
6. **Panel** lists all applicable entries; "mark all as read" clears the badge.
7. **Dashboard card "Últimas novedades"** on all four role dashboards (HOST, EDITOR, ADMIN,
   SUPER_ADMIN) in the config-driven widget system.
8. **Shared state**: one hook/store; modal, badge, panel, and card all consume it.
9. **i18n**: UI strings in a new namespace `admin-whats-new`; entry content carries
   es/en/pt inline with `es` required.
10. **Analytics** via existing PostHog `trackEvent`.
11. **Accessibility**: keyboard nav, focus trap in modal, ESC, screen-reader labels.

### Non-goals (this spec)

- `apps/web` surface (v2 future).
- Admin CRUD panel for authoring entries (content is repo-curated).
- Semantic versioning or deploy-based triggering.
- Pagination of the entries list (volume is low by design).
- Per-user opt-out of all What's New content.

## 4. Locked product decisions (from owner Q&A)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Trigger = curated content publish, NOT deploy or git SHA. | Deploys are frequent; only intentional content authorship should surface to users. |
| D2 | Content file is a TS array in `apps/api/src/data/whats-new/whats-new.ts`, Zod-validated at API boot. | Repo-native, type-safe, startup-time validation catches typos before production. |
| D3 | Entry schema SSOT in `@repo/schemas`. | Never duplicate type definitions across packages. |
| D4 | Entry `roles` field = audience targeting only (content routing), NOT an authorization gate. | The endpoint only requires an authenticated session. `PermissionEnum` governs access; `roles` here just filters which entries a user sees. |
| D5 | Persist in `UserSettings.onboarding.whatsNew` as `{ baselineAt: ISO, seenIds: string[] }`. | Additive JSONB, no migration. Sibling to SPEC-174's `onboarding.adminTours`. |
| D6 | Backend = protected tier. Dedicated `PATCH /api/v1/protected/users/me/whats-new-seen` with server-side merge. | SPEC-169 makes admin-tier user PATCH unusable for HOST/EDITOR. Dedicated endpoint avoids clobber risk on sibling settings. |
| D7 | `GET /api/v1/protected/whats-new` returns role-filtered entries with computed `seen: boolean` + `unseenCount`. Lazy-init on first hit. | Single endpoint computes everything server-side; client stays simple. |
| D8 | Lazy init: on first GET, if `settings.onboarding.whatsNew` is absent, server sets `baselineAt = now`, `seenIds = []` and persists. | Covers new AND pre-existing users uniformly — zero signup code, zero data migration. |
| D9 | Response localizes server-side OR sends all locales + client picks — see §6.2 for the chosen approach. | Consistent with how other i18n payloads work in this codebase. |
| D10 | **Single shared hook** `useWhatsNew()` in `apps/admin/src/hooks/use-whats-new.ts`. Modal, badge, panel, card all consume it. Independent fetches are forbidden. | Ensures marking seen in one surface immediately reflects in all others without re-fetch race conditions. |
| D11 | Modal auto-opens once if there are unseen `highlight: true` entries. Closes → marks those ids seen. | Natural "show once" behaviour without complex state machines. |
| D12 | Badge = `@repo/icons` icon (bell or gift) + unseen counter in topbar, between Notifications and Profile. | Consistent with existing topbar icon pattern. |
| D13 | Dashboard card = `ListWidget` or closest widget primitive in the config-driven system. | Consistency with SPEC-154/SPEC-155 architecture; no ad-hoc card components. |
| D14 | UI chrome strings in new namespace `admin-whats-new.json` (es/en/pt); entry content travels in the data file. | Separation between app strings and curator-authored content. |
| D15 | Markdown body rendered sanitized using TipTap's existing read-only path (`@tiptap/react` + `tiptap-markdown` already installed). | No new dependency; XSS-safe; consistent with admin rich text. See §12 TBD-1. |
| D16 | Analytics via existing `trackEvent` in `apps/admin/src/lib/analytics/posthog-client.ts`. | No new infra. |
| D17 | **Welcome-tour priority (cross-spec, owner-locked 2026-06-03)**: the What's New auto-modal must NOT fire for a user whose SPEC-174 welcome tour is still pending (unseen). A brand-new user starts from zero — nothing is "news" to them. `baselineAt` already covers entries published before first login; this rule covers the residual window. Suppression only affects the auto-modal; badge, panel, and card render normally. Implemented as coordination in the auto-trigger when SPEC-174 lands (whichever ships second wires it). | Avoids stacking two auto-opening modals on a new user's first dashboard load. |

## 5. Scope

### In scope

- `packages/schemas` — `WhatsNewEntrySchema`, `WhatsNewSeenBodySchema`, `UserOnboardingWhatsNew` type, `UserSettingsSchema` delta.
- `apps/api` — curated data file, `GET /api/v1/protected/whats-new`, `PATCH /api/v1/protected/users/me/whats-new-seen`, service method.
- `apps/admin` — `useWhatsNew()` hook, modal, topbar badge, panel (Sheet), dashboard card widget + source registration on all four role dashboards, i18n namespace.
- `packages/i18n` — `admin-whats-new.json` in es/en/pt.
- CSP ops task (§9).

### Out of scope (v1)

- `apps/web` What's New surface.
- Admin CRUD UI for authoring entries.
- Semantic versioning or per-deploy triggering.
- Pagination.
- Individual per-user opt-out toggle.
- Any disabled roles (SPONSOR, CLIENT_MANAGER).

## 6. Architecture — Backend

### 6.1 Schema delta (`packages/schemas/src/entities/user/user.settings.schema.ts`)

Add to `UserSettingsSchema` — **additive only**, no DB migration:

```ts
onboarding: z.object({
  adminTours: z.record(z.string(), z.number().int().nonnegative()).optional(),
  whatsNew: z.object({
    baselineAt: z.string().datetime().optional(),
    seenIds: z.array(z.string()).optional()
  }).optional()
}).optional()
```

Rules (identical to SPEC-174's guidance):

- Do **NOT** add `.default({})` on `onboarding` or any sub-object. Adding a default causes Zod
  to rewrite the stored JSONB on every parse, silently zeroing unseen state for users whose
  stored column lacks the key. A missing `onboarding` key must parse cleanly (treated as "no
  state").
- Export an inferred `UserOnboardingWhatsNew` type alongside existing exports.
- The `onboarding.adminTours` key is SPEC-174's territory — include it in the schema update
  but do not change its semantics.

### 6.2 Entry schema (`packages/schemas/src/entities/whats-new/whats-new.schema.ts`) (NEW)

```ts
export const WhatsNewEntryI18nSchema = z.object({
  es: z.string().min(1),   // REQUIRED — project default locale
  en: z.string().optional(),
  pt: z.string().optional()
});

export const WhatsNewEntrySchema = z.object({
  /** Stable string id, e.g. '2026-05-29-cron-history'. Never reuse a retired id. */
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, 'id must be kebab-case'),

  /** ISO date string. Used for sorting and 'unseen' comparison vs baselineAt. */
  publishedAt: z.string().datetime(),

  /**
   * Optional role audience. Empty/absent means ALL roles see the entry.
   * This is audience targeting — NOT an authorization gate.
   * The endpoint only requires an authenticated session.
   */
  roles: z.array(z.enum(['HOST', 'EDITOR', 'ADMIN', 'SUPER_ADMIN'])).optional(),

  /**
   * When true, the entry auto-opens the modal once (if unseen).
   * Default false — non-highlight entries only appear in panel/card.
   */
  highlight: z.boolean().default(false),

  /** Title — es REQUIRED, en/pt optional (fallback to es). */
  title: WhatsNewEntryI18nSchema,

  /**
   * Body — MARKDOWN. es REQUIRED, en/pt optional (fallback to es).
   * Rendered sanitized via TipTap read-only path. See §12 TBD-1.
   */
  body: WhatsNewEntryI18nSchema,

  /**
   * Optional image URL (CDN/external). When present, admins MUST add the
   * origin to the admin CSP img-src directive. See §9.
   * TBD-2: exact CDN origin is TBD.
   */
  image: z.string().url().optional()
});

export type WhatsNewEntry = z.infer<typeof WhatsNewEntrySchema>;
```

Export from `packages/schemas/src/index.ts`.

### 6.3 Curated data file (`apps/api/src/data/whats-new/whats-new.ts`) (NEW)

```
apps/api/src/data/
└── whats-new/
    └── whats-new.ts   # Typed array, validated at boot
```

Pattern (consistent with how the API organizes other static data; no `data/` dir exists yet,
create it):

```ts
import { WhatsNewEntrySchema } from '@repo/schemas';
import { z } from 'zod';

const WhatsNewCatalogSchema = z.array(WhatsNewEntrySchema).min(0);

/** Curated What's New entries. Sorted newest-first by convention. */
export const whatsNewEntries = WhatsNewCatalogSchema.parse([
  // Example entry:
  // {
  //   id: '2026-05-29-cron-history',
  //   publishedAt: '2026-05-29T00:00:00Z',
  //   highlight: true,
  //   title: { es: 'Historial de trabajos programados', en: 'Cron job history', pt: 'Histórico de tarefas' },
  //   body: { es: 'Ahora podés ver el historial de ejecuciones de cada cron.' },
  //   roles: ['ADMIN', 'SUPER_ADMIN']
  // }
] satisfies z.input<typeof WhatsNewCatalogSchema>);
```

The `WhatsNewCatalogSchema.parse(...)` call runs at module import time. If any entry fails
validation, the API process throws at startup and refuses to serve traffic. This is the
intended behaviour: content typos break startup, not production.

### 6.4 PATCH body schema (`packages/schemas/src/entities/whats-new/whats-new.http.schema.ts`) (NEW)

```ts
export const WhatsNewSeenBodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1)
});
export type WhatsNewSeenBody = z.infer<typeof WhatsNewSeenBodySchema>;
```

### 6.5 GET endpoint: `GET /api/v1/protected/whats-new`

**File**: `apps/api/src/routes/whats-new/protected/getWhatsNew.ts` (NEW)
**Registration**: `apps/api/src/routes/whats-new/protected/index.ts` + `apps/api/src/routes/index.ts`
**Factory**: `createProtectedRoute` (no `requiredPermissions` — any authenticated session).

**Server logic**:

1. Read actor from context.
2. Read actor's settings via `UserService.getById(actor, actor.id)` (or a lean settings-only
   read — confirm cheapest path with `UserService`).
3. **Lazy init**: if `settings.onboarding?.whatsNew` is absent:
   - Set `baselineAt = now().toISOString()`, `seenIds = []`.
   - Persist via the server-side merge described in §6.6 (call the same service method).
   - Continue with this newly-created state.
4. Filter `whatsNewEntries` to entries where:
   - `entry.roles` is absent/empty, OR `actor.role` is in `entry.roles`.
5. For each filtered entry, compute `seen: boolean`:
   - `seen = seenIds.includes(entry.id) || entry.publishedAt <= baselineAt`
   (entries predating baseline are automatically "seen" — avoids flooding pre-existing users).
6. Return:

```ts
{
  items: Array<{
    id: string;
    publishedAt: string;
    highlight: boolean;
    title: string;       // locale-resolved (see §6.7)
    body: string;        // locale-resolved markdown
    image?: string;
    seen: boolean;
  }>;
  unseenCount: number;
}
```

7. Sort `items` by `publishedAt` descending (newest first).

**Response schema**: defined in `packages/schemas/src/entities/whats-new/whats-new.http.schema.ts`.

### 6.6 PATCH endpoint: `PATCH /api/v1/protected/users/me/whats-new-seen`

**File**: `apps/api/src/routes/user/protected/whatsNewSeen.ts` (NEW)
**Registration**: `apps/api/src/routes/user/protected/index.ts` (add alongside existing protected
user routes: `patch.ts`, `getById.ts`, `newsletter.ts`, etc.)
**Factory**: `createProtectedRoute`.

**Body**: `WhatsNewSeenBodySchema` (`{ ids: string[] }`).

**Server logic (server-side merge)**:

1. Read actor's current `settings` (full object).
2. Read current `seenIds` from `settings.onboarding?.whatsNew?.seenIds ?? []`.
3. Merge: `newSeenIds = Array.from(new Set([...currentSeenIds, ...body.ids]))`.
4. Write back: `settings.onboarding.whatsNew.seenIds = newSeenIds` — preserving ALL sibling
   keys (`adminTours`, `baselineAt`, theme, language, notifications, newsletter).
5. Persist via the existing `UserService.update(actor, actor.id, { settings: merged })`.
6. Return `{ success: true }`.

**Why dedicated endpoint (mirrors SPEC-174 rationale)**: a dedicated endpoint gives a small,
clear contract and eliminates all risk of a client accidentally clobbering sibling settings
(theme, language, notifications, `adminTours`). The service method MUST read current settings
first, regardless of whether `UserService.update` replaces or merges the JSONB column — treat
the column as replace-only defensively and always do read-modify-write at the service level.

**Permission guard**: same as SPEC-174 — confirm the exact `PermissionEnum` value with the
seed (`USER_SETTINGS_UPDATE` or `USER_UPDATE_SELF`) at implementation time. See §14 Q1.

**Rate limit**: `{ requests: 30, windowMs: 60000 }` — lower than the general settings PATCH
because mark-seen is programmatic (not human-driven keystroke frequency).

### 6.7 i18n resolution strategy (server-side vs. client-side)

**Chosen approach: server-side resolution.** The GET endpoint resolves the entry's `title`
and `body` to a single locale string before responding, using the actor's `languageAdmin`
from their settings (`settings.languageAdmin ?? 'es'`). Fallback: if the requested locale is
missing from the entry, fall back to `es` (project default locale).

This is consistent with how public API endpoints localize content in this codebase (e.g.,
public accommodation endpoints resolve locale server-side). The client receives pre-localized
strings and does not need to understand the `I18nLabel` shape.

## 7. Architecture — Frontend (`apps/admin`)

### 7.1 Shared hook: `apps/admin/src/hooks/use-whats-new.ts` (NEW)

This hook is the **single source of truth** for all four surfaces. Direct independent fetches
from modal, badge, panel, or card are **forbidden** — any implementation that bypasses this
hook must be rejected in code review.

```ts
// Return shape
interface UseWhatsNewReturn {
  readonly items: WhatsNewItem[];         // role-filtered, sorted newest-first
  readonly unseenCount: number;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly markSeen: (ids: string[]) => void;   // optimistic + invalidate
  readonly markAllSeen: () => void;             // all applicable ids
}
```

Implementation:

- **TanStack Query** `useQuery` with key `['whats-new', userId]` hitting `GET .../whats-new`.
- `useMutation` hitting `PATCH .../users/me/whats-new-seen` with optimistic update on
  `unseenCount` and `items[*].seen`, then `queryClient.invalidateQueries(['whats-new', userId])`.
- **Must NOT** reuse `useUserProfile` or `useUpdateUserSettings` — those are the dead
  admin-tier hooks (see §2.3).
- Exposes `markSeen(ids)` which calls the PATCH mutation, and `markAllSeen()` which derives
  all applicable unseen ids from `items` and calls `markSeen`.

### 7.2 Modal: `apps/admin/src/components/whats-new/WhatsNewModal.tsx` (NEW)

**Trigger**: on admin mount (inside `_authed.tsx` guard area, after `useAuthContext().user` is
available), call `useWhatsNew()` and check for items where `!seen && highlight`. If any exist,
open the modal **once** (use a `useRef` latch to prevent double-fire under React 19 strict
mode).

**Component**:

- **Shadcn Dialog** (`components/ui/dialog.tsx`) — full-screen on mobile, constrained width
  (max `sm:max-w-lg`) on desktop.
- Content: list of highlight entries (title + body rendered as markdown via TipTap read-only,
  optional image). If multiple highlight entries are unseen, list them all scrollably in one
  modal (no stepper in v1 — keep it simple).
- Actions: **"Entendido"** (primary) button. No "Previous/Next" — single-modal list.
- On close (button OR ESC): call `markSeen(highlightIds)`.
- The modal must also be **openable from card/panel** for a single specific entry:
  accept an optional `entryId` prop; when set, show only that entry.
- PostHog: `trackEvent('admin.whats_new.modal.shown', { entryIds, role })` on open;
  `trackEvent('admin.whats_new.modal.closed', { entryIds })` on close.
- Accessibility: focus trap (Radix Dialog handles), ESC closes, `aria-labelledby` on title.

**Auto-trigger component**: `apps/admin/src/components/whats-new/WhatsNewAutoTrigger.tsx`
(headless, renders `null`). Mounted in `AppLayout.tsx`. `useEffect` keyed `[isLoaded, userId]`:
bail if loading; check for unseen highlights; open modal if any. React ref latch prevents
duplicate open on strict-mode double-mount.

### 7.3 Topbar badge: modification to `apps/admin/src/components/layout/header/Header.tsx`

Insert a "What's New" icon button between the existing Notifications button and the Profile
link in the right-side action row.

```tsx
{/* What's New badge */}
<WhatsNewBadge />
```

**New component**: `apps/admin/src/components/whats-new/WhatsNewBadge.tsx` (NEW)

- Calls `useWhatsNew()` to get `unseenCount`.
- Renders a button with a `GiftIcon` or `SparkleIcon` from `@repo/icons` (confirm icon
  name against `@repo/icons` exports at implementation — see §14 Q2).
- When `unseenCount > 0`, overlays a count badge (red pill, `min-width: 1.25rem`).
- `aria-label` from i18n: `t('admin-whats-new.badge.label')` with count interpolation.
- On click: opens the panel (`WhatsNewPanel`).
- Applies the same `icon-river-header` class as the existing Notifications button.

### 7.4 Panel: `apps/admin/src/components/whats-new/WhatsNewPanel.tsx` (NEW)

- **Shadcn Sheet** (`components/ui/sheet.tsx`) — side panel (right, non-modal or modal per
  design preference — see §14 Q3).
- Opened by badge click or "Ver todas" link from the dashboard card.
- Content:
  - Header: "Últimas novedades" + "Marcar todo como leído" button (disabled when
    `unseenCount === 0`).
  - Entry list: all applicable entries, newest first. Unseen entries: bold title + accent
    dot indicator. Seen entries: muted styling.
  - Each entry row: title + date + truncated body excerpt. Click → open `WhatsNewModal`
    for that entry (passes `entryId`), which marks it seen.
- "Marcar todo como leído": calls `markAllSeen()`.
- Empty state: "No hay novedades disponibles." (i18n key `admin-whats-new.panel.empty`).
- PostHog: `trackEvent('admin.whats_new.panel.opened', { unseenCount, role })`.

### 7.5 Dashboard card: widget in the config-driven system

The dashboard card is a **`list` type widget** registered in the config-driven IA dashboard
system (SPEC-154/SPEC-155). This is NOT an ad-hoc card component.

**Source registration** (`apps/admin/src/lib/dashboard-sources/`):

- Add a new source `whats-new.recent` (or per-role if needed) to each of the four source
  files: `host.ts`, `editor.ts`, `admin.ts`, `super.ts`.
- The source's `queryFn` calls `GET /api/v1/protected/whats-new` (via `fetchApi`), maps
  the response to `ListItem[]` shape (title as label, `publishedAt` as meta, `seen` drives
  `statusBadge` styling).
- TanStack Query key: `['dashboard', 'whats-new', userId]` (consistent with the
  `['dashboard', sourceId, role, scope]` convention in dashboard sources).

**Widget config** — add to all four role dashboards in `apps/admin/src/config/ia/dashboards.ts`:

```ts
{
  id: 'whats-new',
  type: 'list',
  label: { es: 'Últimas novedades', en: "What's New", pt: 'Novidades' },
  gridSpan: { cols: 2 },       // 2-column span (half-width on lg:grid-cols-6 grid)
  scope: 'protected',
  config: {
    source: 'whats-new.recent',
    maxItems: 4,
    accent: 'sky',
    icon: 'SparkleIcon',        // confirm name against @repo/icons
    emptyText: 'Sin novedades',
    emptyDescription: 'No hay novedades para tu rol todavía.',
    // Per-row "action": open modal for that entry
    actionPerItem: {
      label: { es: 'Ver', en: 'View', pt: 'Ver' },
      // hrefTemplate omitted — action triggers modal, not navigation
    },
    // Footer link "Ver todas" → opens panel
    // Note: ListWidget does not currently have a footer-link config.
    // Two options: (a) add a `footerLink` config key to ListWidget, or
    // (b) render a "Ver todas" item as the last list row.
    // Decision: see §14 Q4.
  }
}
```

**Unseen visual indicator**: the source's `queryFn` maps unseen entries to
`statusBadge: { label: 'Nuevo', variant: 'success' }` and seen entries to no badge (or
`variant: 'neutral'` with empty label). This reuses `ListWidget`'s existing `statusBadge`
rendering.

**Click behaviour**: clicking an entry in the card should open `WhatsNewModal` for that entry.
`ListWidget` currently supports `actionPerItem` as link or button. Use a button (no
`hrefTemplate`) and wire the `onClick` via a new optional `onItemClick` callback config key in
`ListWidgetConfig`, OR register a global `whatsNewOpenEntry` event that `WhatsNewAutoTrigger`
listens to. Decision: see §14 Q5.

### 7.6 Providers and layout wiring

`WhatsNewAutoTrigger` and `WhatsNewPanel` (for modal state) must be mounted **inside the
`_authed` guard** so they always have an authenticated user. Mount in
`apps/admin/src/components/layout/AppLayout.tsx` alongside the existing layout children.

The `useWhatsNew()` hook uses TanStack Query (already available via `QueryClientProvider` in
the root). No additional context provider is needed.

### 7.7 Pure logic: `apps/admin/src/lib/whats-new/` (NEW)

Small, unit-testable pure functions (no React/DOM):

- `has-unseen-highlights.ts` → `hasUnseenHighlights(items: WhatsNewItem[]): boolean`
- `resolve-entry-locale.ts` → `resolveEntryLocale(field: I18nObject, locale: string): string`
  (falls back to `es`). May reuse logic from `use-localized-label.ts`.

## 8. i18n plan

### 8.1 New namespace: `admin-whats-new.json` (es/en/pt)

Create in `packages/i18n/src/locales/{es,en,pt}/admin-whats-new.json`.

Required keys (es values shown as reference):

```json
{
  "badge": {
    "label": "{{count}} novedad(es) sin leer",
    "labelNone": "Sin novedades"
  },
  "modal": {
    "title": "Novedades",
    "close": "Entendido"
  },
  "panel": {
    "title": "Últimas novedades",
    "markAllRead": "Marcar todo como leído",
    "empty": "No hay novedades disponibles.",
    "seeEntry": "Ver"
  },
  "card": {
    "seeAll": "Ver todas"
  },
  "status": {
    "new": "Nuevo",
    "seen": "Visto"
  }
}
```

The `@repo/i18n` package re-exports all locale files. After adding new files, restart the
dev server (see admin `CLAUDE.md` → "Vite + @repo/i18n SSR cache" gotcha: HMR is not
sufficient; the Node process must restart after JSON edits).

### 8.2 Entry content i18n

Entry `title` and `body` carry es/en/pt inline in the curated data file. The server resolves
to a single locale string before responding (see §6.7). The client receives plain strings and
does not need to understand the multi-locale shape.

Locale fallback: `requestedLocale → es` (never left empty).

## 9. CSP / ops task

Entry images are hosted externally (CDN URL). When the first entry with an `image` field is
published, the CDN origin **must** be added to the admin Content Security Policy `img-src`
directive before the entry goes live.

**TBD-2**: The exact CDN origin is not yet decided. This is a mandatory ops task that the
implementing team must flag when the first image-bearing entry is authored.

Relevant file(s) to update (confirm at implementation time):

- The admin CSP configuration — check `apps/api/src/middlewares/security.ts` or the
  Coolify/reverse-proxy CSP header config.

**Hard requirement**: do NOT publish an entry with an `image` until the origin is added to
CSP. A blocked image is a visible regression; a startup-time test should validate that all
`image` URLs in `whats-new.ts` match the approved origin list (see §12).

## 10. Edge cases

| Case | Behaviour |
|------|-----------|
| New user (no `onboarding.whatsNew` in DB) | Lazy init on first GET: `baselineAt = now`, `seenIds = []`. No migration, no signup hook needed. |
| Pre-existing user at feature deploy | Lazy init fires on their first GET. `baselineAt = now` means all entries published before their first hit are automatically "seen" (baseline prevents flooding). |
| Entry `publishedAt <= baselineAt` | Treated as seen regardless of `seenIds`. Prevents pre-existing entries from flooding new feature adopters. |
| Missing locale on entry (e.g. no `en`) | Fall back to `es`. Client never receives empty string. |
| Empty applicable entries (new role, no content yet) | GET returns `{ items: [], unseenCount: 0 }`. Panel shows empty state. Card shows `WidgetEmptyBody`. Modal does not open. |
| Multiple highlight entries unseen in one login | Modal opens with ALL of them listed in one scrollable modal. All are marked seen on close. |
| `markSeen` called twice with overlapping ids | Server uses `Set` union — idempotent. No error, no duplicate ids in `seenIds`. |
| Entry removed from curated file (id in `seenIds` but not in entries) | Harmless orphan in `seenIds`. Never pruned; never returned by the GET. |
| SPEC-174 `onboarding.adminTours` coexistence | Both keys live under `onboarding` JSONB. Server-side merge in each dedicated endpoint only touches its own key, preserving the other. They are implemented independently and can ship in any order. |
| Actor has no role (unauthenticated slipping through) | `createProtectedRoute` rejects before handler runs. Not a case the handler needs to defend against. |

## 11. User stories and acceptance criteria

### US-1 (HOST — first login, highlight entry exists)

As a HOST, on my first login after a highlight entry is published, I want to see it
automatically so I learn about new features without searching for them.

**AC-1**: Given I am authenticated as HOST and `settings.onboarding.whatsNew` is absent,
When `GET /api/v1/protected/whats-new` is called,
Then the server creates `{ baselineAt: now, seenIds: [] }` and returns all entries applicable
to HOST with `seen: false` for entries published after now (none in this baseline-init case)
and `seen: true` for all prior entries.

**AC-2**: Given there is at least one unseen highlight entry applicable to my role,
When I load the admin dashboard,
Then `WhatsNewAutoTrigger` opens `WhatsNewModal` once (not on every page navigation).

**AC-3**: Given the modal is open,
When I click "Entendido" or press ESC,
Then all highlight entry ids shown are sent to `PATCH .../whats-new-seen`, the badge counter
decrements accordingly, and the modal does not reopen in the same session.

### US-2 (Badge counter accuracy)

As any authenticated user, I want the topbar badge to always reflect my current unseen count
so I know at a glance whether there is anything new.

**AC-4**: Given `unseenCount > 0`,
When any of the four surfaces marks entries seen,
Then the badge counter updates immediately (optimistic update in `useWhatsNew`).

**AC-5**: Given `unseenCount = 0`,
When I view the topbar,
Then the badge counter is hidden (or shows zero with no pill).

### US-3 (Panel — mark all as read)

As any user, I want to clear all new-entry notifications at once.

**AC-6**: Given the panel is open and `unseenCount > 0`,
When I click "Marcar todo como leído",
Then `markAllSeen()` sends all applicable unseen ids to the PATCH endpoint, the panel entries
transition to seen styling, and the badge counter drops to zero.

### US-4 (Dashboard card on all roles)

As a HOST, EDITOR, ADMIN, or SUPER_ADMIN, I want to see a "Últimas novedades" card on my
dashboard so I can review recent news without navigating away.

**AC-7**: Given I am authenticated with any of the four enabled roles,
When I view my dashboard,
Then the "Últimas novedades" `ListWidget` card renders showing up to 4 applicable entries.

**AC-8**: Given the card shows entries,
When I click an entry,
Then `WhatsNewModal` opens for that entry and marks it seen.

### US-5 (Role filtering)

As a HOST, I do NOT want to see entries targeted only at ADMIN users.

**AC-9**: Given an entry has `roles: ['ADMIN', 'SUPER_ADMIN']`,
When I am authenticated as HOST and call `GET /api/v1/protected/whats-new`,
Then that entry does NOT appear in the response.

**AC-10**: Given an entry has no `roles` field (or `roles: []`),
When any authenticated user calls `GET /api/v1/protected/whats-new`,
Then that entry appears for all roles.

### US-6 (i18n fallback)

As an admin user with `languageAdmin = 'en'`, I want entry content in English when available,
falling back to Spanish when not.

**AC-11**: Given an entry has `title: { es: 'Título', en: 'Title', pt: 'Título PT' }` and
the actor has `languageAdmin = 'en'`,
When the server resolves the GET response,
Then `title` in the response is `'Title'`.

**AC-12**: Given an entry has `title: { es: 'Título' }` (no `en`) and the actor has
`languageAdmin = 'en'`,
When the server resolves the GET response,
Then `title` in the response is `'Título'` (es fallback).

### US-7 (Sanitized markdown)

As a user reading a "What's New" entry, I want the body rendered as rich text without XSS
risk.

**AC-13**: Given an entry body contains markdown (e.g. `## Heading\n**Bold** text`),
When rendered in modal or panel,
Then the output is properly formatted HTML rendered via TipTap read-only viewer with no raw
`<script>` or `<iframe>` elements possible (sanitized by TipTap's allowlist).

### US-8 (Persistent across devices)

As any user, I want my "seen" state to persist across browsers and devices.

**AC-14**: Given I marked entries seen on device A,
When I log in on device B,
Then those entries appear as seen (state is server-side in `UserSettings.onboarding.whatsNew`).

### US-9 (CSP — image loads)

As a content curator, I want to include screenshots in entries.

**AC-15**: Given an image URL is approved and its origin is added to CSP `img-src`,
When an entry with that image is rendered in modal or panel,
Then the image loads without CSP violation.

### US-10 (Curator/dev — data validation)

As a developer authoring entries, I want a typo in the data file to fail fast.

**AC-16**: Given `whats-new.ts` contains an entry with a missing required `es` title,
When the API process starts,
Then it throws immediately (Zod `parse` at import time) and refuses to serve traffic.

### US-11 (SPEC-174 coexistence)

As a developer, I want SPEC-175 and SPEC-174 to coexist in the same JSONB column without
interference.

**AC-17**: Given SPEC-174 has written `{ onboarding: { adminTours: { 'host.welcome': 1 } } }`,
When SPEC-175's PATCH endpoint writes `seenIds`,
Then `adminTours` is preserved intact in the resulting stored JSONB.

## 12. Testing strategy

### 12.1 Schema / Zod (`packages/schemas`)

- `WhatsNewEntrySchema` — valid entry parses; missing required `es` title rejects; invalid
  `publishedAt` (not ISO) rejects; `roles` with unknown value rejects.
- `WhatsNewSeenBodySchema` — empty `ids` array rejects; valid array parses.
- `UserSettingsSchema` delta — existing stored JSONB without `onboarding` still parses
  (no regression). Historic shape fixture test (`.compat.test.ts` pattern per schema
  compat policy).
- Curated data file at least validates (integration): `whats-new.ts` imports in test
  environment without throwing.

### 12.2 Service-core (`@repo/service-core`)

- `markWhatsNewSeen` (or equivalent method):
  - Read-modify-write: all sibling settings keys preserved after merge.
  - Idempotency: calling twice with overlapping ids produces a Set union, not duplicate.
  - Missing `onboarding` → initializes cleanly.
  - `adminTours` key untouched when only `seenIds` is written.

### 12.3 API routes (`apps/api`)

- `GET /api/v1/protected/whats-new`:
  - Unauthenticated → 401.
  - Guest actor → 401 (protected tier rejects guests).
  - Authenticated HOST: lazy init fires on first call (mock `whatsNew` absent).
  - Authenticated HOST: role filter applied (ADMIN-only entries excluded).
  - `seen` computation: baseline comparison + seenIds union.
  - `unseenCount` matches count of returned items where `seen === false`.
  - Locale resolution: actor `languageAdmin = 'en'` → resolves `en` field; fallback to `es` when `en` absent.
- `PATCH /api/v1/protected/users/me/whats-new-seen`:
  - Empty `ids` array → 400.
  - Valid ids → 200, `seenIds` updated, sibling keys preserved.
  - Called twice with overlapping ids → idempotent.
  - Unauthenticated → 401.

### 12.4 Admin hook / components (`apps/admin`)

- `useWhatsNew()` (Testing Library + mock server):
  - Initial load: `isLoading` → data populated → `unseenCount` derived correctly.
  - `markSeen(ids)` → optimistic update decrements `unseenCount`; mutation called with correct body.
  - `markAllSeen()` → calls mutation with all applicable unseen ids.
- `WhatsNewModal`:
  - Renders highlight entries; "Entendido" calls `markSeen`; ESC closes + marks seen.
  - `entryId` prop → single entry mode.
  - Does NOT open when no highlight entries are unseen.
- `WhatsNewBadge`:
  - Shows count when `unseenCount > 0`; hides count when 0.
  - Click opens panel.
- `WhatsNewAutoTrigger`:
  - Does not fire while `isLoading`.
  - Fires once when unseen highlights present; ref latch prevents double-fire.
- `WhatsNewPanel`:
  - "Marcar todo como leído" calls `markAllSeen`; disabled when `unseenCount === 0`.
  - Empty state rendered when `items.length === 0`.

### 12.5 i18n fallback (unit)

- `resolveEntryLocale({ es: 'Título' }, 'en')` → `'Título'`.
- `resolveEntryLocale({ es: 'Título', en: 'Title' }, 'en')` → `'Title'`.
- `resolveEntryLocale({ es: 'Título' }, 'pt')` → `'Título'`.

### 12.6 Manual smoke (local)

Use `pnpm db:fresh-dev` + role/plan test users (`<slug>@local.test` / `Password123!`).

Checklist:

1. HOST first login → badge shows count if highlight entries exist → modal auto-opens → close → badge decrements.
2. ADMIN login → ADMIN-targeted entry visible; HOST-only entries absent.
3. Panel: all entries listed; "Marcar todo como leído" → badge = 0.
4. Dashboard card: "Últimas novedades" card on HOST/EDITOR/ADMIN/SUPER dashboards → click entry → modal opens.
5. Reload: seen state persists (server-side).
6. Switch to `languageAdmin = 'en'` in profile → GET response returns English content where available.
7. Add an invalid entry to `whats-new.ts` (missing `es` title) → `pnpm dev` fails to start.
8. Verify i18n: switch admin language → UI chrome updates; entry content falls back to `es` when locale absent.

## 13. Implementation tasks (ordered by dependency)

### Phase 1 — Schema

- **T-001** `packages/schemas`: add `WhatsNewEntrySchema`, `WhatsNewEntryI18nSchema`, `WhatsNewSeenBodySchema`, `WhatsNewGetResponseSchema` to `packages/schemas/src/entities/whats-new/` (NEW directory); export from `index.ts`.
- **T-002** `packages/schemas`: update `UserSettingsSchema` to add `onboarding.whatsNew` (additive, no `.default({})`); export `UserOnboardingWhatsNew` type; update `.compat.test.ts` with historic fixture without `onboarding`.

### Phase 2 — Service

- **T-003** `@repo/service-core`: add `markWhatsNewSeen({ actor, ids })` method (read-modify-write server-side merge). Confirm `UserService.update` JSONB behaviour. Tests per §12.2.

### Phase 3 — API

- **T-004** `apps/api`: create `apps/api/src/data/whats-new/whats-new.ts` with an empty array (boot-validates at startup).
- **T-005** `apps/api`: implement `GET /api/v1/protected/whats-new` including lazy-init, role filter, seen computation, locale resolution. Route file + registration. Tests per §12.3.
- **T-006** `apps/api`: implement `PATCH /api/v1/protected/users/me/whats-new-seen`. Route file + registration in `routes/user/protected/index.ts`. Tests per §12.3.

### Phase 4 — Admin hook

- **T-007** `apps/admin`: implement `useWhatsNew()` hook in `hooks/use-whats-new.ts`. Unit tests per §12.4.
- **T-008** `apps/admin`: implement pure lib `lib/whats-new/{has-unseen-highlights,resolve-entry-locale}.ts` + unit tests.

### Phase 5 — Admin UI

- **T-009** `apps/admin`: `WhatsNewModal.tsx` (Radix Dialog, highlight-entry list, markdown rendering, `entryId` single-entry mode, `markSeen` on close). Tests per §12.4.
- **T-010** `apps/admin`: `WhatsNewAutoTrigger.tsx` (headless, mounts in `AppLayout.tsx`). Tests.
- **T-011** `apps/admin`: `WhatsNewBadge.tsx` (topbar button + count pill). Wire into `Header.tsx`. Tests.
- **T-012** `apps/admin`: `WhatsNewPanel.tsx` (Sheet, entry list, mark-all). Tests.

### Phase 6 — Dashboard card widget

- **T-013** `apps/admin`: register `whats-new.recent` source in `lib/dashboard-sources/{host,editor,admin,super}.ts`. Map response to `ListItem[]` with `statusBadge`.
- **T-014** `apps/admin`: add `'whats-new'` widget to all four role dashboards in `config/ia/dashboards.ts`. Resolve §14 Q4 (footer link) and §14 Q5 (click callback) before starting.

### Phase 7 — i18n

- **T-015** `packages/i18n`: create `admin-whats-new.json` in es/en/pt with all keys from §8.1.

### Phase 8 — CSP / ops

- **T-016** Flag CDN origin TBD-2. Once decided, update CSP `img-src` in the appropriate config file (confirm location at implementation). Add a Vitest test that verifies all `image` URLs in `whats-new.ts` match the approved origin allowlist (fails if a URL with an unapproved origin is added).

### Phase 9 — Integration + E2E

- **T-017** Full integration tests for the GET + PATCH endpoints with real DB (vitest e2e suite pattern from SPEC-143).
- **T-018** Admin component integration tests with Testing Library + MSW mocks.

**Task dependencies**:

- T-003 depends on T-002.
- T-005, T-006 depend on T-001, T-002, T-003, T-004.
- T-007, T-008 depend on T-001 (schema types needed for TypeScript).
- T-009 through T-012 depend on T-007.
- T-013, T-014 depend on T-009, T-012 (modal + panel must exist before wiring card click/panel link).
- T-015 can proceed in parallel with T-009+.
- T-016 unblocks image entries; can be drafted in parallel with T-004.

## 14. Open questions / decisions for owner (consult per decision protocol)

> These items require explicit owner answer before the implementing agent proceeds.

- **Q1** Exact protected-tier `PermissionEnum` for `PATCH .../whats-new-seen` —
  `USER_SETTINGS_UPDATE`, `USER_UPDATE_SELF`, or another value? Confirm against
  `packages/seed/src/required/rolePermissions.seed.ts`.

- **Q2** Icon for the topbar badge button — which icon from `@repo/icons` exports should
  represent "What's New"? Suggested candidates: `GiftIcon`, `SparkleIcon`, `StarIcon`. Confirm
  the exact export name.

- **Q3** Panel Sheet modality — should `WhatsNewPanel` be a non-modal Sheet (like the peek
  drawer in the entity list) or a full modal sheet? Non-modal allows users to keep reading the
  dashboard while glancing at the panel; modal is simpler and matches the existing
  Notifications popover pattern.

- **Q4** Dashboard card "Ver todas" link — how to wire a footer link on the `ListWidget` card?
  Two options:
  1. Add an optional `footerLink: { label: I18nLabel; action: 'whats-new-panel' }` config key
     to `ListWidgetConfig` (requires modifying `ListWidget.tsx`).
  2. Add "Ver todas" as the last item in the list rows with `href` pointing to a
     `/whats-new` virtual route or via a global event.
  Option 1 is cleaner but requires a `ListWidget` mod. Option 2 is a hack. Recommend option 1.

- **Q5** Dashboard card item click — how should clicking a list row open `WhatsNewModal`?
  Two options:
  1. Add an optional `onItemClick` callback to `ListWidgetConfig` (component prop).
  2. Dispatch a custom `whats-new:open-entry` DOM event that `WhatsNewAutoTrigger` intercepts.
  Option 1 is cleaner but changes `ListWidget`'s prop surface. Option 2 is loosely coupled
  but uses a DOM event pattern not established in the codebase. Recommend option 1.

- **TBD-1** Markdown renderer — use TipTap read-only path (`@tiptap/react` + `tiptap-markdown`
  already installed) or `react-markdown` + `rehype-sanitize` (not currently in
  `apps/admin/package.json`)? TipTap is strongly recommended (no new dependency, consistent
  with admin editor). Confirm this is acceptable for a read-only rendered view, as TipTap
  is primarily an editing framework.

- **TBD-2** CDN / image origin — not yet decided. Must be resolved before any entry with an
  `image` field is published to production. Flag in T-016.

## 15. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Curated data file grows unbounded | Low | Medium | Spec policy: archive entries older than 6 months by removing them from the array (orphan `seenIds` are harmless). Document in the data file header. |
| Server-side merge clobbers sibling settings on a JSONB replace-mode `UserService.update` | Medium | High | Service method MUST read current settings first and spread. Covered by §6.6 "defensive read-modify-write". Unit test in T-003 verifies sibling key preservation. |
| `lazyInit` fires on every GET if the update call fails silently | Low | Low | Service method returns `Result<T>`; handler must log and surface error. Lazy init failure is non-fatal (proceed with empty state) but logged as warn. |
| SPEC-174 and SPEC-175 ship in the same PR and conflict on the `onboarding` JSONB key | Low | High | Each spec's PATCH endpoint touches only its own JSONB key. Schema update is additive. Covered by AC-17. Review together if shipped in the same PR. |
| CDN image blocked by CSP | Medium | Medium | T-016 enforces the CSP update before any image-bearing entry is published. Vitest test validates origin allowlist. |
| TipTap read-only rendering introduces XSS if used incorrectly | Low | High | TipTap `generateHTML` with a restricted schema + `rehype-sanitize` as fallback. Document exact rendering pattern in T-009 implementation. |
| `useWhatsNew()` cache invalidation race (optimistic update + server invalidation firing too quickly) | Low | Low | TanStack Query handles this gracefully; optimistic update is rolled back if mutation fails. Covered by unit test for `markSeen`. |
