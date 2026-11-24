/**
 * Unit tests for the account CSS literals guard (HOS-2470, HOS-2413 T-009).
 *
 * Non-vacuity: one synthetic violation per category, a literal `var()`
 * fallback, a component-local custom property holding a hex value, the allowed
 * keywords passing, the strict-zone refusal and a stale count. Then the
 * repo-wide state against the committed exceptions list.
 */
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    classifyDeclaration,
    countHits,
    EXCEPTIONS_CEILING,
    findLiteralHits,
    legacyBaseline,
    MIN_SCANNED_FILES,
    readExceptions,
    scanAccountLiterals,
    unwrapVars
} from '../check-account-css-literals.js';
import { compareWithExceptions, summarize } from '../lib/account-css-scope.js';

const ROOT = resolve(import.meta.dirname, '..', '..');
const KIT_CSS = 'apps/web/src/components/account/ui/Section.module.css';
const LEGACY_CSS = 'apps/web/src/components/account/AlertsList.module.css';

const cats = (property: string, value: string) => classifyDeclaration({ property, value });

describe('classifyDeclaration — one violation per category', () => {
    it.each([
        ['font-size in px', 'font-size', '14px', ['font-size']],
        ['font-size in rem', 'font-size', '0.875rem', ['font-size']],
        ['font-size keyword', 'font-size', 'small', ['font-size']],
        ['font-size clamp', 'font-size', 'clamp(1rem, 2vw, 2rem)', ['font-size']],
        ['font shorthand with a size', 'font', '500 15px/20px var(--font-sans)', ['font-size']],
        ['border-radius', 'border-radius', '8px', ['radius']],
        ['a radius longhand', 'border-top-left-radius', '4px', ['radius']],
        ['a logical radius longhand', 'border-start-end-radius', '0.5rem', ['radius']],
        ['box-shadow built by hand', 'box-shadow', '0 0 0 2px var(--focus-ring)', ['shadow']],
        ['a hex color', 'color', '#fff', ['color']],
        ['rgba()', 'background', 'rgba(0, 0, 0, 0.6)', ['color']],
        ['hsl()', 'border-color', 'hsl(0 0% 50%)', ['color']],
        ['oklch()', 'color', 'oklch(0.45 0.13 75)', ['color']],
        ['oklab()', 'outline-color', 'oklab(0.5 0.1 0.1)', ['color']],
        [
            'relative oklch from a token',
            'background',
            'oklch(from var(--brand-primary) l c h / 0.1)',
            ['color']
        ],
        ['a named color', 'border', '1px solid red', ['color']],
        [
            'a shadow with a literal color',
            'box-shadow',
            '0 1px 2px rgba(0,0,0,.08)',
            ['shadow', 'color']
        ]
    ])('flags %s', (_name, property, value, expected) => {
        expect(cats(property, value)).toEqual(expected);
    });

    it.each([
        ['font-size', 'var(--text-body, 16px)', ['font-size']],
        ['border-radius', 'var(--radius-md, 10px)', ['radius']],
        ['box-shadow', 'var(--shadow-card, 0 2px 8px var(--core-foreground-a08))', ['shadow']],
        ['color', 'var(--core-muted-foreground, #6b7280)', ['color']],
        ['background', 'var(--a, var(--b, white))', ['color']]
    ])('counts a literal var() fallback in %s (%s)', (property, value, expected) => {
        expect(cats(property, value)).toEqual(expected);
    });

    it('flags a component-local custom property holding a hex value', () => {
        expect(cats('--audience-ink', '#3b82f6')).toEqual(['color']);
        expect(cats('--chip-bg', 'white')).toEqual(['color']);
    });
});

describe('classifyDeclaration — allowed values pass', () => {
    it.each([
        ['font-size', 'var(--app-body-size)'],
        ['font-size', 'inherit'],
        ['font-size', '1em'],
        ['font-size', '100%'],
        ['font', 'var(--app-title)'],
        ['font', 'inherit'],
        ['border-radius', 'var(--radius-surface)'],
        ['border-radius', '0'],
        ['border-radius', '50%'],
        ['border-radius', 'var(--radius-control) var(--radius-control) 0 0'],
        ['box-shadow', 'none'],
        ['box-shadow', 'var(--shadow-sticky)'],
        ['color', 'var(--core-foreground)'],
        ['color', 'currentColor'],
        ['background', 'transparent'],
        ['border', '1px solid var(--border)'],
        ['background', 'url("/img/red.svg") no-repeat'],
        ['--kit-gap', 'var(--space-4)'],
        ['grid-template-areas', '"red blue"'],
        ['padding', '12px 16px']
    ])('accepts %s: %s', (property, value) => {
        expect(cats(property, value)).toEqual([]);
    });
});

describe('unwrapVars', () => {
    it('drops a bare var and keeps a fallback, nested included', () => {
        expect(unwrapVars({ value: 'var(--a)' }).trim()).toBe('');
        expect(unwrapVars({ value: 'var(--a, 16px)' }).trim()).toBe('16px');
        expect(unwrapVars({ value: 'var(--a, var(--b, #fff))' }).trim()).toBe('#fff');
    });
});

describe('findLiteralHits — file types', () => {
    it('reads .astro <style> blocks and style="" attributes with the right lines', () => {
        const source =
            '<div style="color: #fff; font-size: 12px"></div>\n<style>\n  .a { border-radius: 4px; }\n</style>';
        const hits = findLiteralHits({ file: 'apps/web/src/layouts/AccountShell.astro', source });
        expect(hits.map((h) => [h.category, h.line])).toEqual([
            ['color', 1],
            ['font-size', 1],
            ['radius', 3]
        ]);
    });

    it('reads literal entries of a TSX style object, numbers as px', () => {
        const source =
            "export const A = () => <div style={{ fontSize: 14, borderRadius: '50%', color: 'tomato', margin: 0 }} />;";
        const hits = findLiteralHits({ file: 'apps/web/src/components/account/ui/A.tsx', source });
        expect(hits.map((h) => h.category)).toEqual(['font-size', 'color']);
    });

    it('ignores commented-out literals and @supports probes', () => {
        const source =
            '/* .a { color: #fff; } */\n@supports (color: oklch(0 0 0)) { .a { color: var(--x); } }';
        expect(findLiteralHits({ file: KIT_CSS, source })).toEqual([]);
    });

    it('does not take a selector pseudo-class or a media prelude for a declaration', () => {
        const source =
            'a:hover{color:var(--x)}\n@media (min-width: 48rem) { .b { color: var(--y); } }';
        expect(findLiteralHits({ file: KIT_CSS, source })).toEqual([]);
    });
});

describe('frozen exceptions list', () => {
    const ceiling = { entries: 10, total: 10 };

    it('refuses an entry in the strict zone', () => {
        const result = compareWithExceptions({
            observed: {},
            exceptions: { [KIT_CSS]: { color: 1 } },
            ceiling
        });
        expect(result.strictEntries).toEqual([KIT_CSS]);
    });

    it('fails a stale count per category', () => {
        const result = compareWithExceptions({
            observed: { [LEGACY_CSS]: { color: 2, radius: 1 } },
            exceptions: { [LEGACY_CSS]: { color: 2, radius: 2 } },
            ceiling
        });
        expect(result.stale).toEqual([`${LEGACY_CSS} › radius: 1 found, 2 pinned`]);
    });

    it('fails a category that appears in a file pinned only for another', () => {
        const result = compareWithExceptions({
            observed: { [LEGACY_CSS]: { color: 1, shadow: 1 } },
            exceptions: { [LEGACY_CSS]: { color: 1 } },
            ceiling
        });
        expect(result.raised).toEqual([`${LEGACY_CSS} › shadow: 1 found, 0 pinned`]);
    });
});

describe('repo-wide state', () => {
    const scan = scanAccountLiterals({ root: ROOT });
    const exceptions = readExceptions({ root: ROOT });

    it('scans a plausible number of account files', () => {
        expect(scan.scannedFiles).toBeGreaterThanOrEqual(MIN_SCANNED_FILES);
    });

    it('matches the committed exceptions list exactly, with zero strict-zone hits', () => {
        const result = compareWithExceptions({
            observed: countHits({ hits: scan.hits }),
            exceptions,
            ceiling: EXCEPTIONS_CEILING
        });
        expect(result).toEqual({
            strictHits: [],
            strictEntries: [],
            raised: [],
            stale: [],
            ceilingBreach: null
        });
    });

    it('keeps the ceiling equal to the list, so a shrink lowers it in the same PR', () => {
        expect(summarize({ counts: exceptions })).toEqual(EXCEPTIONS_CEILING);
    });

    it('never exceeds the size the list was born with (HOS-2413 PR-1: 358 entries, 1682 hits)', () => {
        expect(EXCEPTIONS_CEILING.entries).toBeLessThanOrEqual(358);
        expect(EXCEPTIONS_CEILING.total).toBeLessThanOrEqual(1682);
    });

    it('holds the drained list at zero, so any entry breaches the ceiling (HOS-2508)', () => {
        expect(EXCEPTIONS_CEILING).toEqual({ entries: 0, total: 0 });
        expect(exceptions).toEqual({});
        const result = compareWithExceptions({
            observed: { [LEGACY_CSS]: { color: 1 } },
            exceptions: { [LEGACY_CSS]: { color: 1 } },
            ceiling: EXCEPTIONS_CEILING
        });
        expect(result.ceilingBreach).not.toBeNull();
    });

    it('prints a baseline equal to the committed list', () => {
        expect(legacyBaseline({ counts: countHits({ hits: scan.hits }) })).toEqual(exceptions);
    });
});
