---
spec-id: SPEC-008
title: Phosphor Icons Migration
type: refactoring
complexity: medium
status: draft
created: 2026-02-13T12:00:00.000Z
updated: 2026-02-13T18:00:00.000Z
depends-on: []
---

## SPEC-008: Phosphor Icons Migration

## 1. Overview

Migrate the entire monorepo to use `@repo/icons` as the single source of truth for all icons, then migrate the package internals from 386+ custom SVG components to Phosphor Icons (`@phosphor-icons/react`).

The migration is split into two major stages:

1. **Consolidation**: Make ALL apps/packages use `@repo/icons` exclusively (eliminate direct `lucide-react` imports, inline SVGs, etc.)
2. **Migration**: Replace custom SVG internals with Phosphor Icons wrappers

## 2. Goals

- Establish `@repo/icons` as the single, mandatory icon source across the monorepo
- Eliminate all direct `lucide-react` imports from consuming apps
- Eliminate all inline SVGs used as icons
- Normalize `IconProps` to align with Phosphor's prop interface (`size`, `color`, `weight`, `mirrored`, `className`, `aria-label`)
- Replace all custom SVGs with Phosphor Icons equivalents
- Maintain the existing import API (`import { MapPinIcon } from '@repo/icons'`)
- Gain access to Phosphor's `weight` system (thin, light, regular, bold, fill, duotone)
- Reduce maintenance burden (no more hand-crafted SVGs)
- Access to 9,000+ icons from Phosphor's library
- Maintain tree-shaking capability

## 3. Current State Audit

### 3.1 Icon Sources in the Monorepo

| Source | Files | Location | Notes |
|---|---|---|---|
| `@repo/icons` (custom SVG) | ~34 | admin (22), web (12) | Centralized package, 386 icons |
| `lucide-react` (direct import) | ~60 | admin (56), web (4) | Bypasses the package entirely |
| SVGs inline hardcoded | ~60+ | web (~51), web2 (6+), admin (several) | In Astro templates and React components |

### 3.2 Per-App Breakdown

#### `apps/admin/` - Mixed Usage (worst offender)

- **56 files** import directly from `lucide-react` (~87 unique Lucide icons)
- **22 files** import from `@repo/icons`
- Has its own `components/icons/` wrapper system with `Icon.tsx`, `IconRegistry.tsx`
  - `IconRegistry` maps only ~40 icons from `@repo/icons` by string name
  - `Icon.tsx` uses Tailwind-class-based sizing (`h-4 w-4`) instead of pixel-based
  - Adds `variant` prop (default, muted, success, warning, error, primary)
- Several files use `strokeWidth` prop (not typed in `@repo/icons`)
- Shadcn UI components (`select.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `command.tsx`) import Lucide directly

**Lucide icons used in admin** (~87 unique):

- UI: `Check`, `X`, `XIcon`, `ChevronDown`, `ChevronUp`, `ChevronRight`, `ChevronsUpDown`, `Circle`, `Plus`, `Loader2`, `GripVertical`
- Actions: `Edit`, `Eye`, `EyeOff`, `Download`, `Upload`, `Save`, `RotateCcw`, `Pencil`, `Power`, `PowerOff`, `Play`, `Trash2`, `ExternalLink`, `MoreHorizontal`
- Status: `AlertCircle`, `AlertTriangle`, `CheckCircle`, `CheckCircle2`, `Info`
- Rich text: `Bold`, `Italic`, `Link`, `List`, `ListOrdered`, `Underline`
- Media: `ImageIcon`, `FileText`, `FileTextIcon`, `ZoomIn`
- Business: `Clock`, `CreditCard`, `Receipt`, `Tags`, `DollarSign`, `Shield`, `ShieldAlert`, `Building2`, `Activity`, `BarChart3`, `TrendingUp`, `Package`, `MousePointerClick`
- System: `Bell`, `Monitor`, `Moon`, `Sun`, `Palette`, `Mail`, `Calendar`, `Filter`, `Webhook`, `Grid3X3`, `Maximize2`, `Printer`, `Settings`, `RefreshCw`

#### `apps/web/` (DEPRECATING - out of scope)

- 12 files use `@repo/icons`
- 4 files use `lucide-react` directly
- ~51 files have inline SVGs
- **This app is being deprecated. No migration needed.**

#### `apps/web2/` - Inline SVGs Only

- `@repo/icons` is in `package.json` but **0 actual imports** in source code
- All icons are inline SVGs (EventCard, Header, ViewToggle, ShareButtons, Select, EmptyState)
- Being built by SPEC-005, should adopt `@repo/icons` as icons are added

#### `packages/auth-ui/`

- Has `lucide-react` in `package.json` but **0 imports** found in source.. likely residual dependency

### 3.3 Current `@repo/icons` Props Interface

```typescript
interface IconProps {
  size?: number | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  className?: string;
  'aria-label'?: string;
  [key: string]: unknown;  // catch-all
}

const ICON_SIZES = { xs: 16, sm: 20, md: 24, lg: 28, xl: 32 } as const;
```

### 3.4 Admin `Icon.tsx` Wrapper Props (different from package)

```typescript
type IconProps = {
  name: IconName | string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';  // Tailwind classes, NOT pixels
  className?: string;
  ariaLabel?: string;       // camelCase, NOT 'aria-label'
  decorative?: boolean;
  variant?: 'default' | 'muted' | 'success' | 'warning' | 'error' | 'primary';
};

// Maps to Tailwind: xs='h-3 w-3', sm='h-4 w-4', md='h-5 w-5', lg='h-6 w-6', xl='h-8 w-8', 2xl='h-10 w-10'
```

### 3.5 Phosphor Icons Props (target)

```typescript
interface PhosphorIconProps extends SVGAttributes<SVGSVGElement> {
  size?: number | string;
  color?: string;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  mirrored?: boolean;
  alt?: string;
}
```

### 3.6 Props Gap Analysis

| Prop | `@repo/icons` current | Phosphor native | Target `@repo/icons` |
|---|---|---|---|
| `size` | `number \| 'xs'\|'sm'\|'md'\|'lg'\|'xl'` | `number \| string` | Keep named sizes + number, map internally |
| `color` | `string` | `string` | Same |
| `weight` | Not supported | `'thin'\|'light'\|'regular'\|'bold'\|'fill'\|'duotone'` | Add as optional, default `'regular'` |
| `mirrored` | Not supported | `boolean` | Add as optional, default `false` |
| `className` | `string` | Via `SVGAttributes` | Keep |
| `aria-label` | `string` | Via `SVGAttributes` (or `alt`) | Keep |
| `strokeWidth` | Not typed (passes via spread) | N/A (controlled by `weight`) | Remove (superseded by `weight`) |

## 4. Migration Strategy

### Phase 0: Normalize `@repo/icons` Props Interface

**Goal**: Update `IconProps` to align with Phosphor's interface BEFORE any consumer migration. This way, consumers adopt the final API from the start.

**Tasks**:

1. Update `IconProps` in `packages/icons/src/types.ts`:

   ```typescript
   type IconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';

   interface IconProps extends React.SVGAttributes<SVGSVGElement> {
     size?: number | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
     color?: string;
     weight?: IconWeight;     // NEW - ignored until Phase 3, defaults to 'regular'
     mirrored?: boolean;      // NEW - ignored until Phase 3, defaults to false
     className?: string;
     'aria-label'?: string;
   }
   ```

2. Update existing custom SVG components to accept (and ignore) `weight` and `mirrored` until Phase 3
3. Remove the `[key: string]: unknown` catch-all in favor of extending `SVGAttributes`
4. Add `IconWeight` type export
5. Update tests and documentation

### Phase 1: Consolidate Admin - Replace Direct Lucide Imports

**Goal**: Eliminate all 56 files in `apps/admin/` that import from `lucide-react` directly.

**Tasks**:

1. **Add missing icons to `@repo/icons`**: Create wrapper components in the package for every Lucide icon currently imported directly in admin (~87 unique icons). Many already exist under different names. Create a mapping:
   - Icons that already exist in `@repo/icons` (just need import change)
   - Icons that need to be added as new components

2. **Migrate shadcn/ui components** (6 files):
   - `select.tsx` - `Check`, `ChevronDown`, `ChevronUp`
   - `dialog.tsx` - `XIcon`
   - `dropdown-menu.tsx` - `Check`, `ChevronRight`, `Circle`
   - `command.tsx` - `SearchIcon`
   - `Accordion.tsx` - `ChevronDown`
   - `Checkbox.tsx` - `Check`

3. **Migrate entity-form components** (~10 files):
   - `EntityFormLayout.tsx` - `Eye`, `Loader2`, `RotateCcw`, `Save`
   - `EntityViewLayout.tsx` - `Download`, `Edit`, `Eye`, `EyeOff`, `Grid3X3`, `List`, `Loader2`, `Maximize2`, `Printer`, `RefreshCw`, `Settings`
   - `EntityViewSection.tsx` - `Edit`, `Eye`
   - Field/view components: various icons

4. **Migrate billing routes and features** (~16 files):
   - All billing routes under `routes/_authed/billing/`
   - Billing feature components (plans, addons, metrics, promo-codes, cron-jobs)

5. **Migrate remaining routes** (~14 files):
   - `access/`, `events/`, `sponsor/`, `me/` routes

6. **Migrate ui-wrapped components** (3 files):
   - `Select.tsx`, `Accordion.tsx`, `Checkbox.tsx`

7. **Unify admin Icon system**:
   - Update `IconRegistry.tsx` to include all newly added icons
   - Align `Icon.tsx` ICON_SIZES with package ICON_SIZES (resolve Tailwind-class vs pixel mismatch)
   - Consider whether the admin `Icon` wrapper is still needed or if direct imports suffice

8. **Remove `lucide-react`** from `apps/admin/package.json`

### Phase 1b: Consolidate Admin - Replace Inline SVGs

**Goal**: Replace any inline `<svg>` elements used as icons in admin with `@repo/icons` components.

**Tasks**:

1. Audit and replace inline SVGs in admin components (ValidatedForm, ValidatedInput, GridCard, VirtualizedEntityList, etc.)
2. Replace CSS `animate-spin` border spinners with `LoaderIcon` from `@repo/icons` where appropriate

### Phase 2: Consolidate Web2 - Replace Inline SVGs

**Goal**: Eliminate all inline SVGs in `apps/web2/` and use `@repo/icons` exclusively.

**Tasks**:

1. Replace inline SVGs in:
   - `EventCard.astro` - map/calendar icons
   - `Header.astro` - hamburger menu icon
   - `ViewToggle.client.tsx` - grid/list view icons
   - `ShareButtons.client.tsx` - share icon
   - `Select.astro` - chevron icon
   - `EmptyState.astro` - illustration SVG
2. Add any missing icons to `@repo/icons` if needed
3. Verify Astro component compatibility (no hydration issues)

### Phase 2b: Clean Up Other Packages

**Goal**: Remove unused icon dependencies from packages.

**Tasks**:

1. Remove `lucide-react` from `packages/auth-ui/package.json` (unused dependency)
2. Verify no other packages import icons directly

### Phase 3: Migrate Package Internals to Phosphor

**Goal**: Replace custom SVG implementations inside `@repo/icons` with Phosphor wrappers. Zero changes needed in consuming apps.

**Tasks**:

1. **Mapping audit**: Create complete mapping table `CurrentIconName -> PhosphorIconName`
2. **Identify gaps**: Icons with no Phosphor equivalent (keep as custom SVGs)
3. **Add dependency**: `@phosphor-icons/react` to `packages/icons/package.json`
4. **Create wrapper components**: Replace each custom SVG with a Phosphor wrapper that:
   - Maps named sizes to pixel values
   - Passes `weight`, `mirrored`, `color` to Phosphor
   - Maintains backward-compatible export names
5. **Wire up `weight` and `mirrored`** props (previously accepted but ignored)
6. **Visual verification**: Side-by-side comparison page (old Lucide-style vs new Phosphor-style)
7. **Remove old SVG source files**
8. **Update documentation** (CLAUDE.md, README, guides)

### Phase 4: Cleanup

**Goal**: Remove all legacy icon infrastructure.

**Tasks**:

1. Remove `lucide-react` from root `pnpm-lock.yaml` (should have no consumers)
2. Remove `packages/icons/scripts/generate-icon.js` (no longer needed)
3. Clean up old icon docs referencing Lucide as source
4. Final bundle size analysis
5. Update CLAUDE.md files across the monorepo

## 5. Props Interface (Post-Migration)

```typescript
/** Phosphor-aligned weight system */
export type IconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';

/** Base props for all icon components */
export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  /** Icon size - named preset or pixel value */
  size?: number | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Icon color - any CSS color value. Default: 'currentColor' */
  color?: string;
  /** Icon weight/style. Default: 'regular' */
  weight?: IconWeight;
  /** Flip icon horizontally (useful for RTL). Default: false */
  mirrored?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Accessibility label for screen readers */
  'aria-label'?: string;
}

/** Size mapping for named presets */
export const ICON_SIZES = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
  xl: 32
} as const;
```

## 6. Admin `Icon` Wrapper - Resolution

The admin's `components/icons/Icon.tsx` has diverged from the package:

| Aspect | Package `@repo/icons` | Admin `Icon.tsx` |
|---|---|---|
| Sizing | Pixel values (16, 20, 24...) | Tailwind classes (`h-4 w-4`...) |
| Size keys | xs, sm, md, lg, xl | xs, sm, md, lg, xl, **2xl** |
| Variant | Not supported | default, muted, success, warning, error, primary |
| Resolution | Direct component import | String-based registry lookup |

**Decision**: Keep the admin `Icon` wrapper as an **app-level convenience** on top of `@repo/icons`. It provides admin-specific features (variant colors, registry lookup by name) that don't belong in the shared package. But:

- It MUST import all icons from `@repo/icons` (not Lucide)
- Its sizing should use the package's `ICON_SIZES` internally and apply Tailwind classes via `className`
- The `IconRegistry` should be expanded to cover all icons used in admin

## 7. Icons That May Need Custom SVGs

Some domain-specific icons may not exist in Phosphor:

- Brand-specific icons (Hospeda logo variations)
- Very specific amenity icons (e.g., "quincho", "parrilla")
- Custom attraction icons specific to the Litoral region
- Carnaval-specific icons

These will be kept as custom SVGs with the same props interface.

## 8. Impact Analysis

### 8.1 Consuming Apps

| App | Impact | Action |
|---|---|---|
| `apps/admin/` | **High** - 56 files to migrate from Lucide | Phase 1 |
| `apps/web2/` | **Medium** - ~6 files with inline SVGs | Phase 2 |
| `apps/web/` | **None** - being deprecated | Out of scope |

### 8.2 Breaking Changes

- **Phase 0**: Adding `weight` and `mirrored` to `IconProps` is additive (non-breaking)
- **Phase 1-2**: Import path changes only (non-breaking to package API)
- **Phase 3**: Visual appearance will change (Phosphor style vs Lucide style). No API breaks.
- `strokeWidth` users will need to switch to `weight` prop

### 8.3 Bundle Size

- Current: Each icon is a self-contained SVG component (~200-500 bytes each)
- Phosphor: Similar individual component size with tree-shaking
- Net impact: Roughly neutral, possibly smaller due to Phosphor's optimized SVGs

## 9. Testing

- Phase 0: Unit tests for new `IconProps` interface
- Phase 1-2: Typecheck + visual verification that admin/web2 render correctly
- Phase 3: Visual regression tests comparing old vs new icon rendering
- All phases: Verify tree-shaking still works (bundle analysis)
- Accessibility: Verify `aria-label` and `aria-hidden` behavior preserved

## 10. Out of Scope

- `apps/web/` (being deprecated)
- Redesigning the icon category structure
- Adding new icons beyond what's currently used + Phosphor equivalents
- Animated icons
- Icon font generation

## 11. Execution Order Summary

```
Phase 0: Normalize IconProps          -> No consumer changes, just types
Phase 1: Admin Lucide -> @repo/icons  -> 56 files, ~87 icons to add/map
Phase 1b: Admin inline SVGs           -> Several files
Phase 2: Web2 inline SVGs             -> ~6 files
Phase 2b: Clean up packages           -> Remove unused deps
Phase 3: Package SVGs -> Phosphor     -> Internal rewrite, 0 consumer changes
Phase 4: Final cleanup                -> Remove Lucide, old scripts, update docs
```

---

**Status**: Draft - awaiting review
