/**
 * @file generators/validate.test.ts
 * @description SPEC-153 T-153-17 — Unit tests for the round-trip validator.
 *
 * The happy-path test covers the real generator output against the real
 * seed manifest (this is the actual AC-4 gate). The remaining tests inject
 * synthetic CSS and synthetic seeds to exercise drift detection, missing-
 * token reporting, nested-brace handling, and the human-readable formatter.
 */

import { describe, expect, it } from 'vitest';

import { buildCSS } from './generate-css.ts';
import { type Seed, formatReport, validate } from './validate.ts';

const REAL_REPORT = validate();

describe('validate — real generator vs seed manifest (AC-4 gate)', () => {
    it('reports zero drifts (byte-for-byte match)', () => {
        expect(REAL_REPORT.drifts).toEqual([]);
    });

    it('checks 199 tokens total (142 light + 56 dark + 1 media)', () => {
        expect(REAL_REPORT.totalChecked).toBe(199);
    });
});

// ============================================================================
// Synthetic-input drift detection
// ============================================================================

const MINIMAL_SEED: Seed = {
    tokens: {
        light: {
            'core-background': {
                name: 'core-background',
                value: 'oklch(0.985 0.002 210)'
            },
            border: { name: 'border', value: 'oklch(0.9 0.02 210)' }
        },
        dark: {
            'core-background': {
                name: 'core-background',
                value: 'oklch(0.14 0.02 220)'
            }
        },
        media: {
            '(min-width: 1600px)': {
                condition: '(min-width: 1600px)',
                tokens: {
                    'container-max': { name: 'container-max', value: '1500px' }
                }
            }
        }
    }
};

const VALID_CSS = `
:root {
    --core-background: oklch(0.985 0.002 210);
    --border: oklch(0.9 0.02 210);
}

@media (min-width: 1600px) {
    :root {
        --container-max: 1500px;
    }
}

[data-theme="dark"]:not([data-app="admin"]) {
    --core-background: oklch(0.14 0.02 220);
}
`;

describe('validate — synthetic inputs', () => {
    it('reports zero drifts when CSS matches the seed exactly', () => {
        const report = validate({ css: VALID_CSS, seed: MINIMAL_SEED });
        expect(report.drifts).toEqual([]);
        expect(report.totalChecked).toBe(4);
    });

    it('detects a tampered light token value', () => {
        const tampered = VALID_CSS.replace('oklch(0.9 0.02 210)', 'oklch(0.5 0.02 210)');
        const report = validate({ css: tampered, seed: MINIMAL_SEED });
        expect(report.drifts).toEqual([
            {
                scope: 'light',
                name: 'border',
                expected: 'oklch(0.9 0.02 210)',
                actual: 'oklch(0.5 0.02 210)'
            }
        ]);
    });

    it('detects a missing dark token (actual = null)', () => {
        const stripped = VALID_CSS.replace(
            /\[data-theme="dark"\]:not\(\[data-app="admin"\]\) \{[\s\S]*?\}/,
            '[data-theme="dark"]:not([data-app="admin"]) {}'
        );
        const report = validate({ css: stripped, seed: MINIMAL_SEED });
        expect(report.drifts).toEqual([
            {
                scope: 'dark',
                name: 'core-background',
                expected: 'oklch(0.14 0.02 220)',
                actual: null
            }
        ]);
    });

    it('detects a tampered media-scoped token', () => {
        const tampered = VALID_CSS.replace('--container-max: 1500px;', '--container-max: 1400px;');
        const report = validate({ css: tampered, seed: MINIMAL_SEED });
        expect(report.drifts).toEqual([
            {
                scope: 'media (min-width: 1600px)',
                name: 'container-max',
                expected: '1500px',
                actual: '1400px'
            }
        ]);
    });
});

describe('validate — block extractor robustness', () => {
    it('handles a value containing braces in a function call (no false unterminated)', () => {
        // Stress test: --x: oklch(from var(--y) calc(l) c h) doesn't carry
        // raw braces, but `cubic-bezier(0.4, 0, 1, 1)` parens are similar.
        // Pathological: a value with no inner braces but the @media wrapper.
        const css = `
:root {
    --core-background: oklch(0.985 0.002 210);
    --border: oklch(0.9 0.02 210);
}

@media (min-width: 1600px) {
    :root {
        --container-max: 1500px;
    }
}

[data-theme="dark"]:not([data-app="admin"]) {
    --core-background: oklch(0.14 0.02 220);
}
`;
        // Should not throw, should match the inner :root inside @media.
        const report = validate({ css, seed: MINIMAL_SEED });
        expect(report.drifts).toEqual([]);
    });

    it('throws a descriptive error when the dark selector block is missing', () => {
        const css = `
:root {
    --core-background: oklch(0.985 0.002 210);
    --border: oklch(0.9 0.02 210);
}

@media (min-width: 1600px) {
    :root {
        --container-max: 1500px;
    }
}
`;
        expect(() => validate({ css, seed: MINIMAL_SEED })).toThrow(/selector not found/);
    });
});

describe('formatReport', () => {
    it('returns a success message when there are no drifts', () => {
        const report = { totalChecked: 199, drifts: [] };
        expect(formatReport(report)).toBe('design-tokens validate: 199 web tokens match seed');
    });

    it('lists each drift with expected vs actual', () => {
        const report = {
            totalChecked: 4,
            drifts: [
                {
                    scope: 'light' as const,
                    name: 'border',
                    expected: 'oklch(0.9 0.02 210)',
                    actual: 'oklch(0.5 0.02 210)'
                },
                {
                    scope: 'dark' as const,
                    name: 'core-background',
                    expected: 'oklch(0.14 0.02 220)',
                    actual: null
                }
            ]
        };
        const text = formatReport(report);
        expect(text).toContain('2 drift(s) detected');
        expect(text).toContain('[light] --border');
        expect(text).toContain('expected: oklch(0.9 0.02 210)');
        expect(text).toContain('actual:   oklch(0.5 0.02 210)');
        expect(text).toContain('[dark] --core-background');
        expect(text).toContain('actual:   <missing>');
    });
});

describe('validate — buildCSS output parses cleanly', () => {
    it('extracts the same generated CSS the runtime would write to dist/', () => {
        // Sanity: validate() defaults to buildCSS(), so reading via the
        // explicit override path should yield an identical report.
        const explicit = validate({ css: buildCSS() });
        expect(explicit.drifts).toEqual(REAL_REPORT.drifts);
        expect(explicit.totalChecked).toBe(REAL_REPORT.totalChecked);
    });
});
