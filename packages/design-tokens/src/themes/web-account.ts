/**
 * @file themes/web-account.ts
 * @description Mi Cuenta app tokens, spread into `web-light.ts` and
 * `web-dark.ts` (HOS-2413 PR-1).
 *
 * Two layers, kept in one module so the light and dark values of each token
 * sit side by side and the two theme files stay under the 500-line limit:
 *
 *   - **T-001 · HOS-2454 in full**: role status colors
 *     `status-{success,warning,danger,info,neutral}-{bg,fg,border,solid}`,
 *     `focus-ring`, the app radius scale, control heights and the app
 *     typography aliases.
 *   - **T-002 · the kit delta**: action tokens, control and navigation
 *     tokens, upsell tokens, `shadow-sticky` and the account layout widths.
 *
 * Values are the approved component catalog's (v5, owner 2026-11-20).
 * Nothing outside `apps/web/src/components/account/ui/` consumes them in this
 * phase.
 *
 * D4 «color de acción» (owner, 2026-11-20, binding): `action-primary` and
 * `action-accent` are EXACT aliases of `brand-primary` and `brand-accent`,
 * and their `on-*` text is white. That pair misses WCAG AA; the measured
 * ratios are pinned as an owner decision in
 * `tokens/account-kit-contrast.test.ts` (`OWNER_ACCEPTED_D4`).
 *
 * Aliases are declared in BOTH themes on purpose: a custom property inherits
 * its computed value, so a `var()` alias declared only on `:root` would keep
 * the light value under a dark scope set on a descendant element.
 */

import type { OKLCH } from '../tokens/colors.js';
import { controlHeight, layoutAccount } from '../tokens/layout.js';
import { radiusApp } from '../tokens/radius.js';
import { appTypography, pxToRem } from '../tokens/typography.js';
import type { Theme } from './types.js';

/** Hand-tuned OKLCH (same helper as the theme files). */
const oklchValue = (l: number, c: number, h: number): OKLCH => ({ l, c, h });

/** Pure white, the D4 `on-action-*` text color. */
const WHITE = oklchValue(1, 0, 0);

/**
 * Theme-invariant app tokens: radius scale, control heights, layout widths
 * and typography aliases. Declared only in light; dark inherits them.
 */
function buildInvariantTokens(): Theme {
    const typography: Record<string, string> = {};
    for (const [name, role] of Object.entries(appTypography)) {
        const size = role.sizeToken ? `var(--${role.sizeToken})` : pxToRem({ px: role.sizePx });
        const leading = pxToRem({ px: role.leadingPx });
        typography[`app-${name}`] = `${role.weight} ${size}/${leading} var(--${role.family})`;
        typography[`app-${name}-size`] = size;
        typography[`app-${name}-leading`] = leading;
        typography[`app-${name}-weight`] = String(role.weight);
        if ('tracking' in role) typography[`app-${name}-tracking`] = role.tracking;
    }
    return {
        'radius-control': radiusApp.control,
        'radius-surface': radiusApp.surface,
        'control-h-sm': controlHeight.sm,
        'control-h-md': controlHeight.md,
        'control-h-lg': controlHeight.lg,
        ...layoutAccount,
        ...typography
    };
}

/** Light values of the Mi Cuenta app tokens (merged into `webLight`). */
export const webAccountLight: Theme = {
    // ---- T-001 · role status colors (HOS-2454) ----------------------------
    'status-success-bg': oklchValue(0.96, 0.04, 150),
    'status-success-fg': oklchValue(0.43, 0.12, 150),
    'status-success-border': oklchValue(0.8, 0.09, 150),
    'status-success-solid': oklchValue(0.55, 0.15, 150),
    'status-warning-bg': oklchValue(0.97, 0.05, 85),
    'status-warning-fg': oklchValue(0.46, 0.1, 65),
    'status-warning-border': oklchValue(0.82, 0.11, 80),
    'status-warning-solid': oklchValue(0.62, 0.15, 65),
    'status-danger-bg': oklchValue(0.96, 0.03, 27),
    'status-danger-fg': oklchValue(0.5, 0.2, 27),
    'status-danger-border': oklchValue(0.82, 0.09, 27),
    'status-danger-solid': oklchValue(0.577, 0.245, 27.3),
    'status-info-bg': oklchValue(0.96, 0.03, 259),
    'status-info-fg': oklchValue(0.5, 0.18, 259),
    'status-info-border': oklchValue(0.82, 0.08, 259),
    'status-info-solid': oklchValue(0.6, 0.19, 259),
    'status-neutral-bg': oklchValue(0.955, 0.008, 240),
    'status-neutral-fg': oklchValue(0.42, 0.03, 255),
    'status-neutral-border': oklchValue(0.84, 0.015, 240),
    'status-neutral-solid': oklchValue(0.55, 0.03, 255),

    // ---- T-001 · focus ring: the AA link blue (HOS-2454) -------------------
    'focus-ring': 'var(--brand-primary-link)',

    // ---- T-002 · action tokens (D4: exact brand aliases, white text) -------
    'action-primary': 'var(--brand-primary)',
    // The catalog keeps the hover on the brand fill too; the kit signals
    // hover by other means than a darker action color (D4: no darker token).
    'action-primary-hover': 'var(--brand-primary)',
    'on-action-primary': WHITE,
    'action-accent': 'var(--brand-accent)',
    'action-accent-hover': oklchValue(0.66, 0.18, 55),
    'on-action-accent': WHITE,
    'action-danger': oklchValue(0.577, 0.245, 27.325),
    'on-action-danger': oklchValue(0.98, 0, 0),

    // ---- T-002 · control and navigation -----------------------------------
    'control-bg': oklchValue(1, 0, 0),
    'control-border': oklchValue(0.6, 0.02, 250),
    'nav-active-bg': oklchValue(0.95, 0.03, 259),
    'nav-active-fg': oklchValue(0.5, 0.18, 259),

    // ---- T-002 · upsell ----------------------------------------------------
    'upsell-bg': oklchValue(0.97, 0.03, 60),
    'upsell-fg': oklchValue(0.5, 0.15, 50),
    'upsell-border': oklchValue(0.85, 0.08, 60),

    // ---- T-002 · sticky elevation (same foreground-tinted recipe as
    // `shadow-overlay` in light) ---------------------------------------------
    'shadow-sticky':
        '0 -4px 16px -6px oklch(from var(--core-foreground) l c h / 0.16), 0 1px 2px oklch(from var(--core-foreground) l c h / 0.08)',

    ...buildInvariantTokens()
};

/** Dark overrides of the Mi Cuenta app tokens (merged into `webDark`). */
export const webAccountDark: Theme = {
    'status-success-bg': oklchValue(0.31, 0.06, 150),
    'status-success-fg': oklchValue(0.84, 0.13, 150),
    'status-success-border': oklchValue(0.5, 0.1, 150),
    'status-success-solid': oklchValue(0.74, 0.16, 150),
    'status-warning-bg': oklchValue(0.32, 0.06, 80),
    'status-warning-fg': oklchValue(0.87, 0.13, 85),
    'status-warning-border': oklchValue(0.52, 0.1, 80),
    'status-warning-solid': oklchValue(0.8, 0.16, 85),
    'status-danger-bg': oklchValue(0.31, 0.08, 27),
    'status-danger-fg': oklchValue(0.82, 0.11, 27),
    'status-danger-border': oklchValue(0.52, 0.14, 27),
    'status-danger-solid': oklchValue(0.72, 0.19, 27),
    'status-info-bg': oklchValue(0.32, 0.07, 259),
    'status-info-fg': oklchValue(0.84, 0.09, 259),
    'status-info-border': oklchValue(0.52, 0.12, 259),
    'status-info-solid': oklchValue(0.74, 0.14, 259),
    'status-neutral-bg': oklchValue(0.33, 0.03, 258),
    'status-neutral-fg': oklchValue(0.86, 0.02, 250),
    'status-neutral-border': oklchValue(0.48, 0.03, 258),
    'status-neutral-solid': oklchValue(0.7, 0.02, 250),

    'focus-ring': 'var(--brand-primary-link)',

    'action-primary': 'var(--brand-primary)',
    'action-primary-hover': 'var(--brand-primary)',
    'on-action-primary': WHITE,
    'action-accent': 'var(--brand-accent)',
    'action-accent-hover': oklchValue(0.77, 0.18, 55),
    'on-action-accent': WHITE,
    'action-danger': oklchValue(0.55, 0.2, 27),
    'on-action-danger': oklchValue(0.98, 0, 0),

    'control-bg': oklchValue(0.235, 0.038, 258),
    'control-border': oklchValue(0.6, 0.03, 258),
    'nav-active-bg': oklchValue(0.33, 0.07, 259),
    'nav-active-fg': oklchValue(0.84, 0.09, 259),

    'upsell-bg': oklchValue(0.31, 0.05, 55),
    'upsell-fg': oklchValue(0.8, 0.14, 60),
    'upsell-border': oklchValue(0.48, 0.09, 55),

    'shadow-sticky': '0 -6px 20px -6px oklch(0 0 0 / 0.6), inset 0 1px 0 oklch(1 0 0 / 0.08)'
};
