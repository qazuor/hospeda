---
audit: visual-identity
status: complete
date: 2026-05-21
agent: Explore
---

# 04 — Visual identity (admin vs web)

## 1. Token sources

| App | Token source | Strategy |
|-----|--------------|----------|
| **admin** (TanStack + Tailwind v4 + shadcn) | `apps/admin/src/styles.css` (shadcn defaults) + `packages/tailwind-config/shared-styles.css` (only 3 brand hex values) | Minimal shared layer; shadcn drives everything |
| **web** (Astro + vanilla CSS / CSS Modules) | `apps/web/src/styles/global.css` + `apps/web/src/lib/colors.ts` (semantic enum → color mapping) + `apps/web/src/styles/css-var-themes.css` (data-attribute themes) | Comprehensive custom oklch token system |

The admin and web **do NOT share design tokens today**. Only 3 hex values are shared and they are not used in meaningful places. They are effectively two independent visual systems.

## 2. Palette comparison

### Admin (generic, utility-focused)
- Primary: `oklch(0.21 0.006 285.885)` — desaturated dark slate
- Secondary: `oklch(0.15 0.02 258.975)`
- Destructive: `oklch(0.5 0.245 27.325)` — warm red
- Dark mode via `.dark` class — primary becomes `oklch(0.985 0 0)` (near-white)
- Grayscale with precise luminance steps
- **Zero brand personality** — generic shadcn out-of-the-box

### Web (warm, premium, brand-specific)
- Primary (brand-primary): `oklch(0.63 0.19 259)` — saturated blue
- Accent (brand-accent): `oklch(0.7 0.18 55)` — warm orange/honey
- Hospeda brand colors:
  - sky: `oklch(0.8 0.08 259)`
  - river: `oklch(0.63 0.19 259)`
  - forest: `oklch(0.5 0.14 155)`
  - sand: `oklch(0.7 0.12 75)`
- Dark mode via `[data-theme="dark"]` attribute, computed inversions preserving hue relationships
- Semantic category colors (tourism teal, gastronomy forest, wellness river) mapped to specific entity types
- Designed for tourism/hospitality mood — earthy, natural

### Concrete mismatch
- Admin primary ≈ `#362e5c` (desaturated, cold).
- Web primary ≈ `#7f9cde` (saturated, warm).
- Cannot coexist in the same interface without cognitive dissonance.

## 3. Typography

### Admin
- System font stack only: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- No custom fonts, no semantic font roles
- Headings differ from body only in weight (implicit)
- **Zero personality**

### Web (3-font system with semantic roles)
- `--font-sans: "Roboto"` — body and UI
- `--font-heading: "Geologica"` — display and section headers (geometric, contemporary)
- `--font-decorative: "Caveat"` — accent and brand moments (handwritten, playful)
- Decorative font used in headings, testimonials, marketing copy

**Major gap:** the admin has no equivalent decorative or heading-specific typography. The web feels premium and curated; the admin feels system-level and generic.

## 4. Spacing scale

### Admin
- Implicit Tailwind utilities (`px-4`, `py-8`, `space-y-6`)
- Default Tailwind scale (0.25rem increments)
- No custom spacing tokens

### Web
- Explicit CSS custom properties with responsive `clamp()`
  - `--space-section: clamp(3rem, 8vw, 7.5rem)` — responsive section gutters
  - `--space-1` … `--space-12` — discrete scale (0.5rem → 4rem)
  - `--gap-lg: var(--space-6)` — semantic gap values
- Radius differs: `--radius: 0.75rem` (web) vs `--radius: 0.625rem` (admin) — a 0.125rem mismatch that compounds across surfaces

## 5. Component-level divergences

| Component | Admin | Web |
|-----------|-------|-----|
| **Button** | shadcn Button + Tailwind utilities. Sharp affordances. | BEM-scoped styles. Softer curves, tourism-appropriate. |
| **Card** | shadcn border `hsl(var(--muted-foreground) / 0.2)`, neutral muted background | Custom `--shadow-*` tokens, data-attribute-driven category colors (music → brand-accent, gastronomy → hospeda-forest) |
| **Sidebar nav** | Explicit `--sidebar-background` tokens | No sidebar (web is marketing site). Would clash with warm palette if added. |

## 6. Brand "feel"

- **Admin**: feels like a generic SaaS tool. Shadcn neutral aesthetic unchanged. Functional colors, not memorable. Indistinguishable from dozens of other dashboards.
- **Web**: feels premium, intentional, place-specific. Warm palette evokes Argentine hospitality. 3-font system signals curation. Category colors create semantic, memorable associations. Brand feels owned and opinionated.

**Emotional disconnect:** a user moving web → admin feels they've left the Hospeda brand entirely and landed in a generic dashboard.

## 7. The honest gap (5 bullets)

1. **No shared semantic color language** — admin primary/secondary/destructive don't align with web brand-primary/accent. Two separate visual languages, no bridge.
2. **Typography mismatch** — web's 3-font system has no admin equivalent. Admin users never see the brand voice.
3. **Spacing/radius divergence** — admin 0.625rem vs web 0.75rem radius; Tailwind utilities vs CSS clamp(). Cannot align without manual conversion.
4. **Color philosophy misalignment** — admin treats color as function (primary/destructive); web treats color as narrative (forest = nature, river = wellness, sand = craft).
5. **Dark mode implementation differs** — admin `.dark` class vs web `[data-theme="dark"]`. Independent; cannot share token values.

## Recommendation (high level — defer to discussion)

Consolidate ALL design tokens into a single source (`packages/tailwind-config` extended OR new `packages/design-tokens`). Admin imports via Tailwind theme config; web imports as CSS custom properties. **Same hex/oklch, same fonts, same spacing scale, same radius, same dark mode strategy.** Tooling stays as-is per project policy (admin Tailwind, web vanilla CSS). Adopt the web palette + typography as canon — it's the brand-aware system; the admin is currently brand-less.
