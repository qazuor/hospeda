/**
 * @file account-kit-contrast.test.ts
 * @description HOS-2413 T-002 — the Mi Cuenta kit token delta: the D4 «color
 * de acción» owner decision pinned, the AA pairs the kit relies on, the
 * account layout constants, and the generated CSS for the new names.
 *
 * D4 «color de acción» (owner comment on HOS-2409, 2026-11-20, binding):
 * `action-primary` is EXACTLY `brand-primary` and `action-accent` is EXACTLY
 * `brand-accent`, in both themes, with white text on both. That misses WCAG AA
 * and no darker action token is added. The ratios below are COMPUTED from
 * the repo's theme values, not quoted: the catalog quoted 3.56 / 2.93 (blue)
 * and 2.82 / 2.62 (orange); the owner's comment quoted 3.56 (blue) and 2.7
 * (orange) in light. The computed values match the catalog's.
 *
 * The test fails if an alias drifts or a ratio drops below its pin, so a
 * palette change forces someone to revisit the decision instead of silently
 * worsening it. A ratio that RISES passes; lower the pin's slack only on
 * purpose.
 *
 * The ratio math is the same 8-bit-quantised WCAG pipeline as the sibling
 * contrast tests; the helpers are copied on purpose (see
 * `account-button-contrast.test.ts`).
 *
 * @module tokens/account-kit-contrast
 */

import { clampChroma, converter } from 'culori';
import { describe, expect, it } from 'vitest';
import { buildCSS } from '../generators/generate-css.js';
import * as publicApi from '../index.js';
import type { Theme, ThemeValue } from '../themes/types.js';
import { webDark } from '../themes/web-dark.js';
import { webLight } from '../themes/web-light.js';
import type { OKLCH } from './colors.js';
import { ACCOUNT_BREAKPOINTS_REM, CQ_EDITOR_NAV_REM, layoutAccount } from './layout.js';

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

const toRgb = converter('rgb');
const DARK: Theme = { ...webLight, ...webDark };
const THEMES: ReadonlyArray<readonly ['light' | 'dark', Theme]> = [
    ['light', webLight],
    ['dark', DARK]
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

/**
 * D4 «color de acción»: the measured white-text ratios the owner accepted
 * (HOS-2409, owner comment 2026-11-20). Below AA ON PURPOSE; not a failure.
 */
const OWNER_ACCEPTED_D4 = {
    light: { primary: 3.56, accent: 2.82 },
    dark: { primary: 2.93, accent: 2.62 }
} as const;

describe('T-002 · D4 «color de acción» (owner decision, pinned)', () => {
    it.each(THEMES)('action-* are exact brand aliases in %s', (_name, theme) => {
        expect(theme['action-primary']).toBe('var(--brand-primary)');
        expect(theme['action-accent']).toBe('var(--brand-accent)');
        expect(resolve(theme, 'action-primary')).toEqual(resolve(theme, 'brand-primary'));
        expect(resolve(theme, 'action-accent')).toEqual(resolve(theme, 'brand-accent'));
    });

    it.each(THEMES)('on-action-primary and on-action-accent are white in %s', (_name, theme) => {
        expect(resolve(theme, 'on-action-primary')).toEqual({ l: 1, c: 0, h: 0 });
        expect(resolve(theme, 'on-action-accent')).toEqual({ l: 1, c: 0, h: 0 });
    });

    it.each(THEMES)('white on the action colors stays at or above its pin in %s', (name, theme) => {
        const pin = OWNER_ACCEPTED_D4[name];
        expect(ratio(theme, 'on-action-primary', 'action-primary')).toBeGreaterThanOrEqual(
            pin.primary
        );
        expect(ratio(theme, 'on-action-accent', 'action-accent')).toBeGreaterThanOrEqual(
            pin.accent
        );
    });

    it('premise: the accepted pairs really are below AA (the pin is a decision, not a pass)', () => {
        for (const [, theme] of THEMES) {
            expect(ratio(theme, 'on-action-primary', 'action-primary')).toBeLessThan(AA_TEXT);
            expect(ratio(theme, 'on-action-accent', 'action-accent')).toBeLessThan(AA_TEXT);
        }
    });
});

describe('T-002 · kit pairs clear AA', () => {
    describe.each(THEMES)('%s theme', (_name, theme) => {
        it.each([
            ['brand-primary-link', 'core-card'],
            ['core-foreground', 'control-bg'],
            ['core-foreground', 'core-card'],
            ['brand-primary-link', 'core-background'],
            ['core-muted-foreground', 'core-card'],
            ['on-action-danger', 'action-danger'],
            ['upsell-fg', 'upsell-bg'],
            ['nav-active-fg', 'nav-active-bg']
        ])('text: %s on %s >= 4.5:1', (fg, bg) => {
            expect(ratio(theme, fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
        });

        it.each([
            ['control-border', 'core-card'],
            ['control-border', 'control-bg'],
            ['focus-ring', 'core-card'],
            ['focus-ring', 'muted'],
            ['focus-ring', 'popover']
        ])('non-text: %s on %s >= 3:1', (fg, bg) => {
            expect(ratio(theme, fg, bg)).toBeGreaterThanOrEqual(AA_NON_TEXT);
        });
    });
});

describe('T-002 · account layout constants', () => {
    it('closes the breakpoint list at 30 / 48 / 64 / 80 rem', () => {
        expect(ACCOUNT_BREAKPOINTS_REM).toEqual([30, 48, 64, 80]);
        expect(CQ_EDITOR_NAV_REM).toBe(60);
    });

    it('exports the breakpoint constants from the package entry', () => {
        expect(publicApi.ACCOUNT_BREAKPOINTS_REM).toBe(ACCOUNT_BREAKPOINTS_REM);
        expect(publicApi.CQ_EDITOR_NAV_REM).toBe(CQ_EDITOR_NAV_REM);
        expect(publicApi.layoutAccount).toBe(layoutAccount);
    });

    it('declares the template widths as theme tokens', () => {
        expect(webLight['sidebar-w']).toBe('240px');
        expect(webLight['editor-nav-w']).toBe('224px');
        expect(webLight['form-max']).toBe('720px');
        expect(webLight['reading-max']).toBe('640px');
    });
});

/** Every token name T-002 adds, for the generated-CSS snapshot. */
const T002_NAMES: readonly string[] = [
    'action-primary',
    'action-primary-hover',
    'on-action-primary',
    'action-accent',
    'action-accent-hover',
    'on-action-accent',
    'action-danger',
    'on-action-danger',
    'control-bg',
    'control-border',
    'nav-active-bg',
    'nav-active-fg',
    'upsell-bg',
    'upsell-fg',
    'upsell-border',
    'shadow-sticky',
    ...Object.keys(layoutAccount)
];

function declarationsIn(css: string, selector: string): string[] {
    const start = css.indexOf(`${selector} {`);
    const block = css.slice(start, css.indexOf('\n}', start));
    return block
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => T002_NAMES.some((name) => line.startsWith(`--${name}:`)));
}

describe('T-002 · generated CSS', () => {
    const css = buildCSS();

    it('emits the kit delta in the light :root block', () => {
        expect(declarationsIn(css, ':root')).toMatchSnapshot();
    });

    it('emits the kit delta dark overrides', () => {
        expect(
            declarationsIn(css, '[data-theme="dark"]:not([data-app="admin"])')
        ).toMatchSnapshot();
    });
});
