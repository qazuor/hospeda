---
audit: navigation
status: complete
date: 2026-05-21
agent: Explore
---

# 02 — Navigation, sidebar, topbar, layouts

## 1. Layout architecture

3-level navigation hierarchy:

- **Level 1 (header):** horizontal section nav — Dashboard, Content, Billing, Administration, Analytics
- **Level 2 (sidebar):** contextual, changes based on active section
- **Level 3 (tabs):** page-level tabs in detail views

### Composition (`AppLayout.tsx:1-67`)

```
AppLayout (wraps authenticated routes)
  ├─ ImpersonationBanner
  ├─ Header (sticky, h-14, z-40)
  └─ Flex container (h-[calc(100vh-3.5rem)])
      ├─ Sidebar (Level 2: z-30, w-64 desktop / drawer mobile)
      └─ <main> (flex-1)
```

All authenticated routes pass through `_authed.tsx:60-117`, which wraps content with `AppLayout`. `sidebar-context.tsx` manages sidebar state. Sections registered at startup in `__root.tsx:203`.

### Key files

- `apps/admin/src/components/layout/AppLayout.tsx` — shell composition
- `apps/admin/src/components/layout/header/Header.tsx` — Level 1 nav
- `apps/admin/src/components/layout/sidebar/Sidebar.tsx` — Level 2 nav
- `apps/admin/src/routes/{__root,_authed}.tsx` — routing setup

## 2. Current sidebar menu (per section)

All items use **OR logic** for permissions (user needs ≥1 permission to see an item).

### Dashboard sidebar (no permission gate — always visible)

- Overview → `/dashboard`
- Mis Alojamientos → `/me/accommodations`
- Notificaciones → `/notifications`
- Mi Perfil → `/me/profile`
- Configuración → `/me/settings`

### Content sidebar (`content.section.tsx:25-224`)

- **Accommodations** [group] → List, Create (`ACCOMMODATION_VIEW_ALL` / `ACCOMMODATION_CREATE`)
- **Destinations** [group] → List, Create (`DESTINATION_VIEW_ALL` / `DESTINATION_CREATE`)
- **Attractions** [group] → List, Create (`ATTRACTION_VIEW` / `ATTRACTION_CREATE`)
- **Amenities** [group] → List, Create (`AMENITY_VIEW` / `AMENITY_CREATE`)
- **Features** [group] → List, Create (`FEATURE_VIEW` / `FEATURE_CREATE`)
- *separator*
- **Blog** [group] → Posts, New Post (`POST_VIEW_ALL` / `POST_CREATE`)
- **Events** [group] → List, New (`EVENT_VIEW_ALL` / `EVENT_CREATE`)
- *separator*
- **Conversations Inbox** → `/conversations` (`CONVERSATION_VIEW_OWN` or `CONVERSATION_VIEW_ALL`) — **dynamic unread badge** via `useUnreadCount()` (`Sidebar.tsx:47-56`)

### Billing sidebar (`billing.section.tsx:26-161`)

- **Subscription Management** [group, expanded by default] → Plans, Subscriptions, Add-ons
- **Payments & Billing** [group] → Payments, Invoices
- **Promotions** [group] → Promo Codes, Sponsorships, Owner Promotions
- Exchange Rates → `/billing/exchange-rates`
- Metrics, Settings, Scheduled Tasks

### Administration sidebar (`administration.section.tsx:26-233`)

- **Access Control** [group, expanded by default] → Users, Roles, Permissions
- **Catalogs** [group] → Amenities, Features, Attractions (⚠️ **DUPLICATED from Content**)
- **Tag Management** [group] → PostTags, System Tags, Internal Tags, User Tag Moderation
- **Event Management** [group] → Locations, Organizers
- Sponsors
- **Settings** [group] → SEO, Critical Settings, ISR Revalidation

### Analytics sidebar (`analytics.section.tsx:11-39`)

- Usage, Business
- *separator*
- Debug

## 3. Current topbar (`Header.tsx:33-194`)

Height 3.5rem, sticky z-40, backdrop blur.

### Left
- Mobile hamburger toggle (`MenuIcon`, `md:hidden`)
- Logo/brand ("Admin" text, `hidden sm:inline`)

### Center (`md:flex` only)
- Horizontal section navigation (links to each section's `defaultRoute`)
- Filtered by `getHeaderNavItems()` (`config/sections/index.tsx:52-65`) — OR logic per section permissions

### Right
- **CommandPalette** — global search/command palette
- **Notifications dropdown** (bell icon)
  - Popover shows unread count
  - ⚠️ **Hardcoded "No new notifications" fallback** (`Header.tsx:144`) — placeholder, NOT integrated with notifications backend
  - Link to `/notifications`
- Profile icon → `/me/profile` (`hidden sm:inline`)
- Settings icon → `/me/settings` (`hidden sm:inline`)
- Auth user menu (Clerk HeaderUser integration)

## 4. Per-permission visibility logic

Source: `useUserPermissions()` (`use-user-permissions.ts:20-23`) reads `user?.permissions` from `AuthContext`.

### Section gating (`sidebar-helpers.ts:118-131`)
- `filterSectionsByPermissions()`
- Logic: visible if `permissions.length === 0` OR user has ≥1 permission (OR)
- Applied at `getHeaderNavItems()`

### Sidebar item gating (`sidebar-helpers.ts:136-169`)
- `filterByPermissions()`
- Same OR logic; groups filtered recursively; hidden if all children filtered
- Separators never filtered
- Applied at `Sidebar.tsx:45` via `useCurrentSidebarConfig()`

### No hardcoded roles
Everything uses `PermissionEnum` from `@repo/schemas`. No references to `host`, `editor`, `guest`, etc. in navigation code.

### Dev fallback
If `userPermissions` is undefined, all items shown (prevents local lockout).

## 5. Mobile / responsive

### Desktop (`md:` 768px+)
- Sidebar sticky, `w-64`, visible by default
- Collapses to `w-0` when `isCollapsed=true` (persisted in localStorage via `sidebar-context.tsx:59-69`)
- Full horizontal section nav in header
- Profile/Settings icons visible

### Mobile (<768px)
- Sidebar becomes fixed drawer (`z-30`, `left: 0`, `w-64`, off-screen at `-translate-x-full`)
- Slide-in animation (`duration-200`, `ease-out`) when `isMobileOpen=true`
- Hamburger replaces section nav
- `MobileMenu` (`header/MobileMenu.tsx:1-180`) shows all section links in drawer
- Backdrop overlay
- Closes on section link click or Escape

### State management (`sidebar-context.tsx:74-154`)
`isMobileOpen`, `isCollapsed`, `config`, `isContextual`

## 6. Layout pain points

1. **Hardcoded notifications placeholder** (`Header.tsx:144`) — "No new notifications" is static. Backend not hooked up.
2. **Sidebar items duplicated** — Amenities, Features, Attractions appear in both Content and Administration sidebars, both linking to `/content/*` routes.
3. **Route → section pattern matching is fragile** (`section-registry.ts:15-38`). Glob patterns converted to regex. First-registered-wins. Silent overlap bugs.
4. **Sidebar collapse UX inconsistent** — desktop slides to `w-0` (cosmetic, stays in DOM); mobile off-screen. No "peek" of collapsed icons in desktop.
5. **Permission arrays lack runtime validation** — if a permission string is removed from `PermissionEnum` but not from sidebar configs, items silently become unreachable. No audit UI.
6. **Section-to-sidebar mapping is implicit** — via `useCurrentSidebarConfig()` → `getSidebarConfigForPath()` → pattern matching. Silent failures on wrong patterns. No dev warnings.
