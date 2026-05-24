/**
 * @file themes/admin.test.ts
 * @description Tests for the admin light + dark theme mappings.
 *
 * Admin themes are intentionally compact compared to web — only ~17
 * entries each, using doc 05 §6.2's clean `--color-*` naming scheme.
 * Admin's Tailwind v4 `@theme inline { }` (T-153-26) maps shadcn
 * semantic names to these tokens.
 */

import { describe, expect, it } from 'vitest';

import {
    accent,
    danger,
    formatOKLCH,
    info,
    neutral,
    river,
    success,
    warning
} from '../tokens/colors.js';
import { adminDark } from './admin-dark.js';
import { adminLight } from './admin-light.js';

function serializeThemeValue(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null && 'l' in value) {
        return formatOKLCH(value as { l: number; c: number; h: number });
    }
    throw new Error(`Unexpected theme value: ${String(value)}`);
}

describe('adminLight — coverage and naming', () => {
    it('declares 17 entries (doc 05 §6.2)', () => {
        expect(Object.keys(adminLight)).toHaveLength(17);
    });

    it('keys do not include leading "--"', () => {
        for (const key of Object.keys(adminLight)) {
            expect(key.startsWith('--')).toBe(false);
        }
    });

    it("uses the color-* naming scheme (not web's brand-* / core-*)", () => {
        const colorKeys = Object.keys(adminLight).filter((k) => k.startsWith('color-'));
        // 4 color-primary* + color-accent + 2 color-bg-* + 3 color-fg-* +
        // color-border + 4 color-* feedback = 14 color-* entries.
        expect(colorKeys).toHaveLength(14);
    });
});

describe("adminLight — primary uses river[600] (denser than web's [500])", () => {
    it('color-primary = river[600]', () => {
        expect(adminLight['color-primary']).toBe(river[600]);
    });

    it('color-primary-hover = river[500]', () => {
        expect(adminLight['color-primary-hover']).toBe(river[500]);
    });

    it('color-primary-pressed = river[700]', () => {
        expect(adminLight['color-primary-pressed']).toBe(river[700]);
    });

    it('hover is LIGHTER than primary (lifts on hover)', () => {
        const primary = adminLight['color-primary'] as { l: number };
        const hover = adminLight['color-primary-hover'] as { l: number };
        expect(hover.l).toBeGreaterThan(primary.l);
    });

    it('pressed is DARKER than primary (sinks on press)', () => {
        const primary = adminLight['color-primary'] as { l: number };
        const pressed = adminLight['color-primary-pressed'] as { l: number };
        expect(pressed.l).toBeLessThan(primary.l);
    });
});

describe('adminLight — accent + bg + fg + border + semantic shades', () => {
    it.each([
        ['color-accent', accent[600]],
        ['color-bg-app', neutral[100]],
        ['color-fg-primary', neutral[900]],
        ['color-fg-secondary', neutral[700]],
        ['color-fg-muted', neutral[500]],
        ['color-border', neutral[200]],
        ['color-success', success[600]],
        ['color-warning', warning[600]],
        ['color-danger', danger[600]],
        ['color-info', info[600]]
    ])('%s references the right palette shade', (key, expectedRef) => {
        expect(adminLight[key]).toBe(expectedRef);
    });
});

describe('adminLight — bg-elevated is pure white (not a palette shade)', () => {
    it('color-bg-elevated = oklch(1 0 0)', () => {
        expect(serializeThemeValue(adminLight['color-bg-elevated'])).toBe('oklch(1 0 0)');
    });
});

describe('adminLight — fonts and radius match web (shared baseline)', () => {
    it('font-body = "Roboto", sans-serif', () => {
        expect(adminLight['font-body']).toBe('"Roboto", sans-serif');
    });

    it('font-heading = "Geologica", sans-serif', () => {
        expect(adminLight['font-heading']).toBe('"Geologica", sans-serif');
    });

    it('radius = 0.75rem (matches web base)', () => {
        expect(adminLight.radius).toBe('0.75rem');
    });
});

describe('adminDark — coverage and strict subset of adminLight', () => {
    it('declares 14 dark overrides (fonts + radius inherit from light)', () => {
        expect(Object.keys(adminDark)).toHaveLength(14);
    });

    it('every dark key has a corresponding light declaration', () => {
        const orphans: string[] = [];
        for (const key of Object.keys(adminDark)) {
            if (!(key in adminLight)) orphans.push(key);
        }
        expect(orphans).toEqual([]);
    });

    it('does NOT override font-body / font-heading / radius', () => {
        expect(adminDark['font-body']).toBeUndefined();
        expect(adminDark['font-heading']).toBeUndefined();
        expect(adminDark.radius).toBeUndefined();
    });
});

describe('adminDark — primary shifts one shade LIGHTER vs adminLight', () => {
    it('color-primary in dark = river[500] (vs adminLight river[600])', () => {
        expect(adminDark['color-primary']).toBe(river[500]);
        expect(adminLight['color-primary']).toBe(river[600]);
    });

    it('foreground inverts: dark uses neutral[100], light uses neutral[900]', () => {
        expect(adminDark['color-fg-primary']).toBe(neutral[100]);
        expect(adminLight['color-fg-primary']).toBe(neutral[900]);
    });

    it('bg-app inverts: dark uses neutral[900], light uses neutral[100]', () => {
        expect(adminDark['color-bg-app']).toBe(neutral[900]);
        expect(adminLight['color-bg-app']).toBe(neutral[100]);
    });
});

describe('adminDark — bg-elevated is neutral[800] (lighter than bg-app)', () => {
    it('color-bg-elevated = neutral[800]', () => {
        expect(adminDark['color-bg-elevated']).toBe(neutral[800]);
    });

    it('bg-elevated lightness > bg-app lightness (elevated sits above bg)', () => {
        const bgApp = adminDark['color-bg-app'] as { l: number };
        const bgElevated = adminDark['color-bg-elevated'] as { l: number };
        expect(bgElevated.l).toBeGreaterThan(bgApp.l);
    });
});

describe('admin theme cross-coherence with web', () => {
    it('admin and web share the river HUE for primary (brand coherence)', () => {
        const adminPrimary = adminLight['color-primary'] as { h: number };
        // We can\'t import webLight here without circular concerns; assert
        // the river-family hue directly. river canonical hue is 259.
        expect(adminPrimary.h).toBe(259);
    });
});
