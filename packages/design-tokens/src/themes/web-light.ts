/**
 * @file themes/web-light.ts
 * @description Web light theme mapping for SPEC-153.
 *
 * The full set of CSS custom properties web's `:root` declares in
 * `apps/web/src/styles/global.css`. Every entry is byte-for-byte
 * equivalent to the corresponding line in the Phase 0 seed manifest so
 * the @import drop-in during Phase 2 produces a 0-pixel diff.
 *
 * Values come from three places:
 *
 *   1. Palette / token references (`river[500]`, `radiusBase`, etc.)
 *      where the canonical primitive matches the web value exactly.
 *      These give us refactor safety — change the canonical and the
 *      theme follows.
 *
 *   2. Pre-built structured constants from the token modules
 *      (`shadowSemantic.card`, `webDuration.fast`, etc.) for the
 *      composite values web already encodes as named primitives.
 *
 *   3. Raw OKLCH triples / strings for the "hand-tuned" values that
 *      don't fit a single palette (e.g. `core-foreground` =
 *      `oklch(0.2 0.02 220)` is a low-chroma blueish-grey that doesn't
 *      match either the neutral or river palette canonicals).
 *
 * Re-mapping decisions are documented inline with `// → seed` comments
 * noting which web CSS var the entry corresponds to.
 *
 * NOTE: Web's `:root` is the default theme — the CSS generator emits
 * these declarations directly inside `:root { ... }`. Dark overrides
 * live in `web-dark.ts`.
 */

import { accommodationTypeTokens } from '../tokens/accommodation-types.js';
import { authProviderTokens } from '../tokens/auth-providers.js';
import {
    type OKLCH,
    accent,
    avatarGradients,
    brandSecondary,
    brandSecondaryForeground,
    brandTertiary,
    chartColors,
    danger,
    forest,
    info,
    ratingStar,
    river,
    sand,
    sky,
    skyLight,
    success,
    surfaces,
    warning
} from '../tokens/colors.js';
import { eventCategoryTokens } from '../tokens/event-categories.js';
import { layoutChrome, layoutContainer } from '../tokens/layout.js';
import { webDuration, webEasing } from '../tokens/motion.js';
import { postCategoryTokens } from '../tokens/post-categories.js';
import { radiusBase, radiusOrganic, radiusScale, radiusSemantic } from '../tokens/radius.js';
import { shadowSemantic } from '../tokens/shadows.js';
import { semanticSpacing, spacing } from '../tokens/spacing.js';
import { fontFamily, semanticTypography } from '../tokens/typography.js';
import { userRoleTokens } from '../tokens/user-roles.js';
import { zIndex } from '../tokens/z-index.js';
import type { Theme } from './types.js';

/**
 * Helper: a hand-tuned OKLCH that isn't part of any palette. We still
 * type it as `OKLCH` (not `string`) so the generator formats it
 * uniformly and IEEE-754 noise is rounded the same way as palette refs.
 */
const oklchValue = (l: number, c: number, h: number): OKLCH => ({ l, c, h });

export const webLight: Theme = {
    // ========================================================================
    // Core palette — `:root` declarations from global.css lines 12–39
    // ========================================================================
    'core-background': oklchValue(0.985, 0.002, 210),
    'core-foreground': oklchValue(0.2, 0.02, 220),
    'core-card': oklchValue(1, 0, 0),
    'card-foreground': oklchValue(0.2, 0.02, 220),
    popover: oklchValue(1, 0, 0),
    'popover-foreground': oklchValue(0.2, 0.02, 220),

    'brand-primary': river[500],
    'primary-foreground': oklchValue(0.99, 0, 0),
    'brand-secondary': brandSecondary,
    'brand-secondary-foreground': brandSecondaryForeground,
    'brand-tertiary': brandTertiary,

    muted: oklchValue(0.95, 0.01, 210),
    'core-muted-foreground': oklchValue(0.45, 0.03, 261),

    'brand-accent': accent[500],
    'rating-star': ratingStar,
    'accent-foreground': oklchValue(0.99, 0, 0),

    destructive: danger[500],
    'destructive-foreground': oklchValue(0.98, 0, 0),

    overlay: 'oklch(0.2 0.02 220 / 0.5)',
    border: oklchValue(0.9, 0.02, 210),
    input: oklchValue(0.9, 0.02, 210),
    ring: river[500],

    'chart-1': chartColors[0] as OKLCH,
    'chart-2': chartColors[1] as OKLCH,
    'chart-3': chartColors[2] as OKLCH,
    'chart-4': chartColors[3] as OKLCH,
    'chart-5': chartColors[4] as OKLCH,

    radius: radiusBase,

    // ========================================================================
    // Feedback tokens — global.css lines 42–47
    // ========================================================================
    success: success[500],
    'success-foreground': oklchValue(0.99, 0, 0),
    warning: warning[500],
    'warning-foreground': oklchValue(0.2, 0.02, 85),
    info: info[500],
    'info-foreground': oklchValue(0.99, 0, 0),

    // ========================================================================
    // Surface tokens — global.css lines 50–56
    // ========================================================================
    'surface-warm': surfaces.warm,
    'surface-warm-foreground': surfaces.warmForeground,
    'surface-dark': surfaces.dark,
    'surface-dark-foreground': surfaces.darkForeground,
    'surface-elevated': surfaces.elevated,

    // ========================================================================
    // Footer surface tokens — global.css lines 59–67
    // (All reference / relative-color, kept as raw strings.)
    // ========================================================================
    'footer-bg': 'var(--surface-dark)',
    'footer-fg': 'var(--surface-dark-foreground)',
    'footer-fg-muted': oklchValue(0.74, 0.02, 240),
    'footer-newsletter-bg': 'white',
    'footer-newsletter-fg': 'var(--core-muted-foreground)',
    'footer-newsletter-border': 'transparent',
    'footer-link': 'oklch(from var(--surface-dark-foreground) l c h / 0.7)',
    'footer-link-hover': 'var(--surface-dark-foreground)',
    'footer-border': 'oklch(from var(--surface-dark-foreground) l c h / 0.15)',

    // ========================================================================
    // Hospeda brand colors — global.css lines 70–79
    // ========================================================================
    'hospeda-sky': sky[500],
    'hospeda-sky-light': skyLight,
    'hospeda-river': river[500],
    'hospeda-forest': forest[500],
    'hospeda-sand': sand[500],

    // ========================================================================
    // Social proof avatar gradient stops — global.css lines 82–89
    // ========================================================================
    'avatar-1-from': avatarGradients[1].from,
    'avatar-1-to': avatarGradients[1].to,
    'avatar-2-from': avatarGradients[2].from,
    'avatar-2-to': avatarGradients[2].to,
    'avatar-3-from': avatarGradients[3].from,
    'avatar-3-to': avatarGradients[3].to,
    'avatar-4-from': avatarGradients[4].from,
    'avatar-4-to': avatarGradients[4].to,

    // ========================================================================
    // Font families — global.css lines 92–95
    // ========================================================================
    'font-sans': fontFamily.sans,
    'font-heading': fontFamily.heading,
    'font-decorative': fontFamily.decorative,
    'font-mono': fontFamily.mono,

    // ========================================================================
    // Radius scale — global.css lines 98–101 (calc relative to --radius)
    // ========================================================================
    'radius-sm': radiusScale.sm,
    'radius-md': radiusScale.md,
    'radius-lg': radiusScale.lg,
    'radius-xl': radiusScale.xl,

    // ========================================================================
    // Organic / component radius — global.css lines 104–109
    // ========================================================================
    'radius-organic': radiusOrganic.base,
    'radius-organic-sm': radiusOrganic.sm,
    'radius-organic-alt': radiusOrganic.alt,
    'radius-card': radiusSemantic.card,
    'radius-pill': radiusSemantic.pill,
    'radius-button': radiusSemantic.button,

    // ========================================================================
    // Spacing — global.css lines 112–131
    // ========================================================================
    'space-section': semanticSpacing.section,
    'space-section-sm': semanticSpacing.sectionSm,
    'space-section-lg': semanticSpacing.sectionLg,
    'space-container-x': semanticSpacing.containerX,
    'space-card-content': semanticSpacing.cardContent,
    'space-card-gap': semanticSpacing.cardGap,
    'space-section-header-mb': semanticSpacing.sectionHeaderMb,

    'space-1': spacing[1],
    'space-2': spacing[2],
    'space-3': spacing[3],
    'space-4': spacing[4],
    'space-5': spacing[5],
    'space-6': spacing[6],
    'space-7': spacing[7],
    'space-8': spacing[8],
    'space-9': spacing[9],
    'space-10': spacing[10],
    'space-12': spacing[12],

    // ========================================================================
    // Typography scale — global.css lines 134–151
    // ========================================================================
    'text-hero': semanticTypography.hero,
    'text-display': semanticTypography.display,
    'text-h2': semanticTypography.h2,
    'text-h3': semanticTypography.h3,
    'text-h4': semanticTypography.h4,
    'text-body': semanticTypography.body,
    'text-body-sm': semanticTypography.bodySm,
    'text-body-xs': semanticTypography.bodyXs,
    'text-meta': semanticTypography.meta,
    'text-caption': semanticTypography.caption,
    'text-tagline': semanticTypography.tagline,
    'text-nav': semanticTypography.nav,
    'text-button': semanticTypography.button,
    'text-body-lg': semanticTypography.bodyLg,
    'text-lg': semanticTypography.lg,
    'text-xl': semanticTypography.xl,
    'text-sm': semanticTypography.sm,
    'text-h6': semanticTypography.h6,
    'text-body-md': semanticTypography.bodyMd,

    // ========================================================================
    // Shadows — global.css lines 154–157
    // ========================================================================
    'shadow-card': shadowSemantic.card,
    'shadow-card-hover': shadowSemantic.cardHover,
    'shadow-search': shadowSemantic.search,
    'shadow-nav': shadowSemantic.nav,

    // ========================================================================
    // Transitions — global.css lines 160–165
    // ========================================================================
    'duration-fast': webDuration.fast,
    'duration-normal': webDuration.normal,
    'duration-slow': webDuration.slow,
    'duration-reveal': webDuration.reveal,
    'ease-bounce': webEasing.bounce,
    'ease-reveal': webEasing.reveal,

    // ========================================================================
    // Z-index — global.css lines 168–177
    // ========================================================================
    'z-content': String(zIndex.content),
    'z-nav': String(zIndex.nav),
    'z-dropdown': String(zIndex.dropdown),
    'z-modal': String(zIndex.modal),
    'z-toast': String(zIndex.toast),
    'z-cookie-banner': String(zIndex.cookieBanner),
    'z-mobile-menu': String(zIndex.mobileMenu),

    // ========================================================================
    // Layout — global.css lines 180–191
    // ========================================================================
    'navbar-height': layoutChrome.navbarHeight,
    'wave-bar-compact': layoutChrome.waveBarCompact,
    'cookie-banner-height': layoutChrome.cookieBannerHeight,
    'bottom-safe-inset': layoutChrome.bottomSafeInset,

    // ========================================================================
    // Hover / state variants (relative-color expressions) — global.css lines 194–196
    // ========================================================================
    'primary-hover': 'oklch(from var(--brand-primary) calc(l - 0.05) c h)',
    'accent-hover': 'oklch(from var(--brand-accent) calc(l - 0.05) c h)',
    'brand-primary-dark': 'oklch(from var(--brand-primary) calc(l - 0.1) c h)',

    // ========================================================================
    // Overlays — global.css lines 203–205
    // ========================================================================
    'overlay-bg-strong': 'oklch(0 0 0 / 0.7)',
    'overlay-bg-light': 'oklch(0 0 0 / 0.45)',
    'overlay-blur': '4px',

    // ========================================================================
    // Frosted surfaces (relative-color expressions) — global.css lines 213–216
    // ========================================================================
    'frost-bg-light': 'oklch(from var(--core-card) l c h / 0.72)',
    'frost-bg-dark': 'oklch(from var(--core-foreground) l c h / 0.7)',
    'frost-blur': '14px',
    'frost-border': 'oklch(from var(--core-foreground) l c h / 0.08)',

    // ========================================================================
    // Container max-widths — global.css lines 219–220
    // The (min-width: 1600px) override that bumps container-max to 1500px
    // lives in `layoutMediaOverrides` and is emitted by the generator as
    // a separate @media block, NOT in this theme record.
    // ========================================================================
    'container-max': layoutContainer.max,
    'container-narrow': layoutContainer.narrow,

    // ========================================================================
    // Accommodation-type per-type tokens — layered color model.
    // Each `--accommodation-type-<type>` references its base palette's
    // shade-500 primitive (`--palette-<name>-500`). Declared once in
    // `tokens/accommodation-types.ts` and shared verbatim with admin-light so
    // a given type renders with the SAME hue in both apps. Theme-independent
    // (the palette primitives are not overridden in dark), so the dark themes
    // inherit these via the cascade.
    // ========================================================================
    ...accommodationTypeTokens,
    // Per-event-category tokens (same source constant as admin), each
    // referencing an existing base palette's shade-500 primitive so a category
    // renders with the SAME hue in both apps across light and dark.
    ...eventCategoryTokens,
    // Per-post-category tokens — same layered model as the event-category and
    // accommodation-type ones; declared once and shared with admin.
    ...postCategoryTokens,
    // Per-user-role tokens — same layered model; declared once and shared with admin.
    ...userRoleTokens,
    // Per-auth-provider tokens — same layered model; declared once and shared with admin.
    ...authProviderTokens
};
