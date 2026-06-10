---
audit: mobile-ux
status: complete
date: 2026-05-21
agent: Explore
---

# 13 — Mobile UX (deeper than nav drawer)

## 1. Long forms on mobile

**Form structure:**
- Forms use `GridLayout` with responsive column breakpoints (`sm`, `md`, `lg`, `xl`).
- Default 2 columns desktop → **1 column on mobile** via `grid-cols-1` base + responsive overrides (`GridLayout.tsx:32`).
- Field grouping via `EntityFormSection` with nested `GridLayout`.

**Findings:**
- ✅ Single-column on small screens by default.
- ✅ Responsive field spans available (`responsive: { sm: 1, md: 2, lg: 2 }`).
- ⚠️ `EntityFormLayout` has `stickyHeader` / `stickyFooter` props (`EntityFormLayout.tsx:90-91`) but footer buttons are in a horizontal `flex items-center gap-2` row (lines 287-319) with **no wrapping strategy** for mobile.
- ⚠️ Multiple-button footers (Save / Discard / Save & Publish) can overflow on small phones; labels may truncate.

## 2. Wide tables on mobile

**Strategy:** **scroll, not stack.** No card-view alternative.

```html
<div className="overflow-x-auto rounded-md border">
  <table className="w-full min-w-max table-auto text-left text-sm lg:min-w-0">
```
(`DataTable.tsx:357-361`)

- Below `lg:` (≈1024px) table keeps natural width → horizontal scroll.
- At `lg:` and above table can shrink to viewport.

**Findings:**
- ✅ Scroll affordance is clear (overflow-x-auto container).
- ⚠️ No responsive column visibility toggle (no "hide secondary columns on mobile").
- ⚠️ No mobile card view as alternative to horizontal scroll.
- ⚠️ Pagination row uses `flex items-center justify-between` (line 450) without mobile stacking — "Rows per page" select + nav buttons can crowd at <320px.

## 3. Detail page tabs (PageTabs.tsx)

**Strategy: horizontal scroll, not dropdown or stack.**

```html
<div className="scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent mb-6 overflow-x-auto border-b">
  <div role="tablist" className="flex min-w-max gap-4">
```
(`PageTabs.tsx:36, 43`)

**Tab counts:** Accommodation = 5 (Overview, Gallery, Amenities, Reviews, Pricing). User = 3. Event = 3.

**Findings:**
- ✅ Horizontal scroll intuitive.
- ✅ Custom scrollbar styling (`scrollbar-thin`).
- ⚠️ No mobile dropdown variant for tabs.
- ⚠️ Long Spanish labels (e.g. "Amenidades") may require scroll on very small screens.

## 4. Dialogs / modals

**CommandPalette:**
- Trigger has `lg:flex` (`CommandPalette.tsx:48`) — **hidden below 1024px**.
- Cmd+K / Ctrl+K shortcut still works on hardware keyboards but no touch-friendly alternative.

**Notifications dropdown:**
- Fixed width `w-80` (`Header.tsx:137`) — **too wide for screens <320px**.
- No responsive variant.

**General dialogs (Radix):**
- Centered modals, NOT full-screen on mobile. Verify on real devices — small dialogs OK, but full forms in dialogs are a bad mobile UX.

## 5. Filter bar

**Not present** as a dedicated component. DataTable has no per-column filters. Search lives in (unfinished) CommandPalette only. This is a gap for any user trying to filter list views on mobile.

## 6. Sidebar / navigation (recap from nav audit)

- Fixed mobile drawer: `fixed inset-y-0 top-14 left-0 w-64` (`Sidebar.tsx:81`).
- Overlay: `fixed inset-0 z-30 bg-black/40` (lines 63-67).
- Slide transition 200ms (`translate-x-0` / `-translate-x-full`).
- Width 256px (`w-64`) — reasonable for mobile.
- Focus trap + Escape key to close (`MobileMenu.tsx:76-93`).
- Menu items ≥40px tall (`py-2.5 px-3`).

✅ Mobile drawer is the best-executed mobile element in the admin.

## 7. Touch target sizes

| Button size | Height | WCAG (≥44px) |
|-------------|--------|--------------|
| `default` | 40px (h-10 px-4 py-2) | Close, not strict pass |
| `sm` | 36px (h-9 px-3) | ⚠️ **FAILS** |
| `icon` | 40px (h-10 w-10) | Close, not strict pass |
| `lg` | 44px (h-11 px-8) | ✅ Passes |

Checkbox / Switch / Select likely 40px (shadcn defaults). **No explicit min-touch-target guarantee** across all controls.

## 8. Responsive breakpoints

Standard Tailwind: `sm:` 640, `md:` 768, `lg:` 1024, `xl:` 1280.

**Usage patterns:**
- `md:hidden` / `hidden md:flex` — toggle nav between mobile/desktop.
- `lg:flex` — desktop-only features (search button, profile link).
- `sm:inline` — small text visibility.

## 9. Bottom nav / FAB

**Not present.** Mobile entry points are limited to:
1. Header hamburger (only entry visible).
2. Sidebar drawer (slides from left).

**No floating action button** for primary actions (e.g. "+ Create accommodation").

## 10. Toasts / feedback

- No global toast/snackbar library detected (no `toast()` calls in forms).
- Notification dropdown lives in header (`Header.tsx:137-157`).
- Form success/error shown as **full-width banners** (`ValidatedForm.tsx:255-293`), not toasts.
- ⚠️ No toast position strategy for mobile clearance from nav bars.

## Top 3 wins

1. **Sticky header & footer on forms** — save buttons accessible while scrolling.
2. **Responsive grid layout with col-span control** — forms adapt 2col → 1col cleanly.
3. **Mobile sidebar drawer** — focus trap + Escape + overlay, accessible execution.

## Top 3 gaps

1. **No mobile-optimized search entry** — CommandPalette trigger hidden, no fallback icon, no full-screen sheet on mobile.
2. **Table pagination not mobile-stacked** — "Rows per page" + nav buttons can overflow at <320px.
3. **Form footer buttons don't wrap on mobile** — multi-button footers (Save / Discard / Save & Publish) truncate or overflow on small screens.

## Additional issues worth flagging

- No card-view alternative for wide tables on mobile.
- Notification dropdown `w-80` too wide for narrow phones.
- `sm` button size (36px) below WCAG touch-target recommendation.
- No FAB for primary create actions on mobile.
- No filter bar component → mobile filtering is essentially absent in list pages.
