/**
 * @file index.test.ts
 * @description SPEC-153 T-153-18 — Public-API surface tests.
 *
 * Simulates an external consumer (apps/web, apps/admin) by importing every
 * name advertised in the package README + JSDoc and exercising it. The
 * vitest assertions are largely cheap identity / shape checks — the real
 * gate is `pnpm typecheck`, which would fail if a re-export went missing
 * or a type changed shape. expectTypeOf assertions encode the type-level
 * contracts so a future structural change to the underlying modules can't
 * silently break consumer autocomplete.
 */

import { describe, expect, expectTypeOf, it } from 'vitest';

import {
    PACKAGE_NAME,
    PACKAGE_VERSION,
    SHADES,
    SPEC_REF,
    accent,
    adminDark,
    adminLight,
    avatarGradients,
    brandPalettes,
    chartColors,
    deriveShades,
    fontFamily,
    fontSize,
    fontWeight,
    formatOKLCH,
    layoutChrome,
    layoutContainer,
    layoutMediaOverrides,
    lineHeight,
    motionDuration,
    motionEasing,
    neutral,
    palettes,
    radiusBase,
    radiusScale,
    radiusSemantic,
    river,
    semanticPalettes,
    semanticSpacing,
    semanticTypography,
    shadowScale,
    shadowSemantic,
    spacing,
    surfaces,
    webDark,
    webDuration,
    webEasing,
    webLight,
    zIndex
} from './index.ts';
import type {
    BrandPaletteName,
    FontFamilyName,
    FontSizeKey,
    FontWeightName,
    LineHeightName,
    MotionDurationKey,
    MotionEasingName,
    OKLCH,
    Palette,
    PaletteName,
    RadiusScaleKey,
    SemanticPaletteName,
    SemanticTypographyName,
    Shade,
    ShadowScaleKey,
    ShadowSemanticName,
    SpacingKey,
    Theme,
    ThemeValue,
    WebDurationKey,
    ZIndexName
} from './index.ts';

describe('package metadata', () => {
    it('exposes the package name, version, and spec ref', () => {
        expect(PACKAGE_NAME).toBe('@repo/design-tokens');
        expect(PACKAGE_VERSION).toBe('0.0.0');
        expect(SPEC_REF).toBe('SPEC-153');
    });
});

describe('color exports', () => {
    it('exposes all 5 brand palettes through the aggregate', () => {
        expect(Object.keys(brandPalettes).sort()).toEqual(
            ['accent', 'forest', 'river', 'sand', 'sky'].sort()
        );
        expect(brandPalettes.river).toBe(river);
        expect(brandPalettes.accent).toBe(accent);
    });

    it('exposes semantic palettes + neutral through the master aggregate', () => {
        expect(Object.keys(semanticPalettes).sort()).toEqual(
            ['danger', 'info', 'success', 'warning'].sort()
        );
        expect(palettes.river).toBe(river);
        expect(palettes.neutral).toBe(neutral);
        expect(Object.keys(palettes)).toHaveLength(10);
    });

    it('exposes derivation + formatting helpers', () => {
        const derived = deriveShades({ l: 0.5, c: 0.1, h: 100 });
        expect(derived[500]).toEqual({ l: 0.5, c: 0.1, h: 100 });
        expect(formatOKLCH(river[500])).toBe('oklch(0.63 0.19 259)');
    });

    it('exposes structured single-OKLCH extras', () => {
        expect(avatarGradients[1].from).toEqual({ l: 0.25, c: 0.08, h: 255 });
        expect(chartColors).toHaveLength(5);
        expect(surfaces.warm.l).toBeGreaterThan(0.9);
    });

    it('SHADES constant is the canonical 10-step ladder', () => {
        expect(SHADES).toEqual([50, 100, 200, 300, 400, 500, 600, 700, 800, 900]);
    });
});

describe('typography exports', () => {
    it('exposes font scales and semantic composites', () => {
        expect(fontFamily.sans).toBe('"Roboto", sans-serif');
        expect(fontSize.base).toBe('1rem');
        expect(fontWeight.bold).toBe(700);
        expect(lineHeight.normal).toBe(1.5);
        expect(semanticTypography.hero).toContain('clamp(');
    });
});

describe('spacing / radius / shadows / motion / z-index / layout exports', () => {
    it('spacing scale + semantic both reachable', () => {
        expect(spacing[4]).toBe('1rem');
        expect(semanticSpacing.section).toContain('clamp');
    });

    it('radius layers all reachable', () => {
        expect(radiusBase).toBe('0.75rem');
        expect(radiusScale.sm).toContain('var(--radius)');
        expect(radiusSemantic.pill).toBe('9999px');
    });

    it('shadow scale + semantic both reachable', () => {
        expect(shadowScale.none).toBe('none');
        expect(shadowSemantic.card).toContain('oklch(from var(--core-foreground)');
    });

    it('motion doc 05 + web scales coexist without collision', () => {
        expect(motionDuration.fast).toBe('150ms');
        expect(webDuration.fast).toBe('0.2s');
        expect(motionEasing.out).toContain('cubic-bezier');
        expect(webEasing.bounce).toContain('cubic-bezier');
    });

    it('z-index ladder + layout chrome/container/media reachable', () => {
        expect(zIndex.modal).toBe(100);
        expect(layoutChrome.navbarHeight).toBe('80px');
        expect(layoutContainer.max).toBe('1350px');
        expect(layoutMediaOverrides['(min-width: 1600px)']?.['container-max']).toBe('1500px');
    });
});

describe('theme exports', () => {
    it('all four theme records are imported and shaped correctly', () => {
        expect(Object.keys(webLight)).toHaveLength(142);
        expect(Object.keys(webDark)).toHaveLength(56);
        expect(Object.keys(adminLight)).toHaveLength(17);
        expect(Object.keys(adminDark)).toHaveLength(14);
    });

    it('themes share the Theme contract (no `--` prefix on keys)', () => {
        for (const theme of [webLight, webDark, adminLight, adminDark]) {
            for (const key of Object.keys(theme)) {
                expect(key.startsWith('--')).toBe(false);
            }
        }
    });
});

describe('type re-exports compile (consumer autocomplete contract)', () => {
    it('type aliases are usable in consumer-typed positions', () => {
        // Compile-time assertions. The fact that these expressions
        // typecheck is the gate. Vitest runs them too as a smoke check.

        const oklch: OKLCH = { l: 0.5, c: 0.1, h: 100 };
        expectTypeOf(oklch).toEqualTypeOf<OKLCH>();

        const shade: Shade = 500;
        expectTypeOf(shade).toEqualTypeOf<Shade>();

        const palette: Palette = neutral;
        expectTypeOf(palette).toEqualTypeOf<Palette>();

        const brand: BrandPaletteName = 'river';
        const semantic: SemanticPaletteName = 'success';
        const any: PaletteName = 'neutral';
        expectTypeOf(brand).toEqualTypeOf<BrandPaletteName>();
        expectTypeOf(semantic).toEqualTypeOf<SemanticPaletteName>();
        expectTypeOf(any).toEqualTypeOf<PaletteName>();

        const themeValue: ThemeValue = oklch;
        const theme: Theme = { 'core-background': oklch };
        expectTypeOf(themeValue).toEqualTypeOf<ThemeValue>();
        expectTypeOf(theme).toEqualTypeOf<Theme>();

        // Width-of-name aliases. Each must accept its literal keys.
        const fontName: FontFamilyName = 'sans';
        const fontSizeKey: FontSizeKey = 'base';
        const fontWeightName: FontWeightName = 'bold';
        const lineHeightName: LineHeightName = 'tight';
        const semanticType: SemanticTypographyName = 'hero';
        const spacingKey: SpacingKey = 4;
        const radiusKey: RadiusScaleKey = 'sm';
        const shadowScaleKey: ShadowScaleKey = 'md';
        const shadowSemanticName: ShadowSemanticName = 'card';
        const motionDurKey: MotionDurationKey = 'fast';
        const motionEaseName: MotionEasingName = 'out';
        const webDurKey: WebDurationKey = 'normal';
        const zName: ZIndexName = 'modal';

        // Touch the bindings so biome doesn't flag them as unused.
        expect([
            fontName,
            fontSizeKey,
            fontWeightName,
            lineHeightName,
            semanticType,
            spacingKey,
            radiusKey,
            shadowScaleKey,
            shadowSemanticName,
            motionDurKey,
            motionEaseName,
            webDurKey,
            zName
        ]).toHaveLength(13);
    });
});
