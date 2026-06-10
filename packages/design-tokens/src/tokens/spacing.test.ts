/**
 * @file spacing.test.ts
 * @description Unit tests for the spacing tokens. Numeric stops 1..10 + 12
 * verified against web seed byte-for-byte; 0/16/20/24 verified against
 * doc 05 §5.3. Semantic composites all verified against web seed.
 */

import { describe, expect, it } from 'vitest';

import {
    type SemanticSpacingName,
    type SpacingKey,
    semanticSpacing,
    spacing,
    spacingTokens
} from './spacing.ts';

describe('spacing numeric scale', () => {
    it('declares 15 stops (union of doc 05 §5.3 + web seed)', () => {
        // Numeric keys come out as strings from Object.keys; just check the count.
        expect(Object.keys(spacing)).toHaveLength(15);
    });

    const expected: Record<SpacingKey, string> = {
        0: '0',
        1: '0.25rem',
        2: '0.5rem',
        3: '0.75rem',
        4: '1rem',
        5: '1.25rem',
        6: '1.5rem',
        7: '1.75rem',
        8: '2rem',
        9: '2.25rem',
        10: '2.5rem',
        12: '3rem',
        16: '4rem',
        20: '5rem',
        24: '6rem'
    };

    it.each(Object.entries(expected))('spacing[%s] = %s', (keyStr, expectedValue) => {
        const key = Number.parseInt(keyStr, 10) as SpacingKey;
        expect(spacing[key]).toBe(expectedValue);
    });

    it('progresses monotonically by stop key', () => {
        const stops = (Object.keys(spacing) as ReadonlyArray<string>).map((k) =>
            Number.parseInt(k, 10)
        );
        for (let i = 1; i < stops.length; i++) {
            expect(stops[i]).toBeGreaterThan(stops[i - 1] ?? Number.NEGATIVE_INFINITY);
        }
    });
});

describe('semanticSpacing — anchored to web seed byte-for-byte', () => {
    const cases: ReadonlyArray<readonly [SemanticSpacingName, string]> = [
        ['section', 'clamp(3rem, 8vw, 7.5rem)'],
        ['sectionSm', 'clamp(2.5rem, 5vw, 5rem)'],
        ['sectionLg', 'clamp(4rem, 10vw, 10rem)'],
        ['containerX', 'clamp(0.75rem, 3vw, 1.5rem)'],
        ['cardGap', 'clamp(1rem, 3vw, 1.875rem)'],
        ['sectionHeaderMb', '50px'],
        ['cardContent', '27px 30px 26px']
    ];

    it.each(cases)('%s = %s', (key, expected) => {
        expect(semanticSpacing[key]).toBe(expected);
    });

    it('declares 7 semantic entries', () => {
        expect(Object.keys(semanticSpacing)).toHaveLength(7);
    });
});

describe('spacingTokens aggregate', () => {
    it('groups scale + semantic', () => {
        expect(Object.keys(spacingTokens).sort()).toEqual(['scale', 'semantic']);
    });

    it('preserves identity of sub-namespace references', () => {
        expect(spacingTokens.scale).toBe(spacing);
        expect(spacingTokens.semantic).toBe(semanticSpacing);
    });
});
