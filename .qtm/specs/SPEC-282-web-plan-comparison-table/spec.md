---
spec-id: SPEC-282
title: Web — Plan comparison table page (detailed feature/entitlement/limit breakdown)
type: feature
complexity: medium
status: draft
created: 2026-06-26T00:00:00Z
effort_estimate_hours: 12-20
tags: [web, billing, pricing, plans, comparison, entitlements, limits, i18n, ssr, astro]
---

# SPEC-282: Web — Plan comparison table page

## 1. Context

The web app has two pricing pages — `/suscriptores/planes/` (owners) and
`/suscriptores/turistas/` (tourists) — that show **summary cards** via
`PricingCardsGrid.astro`. Each card lists a few highlight bullets, the price,
and a CTA button. But there is **no detailed breakdown** of what each plan
includes: the full list of 48 entitlements and 14 limits is invisible to the
user deciding which plan to buy.

A user who wants to know "does the Pro plan include the availability calendar?"
or "how many photos can I upload on the Basic plan?" has no way to find out
without starting a checkout or contacting support. This is a conversion friction
point — pricing comparison tables are a standard SaaS pattern exactly because
they close that gap.

### What already exists (do NOT redo)

| Capability | Where | Source |
|---|---|---|
| `/suscriptores/planes/` (owner pricing, SSR + Cloudflare cache) | `pages/[lang]/suscriptores/planes/index.astro` | SPEC-168 |
| `/suscriptores/turistas/` (tourist pricing, SSR + Cloudflare cache) | `pages/[lang]/suscriptores/turistas/index.astro` | SPEC-168 |
| `PricingCardsGrid.astro` — summary card grid | `components/billing/PricingCardsGrid.astro` | SPEC-168 |
| `fetchPublicPlans()` + `filterPlansByCategory()` — runtime plan fetch | `lib/billing/fetch-plans.ts` | SPEC-168 |
| `GET /api/v1/public/plans` — returns plans with `entitlements: string[]` + `limits: Record<string, number>` | `apps/api/src/routes/billing/public/listPlans.ts` | SPEC-168 |
| `ENTITLEMENT_DEFINITIONS` (48 keys with name + description) | `packages/billing/src/config/entitlements.config.ts` | SPEC-145 |
| `LIMIT_METADATA` (14 keys with name + description) | `packages/billing/src/config/limits.config.ts` | SPEC-145 |
| `getEntitlementName()` — i18n lookup with fallback | `apps/web/src/lib/billing-i18n.ts` | SPEC-168 |
| `billing.entitlement.<key>` i18n keys (es/en/pt) | `packages/i18n/src/locales/` | SPEC-168 |
| `billing.limit.<key>.title` i18n keys (es/en/pt) — used in limit-reached panels | `packages/i18n/src/locales/` | SPEC-145 |
| `MarketingLayout.astro` + `MarketingHero.astro` — shared marketing page shell | `layouts/`, `components/marketing/` | SPEC-048 |
| CSS design tokens (`global.css`), section alternation, `data-reveal` | `styles/global.css`, `components.css` | SPEC-048 |

## 2. Goal

Add **two new pages** — one per audience — that render a **detailed comparison
table** showing every entitlement and limit for every plan in that audience,
with checkmarks for boolean features and numeric values (or "Ilimitado") for
limits. The pages are accessible via a link from the existing pricing card
pages.

| Page | Route | Plans shown | Link from |
|---|---|---|---|
| Owner comparison | `/{lang}/suscriptores/planes/comparar/` | `owner` + `complex` plans | `/suscriptores/planes/` |
| Tourist comparison | `/{lang}/suscriptores/turistas/comparar/` | `tourist` plans | `/suscriptores/turistas/` |

## 3. Out of scope

- Admin panel (admin has its own plan editor with full entitlement/limit pickers)
- Mobile app (SPEC-243)
- Changing the existing `PricingCardsGrid` summary cards (they stay as-is)
- Adding new entitlements or limits (this spec consumes the existing catalog)
- Changing the `/api/v1/public/plans` endpoint (the response already includes
  `entitlements` and `limits` — no endpoint changes needed)
- Complex plan comparison as a separate page (complex plans are included in the
  owner comparison page, same as they appear in the owner pricing cards)
- Commerce plans (excluded from `/api/v1/public/plans` by SPEC-239 isolation)

## 4. User flows

### 4.1 Tourist — comparing plans

1. User lands on `/suscriptores/turistas/` (existing pricing cards)
2. Below the cards, a link "Ver comparativa detallada" is visible
3. User clicks → navigates to `/suscriptores/turistas/comparar/`
4. Page renders: hero section + comparison table with tourist plans as columns
5. Rows are grouped: "Funciones turistas", "Funciones IA", "Límites"
6. Each cell shows a checkmark (✓) or dash (—) for entitlements, a number or
   "Ilimitado" for limits
7. Below the table, a CTA button links back to `/suscriptores/turistas/` to
   start checkout

### 4.2 Owner — comparing plans

1. User lands on `/suscriptores/planes/` (existing pricing cards)
2. Below the cards, a link "Ver comparativa detallada" is visible
3. User clicks → navigates to `/suscriptores/planes/comparar/`
4. Page renders: hero section + comparison table with owner + complex plans as
   columns
5. Rows are grouped: "Funciones propietario", "Funciones de alojamiento",
   "Funciones complejo", "Funciones IA", "Límites"
6. Each cell shows a checkmark (✓) or dash (—) for entitlements, a number or
   "Ilimitado" for limits
7. Below the table, a CTA button links back to `/suscriptores/planes/` to
   start checkout

## 5. Technical design

### 5.1 New pages

Two new Astro pages, both SSR with Cloudflare cache (identical caching strategy
to the existing pricing pages):

```
apps/web/src/pages/[lang]/suscriptores/planes/comparar/index.astro
apps/web/src/pages/[lang]/suscriptores/turistas/comparar/index.astro
```

Each page:

- `export const prerender = false` (SSR, same as existing pricing pages)
- Fetches plans via `fetchPublicPlans()` + `filterPlansByCategory()`
  - Owner page: fetches both `owner` and `complex` categories, merges, sorts by
    `sortOrder`
  - Tourist page: fetches `tourist` category
- Sets `Cache-Control: s-maxage=300, stale-while-revalidate=60` (same as
  existing pricing pages)
- Uses `MarketingLayout` + `MarketingHero` (same shell as existing pricing pages)
- Renders `<PlanComparisonTable>` component with the filtered plans
- Includes a CTA section at the bottom linking back to the pricing card page

### 5.2 New component: `PlanComparisonTable.astro`

```
apps/web/src/components/billing/PlanComparisonTable.astro
```

**Props:**

```ts
interface Props {
    readonly locale: SupportedLocale;
    readonly plans: readonly PublicPlanData[];
    readonly audience: 'owner' | 'tourist';
}
```

**Structure:**

The component renders a semantically accessible `<table>` with:

1. **Header row**: plan names (via `getPlanName()`) + monthly price formatted
   via `Intl.NumberFormat` with the locale's currency formatter
2. **Body rows grouped by category** using `<tbody>` sections with a group
   header row (`<th scope="rowgroup" colspan>`):

   | Group | Audience | EntitlementKeys included | Source |
   |-------|----------|--------------------------|--------|
   | Funciones propietario | owner | `PUBLISH_ACCOMMODATIONS`, `EDIT_ACCOMMODATION_INFO`, `VIEW_BASIC_STATS`, `VIEW_ADVANCED_STATS`, `RESPOND_REVIEWS`, `PRIORITY_SUPPORT`, `FEATURED_LISTING`, `CUSTOM_BRANDING`, `CREATE_PROMOTIONS` | `EntitlementKey` owner block |
   | Funciones de alojamiento | owner | `CAN_USE_RICH_DESCRIPTION`, `CAN_EMBED_VIDEO`, `CAN_USE_CALENDAR`, `CAN_SYNC_EXTERNAL_CALENDAR`, `CAN_CONTACT_WHATSAPP_DISPLAY`, `CAN_CONTACT_WHATSAPP_DIRECT`, `HAS_VERIFICATION_BADGE` | `EntitlementKey` accommodation block |
   | Funciones complejo | owner | `MULTI_PROPERTY_MANAGEMENT`, `CONSOLIDATED_ANALYTICS`, `CENTRALIZED_BOOKING`, `STAFF_MANAGEMENT` | `EntitlementKey` complex block |
   | Funciones turista | tourist | `SAVE_FAVORITES`, `WRITE_REVIEWS`, `READ_REVIEWS`, `AD_FREE`, `PRICE_ALERTS`, `EXCLUSIVE_DEALS`, `VIP_SUPPORT`, `VIP_PROMOTIONS_ACCESS`, `CAN_COMPARE_ACCOMMODATIONS`, `CAN_ATTACH_REVIEW_PHOTOS`, `CAN_VIEW_SEARCH_HISTORY`, `CAN_VIEW_RECOMMENDATIONS` | `EntitlementKey` tourist block |
   | Funciones IA | both | `AI_TEXT_IMPROVE`, `AI_CHAT`, `AI_SEARCH`, `AI_SUPPORT`, `AI_TRANSLATE`, `AI_ACCOMMODATION_IMPORT` | `EntitlementKey` AI block |
   | Límites | both | All `LimitKey` values relevant to the audience | `LIMIT_METADATA` |

   The entitlement-to-group mapping is derived from the `EntitlementKey` enum
   order (owner block, accommodation block, complex block, tourist block, AI
   block). A helper function in the component maps each key to its group. The
   group visibility depends on `audience`:
   - `owner`: show owner + accommodation + complex + AI groups + owner-relevant
     limits
   - `tourist`: show tourist + AI groups + tourist-relevant limits

3. **Entitlement rows**: one row per entitlement key.
   - Row header (`<th scope="row">`): localized entitlement name via
     `getEntitlementName({ key, t })`
   - Cells: `✓` icon (checkmark, from `@repo/icons` `CheckIcon`) if the plan's
     `entitlements` array includes the key, `—` (dash, muted) otherwise
   - The checkmark uses `var(--brand-tertiary)` color; the dash uses
     `var(--core-muted-foreground)`

4. **Limit rows**: one row per limit key relevant to the audience.
   - Row header: localized limit name via `getLimitName({ key, t })` (new helper,
     see §5.3)
   - Cells: the numeric value from `plan.limits[key]`, or "Ilimitado" (via i18n)
     if the value is `-1`
   - Limits not present in a plan's `limits` map show `—` (the plan doesn't
     enforce that limit)

5. **Responsive behavior**:
   - Desktop (≥768px): standard horizontal table, plans as columns, sticky first
     column (row headers)
   - Mobile (<768px): the table horizontally scrolls inside a
     `overflow-x: auto` container with `-webkit-overflow-scrolling: touch`; the
     first column remains sticky via `position: sticky; left: 0` so row labels
     are always visible while scrolling through plan columns

### 5.3 i18n helper: `getLimitName()`

Add a new function to `apps/web/src/lib/billing-i18n.ts`:

```ts
import { LIMIT_METADATA } from '@repo/billing';

export function getLimitName(input: { key: string; t: Translator }): string {
    const { key, t } = input;
    const meta = LIMIT_METADATA[key as LimitKey];
    const fallback = meta?.name ?? humanizeKey(key);
    return t(`billing.limit.${key}.title`, fallback);
}
```

This reuses the existing `billing.limit.<key>.title` i18n keys that are already
defined for limit-reached panels (SPEC-145). No new i18n keys are needed for
limit names — they already exist in es/en/pt.

For the "Ilimitado" label, add a single new i18n key:

- `billing.comparison.unlimited` → es: "Ilimitado", en: "Unlimited", pt: "Ilimitado"

For the "No incluido" dash label (accessibility), add:

- `billing.comparison.notIncluded` → es: "No incluido", en: "Not included", pt: "Não incluído"

### 5.4 Link from existing pricing pages

Add a "Ver comparativa detallada" link below the `PricingCardsGrid` section in
both existing pricing pages:

- `suscriptores/planes/index.astro`: link to `suscriptores/planes/comparar`
- `suscriptores/turistas/index.astro`: link to `suscriptores/turistas/comparar`

The link uses `GradientButton` (variant: secondary) or a text link with an icon,
styled to match the page's visual language. i18n key:

- `pricing.comparison.link` → es: "Ver comparativa detallada", en: "See detailed comparison", pt: "Ver comparação detalhada"

### 5.5 SEO

- Each comparison page includes `SEOHead` with a unique title and description
  (e.g., "Comparativa de planes para propietarios | Hospeda")
- No JSON-LD needed beyond what `MarketingLayout` already provides (the pricing
  JSON-LD stays on the card pages, not the comparison pages)
- `noindex` is NOT set — these pages are indexable and target long-tail search
  intent ("comparar planes hospeda", "que incluye cada plan")

### 5.6 Accessibility

- Table uses proper semantic markup: `<table>`, `<thead>`, `<tbody>`,
    `<th scope="col">` for plan columns, `<th scope="row">` for feature rows,
    `<th scope="rowgroup" colspan>` for group headers
- Checkmark and dash icons include `aria-label` with the localized "Incluido" /
    "No incluido" text, or `aria-hidden="true"` if a visually-hidden text
    alternative is provided in the cell
- Color is NOT the only indicator: checkmark icon + dash icon are distinct
    shapes, not just green/red
- Sticky first column does not trap focus — it's a visual affordance only
- Horizontal scroll on mobile is keyboard-accessible (scrollable container has
    `tabindex="0"` with a visually-hidden label)

### 5.7 Data flow

```
API: GET /api/v1/public/plans
  → ResponseFactory envelope { success, data: [...] }
  → Each plan: { slug, name, category, monthlyPriceArs, entitlements: string[], limits: Record<string, number>, ... }

Page (SSR):
  fetchPublicPlans() → { ok, plans }
  filterPlansByCategory(plans, 'owner') + filterPlansByCategory(plans, 'complex') → merged
  OR filterPlansByCategory(plans, 'tourist')

Component:
  PlanComparisonTable.astro receives { plans, audience, locale }
  - Entitlement groups derived from EntitlementKey enum order
  - For each entitlement key: check plan.entitlements.includes(key)
  - For each limit key: read plan.limits[key] ?? null
  - Names via getEntitlementName() / getLimitName() with i18n fallback
```

No new API endpoints. No new schemas. No DB changes. No new env vars.

## 6. Tasks

### WS-1 — i18n + helper layer

- **T-282-01**: Add `getLimitName()` to `apps/web/src/lib/billing-i18n.ts`
  (reuses existing `billing.limit.<key>.title` keys; add `LIMIT_METADATA`
  import from `@repo/billing`)
- **T-282-02**: Add new i18n keys to `packages/i18n/src/locales/` for es/en/pt:
  - `billing.comparison.unlimited` ("Ilimitado" / "Unlimited" / "Ilimitado")
  - `billing.comparison.notIncluded` ("No incluido" / "Not included" / "Não incluído")
  - `billing.comparison.included` ("Incluido" / "Included" / "Incluído")
  - `pricing.comparison.link` ("Ver comparativa detallhada" / "See detailed comparison" / "Ver comparação detalhada")
  - `pricing.comparison.owner.heading` ("Comparativa detallada de planes para propietarios")
  - `pricing.comparison.tourist.heading` ("Comparativa detallada de planes para turistas")
  - `pricing.comparison.owner.title` (SEO title)
  - `pricing.comparison.tourist.title` (SEO title)
  - `pricing.comparison.owner.description` (SEO description)
  - `pricing.comparison.tourist.description` (SEO description)
  - `pricing.comparison.cta` ("Elegir plan" / "Choose plan" / "Escolher plano")
  - Group header labels: `billing.comparison.group.owner`, `.accommodation`,
    `.complex`, `.tourist`, `.ai`, `.limits`
- **T-282-03**: Add `LIMIT_METADATA` and `LimitKey` to the `@repo/billing`
  package public exports (verify it's exported from the barrel index)

### WS-2 — Comparison table component

- **T-282-04**: Create `apps/web/src/components/billing/PlanComparisonTable.astro`
  with the structure described in §5.2. Includes:
  - Entitlement-to-group mapping helper (derived from `EntitlementKey` enum
    order)
  - Audience-based group visibility filter
  - Scoped `<style>` block using CSS custom properties (no hardcoded values)
  - Responsive: sticky first column, horizontal scroll on mobile
  - `CheckIcon` and `MinusIcon` from `@repo/icons` for cell indicators
  - `aria-label` on icon cells for screen readers
- **T-282-05**: Write tests for `PlanComparisonTable.astro`:
  - Read-source test asserting the component renders entitlement names via
    `getEntitlementName` and limit names via `getLimitName`
  - Assert `CheckIcon` / `MinusIcon` usage
  - Assert `scope="col"`, `scope="row"`, `scope="rowgroup"` attributes
  - Assert responsive classes (`sticky`, `overflow-x`) are present

### WS-3 — Pages + navigation links

- **T-282-06**: Create
  `apps/web/src/pages/[lang]/suscriptores/planes/comparar/index.astro`:
  - SSR (`prerender = false`), `Cache-Control` header
  - Fetches `owner` + `complex` plans
  - `MarketingLayout` + `MarketingHero` + `PlanComparisonTable`
  - SEO: `SEOHead` with comparison-specific title/description
  - CTA section linking back to `/suscriptores/planes/`
- **T-282-07**: Create
  `apps/web/src/pages/[lang]/suscriptores/turistas/comparar/index.astro`:
  - Same structure as T-282-06 but for `tourist` plans
  - CTA section linking back to `/suscriptores/turistas/`
- **T-282-08**: Add "Ver comparativa detallada" link to both existing pricing
  pages (`suscriptores/planes/index.astro` and `suscriptores/turistas/index.astro`),
  below the `PricingCardsGrid` section, using `GradientButton` or text+icon link
  with `buildUrl()` for the locale-aware URL

### WS-4 — Tests + verification

- **T-282-09**: Write page-level tests (read-source) for both comparison pages:
  - Assert `prerender = false`
  - Assert `Cache-Control` header is set
  - Assert `PlanComparisonTable` is rendered with correct `audience` prop
  - Assert `MarketingHero` is used
  - Assert CTA link points to the correct pricing card page
- **T-282-10**: Write test for `billing-i18n.ts` `getLimitName()`:
  - Returns i18n value when key exists
  - Falls back to `LIMIT_METADATA` name when no translation
  - Falls back to humanized key when metadata missing
- **T-282-11**: Run `pnpm typecheck`, `pnpm lint`, `pnpm test` — all green

## 7. Testing strategy

| Layer | Approach | Files |
|---|---|---|
| `billing-i18n.ts` | Unit test, direct import | `test/lib/billing-i18n.test.ts` |
| `PlanComparisonTable.astro` | Read-source assertions (Astro can't render in Vitest) | `test/components/billing/PlanComparisonTable.test.ts` |
| Comparison pages | Read-source assertions | `test/pages/suscriptores/comparar.test.ts` |
| Pricing page links | Read-source assertions (verify link text + href) | `test/pages/suscriptores/pricing-links.test.ts` |

No E2E tests needed for this spec — the pages are read-only SSR with no
interactive state. The existing pricing E2E flow (if any) is unaffected.

## 8. Dependencies

- **Depends on**: None (all data sources, i18n keys, and components already exist)
- **Relates to**: SPEC-168 (pricing pages), SPEC-145 (entitlements/limits catalog)
- **Blocks**: Nothing

## 9. Risks

| Risk | Mitigation |
|---|---|
| Table is too wide on mobile with 4+ plan columns | Horizontal scroll with sticky first column; tested at 375px viewport |
| Entitlement list is long (48 keys) and feels overwhelming | Group by category with group header rows; users can scan group headers first |
| i18n keys for limit names use `.title` suffix (from limit-reached panels) — might sound wrong in a table context | The `.title` keys are short labels like "Favorites", "Photos per accommodation" — they work as row labels. If a key sounds wrong, add a `billing.limit.<key>.short` variant, but start with `.title` |
| Plans fetched at runtime could be empty (API down) | Same graceful degradation as existing pricing pages: render an empty state with a link to contact |
| Complex plans appear in owner comparison — user might not know what "complex" means | Add a small badge/tooltip on complex plan columns ("Complejo / Multi-propiedad") via i18n |
