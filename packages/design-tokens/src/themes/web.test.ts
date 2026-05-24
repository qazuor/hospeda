/**
 * @file themes/web.test.ts
 * @description Tests for the web light and dark theme mappings. These
 * are NOT generator round-trip tests (T-153-17 does that against the
 * full seed manifest). They cover:
 *
 *   - the right NUMBER of keys per theme (142 light + 56 dark),
 *   - a sample of values are correctly referenced from the underlying
 *     token modules (palette refs, semantic refs, raw strings),
 *   - the dark theme is a strict subset of light (no orphan overrides
 *     that wouldn't apply because the light default doesn't exist).
 */

import { describe, expect, it } from 'vitest';

import { formatOKLCH, river, success, surfaces } from '../tokens/colors.js';
import { webDark } from './web-dark.js';
import { webLight } from './web-light.js';

/**
 * Helper to serialize a theme value (OKLCH or string) the way the CSS
 * generator (T-153-16) will. Used here to assert byte-for-byte against
 * the seed manifest values.
 */
function serializeThemeValue(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null && 'l' in value) {
        return formatOKLCH(value as { l: number; c: number; h: number });
    }
    throw new Error(`Unexpected theme value: ${String(value)}`);
}

describe('webLight — coverage', () => {
    it('declares all 142 web :root tokens', () => {
        // 142 matches the Phase 0 extractor count for tokens.light in the
        // seed manifest. Adding or removing entries should be intentional.
        expect(Object.keys(webLight)).toHaveLength(142);
    });

    it('keys do not include leading `--` (generator prepends it)', () => {
        for (const key of Object.keys(webLight)) {
            expect(key.startsWith('--')).toBe(false);
        }
    });
});

describe('webLight — sample palette-ref entries match canonical values', () => {
    it.each([
        ['brand-primary', 'oklch(0.63 0.19 259)'], // river[500]
        ['hospeda-river', 'oklch(0.63 0.19 259)'], // river[500]
        ['hospeda-sky', 'oklch(0.8 0.08 259)'], // sky[500]
        ['hospeda-forest', 'oklch(0.5 0.14 155)'], // forest[500]
        ['hospeda-sand', 'oklch(0.7 0.12 75)'], // sand[500]
        ['brand-accent', 'oklch(0.7 0.18 55)'], // accent[500]
        ['ring', 'oklch(0.63 0.19 259)'], // river[500]
        ['destructive', 'oklch(0.577 0.245 27.325)'], // danger[500]
        ['success', 'oklch(0.58 0.15 150)'], // success[500]
        ['warning', 'oklch(0.75 0.18 85)'], // warning[500]
        ['info', 'oklch(0.63 0.19 259)'] // info[500]
    ])('%s = %s', (key, expected) => {
        expect(serializeThemeValue(webLight[key])).toBe(expected);
    });
});

describe('webLight — hand-tuned OKLCH entries match seed byte-for-byte', () => {
    it.each([
        ['core-background', 'oklch(0.985 0.002 210)'],
        ['core-foreground', 'oklch(0.2 0.02 220)'],
        ['border', 'oklch(0.9 0.02 210)'],
        ['muted', 'oklch(0.95 0.01 210)'],
        ['core-muted-foreground', 'oklch(0.45 0.03 261)'],
        ['primary-foreground', 'oklch(0.99 0 0)']
    ])('%s = %s', (key, expected) => {
        expect(serializeThemeValue(webLight[key])).toBe(expected);
    });
});

describe('webLight — raw-string entries match seed byte-for-byte', () => {
    it.each([
        ['overlay', 'oklch(0.2 0.02 220 / 0.5)'],
        ['footer-bg', 'var(--surface-dark)'],
        ['footer-link', 'oklch(from var(--surface-dark-foreground) l c h / 0.7)'],
        ['footer-newsletter-bg', 'white'],
        ['footer-newsletter-border', 'transparent'],
        ['primary-hover', 'oklch(from var(--brand-primary) calc(l - 0.05) c h)'],
        ['brand-primary-dark', 'oklch(from var(--brand-primary) calc(l - 0.1) c h)'],
        ['overlay-bg-strong', 'oklch(0 0 0 / 0.7)'],
        ['frost-bg-light', 'oklch(from var(--core-card) l c h / 0.72)'],
        ['frost-blur', '14px']
    ])('%s = %s', (key, expected) => {
        expect(webLight[key]).toBe(expected);
    });
});

describe('webLight — structured-token refs preserve identity', () => {
    it('--hospeda-river references the river[500] OKLCH object', () => {
        expect(webLight['hospeda-river']).toBe(river[500]);
    });

    it('--success references the success[500] OKLCH object', () => {
        expect(webLight.success).toBe(success[500]);
    });

    it('--surface-warm references surfaces.warm', () => {
        expect(webLight['surface-warm']).toBe(surfaces.warm);
    });
});

describe('webLight — radius / spacing / typography / shadows / motion / z-index / layout', () => {
    it.each([
        ['radius', '0.75rem'],
        ['radius-sm', 'calc(var(--radius) - 4px)'],
        ['radius-card', '24px'],
        ['radius-pill', '9999px'],
        ['space-1', '0.25rem'],
        ['space-section', 'clamp(3rem, 8vw, 7.5rem)'],
        ['text-hero', 'clamp(3rem, 2rem + 5vw, 5.75rem)'],
        ['text-body', '1rem'],
        ['font-sans', '"Roboto", sans-serif'],
        ['font-heading', '"Geologica", sans-serif'],
        ['duration-fast', '0.2s'],
        ['ease-bounce', 'cubic-bezier(0.1, 0, 0.3, 1)'],
        ['z-content', '10'],
        ['z-mobile-menu', '9100'],
        ['navbar-height', '80px'],
        ['container-max', '1350px']
    ])('%s = %s', (key, expected) => {
        expect(webLight[key]).toBe(expected);
    });
});

describe('webDark — coverage', () => {
    it('declares 56 dark overrides', () => {
        // 56 matches the Phase 0 extractor count for tokens.dark.
        expect(Object.keys(webDark)).toHaveLength(56);
    });

    it('every dark key has a corresponding light declaration', () => {
        // Dark MUST be a strict subset of light — a dark override with no
        // light default is dead CSS. The Phase 0 extractor's integrity
        // check enforces this at the seed level; this assertion enforces
        // it at the TS theme level.
        const orphans: string[] = [];
        for (const key of Object.keys(webDark)) {
            if (!(key in webLight)) orphans.push(key);
        }
        expect(orphans).toEqual([]);
    });
});

describe('webDark — sample dark values match seed byte-for-byte', () => {
    it.each([
        ['core-background', 'oklch(0.14 0.02 220)'],
        ['core-foreground', 'oklch(0.92 0.01 210)'],
        ['brand-primary', 'oklch(0.68 0.17 259)'],
        ['destructive', 'oklch(0.6 0.22 27)'],
        ['success', 'oklch(0.65 0.16 150)'],
        ['warning', 'oklch(0.78 0.18 85)'],
        ['info', 'oklch(0.68 0.17 259)'],
        ['surface-warm', 'oklch(0.2 0.03 50)'],
        ['surface-elevated', 'oklch(0.24 0.025 220)'],
        ['footer-bg', 'oklch(0.12 0.02 220)'],
        ['avatar-1-from', 'oklch(0.3 0.1 255)']
    ])('%s = %s', (key, expected) => {
        expect(serializeThemeValue(webDark[key])).toBe(expected);
    });
});

describe('webDark — hover variants flip direction (LIGHTER instead of darker)', () => {
    it('primary-hover uses calc(l + 0.07) in dark vs calc(l - 0.05) in light', () => {
        expect(webDark['primary-hover']).toBe(
            'oklch(from var(--brand-primary) calc(l + 0.07) c h)'
        );
        expect(webLight['primary-hover']).toBe(
            'oklch(from var(--brand-primary) calc(l - 0.05) c h)'
        );
    });

    it('accent-hover similarly inverts direction', () => {
        expect(webDark['accent-hover']).toBe('oklch(from var(--brand-accent) calc(l + 0.07) c h)');
        expect(webLight['accent-hover']).toBe('oklch(from var(--brand-accent) calc(l - 0.05) c h)');
    });
});
