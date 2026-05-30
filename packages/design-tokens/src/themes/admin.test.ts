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
    brandSecondary,
    danger,
    forest,
    formatOKLCH,
    info,
    neutral,
    river,
    sand,
    sky,
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
    it('declares 92 entries', () => {
        // Original narrow admin surface = 17 (doc 05 §6.2). Brand-cohesion
        // pass added 12 web brand tokens. Layered color model added 10
        // per-accommodation-type tokens (39 total prior count). The SSOT
        // icon+color passes then added event-category (8), post-category (18),
        // user-role (7), auth-provider (5), amenity-type (12) and sponsor-type
        // (3) families — bringing the count to 92.
        expect(Object.keys(adminLight)).toHaveLength(92); // post-SSOT sponsors/amenities/auth/post-categories
    });

    it('keys do not include leading "--"', () => {
        for (const key of Object.keys(adminLight)) {
            expect(key.startsWith('--')).toBe(false);
        }
    });

    it("the core admin surface uses the color-* naming scheme (not web's brand-* / core-*)", () => {
        const colorKeys = Object.keys(adminLight).filter((k) => k.startsWith('color-'));
        // 4 color-primary* + color-accent + 2 color-bg-* + 3 color-fg-* +
        // color-border + 4 color-* feedback = 14 color-* entries.
        expect(colorKeys).toHaveLength(14);
    });

    it('declares the 10 per-accommodation-type tokens (cross-app badge identity)', () => {
        const typeKeys = Object.keys(adminLight).filter((k) => k.startsWith('accommodation-type-'));
        expect(typeKeys).toHaveLength(10);
    });
});

describe('adminLight — web brand tokens (cross-app badge support)', () => {
    it.each([
        ['brand-primary', river[500]],
        ['brand-accent', accent[500]],
        ['brand-secondary', brandSecondary],
        ['hospeda-river', river[500]],
        ['hospeda-sky', sky[500]],
        ['hospeda-forest', forest[500]],
        ['hospeda-sand', sand[500]],
        ['info', info[500]],
        ['warning', warning[500]]
    ])('%s mirrors the web-light palette value', (key, expectedRef) => {
        expect(adminLight[key]).toBe(expectedRef);
    });

    it('muted / warning-foreground / core-foreground mirror web-light hand-tuned values', () => {
        expect(adminLight.muted).toEqual({ l: 0.95, c: 0.01, h: 210 });
        expect(adminLight['warning-foreground']).toEqual({ l: 0.2, c: 0.02, h: 85 });
        expect(adminLight['core-foreground']).toEqual({ l: 0.2, c: 0.02, h: 220 });
    });
});

describe('adminLight — primary uses river[500] (brand-forward, matches web)', () => {
    it('color-primary = river[500]', () => {
        expect(adminLight['color-primary']).toBe(river[500]);
    });

    it('color-primary-hover = river[400]', () => {
        expect(adminLight['color-primary-hover']).toBe(river[400]);
    });

    it('color-primary-pressed = river[600]', () => {
        expect(adminLight['color-primary-pressed']).toBe(river[600]);
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

    it('bg-app is a faintly river-tinted off-white (brand-cohesion compromise)', () => {
        // Brighter + warmer than the old neutral[100] gray, calmer than web's
        // full river-white. River hue 259, very low chroma.
        expect(adminLight['color-bg-app']).toEqual({ l: 0.97, c: 0.006, h: 259 });
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
    it('declares 22 dark overrides (14 color-* + 8 web brand tokens; fonts + radius inherit)', () => {
        // 14 core color-* dark overrides + 8 web brand dark overrides
        // (brand-primary/accent/secondary, muted, info, warning,
        // warning-foreground, core-foreground). The hospeda-* family is NOT
        // overridden in dark (it inherits admin-light), matching web-dark.
        expect(Object.keys(adminDark)).toHaveLength(22);
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
    it('color-primary in dark = river[400] (vs adminLight river[500])', () => {
        expect(adminDark['color-primary']).toBe(river[400]);
        expect(adminLight['color-primary']).toBe(river[500]);
    });

    it('foreground inverts: dark uses neutral[100], light uses neutral[900]', () => {
        expect(adminDark['color-fg-primary']).toBe(neutral[100]);
        expect(adminLight['color-fg-primary']).toBe(neutral[900]);
    });

    it('bg-app inverts: dark is dark neutral[900], light is a bright off-white', () => {
        expect(adminDark['color-bg-app']).toBe(neutral[900]);
        // Light bg is no longer pure neutral[100] — it's a faintly river-tinted
        // off-white (RIVER_TINTED_BG). Assert it stays bright.
        const light = adminLight['color-bg-app'] as { l: number };
        expect(light.l).toBeGreaterThan(0.9);
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

describe('adminLight — per-accommodation-type tokens reference base palettes', () => {
    it.each([
        ['accommodation-type-hotel', 'var(--palette-accent-500)'],
        ['accommodation-type-apartment', 'var(--palette-river-500)'],
        ['accommodation-type-house', 'var(--palette-forest-500)'],
        ['accommodation-type-country-house', 'var(--palette-teal-500)'],
        ['accommodation-type-cabin', 'var(--palette-terracotta-500)'],
        ['accommodation-type-camping', 'var(--palette-sand-500)'],
        ['accommodation-type-hostel', 'var(--palette-cyan-500)'],
        ['accommodation-type-room', 'var(--palette-rose-500)'],
        ['accommodation-type-motel', 'var(--palette-danger-500)'],
        ['accommodation-type-resort', 'var(--palette-purple-500)']
    ])('%s = %s (same value web uses → identical cross-app hue)', (key, expected) => {
        expect(adminLight[key]).toBe(expected);
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
