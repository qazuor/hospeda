/**
 * @file app-tokens-contrast.test.ts
 * @description HOS-2454 (HOS-2413 T-001) — the Mi Cuenta app tokens: WCAG AA
 * contrast in light and dark, the generated CSS for the new names, and the
 * radius / control-height / typography scales.
 *
 * Pairs checked (AA: 4.5:1 text, 3:1 non-text):
 *   - `status-*-fg` on `status-*-bg` (text);
 *   - `status-*-solid` on `core-card` (non-text);
 *   - `focus-ring` on `core-card`, `muted` and `popover` (non-text);
 *   - `brand-primary-link` on `core-card` (text).
 *
 * The ratio math is the same 8-bit-quantised WCAG pipeline as the sibling
 * contrast tests (`account-button-contrast.test.ts`, …); the helpers are
 * copied on purpose so no guard can be weakened by a change aimed at another.
 * The only addition is `resolve()`, which follows `var(--x)` aliases so a
 * token declared as an alias is measured on the color it really paints.
 *
 * @module tokens/app-tokens-contrast
 */

import { clampChroma, converter } from 'culori';
import { describe, expect, it } from 'vitest';
import { buildCSS } from '../generators/generate-css.js';
import type { Theme, ThemeValue } from '../themes/types.js';
import { webDark } from '../themes/web-dark.js';
import { webLight } from '../themes/web-light.js';
import type { OKLCH } from './colors.js';
import { controlHeight } from './layout.js';
import { radiusApp, radiusSemantic } from './radius.js';
import { APP_TYPOGRAPHY_FLOOR_PX, appTypography, pxToRem } from './typography.js';

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

const toRgb = converter('rgb');
const THEMES: ReadonlyArray<readonly [string, Theme]> = [
    ['light', webLight],
    ['dark', { ...webLight, ...webDark }]
];

const ALIAS = /^var\(--([a-z0-9-]+)\)$/;

function resolve(theme: Theme, token: string, depth = 0): OKLCH {
    const value: ThemeValue | undefined = theme[token];
    if (typeof value === 'string') {
        const alias = ALIAS.exec(value);
        if (alias?.[1] && depth < 5) return resolve(theme, alias[1], depth + 1);
    }
    if (typeof value !== 'object' || value === null) {
        throw new Error(`--${token} must resolve to an OKLCH triple, got ${JSON.stringify(value)}`);
    }
    return value as OKLCH;
}

function luminance(value: OKLCH): number {
    const mapped = clampChroma(
        { mode: 'oklch', l: value.l, c: value.c, h: value.h },
        'oklch',
        'rgb'
    );
    const rgb = toRgb(mapped);
    const lin = (channel: number | undefined) => {
        const q = Math.round(Math.max(0, Math.min(1, channel ?? 0)) * 255) / 255;
        return q <= 0.03928 ? q / 12.92 : ((q + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(rgb?.r) + 0.7152 * lin(rgb?.g) + 0.0722 * lin(rgb?.b);
}

function ratio(theme: Theme, a: string, b: string): number {
    const la = luminance(resolve(theme, a));
    const lb = luminance(resolve(theme, b));
    const [hi, lo] = la > lb ? [la, lb] : [lb, la];
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

const STATUS_ROLES = ['success', 'warning', 'danger', 'info', 'neutral'] as const;

/** Every token name T-001 adds, for the generated-CSS snapshot. */
const T001_NAMES: readonly string[] = [
    ...STATUS_ROLES.flatMap((role) =>
        ['bg', 'fg', 'border', 'solid'].map((part) => `status-${role}-${part}`)
    ),
    'focus-ring',
    'radius-control',
    'radius-surface',
    'control-h-sm',
    'control-h-md',
    'control-h-lg',
    ...Object.keys(webLight).filter((key) => key.startsWith('app-'))
];

function declarationsIn(block: string, names: readonly string[]): string[] {
    return block
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => names.some((name) => line.startsWith(`--${name}:`)));
}

function cssBlock(css: string, selector: string): string {
    const start = css.indexOf(`${selector} {`);
    const end = css.indexOf('\n}', start);
    return css.slice(start, end);
}

describe('HOS-2454 · app tokens — AA contrast', () => {
    describe.each(THEMES)('%s theme', (_name, theme) => {
        it.each(STATUS_ROLES)('status-%s-fg on status-%s-bg clears 4.5:1', (role) => {
            expect(ratio(theme, `status-${role}-fg`, `status-${role}-bg`)).toBeGreaterThanOrEqual(
                AA_TEXT
            );
        });

        it.each(STATUS_ROLES)('status-%s-solid on core-card clears 3:1', (role) => {
            expect(ratio(theme, `status-${role}-solid`, 'core-card')).toBeGreaterThanOrEqual(
                AA_NON_TEXT
            );
        });

        it.each(['core-card', 'muted', 'popover'])('focus-ring on %s clears 3:1', (surface) => {
            expect(ratio(theme, 'focus-ring', surface)).toBeGreaterThanOrEqual(AA_NON_TEXT);
        });

        it('brand-primary-link on core-card clears 4.5:1 (pinned)', () => {
            expect(ratio(theme, 'brand-primary-link', 'core-card')).toBeGreaterThanOrEqual(AA_TEXT);
        });
    });

    it('focus-ring is the AA link blue in both themes', () => {
        expect(webLight['focus-ring']).toBe('var(--brand-primary-link)');
        expect(webDark['focus-ring']).toBe('var(--brand-primary-link)');
    });
});

describe('HOS-2454 · app tokens — scales', () => {
    it('keeps the three app radii and leaves the public-site card radius alone', () => {
        expect(radiusApp).toEqual({ control: '8px', surface: '12px' });
        expect(webLight['radius-pill']).toBe(radiusSemantic.pill);
        expect(webLight['radius-card']).toBe('24px');
    });

    it('declares the control heights 36 / 40 / 44', () => {
        expect(controlHeight).toEqual({ sm: '36px', md: '40px', lg: '44px' });
        expect(webLight['control-h-lg']).toBe('44px');
    });

    it.each(Object.entries(appTypography))('app-%s respects the 12px floor', (_name, role) => {
        expect(role.sizePx).toBeGreaterThanOrEqual(APP_TYPOGRAPHY_FLOOR_PX);
        expect(role.leadingPx).toBeGreaterThan(role.sizePx);
    });

    it.each(
        Object.entries(appTypography).filter(([, role]) => role.sizeToken !== null)
    )('app-%s maps onto an existing font token with the same size', (name, role) => {
        expect(webLight[role.sizeToken as string]).toBe(pxToRem({ px: role.sizePx }));
        expect(webLight[`app-${name}-size`]).toBe(`var(--${role.sizeToken})`);
    });

    it('emits a font shorthand per alias over the existing family tokens', () => {
        expect(webLight['app-title']).toBe('700 1.75rem/2.125rem var(--font-heading)');
        expect(webLight['app-body']).toBe('400 var(--text-body)/1.5rem var(--font-sans)');
        expect(webLight['app-caption-tracking']).toBe('0.02em');
    });
});

describe('HOS-2454 · app tokens — generated CSS', () => {
    const css = buildCSS();

    it('emits every T-001 name in the light :root block', () => {
        expect(declarationsIn(cssBlock(css, ':root'), T001_NAMES)).toMatchSnapshot();
    });

    it('emits the dark overrides for the color tokens', () => {
        const dark = cssBlock(css, '[data-theme="dark"]:not([data-app="admin"])');
        expect(declarationsIn(dark, T001_NAMES)).toMatchSnapshot();
    });
});
