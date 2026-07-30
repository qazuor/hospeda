/**
 * @file ink-literals.test.ts
 * @description Unit tests for the HOS-314 ink predicate.
 *
 * WHY THIS FILE EXISTS. `findBareInkDeclarations` became the single load-bearing
 * predicate for this issue's central invariant, and its only consumers assert
 * `expect(findBareInkDeclarations(src)).toEqual([])` against files that currently
 * yield `[]`. A negative assertion against an empty result cannot distinguish a
 * working predicate from one that matches nothing: round 4 proved it by inserting
 * an early `return []` and watching all three component suites pass. Extracting
 * the invariant into a shared helper moved it OUT of the coverage the guard file
 * it replaced had for its inline predicates — so the mutation tests move with it.
 *
 * Every positive row below is a vector a judge actually used to defeat an earlier
 * revision of this check, so this file doubles as the regression record: if the
 * predicate is ever weakened, the row naming the original bypass goes red.
 *
 * @module test/static-guards/ink-literals
 */

import { describe, expect, it } from 'vitest';

import { APPROVED_INK_TOKENS, findBareInkDeclarations } from './ink-literals';

describe('findBareInkDeclarations — values it must REJECT', () => {
    it.each([
        // The original defect, in every spelling of white. The rule is "nothing but
        // approved tokens", not "no white", which is why these all fall out at once.
        ['plain keyword', '.a { color: white; }'],
        ['3-digit hex', '.a { color: #fff; }'],
        ['6-digit hex', '.a { color: #ffffff; }'],
        ['near-white hex', '.a { color: #fefefe; }'],
        ['8-digit hex with alpha', '.a { color: #ffffffff; }'],
        ['space-separated rgb()', '.a { color: rgb(255 255 255); }'],
        ['legacy rgba()', '.a { color: rgba(255, 255, 255, 1); }'],
        ['hsl()', '.a { color: hsl(0 0% 100%); }'],
        ['oklch() — the form this repo authors colors in', '.a { color: oklch(1 0 0); }'],
        ['a CSS named color', '.a { color: WhiteSmoke; }'],
        // Cascade vectors: all six defeated the per-rule revisions of the guard.
        [
            'a duplicate selector later in the file',
            '.cta { color: var(--core-foreground); }\n.cta { color: white; }'
        ],
        ['a descendant selector', '.wrap .cta { color: #fff; }'],
        ['an :is() wrapper', ':is(.cta) { color: white; }'],
        ['a child universal selector', '.cta > * { color: white; }'],
        ['a @media re-declaration', '@media (min-width: 900px) { .cta { color: white; } }'],
        ['-webkit-text-fill-color, which beats color', '.a { -webkit-text-fill-color: #fff; }'],
        // Round 4's three laundering paths.
        [
            'a var() FALLBACK, which paints when the token is undefined',
            '.a { color: var(--nope, white); }'
        ],
        [
            'a var() fallback on the webkit property',
            '.a { -webkit-text-fill-color: var(--x, #fff); }'
        ],
        ['an unapproved token that happens to be white', '.a { color: var(--surface-overlay); }'],
        ['one hop through a local custom property', '.a { --ink: white; color: var(--ink); }'],
        // Case-insensitivity is part of the CSS grammar.
        ['an uppercase property name', '.a { COLOR: #ffffff; }'],
        ['a mixed-case property name', '.a { Color: white; }'],
        // `!important` must not defeat the check.
        ['a literal marked !important', '.a { color: white !important; }'],
        // `inherit` resolves to the section ink, which inverts to near-white in dark.
        ['inherit, which inverts to near-white on a green fill in dark', '.a { color: inherit; }'],
        // The glyph's ink is an attribute, not a declaration.
        ['an SVG fill attribute', '<svg><path fill="#fff" /></svg>'],
        ['an SVG stroke attribute', '<svg><path stroke="white" /></svg>']
    ])('rejects %s', (_label, source) => {
        expect(findBareInkDeclarations(source).length).toBeGreaterThan(0);
    });

    it('names the reason a fallback was rejected', () => {
        const [offender] = findBareInkDeclarations('.a { color: var(--nope, white); }');
        expect(offender?.reason).toContain('fallback');
    });

    it('names the unapproved token, so the diff is actionable', () => {
        const [offender] = findBareInkDeclarations('.a { color: var(--surface-overlay); }');
        expect(offender?.reason).toContain('--surface-overlay');
    });
});

describe('findBareInkDeclarations — values it must ACCEPT', () => {
    it.each(APPROVED_INK_TOKENS)('accepts the approved token %s', (token) => {
        expect(findBareInkDeclarations(`.a { color: var(${token}); }`)).toEqual([]);
    });

    it.each([
        ['currentColor, which inherits the computed token ink', '.a { color: currentColor; }'],
        ['currentColor in any case', '.a { color: CURRENTCOLOR; }'],
        ['an SVG fill of currentColor', '<svg><path fill="currentColor" /></svg>'],
        ['fill="none"', '<svg><path fill="none" /></svg>'],
        ['an approved token marked !important', '.a { color: var(--core-foreground) !important; }'],
        ['no whitespace after the colon', '.a { color:var(--core-foreground); }']
    ])('accepts %s', (_label, source) => {
        expect(findBareInkDeclarations(source)).toEqual([]);
    });

    it.each([
        ['background-color', '.a { background-color: #25d366; }'],
        ['border-color', '.a { border-color: white; }'],
        ['accent-color', '.a { accent-color: white; }'],
        ['text-decoration-color', '.a { text-decoration-color: white; }'],
        ['scrollbar-color', '.a { scrollbar-color: white transparent; }'],
        ['a custom property whose NAME ends in color', '.a { --brand-color: white; }']
    ])('does not treat %s as ink', (_label, source) => {
        expect(findBareInkDeclarations(source)).toEqual([]);
    });

    it('exempts a color literal that appears only in comment prose', () => {
        // The three components document rejected colors in prose ("#128c7e reads
        // 3.57:1"), so a predicate that counted those would go red on the very
        // explanation of why it exists.
        const source =
            '/* was color: white, which measured 1.98:1 */\n.a { color: var(--core-foreground); }';
        expect(findBareInkDeclarations(source)).toEqual([]);
    });

    it('exempts a line comment mentioning an ink literal', () => {
        expect(findBareInkDeclarations('// color: #fff was the old ink\nconst a = 1;')).toEqual([]);
    });
});

describe('the predicate itself is not vacuous', () => {
    it('detects something in a file that mixes approved and unapproved ink', () => {
        // The shape the three component tests assert against: a file where most ink
        // is fine and exactly one declaration is not. A predicate returning [] for
        // everything would pass those tests, which is what this file exists to stop.
        const source = [
            '.title { color: var(--core-foreground); }',
            '.btn { color: var(--channel-whatsapp-foreground); }',
            '.btn > span { color: white; }'
        ].join('\n');

        const offenders = findBareInkDeclarations(source);
        expect(offenders).toHaveLength(1);
        expect(offenders[0]?.value).toBe('white');
    });

    it('reports the property that was set, not just the value', () => {
        const [offender] = findBareInkDeclarations('.a { -webkit-text-fill-color: white; }');
        expect(offender?.property).toBe('-webkit-text-fill-color');
    });

    it('does not let a value bleed across lines into the diagnostic', () => {
        const source = '.a { color: white\n}\n.b { color: var(--core-foreground); }';
        expect(findBareInkDeclarations(source)[0]?.value).toBe('white');
    });
});
