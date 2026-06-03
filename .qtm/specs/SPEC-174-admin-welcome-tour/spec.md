---
id: SPEC-174
slug: admin-welcome-tour
title: Admin Guided Welcome Tour (role-based, config-driven)
status: draft
owner: qazuor
created: 2026-05-29
relatedSpecs:
  - SPEC-154  # admin config-driven IA — the tour config is a sibling of this config; tours bind to its sections/dashboards
  - SPEC-169  # role-permission own-scoping — REASON the admin /users PATCH path is unusable; forces the protected-tier endpoint
  - SPEC-155  # role dashboards (HOST/EDITOR/ADMIN/SUPER) — welcome tours reference these dashboard cards
  - SPEC-156  # admin settings reorganization — "Mi cuenta" / self-settings surface the tour state lives near
tags:
  - admin
  - onboarding
  - ux
  - config-driven
  - i18n
  - frontend
  - api
---

# SPEC-174 — Admin Guided Welcome Tour (role-based, config-driven)

> ⛔ **DECISION PROTOCOL (read first, applies to the whole spec):** In every single case —
> without exception — if a change or decision is not *extremely* clear-cut, if there is even
> the slightest ambiguity, or if there is more than one viable option, **STOP and consult the
> owner (qazuor)**. Do not decide autonomously. See §13.

## 1. Summary

Add a **role-based guided welcome tour** to the admin panel (`apps/admin`). On first login a
user sees a warm welcome modal and, optionally, a spotlight walkthrough of their menu and
dashboard. On the first visit to each key section, a contextual mini-tour explains that screen.
A **"Ver guía"** entry point is always available to replay tours. The whole tour catalog is
defined in a **centralized, Zod-validated config file** (a sibling of the SPEC-154 IA config),
with all step text inline as `I18nLabel` (`es`/`en`/`pt`).

The motivation: the admin has many **non-technical users** (HOST above all, also EDITOR) who
today land in the panel with zero orientation. The tour must be friendly, never overwhelming,
and respect the user's role (role = which layout/sections they see) and language.

**Scope note (important):** persistence of "tour seen" forces a small backend change in
`apps/api` + `@repo/schemas` (see §4). This is **not** an admin-only feature.

## 2. Context & motivation (verified 2026-05-29)

### 2.1 What exists today

- **Config-driven IA (SPEC-154)** lives in `apps/admin/src/config/ia/`: `schema.ts` (Zod,
  boot-validated), `index.ts` (assembles `rawConfig`), `validate.ts` (IIFE that `safeParse`s
  and throws), `sections.ts`, `dashboards.ts`, `sidebars.ts`, `roles/{host,editor,admin,super-admin}.ts`.
  `I18nLabelSchema = z.object({ es, en, pt }).min(1)` is defined there. Step text reuses it inline.
- **Roles**: HOST, EDITOR, ADMIN, SUPER_ADMIN are enabled (SPONSOR/CLIENT_MANAGER disabled).
  Role = layout template; permissions (`useUserPermissions()`) = real gatekeeper.
- **Runtime access**: `useAuthContext().user` → `{ id, role, permissions }`;
  `useCurrentRoleConfig()`; `useUserPermissions()` / `useHasPermission()`;
  `useCurrentSection()`; locale from `useTranslations().locale` (already reflects the user's
  admin language, see `use-localized-label.ts`).
- **Layout**: `_authed.tsx` guard → `AppLayout` → `Header` + `Sidebar` + `main` + `BottomNav`.
- **UI primitives**: Radix `Dialog`/`Popover` + shadcn wrappers exist (`components/ui/dialog.tsx`,
  `popover.tsx`). `tw-animate-css` is available. **No** framer-motion, **no** shadcn Tooltip.
- **No tour infra of any kind** anywhere in the repo (no driver.js / joyride / intro.js / etc.).
- **No "onboarding seen" persistence**. `UserSettings` (JSONB column on the users table) is the
  natural home for a flag but the field does not exist yet.
- **PostHog** client exists (`apps/admin/src/lib/analytics/posthog-client.ts`, `trackEvent`).

### 2.2 Why config-driven + a library

Consistency with SPEC-154 (everything in admin IA is config + Zod + boot validation). The tour
is just another config sibling. For the spotlight we use **driver.js** (~5kb, no deps, MIT)
rather than reinventing fragile overlay/anchoring/repositioning code; the welcome modal reuses
the existing Radix `Dialog`. This is a deliberate, owner-approved exception to the
dependency-policy (document in the PR).

## 3. Goals / Non-goals

### Goals

1. Hybrid UX: a warm welcome **modal** (Radix Dialog) → an **optional** spotlight walkthrough
   (driver.js).
2. **Contextual, separate tours** (no cross-route auto-navigation): one **welcome** tour per
   role (layout + dashboard, single page) + **mini-tours** per key section, auto-triggered on
   first visit to that route (single page).
3. A **centralized config file** with the full tour catalog, Zod-validated at boot, step text
   inline `I18nLabel`.
4. **Per-user persistence** of seen tours as a `tourId → seenVersion` map, surviving across
   devices (DB, not localStorage).
5. **Versioning**: bumping a tour's `version` in config re-offers it (auto trigger only).
6. **"Ver guía"** entry point (avatar dropdown) + contextual "Ver guía de esta página".
7. **Accessibility** (focus trap, ESC, keyboard nav, reduced-motion) and **i18n** (es/en/pt).
8. **Analytics**: PostHog events for shown/completed/skipped.
9. **Catalog v1**: 4 welcome + 15 contextual = 19 tours.

### Non-goals (this spec)

- Cross-route auto-navigation during a tour (explicitly rejected — too fragile for non-tech users).
- A dedicated `onboarding` DB table (we reuse the `UserSettings` JSONB column).
- Tours for disabled roles (SPONSOR/CLIENT_MANAGER).
- A help-center / docs portal (only the in-product tour).
- Web app (`apps/web`) onboarding — admin only.

## 4. ⚠️ Scope-expanding finding (verified against code)

The naive plan ("persist via the existing `PATCH /api/v1/admin/users/{id}` + `useUpdateUserSettings`")
**does not work**:

- The admin PATCH requires `MANAGE_USERS`, which is assigned to **no role** in
  `packages/seed/src/required/rolePermissions.seed.ts` (not even SUPER_ADMIN). The
  `useUpdateUserSettings` hook is effectively dead for everyone.
- The admin GET requires `USER_READ_ALL`, which **HOST and EDITOR do not hold** (a direct
  consequence of SPEC-169 owner-scoping). They are the primary non-tech audience.

**Therefore** persistence must go through the **protected tier** (ownership-only: a user
editing their own record passes). This is why the spec touches `apps/api` + `@repo/schemas`.
Owner decision (locked): a **dedicated endpoint** `PATCH /api/v1/protected/users/me/tour-progress`
with server-side merge (chosen over extending the generic settings PATCH, to get a small clear
contract and zero clobber risk on sibling settings like theme/language/notifications).

## 5. Locked product decisions (from owner Q&A)

| # | Decision |
|---|---|
| D1 | Hybrid UX: welcome modal (Radix Dialog) → optional spotlight (driver.js). |
| D2 | Library: **driver.js**, lazy-loaded. Dependency-policy exception approved. |
| D3 | Contextual & separate tours; no cross-route auto-navigation. |
| D4 | Catalog v1 = welcome ×4 + a mini-tour for **every** key section per role (~19 total). |
| D5 | Persist in `UserSettings.onboarding.adminTours` as `tourId → seenVersion`. |
| D6 | Backend contract = dedicated `PATCH /api/v1/protected/users/me/tour-progress` + server merge. |
| D7 | Step text inline `I18nLabel`; only chrome (Next/Back/Skip) uses `@repo/i18n` keys. |
| D8 | "Ver guía" in avatar dropdown + contextual "Ver guía de esta página". |
| D9 | Versioning: auto-trigger offers iff `config.version > seenVersion`; manual replay ignores version. |
| D10 | Roles v1: HOST, EDITOR, ADMIN, SUPER_ADMIN. |
| D11 | Analytics via existing PostHog `trackEvent`. |
| D12 | **Cross-spec priority vs SPEC-175 (owner-locked 2026-06-03)**: the welcome tour always wins over the What's New auto-modal. While the role's welcome tour is unseen, SPEC-175's auto-modal is suppressed (a new user has no "news"). Whichever spec ships second wires the coordination in its auto-trigger. |

## 6. Architecture — Backend (`apps/api` + `@repo/schemas` + `@repo/service-core`)

### 6.1 Schema delta

`packages/schemas/src/entities/user/user.settings.schema.ts` — add to `UserSettingsSchema`
(additive-only; `settings` is a JSONB column, **no DB migration**):

```ts
onboarding: z.object({
  adminTours: z.record(z.string(), z.number().int().nonnegative()).optional()
}).optional()
```

- `adminTours` is the `tourId → seenVersion` map.
- Do **NOT** add `.default({})` — it would rewrite stored JSONB on every parse. A brand-new
  user (column default `{ notifications: {...} }`, no `onboarding`) parses cleanly and is
  treated as seenVersion 0 for every tour.
- Export an inferred `UserOnboarding` type alongside the others.

### 6.2 Dedicated endpoint

`PATCH /api/v1/protected/users/me/tour-progress`:

- **Tier**: protected (authenticated, no guest). Ownership is implicit (`me` = actor).
- **Body** (Zod, in `@repo/schemas`): `{ tourId: z.string().min(1), version: z.number().int().nonnegative() }`.
- **Route** is thin (existing Hono factory) → delegates to a service method.
- **Permission guard**: use a self-scope permission HOST/EDITOR already hold (e.g.
  `USER_SETTINGS_UPDATE` / `USER_UPDATE_SELF`). **Confirm the exact guard against the seed at
  implementation time** (decision protocol §13 if ambiguous).
- Returns `Result<T>` per project convention; `ResponseFactory` for the HTTP shape.

### 6.3 Service (read-modify-merge, server-side)

A method on `UserService` (or a dedicated `markAdminTourSeen`) in `@repo/service-core`:

- Reads the actor's current `settings`, sets
  `settings.onboarding.adminTours[tourId] = version`, **preserving all other settings keys**
  (theme/language/notifications/newsletter). The merge happens server-side so the client never
  has to resend the full settings object.
- **Load-bearing check for the implementer**: confirm whether the underlying update **replaces**
  or **deep-merges** the JSONB column. The dedicated method must guarantee a merge regardless
  (read current → spread → write). This is the entire reason a dedicated endpoint was chosen.

### 6.4 Read path

The client reads its own settings via the existing owner-scoped protected GET
(`GET /api/v1/protected/users/{actorId}` with `actorId = useAuthContext().user.id`), which
returns `settings`. (Alternative considered: embed the map in `/public/auth/me` — rejected to
avoid inflating `me`. Reuse the protected GET.)

## 7. Architecture — Frontend (`apps/admin`)

### 7.1 Config (sibling of the SPEC-154 IA config)

- `src/config/ia/primitives.ts` (NEW) — extract `I18nLabelSchema` + permission primitives from
  `schema.ts` and re-export them, to avoid an ESM cycle with `tour.schema.ts`. `schema.ts`
  re-exports for backward compat (no behavior change).
- `src/config/ia/tour.schema.ts` (NEW) — Zod shapes + `KNOWN_DATA_TOUR_IDS` (the target
  registry) + inferred types:

  ```
  Tour { id, roles: 'all' | RoleEnum[], kind: 'welcome' | 'contextual', route?: string,
         version: number (int > 0), trigger: 'auto-first-visit' | 'manual',
         showWelcomeModal: boolean, steps: Step[] }
  Step { id, target: 'center' | 'data-tour:<id>', title: I18nLabel, body: I18nLabel,
         side?, align?, permissions?: PermissionGate }
  ```

- `src/config/ia/schema.ts` (MOD) — add `tours: ToursRecordSchema` to `AdminIAConfigSchema` and
  3 cross-checks in `superRefine`:
  - **§T1** every non-`center` `target` (stripped of `data-tour:`) ∈ `KNOWN_DATA_TOUR_IDS`.
  - **§T2** when `roles !== 'all'`, every role exists in `config.roles` and is `enabled`.
  - **§T3** when `kind === 'contextual'`, `route` equals some `section.route`/`defaultRoute`.
  Also enforce: contextual ⇒ `route` required; welcome ⇒ `route` absent; unique step ids.
- `src/config/ia/tours.ts` (NEW) — the v1 catalog (§9), typed `z.input<typeof ToursRecordSchema>`.
- `src/config/ia/index.ts` (MOD) — include `tours` in `rawConfig` (validate.ts already parses all).

### 7.2 Selectors — `src/hooks/use-tours.ts` (NEW)

`useTourById`, `useToursForRole`, `useWelcomeTourForRole`,
`useContextualTourForRoute({ pathname })` (matches via `useCurrentSection()` →
`tour.route === (section.defaultRoute ?? section.route)`). RO-RO, named exports.

### 7.3 Pure logic — `src/lib/tour/` (unit-testable, no React/DOM)

- `compare-version.ts` → `shouldOfferTour({ configVersion, seenVersion })` = `seenVersion === null || configVersion > seenVersion`.
- `resolve-step-text.ts` → locale fallback (requested → es → first key). Shared with `use-localized-label.ts`.
- `build-driver-steps.ts` → `Tour` → `DriveStep[]`: filter steps by `permissions`
  (`expandPermissions` + intersection with `useUserPermissions()`), map `'center'` → no element,
  `'data-tour:x'` → `[data-tour="x"]`, localize `title`/`body`, set `side`/`align`. `import type`
  for the driver.js type only (runtime factory is dynamic-imported).
- `decide-auto-trigger.ts` → pure decision: welcome only auto-fires on the dashboard route;
  welcome > contextual priority; respects version.

### 7.4 Engine — `src/contexts/tour-context.tsx` (NEW)

`TourProvider` + `useTour()` → `{ isRunning, activeTourId, startTour({ tourId }), stopTour() }`.

- `startTour`: `trackEvent('admin.tour.shown', …)`; if `showWelcomeModal` render
  `TourWelcomeModal` (Radix Dialog, "Saltar" / "Mostrame →"); on proceed (or immediately for
  contextual) **lazy-import** driver.js (`const { driver } = await import('driver.js')`), build
  steps, run spotlight (`showProgress`, `allowClose`, `allowKeyboardControl`, localized chrome
  via `t('admin-common.tour.*')`); on finish/skip → `markSeen` + `trackEvent('admin.tour.completed'|'skipped')`.
- Driver instance in a `useRef`, destroyed on unmount. Driver CSS imported once in `styles.css`
  with admin-theme overrides.
- Mounted **inside `AppLayout`** (below Auth/QueryClient/i18n providers).

### 7.5 Client persistence — `src/hooks/use-admin-tour-state.ts` (NEW)

TanStack Query against the protected GET (key `['user','settings', userId]`) + a `useMutation`
hitting `PATCH …/users/me/tour-progress`. Exposes `hasSeen(tourId, version)` and
`markSeen({ tourId, version })` with optimistic update + invalidate. Must NOT reuse
`useUserProfile`/`useUpdateUserSettings` (those are the dead admin-tier hooks, §4).

### 7.6 Auto-trigger — `src/components/tour/TourAutoTrigger.tsx` (NEW, headless, renders null)

Mounted in `AppLayout`. `useEffect` keyed `[pathname, isLoaded, role]`: bail if
`!isLoaded || isRunning || !role`; call `decideAutoTrigger(...)`; if non-`none`, wait a
double-`requestAnimationFrame` (let `data-tour` targets paint) then `startTour`. `useRef` latch
per pathname for strict-mode double-mount. Lives below `_authed` so it never races the guard.

### 7.7 `data-tour` attributes (additive, no behavior change)

Registry in `KNOWN_DATA_TOUR_IDS`. Add to existing layout components: `main-menu` +
`main-menu-section-<id>` (`MainMenu.tsx`), `sidebar` (`Sidebar.tsx`), `dashboard-region`
(dashboard page), `quick-create` (`QuickCreate.tsx`), `command-palette` + `notifications`
(`Header.tsx`), `user-menu` (`header-user.tsx`), `bottom-nav` (`BottomNav.tsx`), plus
per-section anchors as specific mini-tours need them. Steps whose target may be absent
(permission-gated UI) must carry matching `permissions` or tolerate a missing element
(driver.js skips; `adminLogger.warn`).

### 7.8 "Ver guía" — `src/integrations/clerk/header-user.tsx` (MOD)

Avatar dropdown items: "Ver guía" (relaunch role welcome via `useWelcomeTourForRole`) +
"Ver guía de esta página" (only when `useContextualTourForRoute` returns a tour). Labels via
`t('admin-common.tour.replay' | 'replayPage')`. Manual replay ignores version but still
`markSeen` on finish.

### 7.9 Accessibility & i18n

driver.js focus trap + restore (default), ESC/overlay → skip, keyboard nav on; Radix Dialog
handles its own focus/aria. `prefers-reduced-motion` → `animate: false` + drop Dialog enter/exit
animation. Chrome keys `tour.next/prev/done/skip/replay/replayPage` added to the admin i18n
bundle (es/en/pt). Step content is inline `I18nLabel`.

## 8. (intentionally merged into §7)

## 9. Tour catalog v1 (4 welcome + 15 contextual = 19)

### Welcome tours (auto on `/dashboard`, `showWelcomeModal: true`)

| tourId | role | steps (summary) |
|---|---|---|
| `host.welcome` | HOST | greeting → main menu → cards "Mis alojamientos"/"Mi plan"/"Consultas"/"Próximos pasos" → quick-create "+" → help/replay |
| `editor.welcome` | EDITOR | greeting → main menu → cards posts/events/newsletter/campaigns → quick-create + search → help |
| `admin.welcome` | ADMIN | greeting → 7 sections → cards entities/crons/system-health/moderation → quick-create + search → help |
| `superAdmin.welcome` | SUPER_ADMIN | greeting → 7 sections → base cards + Audit Logs + Billing stats (super-only) → help |

### Contextual mini-tours (auto on first visit to the route, `kind: 'contextual'`)

| tourId | role | route (confirm vs sections.ts) | teaches |
|---|---|---|---|
| `host.misAlojamientos` | HOST | `/me/accommodations` | view/create/publish your own listings |
| `host.consultas` | HOST | `/conversations` | read & reply to guest inquiries |
| `host.miFacturacion` | HOST | `/billing/subscriptions` | your plan/subscription & statuses |
| `host.miCuenta` | HOST | `/account/profile` | profile, theme/language, notifications, tags |
| `editor.editorial` | EDITOR | `/posts` | editorial hub: posts/events/newsletter/tags |
| `editor.analisis` | EDITOR | `/analytics/usage` | content/usage analytics |
| `editor.miCuenta` | EDITOR | `/account/profile` | profile & preferences |
| `admin.catalogo` | ADMIN | `/accommodations` | accommodations, destinations, attractions, amenities |
| `admin.editorial` | ADMIN | `/posts` | posts, events, newsletter, tags |
| `admin.comunidad` | ADMIN | `/access/users` | users, conversations, roles/permissions, moderation |
| `admin.comercial` | ADMIN | `/billing/plans` | plans, subscriptions, invoices, promos |
| `admin.plataforma` | ADMIN | `/platform/configuration/seo` | settings, SEO, cache, crons, webhooks, logs |
| `admin.analisis` | ADMIN | `/analytics/usage` | business/usage/SEO analytics |
| `superAdmin.plataforma` | SUPER_ADMIN | `/platform/configuration/seo` | admin content + super-only subsections |
| `superAdmin.analisis` | SUPER_ADMIN | `/analytics/usage` | admin content + super-only debug |

Locked content decisions:

- SUPER_ADMIN reuses `admin.catalogo/editorial/comunidad/comercial`; only `plataforma`/`analisis`
  get super-specific variants (different content).
- `miCuenta` mini-tour only for HOST/EDITOR (ADMIN/SUPER reach it via dropdown, `accountInMenu:false`).
- All routes must be confirmed against `sections.ts` when authoring `tours.ts`.

## 10. Versioning & edge cases

- AUTO: offer iff `config.version > seenVersion` (absent ⇒ 0). MANUAL: always runs.
- New user: all auto-eligible role tours offered; nothing written until finish/skip.
- `markSeen` fires on **finish OR skip**, writing `version` (the one shown), not `version+1`.
- Orphan seen entries (tour removed from config): harmless, never pruned.
- Role with no tours / disabled role: empty eligible set, no error.

## 11. User stories & acceptance criteria

- **US-1 (HOST first login)**: As a new HOST, on first login I see a welcome modal; if I click
  "Mostrame", a spotlight walks me through my menu and dashboard. **AC**: welcome auto-fires once
  on `/dashboard`; "Saltar" closes and marks seen; "Mostrame" runs driver.js highlighting real
  elements; on finish, `markSeen('host.welcome', version)` persists.
- **US-2 (contextual)**: First time I open "Mis alojamientos", a mini-tour explains the screen.
  **AC**: `host.misAlojamientos` auto-fires once on `/me/accommodations`; not again after seen.
- **US-3 (replay)**: I can re-watch a guide anytime. **AC**: "Ver guía" in the avatar dropdown
  relaunches the role welcome regardless of seen state; "Ver guía de esta página" shows only on
  routes that have a contextual tour.
- **US-4 (versioning)**: When the team improves a tour, returning users see it again. **AC**:
  bumping `config.version` above the stored seen version re-offers the tour on next auto trigger.
- **US-5 (per role)**: Each enabled role gets its own welcome + section mini-tours. **AC**: the
  catalog resolves by `useAuthContext().user.role`; config validation fails the build if a tour
  targets an unknown/disabled role, an unknown `data-tour` target, or a non-existent route.
- **US-6 (i18n + a11y)**: Tours render in the user's admin language and are keyboard/SR friendly.
  **AC**: step text resolves es/en/pt; ESC closes; Tab/arrows/Enter navigate; `prefers-reduced-motion`
  disables animation.
- **US-7 (persistence cross-device)**: Seen state follows the user across devices. **AC**: state
  stored in `UserSettings.onboarding.adminTours` via the protected endpoint; HOST/EDITOR (no
  `USER_READ_ALL`/`MANAGE_USERS`) can read & write their own state.

## 12. File list

**New (admin)**: `config/ia/primitives.ts`, `config/ia/tour.schema.ts`, `config/ia/tours.ts`,
`hooks/use-tours.ts`, `hooks/use-admin-tour-state.ts`, `contexts/tour-context.tsx`,
`components/tour/{TourWelcomeModal,TourAutoTrigger,index}.tsx`,
`lib/tour/{compare-version,resolve-step-text,build-driver-steps,decide-auto-trigger}.ts` + `.test.ts`.

**Modified (admin)**: `config/ia/{schema,index}.ts`, `components/layout/AppLayout.tsx`,
`.../main-menu/MainMenu.tsx`, `.../sidebar/Sidebar.tsx`, `.../header/Header.tsx`,
`.../quick-create/QuickCreate.tsx`, `.../mobile-nav/BottomNav.tsx`,
`integrations/clerk/header-user.tsx`, the dashboard page, `styles.css`, `package.json`
(driver.js), `hooks/use-localized-label.ts` (optional).

**Backend / schemas**: `packages/schemas/.../user.settings.schema.ts` (`onboarding` field) +
the `tour-progress` body schema; new route `apps/api/.../protected/users/me/tour-progress`;
service method in `@repo/service-core`; admin i18n bundle (`tour.*` chrome keys).

## 13. Implementation sequence

1. Schema delta `onboarding` + tour-progress body schema + types (`@repo/schemas`).
2. Dedicated endpoint + service method (server-side merge) + tests (`apps/api`, `service-core`).
3. `primitives.ts` extraction + `schema.ts` re-export (no behavior change; tests stay green).
4. `tour.schema.ts` + cross-checks + `tours.ts` + `index.ts` wiring (config test green at boot).
5. Pure `lib/tour/*` + unit tests.
6. `use-admin-tour-state.ts` + `tour-context.tsx` + `TourWelcomeModal`.
7. `data-tour` attributes across layout.
8. `TourAutoTrigger` + `AppLayout` wiring.
9. `header-user.tsx` entry points + i18n chrome keys.
10. driver.css + theme overrides + a11y pass.
11. Component/integration tests.
12. Author the 19 tours' content (es/en/pt I18nLabel).

## 14. Verification

- **Unit (Vitest, no `.only`/`.skip`)**: config `safeParse` + negative cases (bad role/target/route);
  `shouldOfferTour` truth table; locale resolution; `buildDriverSteps` (center/data-tour/permission
  filter); `decideAutoTrigger` (welcome on dashboard, suppressed when seen, contextual by route, priority).
- **Integration (testing-library)**: `TourWelcomeModal` (Saltar/Mostrame); `TourAutoTrigger`
  (no fire while `!isLoaded`, fires once when unseen — driver.js mocked); `header-user` items by role/route.
- **Backend**: `tour-progress` endpoint (merge does not clobber other settings; ownership; invalid body → 400).
- **Manual smoke** (local, `pnpm db:fresh-dev` + role/plan test users, `<slug>@local.test` / `Password123!`):
  HOST first login → welcome auto → spotlight; open `/me/accommodations` → mini-tour; reload → no
  re-fire; "Ver guía" replays; bump a `version` → re-offers. Repeat for EDITOR/ADMIN/SUPER_ADMIN;
  verify es/en/pt and `prefers-reduced-motion`.
- `pnpm typecheck` + `pnpm lint` + `pnpm test` green before PR to `staging`.

## 15. Open questions / decisions for owner (consult per protocol)

- **Q1** Exact protected-tier permission guard for the endpoint (`USER_SETTINGS_UPDATE` vs
  `USER_UPDATE_SELF`) — confirm against the seed.
- **Q2** Does `UserService.update` replace or merge the JSONB column? Drives whether the service
  method must read-modify-write (assume yes/merge defensively).
- **Q3** Should the welcome tour auto-fire only on `/dashboard`, or on whatever the first
  authenticated landing route is? (Current plan: dashboard only.)
- **Q4** Whether to keep separate `superAdmin.*` tourIds for ALL sections (per-role analytics) vs
  the lean reuse of `admin.*` (current plan: reuse, super-specific only for plataforma/analisis).
- **Q5** Is a "skip all tours forever" master opt-out desired in v1? (Not in current scope.)
