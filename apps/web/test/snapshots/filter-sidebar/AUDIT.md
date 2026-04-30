# FilterSidebar Audit — SPEC-096 T-018

**Date**: 2026-04-29
**Auditor**: SPEC-096 React Agent

---

## Summary

There is **exactly one** FilterSidebar component file in the codebase:

- `apps/web/src/components/shared/filters/FilterSidebar.client.tsx`
- Co-located CSS Module: `apps/web/src/components/shared/filters/FilterSidebar.module.css`

No duplicate variants exist. Consolidation is a no-op: only verification + light
refactor needed (REQ-096-11 tasks T-019, T-020).

---

## Component File

| File | Role |
|------|------|
| `src/components/shared/filters/FilterSidebar.client.tsx` | Main island component |
| `src/components/shared/filters/FilterSidebar.module.css` | Shell layout styles |
| `src/components/shared/filters/filter-types/filter.types.ts` | Shared type definitions |
| `src/components/shared/filters/filter-types/FilterGroupContent.tsx` | Inner render dispatcher |

---

## Call Sites (3 total)

### 1. `src/pages/[lang]/alojamientos/index.astro` (line 324)

Accommodation listing page. Uses `slot="filters"` inside `ListingLayout.astro`.

```astro
<FilterSidebar
    slot="filters"
    client:load
    locale={locale}
    filters={filterGroups}
    sortOptions={sortOptions}
    initialParams={initialParams}
/>
```

**Props passed:**

| Prop | Value |
|------|-------|
| `locale` | `SupportedLocale` from middleware |
| `filters` | `FilterGroup[]` — includes checkbox, radio, dual-range, stepper, stars, toggle, icon-chips types |
| `sortOptions` | Array of `{ value, label }` sort options |
| `initialParams` | `Record<string, string>` — SSR-provided URL params to avoid hydration flash |
| `position` | not passed (defaults to `'left'`) |

**Filter group types used**: checkbox, radio, dual-range (price), stepper (guests, rooms), stars, toggle (featured, pet-friendly, instant-book), icon-chips (amenities, features)

---

### 2. `src/pages/[lang]/eventos/index.astro` (line 95)

Events listing page. Uses `slot="filters"` inside `ListingLayout.astro`.

```astro
<FilterSidebar
    slot="filters"
    client:load
    locale={locale}
    filters={filterGroups}
    sortOptions={sortOptions}
    defaultSort="startDate"
/>
```

**Props passed:**

| Prop | Value |
|------|-------|
| `locale` | `SupportedLocale` from middleware |
| `filters` | `FilterGroup[]` — checkbox, radio, toggle, date-range types |
| `sortOptions` | Array of `{ value, label }` sort options |
| `defaultSort` | `"startDate"` |
| `initialParams` | not passed |
| `position` | not passed (defaults to `'left'`) |

---

### 3. `src/pages/[lang]/publicaciones/index.astro` (line 97)

Blog/posts listing page. Uses `slot="filters"` inside `ListingLayout.astro`.

```astro
<FilterSidebar
    slot="filters"
    client:load
    locale={locale}
    filters={filterGroups}
    sortOptions={sortOptions}
    defaultSort="publishedAt"
/>
```

**Props passed:**

| Prop | Value |
|------|-------|
| `locale` | `SupportedLocale` from middleware |
| `filters` | `FilterGroup[]` — checkbox, radio types |
| `sortOptions` | Array of `{ value, label }` sort options |
| `defaultSort` | `"publishedAt"` |
| `initialParams` | not passed |
| `position` | not passed (defaults to `'left'`) |

---

## Rendered HTML Structure (from source analysis)

```
<div class="wrapper [className]">

  <!-- Desktop sidebar (hidden on mobile via .sidebarDesktop: display:none) -->
  <div class="sidebar sidebarDesktop">
    <SidebarPanel>
      <div class="sidebarHeader">
        <div class="headerTop">
          <h2 class="title">Filtros [badge] [loadingIndicator?]</h2>
          <div class="headerActions">
            [SortPopover?] [clearAllBtn?]
          </div>
        </div>
      </div>
      <div class="sidebarBody">
        {toggle groups} → <div class="inlineFilter">...</div>
        {other groups} → <fieldset class="group [groupActive?]">
          <div class="groupHeader">
            <button class="groupToggle">...</button>
            <span class="groupHeaderActions">
              [groupReset?] <button class="chevronBtn"><span class="chevron [chevronCollapsed?]">▾</span></button>
            </span>
          </div>
          <div class="groupContent [groupContentCollapsed?]">
            <FilterGroupContent />
          </div>
        </fieldset>
      </div>
    </SidebarPanel>
  </div>

  <!-- Mobile: floating trigger (visible only on <768px) -->
  <button class="floatingTrigger" aria-haspopup="dialog">
    <span class="floatingTriggerIcon">☰</span>
    <span>Filtros</span>
    [floatingBadge?]
  </button>

  <!-- Mobile: overlay (rendered when isDrawerOpen) -->
  [isDrawerOpen && <div class="drawerOverlay" />]

  <!-- Mobile: drawer dialog -->
  <dialog class="drawer [drawerOpen?]">
    <SidebarPanel drawerMode onCloseDrawer>
      {same structure as desktop + drawerClose button in headerActions}
    </SidebarPanel>
  </dialog>

</div>
```

---

## Mobile Behavior (verified from source)

- **Trigger**: Fixed floating button (`.floatingTrigger`) at `bottom:1.5rem, left:1rem`, visible only at `max-width: 767px`.
- **Drawer**: Full-height panel from the left (`width: min(85vw, 380px)`), slides in with CSS transform.
- **Overlay**: Dimmed backdrop closes drawer on click or `Escape` key.
- **Focus trap**: `useEffect` traps keyboard focus inside the `<dialog>` element.
- **Body scroll lock**: `document.body.style.overflow = 'hidden'` while drawer is open.
- **MediaQuery listener**: Automatically closes drawer when viewport grows to `>=768px`.
- The desktop `.sidebarDesktop` uses `display: none` at `max-width: 767px` and `display: flex` at `min-width: 768px`.

---

## Findings

1. **No duplicate files**: Single component, no consolidation needed.
2. **All 3 call sites use identical pattern**: `slot="filters"`, `client:load`, same prop shape.
3. **No call site uses `position='top'`**: None currently need horizontal bar layout.
4. **`initialParams` is optional**: Only accommodations page passes it; events and posts do not.
5. **`defaultSort` is optional**: Only events and posts pass it.
6. **`className` prop exists but no call site passes it**: Available for custom layout integration.

---

## T-019 Action Plan

- Add `position?: 'left' | 'top'` prop (default `'left'`) to `FilterSidebarProps`.
- Add `.positionLeft` and `.positionTop` CSS Module classes to `FilterSidebar.module.css`.
- `position='left'`: current layout (sidebar to the left of content grid via `ListingLayout.astro`).
- `position='top'`: horizontal bar above content (wrapper becomes `display:flex; flex-direction:row` clamped to full width, sidebar scrolls horizontally).
- Mobile: both positions collapse to the same floating drawer (existing behavior preserved).
- All 3 call sites keep default `position='left'` (no prop change needed).
