---
linear: HOS-134
statusSource: linear
title: Expand /mi-cuenta discovery doors — 3-way publish split + aliados 4-up + stateful partner label
phase: 2
parent: HOS-131
status: in-progress
area: [web, content]
---

# HOS-134 — Expand `/mi-cuenta` discovery doors (HOS-131 Phase 2)

## 1. Context

Phase 1 (HOS-131, PR #2267, merged to staging) shipped the `/mi-cuenta` account
navigation IA, including two **discovery doors** — sidebar CTAs that lead to
internal hub pages listing "acquirable" verticals/roles:

- **"Publicá en Hospeda"** (`/mi-cuenta/publica`) — list-on-Hospeda verticals.
- **"Sumate como aliado"** (`/mi-cuenta/aliados`) — B2B alliance roles.

Phase 2 expands both doors. This is **`apps/web` only — no backend, no new
permissions, no DB migration.**

The door mechanism (`DiscoveryDoor` / `DiscoveryDoorOption` types,
`ACCOUNT_DISCOVERY_DOORS` config, `resolveDoorOptionState` / `isDoorVisible`
gating, `DiscoveryDoorHub.astro`) already exists from Phase 1 — this spec extends
it, it does not build it.

## 2. Investigation (evidence-backed — corrected an owner assumption)

The owner initially believed only *Sponsor* lacked an entry form and that
Partner/Provider/Editor were already built. **Verified false:**

- **Sponsor, Partner (home-ad), Service-provider are ALL at the same stage:**
  `comingSoon` → `/contacto`, zero self-service. No `RoleEnum.PARTNER`, no
  service-provider role/permission, `Partner` entity is admin-only
  (`PARTNER_MANAGE`, no `ownerId`). `/partners` is a read-only public directory;
  `/mi-cuenta/directorio-proveedores` is host-*consuming* (`HostTrade`), unrelated.
- **Editor is the only aliado with a real entry form** — `/colaborar/editores`
  (`ContributionForm`, `type: 'editor_application'` → generic `/contact`
  endpoint). No automatic role promotion: an admin assigns `RoleEnum.EDITOR`
  manually. But `RoleEnum.EDITOR` DOES exist and is **staff** (shares
  `access.panelAdmin` → editors manage content in the admin panel).
- **Sponsor** is the most backend-advanced (role + 14 perms + seed exist) but
  `enabled: false`, backlog in HOS-107, blocked by security bug F-1.
- **Gastronomía and Experiencias share `COMMERCE_EDIT_OWN`** (ADR-035, no
  `GASTRONOMY_*` / `EXPERIENCE_*` perms). Splitting is pure UI/routing. The
  `commerce_leads.domain` column is an open string by design, so `domain =
  'experience'` needs no migration.

## 3. Decisions

- **D-1** — Tracked as a NEW Linear issue (HOS-134), not a re-open of HOS-131
  (which is Done/merged). *(owner)*
- **D-2** — Aliados door expands to 4 options **UI-only, no new backend**.
  Sponsor / Partner / Service-provider = `comingSoon` → `/contacto`. Editor →
  its existing `/colaborar/editores` form. *(owner)*
- **D-3** — Experiencias gets a **separate lead page** `/publicar-experiencia`,
  reusing the existing `POST /api/v1/public/commerce/leads` endpoint with
  `domain='experience'` (no schema migration). *(owner)*
- **D-4** — **Editor counts as `acquired`**: when the user already holds the
  editor role, the editor option shows "Ya lo tenés → Gestionar" linking to the
  **admin panel** (cross-app absolute URL). This is what makes the stateful
  partner-door label fire today. *(owner)*
- **D-5 (known limitation, documented, NOT fixed)** — Because Gastronomía and
  Experiencias share `COMMERCE_EDIT_OWN`, a commerce owner sees BOTH options as
  `acquired` ("Gestionar") regardless of which vertical they actually operate.
  Acceptable — there is no per-vertical permission to disambiguate, and adding
  one is out of scope (backend).

## 4. Scope

### In scope (`apps/web` only)

1. **Publish door → 3 options.** Replace the combined `commerce` option with:
   - `accommodation` — unchanged (`/publicar`, `ACCOMMODATION_CREATE`).
   - `gastronomy` — `/publicar-restaurante`, `COMMERCE_EDIT_OWN`.
   - `experience` — new `/publicar-experiencia`, `COMMERCE_EDIT_OWN`.
2. **New page `/publicar-experiencia`** — clone of `/publicar-restaurante` with
   `CommerceLead` parametrized by a `domain` prop (default `'gastronomy'`).
3. **Aliados door → 4 options** — `sponsor` (content), `partner` (home-ad),
   `serviceProvider`, `editor`. First three `comingSoon` → `/contacto`; `editor`
   → `/colaborar/editores`, `acquired` when the user is an editor → admin panel.
4. **Stateful partner-door label** — switch `account.doors.partner.title` →
   `account.doors.partner.titleStateful` ("Sumá otra alianza") when ≥1 partner
   option resolves `acquired`, on the sidebar CTA (`AccountLayout.astro`) and the
   `/mi-cuenta/aliados` hub page title.
5. **`navigation.ts` split (BETA-156)** — extract `DiscoveryDoor*` types +
   `ACCOUNT_DISCOVERY_DOORS` to `apps/web/src/config/discovery-doors.ts`
   (`navigation.ts` is at the 500-line cap). Prerequisite for 1–4.
6. **i18n** (`es`/`en`/`pt` `account.json` + publish-experience copy) + tests.

### Out of scope

- Real lead forms/endpoints/roles for partner / service-provider / sponsor
  (owner: UI-only). Sponsor self-service is HOS-107 (backlog, blocked by F-1).
- Per-vertical commerce permissions to disambiguate gastronomy vs experience
  (see D-5).

## 5. Technical design

### 5.1 Block 0 — split `navigation.ts` (BETA-156)

New file `apps/web/src/config/discovery-doors.ts` owns: `DiscoveryDoorOption`,
`DiscoveryDoor` types, and `ACCOUNT_DISCOVERY_DOORS`, plus their icon/permission
imports. The 4 current consumers (`AccountLayout.astro`,
`DiscoveryDoorHub.astro`, `mi-cuenta/{publica,aliados}/index.astro`) import from
the new module. `navigation.ts` keeps `NavItem`/`NavGroup`/`getNavForSurface`.
No behavior change; existing tests must stay green. Mechanical, isolated commit.

### 5.2 Block 1 — 3-way publish split

- `discovery-doors.ts`: replace `commerce` option with `gastronomy`
  (`ForkKnifeIcon`, href `publicar-restaurante`) and `experience` (`CompassIcon`,
  href `publicar-experiencia`). Both `acquiredPermission: COMMERCE_EDIT_OWN`,
  `manageHref: mi-cuenta/comercio`.
- `CommerceLead.client.tsx`: add `domain?: 'gastronomy' | 'experience'` prop
  (default `'gastronomy'`); use it in the POST body instead of the hardcoded
  literal.
- New `apps/web/src/pages/[lang]/publicar-experiencia/index.astro` — clone of
  `publicar-restaurante`, passes `domain="experience"`, own SEO/title/copy.
- i18n: remove `account.doors.publish.options.commerce`, add `.gastronomy` and
  `.experience` (title/description/cta); add `commerce.lead.experience.*` (or a
  parametrized title) for the new page.

### 5.3 Block 2 — aliados 4-up

- `discovery-doors.ts` partner `options`:
  - `sponsor` — `MegaphoneIcon`, `comingSoon`, `/contacto`.
  - `partner` — `StarIcon`, `comingSoon`, `/contacto` (NEW).
  - `serviceProvider` — `WrenchIcon`, `comingSoon`, `/contacto`.
  - `editor` — `EditIcon`, href `colaborar/editores`, `acquiredPermission:
    POST_CREATE`, new flag `managesInAdminPanel: true`, no `comingSoon`.
- `DiscoveryDoorOption`: add `readonly managesInAdminPanel?: boolean`. When set
  and the option is `acquired`, the hub links the admin base URL
  (`getAdminUrl()`) as an absolute href instead of `buildUrl({ path: manageHref })`.
- `nav-gating.ts` `PERMISSION_ROLE_MAP`: add
  `[PermissionEnum.POST_CREATE]: new Set([EDITOR, ADMIN, SUPER_ADMIN])` so the
  SSR-by-role approximation resolves editor as `acquired`. (Client-side
  `isVisibleByPermissions` already reads real effective perms.)
- `DiscoveryDoorHub.astro`: accept an `adminUrl` prop (from `getAdminUrl()`),
  render absolute `Gestionar` for `managesInAdminPanel` acquired options; if
  `adminUrl` is undefined, fall back to the door href (fail-safe).
- i18n: rename `sponsor` title to "Sponsor de contenido"; add `partner`
  (home-ad) and `editor` options.

### 5.4 Block 3 — stateful partner-door label

- `nav-gating.ts`: add `resolveDoorLabelKey({ door, visibility })` →
  `door.statefulI18nKey` when `door.statefulI18nKey` is set AND ≥1 option
  resolves `acquired`, else `door.i18nKey`.
- `AccountLayout.astro`: sidebar door CTA uses `resolveDoorLabelKey` instead of
  `t(door.i18nKey)`.
- `mi-cuenta/aliados/index.astro`: page `<h1>`/title uses `resolveDoorLabelKey`.
- Depends on Block 2 (editor `acquired` is what makes it fire).

## 6. Gating / acquired signals (summary)

| Door | Option | acquiredPermission | comingSoon | manage target |
|---|---|---|---|---|
| publish | accommodation | `ACCOMMODATION_CREATE` | — | `mi-cuenta/host-dashboard` |
| publish | gastronomy | `COMMERCE_EDIT_OWN` | — | `mi-cuenta/comercio` |
| publish | experience | `COMMERCE_EDIT_OWN` | — | `mi-cuenta/comercio` |
| partner | sponsor | — | ✓ | — (`/contacto`) |
| partner | partner | — | ✓ | — (`/contacto`) |
| partner | serviceProvider | — | ✓ | — (`/contacto`) |
| partner | editor | `POST_CREATE` | — | admin panel (cross-app) |

## 7. Testing

- Unit: `resolveDoorLabelKey` (stateful switch), `resolveDoorOptionState` for
  the editor/`managesInAdminPanel` path, `PERMISSION_ROLE_MAP` POST_CREATE entry.
- Astro source-assertion tests: `DiscoveryDoorHub.astro` renders absolute admin
  href for editor-acquired; `/publicar-experiencia` passes `domain="experience"`.
- Config test: `ACCOUNT_DISCOVERY_DOORS` shape (3 publish + 4 partner options).
- i18n: keys present in `es`/`en`/`pt`; no orphaned `commerce` publish key.
- Per-role visual verification (design-reviewer / Playwright) with the local
  test users and superadmin.

## 8. Implementation order

Block 0 → Block 1 → Block 2 → Block 3. Blocks 1–3 all touch
`discovery-doors.ts`, so they run sequentially to avoid conflicts. Each block:
implementation → adversarial code review (code-reviewer) → per-role visual
verification. Atomic commits, tests mandatory, `[HOS-134]` PR to `staging` with
`Closes HOS-134`.
