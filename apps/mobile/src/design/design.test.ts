/**
 * @file design.test.ts
 * @description Invariant tests for the Hospeda mobile design-token modules.
 *
 * These tests are NOT tautologies — they verify structural contracts that
 * would be broken by accidental deletion, typo, or wrong-type regressions:
 *
 * - Color tokens are valid hex strings across all palettes.
 * - Spacing values are non-negative numbers in monotonically-ascending order.
 * - Radius values are non-negative numbers; pill sentinel exists at 9999.
 * - Typography sizes are positive numbers; semantic keys exist; lineHeightFor
 *   computes sensible absolute pixel values.
 * - The theme aggregate re-exports the exact same references as the
 *   individual token modules.
 * - The barrel index.ts re-exports all expected named symbols.
 */

import { describe, expect, it } from 'vitest';

// Individual token modules
import {
    accent,
    semantic as colorSemantic,
    colors,
    danger,
    forest,
    info,
    neutral,
    river,
    sand,
    sky,
    success,
    warning
} from './colors';
import {
    radius,
    base as radiusBase,
    scale as radiusScale,
    semantic as radiusSemantic
} from './radius';
import { spacing } from './spacing';
import { theme } from './theme';
import {
    fontFamily,
    fontSize,
    fontWeight,
    lineHeightFor,
    lineHeightRatio,
    semanticSize,
    typography
} from './typography';

// Barrel (index.ts)
import * as design from './index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Assert every value in a color palette object is a valid hex string. */
const expectAllHex = (palette: Record<string | number, string>): void => {
    for (const [key, value] of Object.entries(palette)) {
        expect(value, `${key} should be a valid hex string`).toMatch(HEX_RE);
    }
};

// ---------------------------------------------------------------------------
// colors.ts
// ---------------------------------------------------------------------------

describe('colors — brand palettes', () => {
    it('river palette: all 10 shades are valid hex strings', () => {
        expectAllHex(river);
    });

    it('sky palette: all 10 shades are valid hex strings', () => {
        expectAllHex(sky);
    });

    it('forest palette: all 10 shades are valid hex strings', () => {
        expectAllHex(forest);
    });

    it('sand palette: all 10 shades are valid hex strings', () => {
        expectAllHex(sand);
    });

    it('accent palette: all 10 shades are valid hex strings', () => {
        expectAllHex(accent);
    });
});

describe('colors — semantic palettes', () => {
    it('success palette: all 10 shades are valid hex strings', () => {
        expectAllHex(success);
    });

    it('warning palette: all 10 shades are valid hex strings', () => {
        expectAllHex(warning);
    });

    it('danger palette: all 10 shades are valid hex strings', () => {
        expectAllHex(danger);
    });

    it('info palette: all 10 shades are valid hex strings', () => {
        expectAllHex(info);
    });
});

describe('colors — neutral grays', () => {
    it('neutral palette: all 10 shades are valid hex strings', () => {
        expectAllHex(neutral);
    });

    it('neutral shades are ordered light-to-dark (ascending darkness)', () => {
        // The neutral scale is ordered lightest (50) to darkest (900).
        // We can verify this by comparing shade values as hex integers — lower
        // hex value = darker (smaller RGB sum). We check each step is darker.
        const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
        for (let i = 1; i < shades.length; i++) {
            const lighter = Number.parseInt(neutral[shades[i - 1]].slice(1), 16);
            const darker = Number.parseInt(neutral[shades[i]].slice(1), 16);
            expect(
                darker,
                `neutral[${shades[i]}] should be darker than neutral[${shades[i - 1]}]`
            ).toBeLessThan(lighter);
        }
    });
});

describe('colors — semantic single-value tokens', () => {
    it('semantic tokens are all valid hex strings', () => {
        expectAllHex(colorSemantic);
    });

    it('semantic.background is pure white (#ffffff)', () => {
        expect(colorSemantic.background).toBe('#ffffff');
    });

    it('semantic.textInverted is white (#ffffff) — usable on dark surfaces', () => {
        expect(colorSemantic.textInverted).toBe('#ffffff');
    });

    it('semantic.border matches neutral[200] — consistent with the scale', () => {
        expect(colorSemantic.border).toBe(neutral[200]);
    });

    it('semantic.divider matches neutral[100] — consistent with the scale', () => {
        expect(colorSemantic.divider).toBe(neutral[100]);
    });

    it('semantic.textPrimary matches neutral[900] (near-black)', () => {
        expect(colorSemantic.textPrimary).toBe(neutral[900]);
    });
});

describe('colors — master aggregate', () => {
    it('colors.river is the same reference as the named river export', () => {
        expect(colors.river).toBe(river);
    });

    it('colors.neutral is the same reference as the named neutral export', () => {
        expect(colors.neutral).toBe(neutral);
    });

    it('colors.semantic is the same reference as the named semantic export', () => {
        expect(colors.semantic).toBe(colorSemantic);
    });

    it('colors aggregate has exactly the expected palette keys', () => {
        const expectedKeys = [
            'river',
            'sky',
            'forest',
            'sand',
            'accent',
            'success',
            'warning',
            'danger',
            'info',
            'neutral',
            'semantic'
        ];
        expect(Object.keys(colors).sort()).toEqual(expectedKeys.sort());
    });
});

// ---------------------------------------------------------------------------
// spacing.ts
// ---------------------------------------------------------------------------

describe('spacing', () => {
    it('spacing[0] is 0', () => {
        expect(spacing[0]).toBe(0);
    });

    it('all spacing values are non-negative numbers', () => {
        for (const [key, value] of Object.entries(spacing)) {
            expect(typeof value, `spacing[${key}] should be a number`).toBe('number');
            expect(value, `spacing[${key}] should be >= 0`).toBeGreaterThanOrEqual(0);
        }
    });

    it('spacing scale is monotonically ascending (larger keys = larger values)', () => {
        // Keys: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16, 20, 24
        const entries = Object.entries(spacing).map(([k, v]) => [Number(k), v] as [number, number]);
        entries.sort(([a], [b]) => a - b);
        for (let i = 1; i < entries.length; i++) {
            expect(
                entries[i][1],
                `spacing[${entries[i][0]}] should be greater than spacing[${entries[i - 1][0]}]`
            ).toBeGreaterThan(entries[i - 1][1]);
        }
    });

    it('rem×16 conversions are correct for key sample', () => {
        // key=1 → 0.25rem × 16 = 4
        expect(spacing[1]).toBe(4);
        // key=4 → 1rem × 16 = 16
        expect(spacing[4]).toBe(16);
        // key=8 → 2rem × 16 = 32
        expect(spacing[8]).toBe(32);
        // key=24 → 6rem × 16 = 96
        expect(spacing[24]).toBe(96);
    });

    it('has the canonical 15 keys defined', () => {
        const expectedKeys = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16, 20, 24];
        expect(
            Object.keys(spacing)
                .map(Number)
                .sort((a, b) => a - b)
        ).toEqual(expectedKeys);
    });
});

// ---------------------------------------------------------------------------
// radius.ts
// ---------------------------------------------------------------------------

describe('radius', () => {
    it('radiusBase is 12 (0.75rem × 16)', () => {
        expect(radiusBase).toBe(12);
    });

    describe('scale', () => {
        it('sm is 8 (base - 4)', () => {
            expect(radiusScale.sm).toBe(8);
        });

        it('md is 10 (base - 2)', () => {
            expect(radiusScale.md).toBe(10);
        });

        it('lg equals the base radius (12)', () => {
            expect(radiusScale.lg).toBe(radiusBase);
        });

        it('xl is 16 (base + 4)', () => {
            expect(radiusScale.xl).toBe(16);
        });

        it('all scale values are positive numbers', () => {
            for (const [key, value] of Object.entries(radiusScale)) {
                expect(typeof value, `scale.${key} should be a number`).toBe('number');
                expect(value, `scale.${key} should be > 0`).toBeGreaterThan(0);
            }
        });

        it('scale keys are monotonically ascending (sm < md < lg < xl)', () => {
            expect(radiusScale.sm).toBeLessThan(radiusScale.md);
            expect(radiusScale.md).toBeLessThan(radiusScale.lg);
            expect(radiusScale.lg).toBeLessThan(radiusScale.xl);
        });
    });

    describe('semantic', () => {
        it('card is 24', () => {
            expect(radiusSemantic.card).toBe(24);
        });

        it('pill is 9999 (RN fully-rounded convention)', () => {
            expect(radiusSemantic.pill).toBe(9999);
        });

        it('button is 8', () => {
            expect(radiusSemantic.button).toBe(8);
        });

        it('all semantic values are positive numbers', () => {
            for (const [key, value] of Object.entries(radiusSemantic)) {
                expect(typeof value, `semantic.${key} should be a number`).toBe('number');
                expect(value, `semantic.${key} should be > 0`).toBeGreaterThan(0);
            }
        });
    });

    describe('radius aggregate', () => {
        it('radius.base is the same value as the named base export', () => {
            expect(radius.base).toBe(radiusBase);
        });

        it('radius.scale is the same reference as the named scale export', () => {
            expect(radius.scale).toBe(radiusScale);
        });

        it('radius.semantic is the same reference as the named semantic export', () => {
            expect(radius.semantic).toBe(radiusSemantic);
        });
    });
});

// ---------------------------------------------------------------------------
// typography.ts
// ---------------------------------------------------------------------------

describe('typography — fontFamily', () => {
    it('sans is "Roboto"', () => {
        expect(fontFamily.sans).toBe('Roboto');
    });

    it('heading is "Geologica"', () => {
        expect(fontFamily.heading).toBe('Geologica');
    });

    it('decorative is "Caveat"', () => {
        expect(fontFamily.decorative).toBe('Caveat');
    });
});

describe('typography — fontSize scale', () => {
    it('all fontSize values are positive numbers', () => {
        for (const [key, value] of Object.entries(fontSize)) {
            expect(typeof value, `fontSize.${key} should be a number`).toBe('number');
            expect(value, `fontSize.${key} should be > 0`).toBeGreaterThan(0);
        }
    });

    it('rem×16 conversions are correct for key sample', () => {
        // xs: 0.75rem × 16 = 12
        expect(fontSize.xs).toBe(12);
        // base: 1rem × 16 = 16
        expect(fontSize.base).toBe(16);
        // 2xl: 1.5rem × 16 = 24
        expect(fontSize['2xl']).toBe(24);
        // 5xl: 3rem × 16 = 48
        expect(fontSize['5xl']).toBe(48);
    });

    it('has the expected 9 scale keys', () => {
        const expectedKeys = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'];
        expect(Object.keys(fontSize).sort()).toEqual(expectedKeys.sort());
    });
});

describe('typography — fontWeight', () => {
    it('all fontWeight values are positive numbers', () => {
        for (const [key, value] of Object.entries(fontWeight)) {
            expect(typeof value, `fontWeight.${key} should be a number`).toBe('number');
            expect(value, `fontWeight.${key} should be > 0`).toBeGreaterThan(0);
        }
    });

    it('has the expected weight names', () => {
        expect(fontWeight.normal).toBe(400);
        expect(fontWeight.medium).toBe(500);
        expect(fontWeight.semibold).toBe(600);
        expect(fontWeight.bold).toBe(700);
    });

    it('weights are monotonically ascending', () => {
        expect(fontWeight.normal).toBeLessThan(fontWeight.medium);
        expect(fontWeight.medium).toBeLessThan(fontWeight.semibold);
        expect(fontWeight.semibold).toBeLessThan(fontWeight.bold);
    });
});

describe('typography — lineHeightRatio', () => {
    it('tight is 1.2', () => {
        expect(lineHeightRatio.tight).toBe(1.2);
    });

    it('normal is 1.5', () => {
        expect(lineHeightRatio.normal).toBe(1.5);
    });

    it('relaxed is 1.75', () => {
        expect(lineHeightRatio.relaxed).toBe(1.75);
    });

    it('ratios are all greater than 1 (line height exceeds font size)', () => {
        for (const [key, value] of Object.entries(lineHeightRatio)) {
            expect(value, `lineHeightRatio.${key} should be > 1`).toBeGreaterThan(1);
        }
    });

    it('ratios are monotonically ascending (tight < normal < relaxed)', () => {
        expect(lineHeightRatio.tight).toBeLessThan(lineHeightRatio.normal);
        expect(lineHeightRatio.normal).toBeLessThan(lineHeightRatio.relaxed);
    });
});

describe('typography — lineHeightFor helper', () => {
    it('returns a number greater than the input size for any ratio > 1', () => {
        expect(lineHeightFor(16, 'normal')).toBeGreaterThan(16);
        expect(lineHeightFor(16, 'tight')).toBeGreaterThan(16);
        expect(lineHeightFor(16, 'relaxed')).toBeGreaterThan(16);
    });

    it('computes correct absolute px for base size + normal ratio: 16 × 1.5 = 24', () => {
        expect(lineHeightFor(16, 'normal')).toBe(24);
    });

    it('computes correct absolute px for 24px + tight ratio: round(24 × 1.2) = 29', () => {
        expect(lineHeightFor(24, 'tight')).toBe(29);
    });

    it('computes correct absolute px for 14px + relaxed ratio: round(14 × 1.75) = 25', () => {
        expect(lineHeightFor(14, 'relaxed')).toBe(25);
    });

    it('returns an integer (Math.round is applied)', () => {
        const result = lineHeightFor(15, 'normal'); // 15 × 1.5 = 22.5 → 23
        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBe(23);
    });
});

describe('typography — semanticSize', () => {
    it('all semanticSize values are positive numbers', () => {
        for (const [key, value] of Object.entries(semanticSize)) {
            expect(typeof value, `semanticSize.${key} should be a number`).toBe('number');
            expect(value, `semanticSize.${key} should be > 0`).toBeGreaterThan(0);
        }
    });

    it('has the expected semantic keys', () => {
        const expectedKeys = [
            'hero',
            'display',
            'h2',
            'h3',
            'h4',
            'body',
            'bodySm',
            'bodyXs',
            'bodyLg',
            'meta',
            'caption',
            'button',
            'nav'
        ];
        expect(Object.keys(semanticSize).sort()).toEqual(expectedKeys.sort());
    });

    it('body is 16 (1rem)', () => {
        expect(semanticSize.body).toBe(16);
    });

    it('caption is 12 (0.75rem)', () => {
        expect(semanticSize.caption).toBe(12);
    });

    it('h2 is 28 (lower-bound of web clamp range)', () => {
        expect(semanticSize.h2).toBe(28);
    });

    it('hero is larger than display (hero > display)', () => {
        expect(semanticSize.hero).toBeGreaterThan(semanticSize.display);
    });

    it('display is larger than h2 (heading hierarchy preserved)', () => {
        expect(semanticSize.display).toBeGreaterThan(semanticSize.h2);
    });

    it('h2 > h3 > h4 (heading hierarchy preserved)', () => {
        expect(semanticSize.h2).toBeGreaterThan(semanticSize.h3);
        expect(semanticSize.h3).toBeGreaterThan(semanticSize.h4);
    });
});

describe('typography — aggregate object', () => {
    it('typography.fontFamily is the same reference as named fontFamily export', () => {
        expect(typography.fontFamily).toBe(fontFamily);
    });

    it('typography.fontSize is the same reference as named fontSize export', () => {
        expect(typography.fontSize).toBe(fontSize);
    });

    it('typography.fontWeight is the same reference as named fontWeight export', () => {
        expect(typography.fontWeight).toBe(fontWeight);
    });

    it('typography.lineHeightRatio is the same reference as named lineHeightRatio export', () => {
        expect(typography.lineHeightRatio).toBe(lineHeightRatio);
    });

    it('typography.semantic is the same reference as named semanticSize export', () => {
        expect(typography.semantic).toBe(semanticSize);
    });
});

// ---------------------------------------------------------------------------
// theme.ts
// ---------------------------------------------------------------------------

describe('theme — aggregate object', () => {
    it('theme.colors is the same reference as the named colors export', () => {
        expect(theme.colors).toBe(colors);
    });

    it('theme.typography is the same reference as the named typography export', () => {
        expect(theme.typography).toBe(typography);
    });

    it('theme.spacing is the same reference as the named spacing export', () => {
        expect(theme.spacing).toBe(spacing);
    });

    it('theme.radius is the same reference as the named radius export', () => {
        expect(theme.radius).toBe(radius);
    });

    it('theme.lineHeightFor is the same function as the named lineHeightFor export', () => {
        expect(theme.lineHeightFor).toBe(lineHeightFor);
    });

    it('theme.lineHeightFor computes the correct value (delegates to lineHeightFor)', () => {
        expect(theme.lineHeightFor(32, 'tight')).toBe(lineHeightFor(32, 'tight'));
    });
});

// ---------------------------------------------------------------------------
// index.ts (barrel)
// ---------------------------------------------------------------------------

describe('design barrel (index.ts) — re-exports', () => {
    it('exports colors', () => {
        expect(design.colors).toBe(colors);
    });

    it('exports typography', () => {
        expect(design.typography).toBe(typography);
    });

    it('exports spacing', () => {
        expect(design.spacing).toBe(spacing);
    });

    it('exports radius', () => {
        expect(design.radius).toBe(radius);
    });

    it('exports theme', () => {
        expect(design.theme).toBe(theme);
    });

    it('exports lineHeightFor', () => {
        expect(design.lineHeightFor).toBe(lineHeightFor);
    });

    it('exports fontFamily', () => {
        expect(design.fontFamily).toBe(fontFamily);
    });

    it('exports fontSize', () => {
        expect(design.fontSize).toBe(fontSize);
    });

    it('exports fontWeight', () => {
        expect(design.fontWeight).toBe(fontWeight);
    });

    it('exports lineHeightRatio', () => {
        expect(design.lineHeightRatio).toBe(lineHeightRatio);
    });

    it('exports semanticSize', () => {
        expect(design.semanticSize).toBe(semanticSize);
    });

    it('exports radiusBase (aliased from base)', () => {
        expect(design.radiusBase).toBe(radiusBase);
    });

    it('exports radiusScale (aliased from scale)', () => {
        expect(design.radiusScale).toBe(radiusScale);
    });

    it('exports radiusSemantic (aliased from semantic)', () => {
        expect(design.radiusSemantic).toBe(radiusSemantic);
    });
});
