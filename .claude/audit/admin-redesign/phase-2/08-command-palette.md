---
audit: command-palette
status: complete
date: 2026-05-21
agent: Explore
---

# 08 — CommandPalette

## Status: **PLACEHOLDER / WIP (skeletal implementation)**

The CommandPalette is wired into the header but is essentially a UI shell awaiting a real implementation. There is no search logic, no data sources, no result rendering.

## What it does today

- Opens on **Cmd+K (Mac) / Ctrl+K (Windows/Linux)** keyboard shortcut.
- Closes the modal when dismissed (Escape, click outside).
- Shows a search trigger button in the **desktop header only** (hidden on screens below `lg:` ≈ 1024px).
- i18n-ready with translation IDs defined in `admin-common.json` and `admin-nav.json`.
- Built on the **cmdk** library v1.1.1 (headless, unstyled command palette) + Radix Dialog + shadcn/ui command primitives.

## What it CANNOT do (yet)

- **No actual search**: zero search functionality — the dialog body shows only a placeholder "Coming Soon" message.
- **No data sources**: no API queries, no static index, no entity indexing.
- **No result types**: cannot search pages, entities, actions, users, settings, or routes.
- **No debouncing or caching**: no request optimization since there are no requests.
- **No history / recent searches**: no persistence.
- **No permission filtering**: nothing to filter (there are no items).
- **No mobile UI**: trigger button hidden on screens below `lg:`. Cmd+K still works on bluetooth keyboards, but there is no touch-friendly affordance (no search icon button, no swipe-to-search, no full-screen sheet).

## Code references

- Component: `apps/admin/src/components/layout/header/CommandPalette.tsx`
- Trigger button: line 48 (`lg:flex` visibility class)
- Implementation library: `cmdk` v1.1.1
- Translation keys: defined in `packages/i18n/locales/admin-common.json` and `admin-nav.json`
- Code comment explicitly states: *"Real search functionality will be implemented in a future spec."*

## Biggest gap

**The feature is not implemented at all.** The component is a UI shell awaiting a spec that defines:

1. **Searchable entity types** — should it search accommodations, destinations, posts, users, settings? Across all of them or filtered by section?
2. **Result grouping** — how to group results by type? Show recent searches?
3. **Filtering by user permissions** — must respect what each user can access.
4. **API integration** — server-side search endpoint(s) vs client-side index. For a multi-entity search this almost certainly needs a dedicated `/api/v1/admin/search?q=...` endpoint with permission-aware filtering at the API layer.
5. **Actions vs navigation** — should it expose actions ("Create accommodation", "Switch theme") in addition to entity navigation?
6. **Mobile UX strategy** — full-screen sheet on mobile, or hidden entirely?

## Implication for the admin redesign

The CommandPalette is the **most underutilized opportunity** in the current admin. A working command palette would solve several pain points at once:

- Reduce sidebar complexity for power users (they can jump anywhere without clicking through groups).
- Provide a permission-aware "single search box" that respects what each user can actually access.
- Become a centralized place to expose **actions** (not just navigation) — e.g. "Mark all notifications as read", "Switch language to English", "Toggle dark mode".

Recommend: this becomes its own SPEC. Scope it AFTER the permission-bundle decisions are made, because the searchable surface depends on what items the user can see.

## Estimated effort

Building a real CommandPalette is a focused 1-2 week SPEC:

- Define searchable entities + actions.
- Build a permission-aware `/api/v1/admin/search` endpoint OR pre-index client-side from already-loaded query caches.
- Wire result rendering (grouped by type, with icons, with keyboard navigation).
- Add recent-search persistence (localStorage).
- Add mobile UX (full-screen sheet).
- i18n the full result surface.
