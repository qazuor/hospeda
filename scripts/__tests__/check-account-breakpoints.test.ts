/**
 * Unit tests for the account breakpoint guard (HOS-2469, HOS-2413 T-008).
 *
 * Non-vacuity first: every rule must flag its synthetic violation, the strict
 * zone must refuse an exceptions entry, and a stale count must fail. Then the
 * repo-wide state, so the guard cannot quietly become unable to fail.
 */
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    countHits,
    EXCEPTIONS_CEILING,
    findBreakpointHits,
    isAllowedContainerQuery,
    isAllowedMediaQuery,
    legacyBaseline,
    MIN_SCANNED_FILES,
    readExceptions,
    scanAccountBreakpoints
} from '../check-account-breakpoints.js';
import {
    compareWithExceptions,
    isInAccountScope,
    isInStrictZone,
    summarize
} from '../lib/account-css-scope.js';

const ROOT = resolve(import.meta.dirname, '..', '..');
const KIT_CSS = 'apps/web/src/components/account/ui/Button.module.css';
const LEGACY_CSS = 'apps/web/src/components/account/AlertsList.module.css';

const rules = (file: string, source: string) =>
    findBreakpointHits({ file, source }).map((hit) => hit.rule);

describe('findBreakpointHits — violations are flagged', () => {
    it.each([
        ['max-width in the kit', '@media (max-width: 48rem) { .a { color: red; } }'],
        ['a px breakpoint', '@media (min-width: 768px) { .a { display: none; } }'],
        ['a rem value off the list', '@media (min-width: 40rem) { .a { display: none; } }'],
        ['a bounded range', '@media (48rem <= width < 64rem) { .a { display: none; } }'],
        ['an upper-bound range', '@media (width < 64rem) { .a { display: none; } }'],
        ['a device-width query', '@media (min-device-width: 48rem) { .a { top: 0; } }'],
        ['one bad feature among good ones', '@media (min-width: 48rem) and (max-width: 1023px) {}']
    ])('flags %s', (_name, source) => {
        expect(rules(KIT_CSS, source)).toEqual(['media']);
    });

    it('flags matchMedia with a px query', () => {
        const source = "const mq = window.matchMedia('(min-width: 1024px)');";
        expect(rules('apps/web/src/components/account/ui/Bar.tsx', source)).toEqual([
            'match-media'
        ]);
    });

    it('flags client:media off the list', () => {
        const source = '<Bar client:media="(max-width: 767px)" />';
        expect(rules('apps/web/src/layouts/AccountShell.astro', source)).toEqual(['client-media']);
    });

    it('flags a @container length that is not rem', () => {
        expect(rules(KIT_CSS, '@container (width < 480px) { .a { padding: 0; } }')).toEqual([
            'container'
        ]);
    });

    it('scans <style> blocks of an .astro file and reports the right line', () => {
        const source =
            '---\nconst a = 1;\n---\n<div />\n<style>\n  @media (max-width: 768px) {}\n</style>';
        const hits = findBreakpointHits({
            file: 'apps/web/src/layouts/AccountShell.astro',
            source
        });
        expect(hits).toHaveLength(1);
        expect(hits[0]?.line).toBe(6);
    });
});

describe('findBreakpointHits — allowed forms pass', () => {
    it.each([
        [
            'the four min-width values',
            '@media (min-width: 30rem) {} @media (min-width: 48rem) {} @media (min-width: 64rem) {} @media (min-width: 80rem) {}'
        ],
        ['range syntax', '@media (width >= 64rem) {} @media (48rem <= width) {}'],
        ['screen and a min-width', '@media screen and (min-width: 48rem) {}'],
        [
            'prefers-* and other non-width features',
            '@media (prefers-reduced-motion: reduce) {} @media (hover: hover) and (pointer: fine) {} @media print {} @media (forced-colors: active) {}'
        ],
        [
            '@container in rem, any value',
            '@container (width < 30rem) {} @container account-content (min-width: 37.5rem) {}'
        ],
        ['a commented-out violation', '/* @media (max-width: 768px) {} */'],
        ['a @supports probe', '@supports (width: 1px) { .a { display: grid; } }']
    ])('accepts %s', (_name, source) => {
        expect(rules(KIT_CSS, source)).toEqual([]);
    });

    it('accepts the complement in matchMedia and client:media', () => {
        const tsx = "matchMedia('(max-width: 63.99rem)'); matchMedia('(min-width: 64rem)');";
        const astro = '<Bar client:media="(max-width: 63.99rem)" />';
        expect(rules('apps/web/src/components/account/ui/Bar.tsx', tsx)).toEqual([]);
        expect(rules('apps/web/src/layouts/AccountShell.astro', astro)).toEqual([]);
    });

    it('does not accept the complement inside a CSS @media', () => {
        expect(rules(KIT_CSS, '@media (max-width: 63.99rem) {}')).toEqual(['media']);
    });
});

describe('query predicates', () => {
    it('rejects an off-list complement even in matchMedia', () => {
        expect(isAllowedMediaQuery({ query: '(max-width: 50rem)', allowComplement: true })).toBe(
            false
        );
    });

    it('accepts a zero length in a container query', () => {
        expect(isAllowedContainerQuery({ prelude: '(width > 0)' })).toBe(true);
    });
});

describe('scope and zones', () => {
    it('puts the kit, AccountShell and AccountHeader in the strict zone', () => {
        expect(isInStrictZone({ file: KIT_CSS })).toBe(true);
        expect(isInStrictZone({ file: 'apps/web/src/layouts/AccountShell.astro' })).toBe(true);
        expect(isInStrictZone({ file: 'apps/web/src/layouts/AccountHeader.astro' })).toBe(true);
        expect(isInStrictZone({ file: LEGACY_CSS })).toBe(false);
    });

    it('covers the account folders, layouts and listed components, not the public site', () => {
        expect(isInAccountScope({ file: LEGACY_CSS })).toBe(true);
        expect(isInAccountScope({ file: 'apps/web/src/pages/[lang]/mi-cuenta/index.astro' })).toBe(
            true
        );
        expect(isInAccountScope({ file: 'apps/web/src/layouts/EditorShellLayout.astro' })).toBe(
            true
        );
        expect(
            isInAccountScope({ file: 'apps/web/src/components/venue/VenueMenuManager.module.css' })
        ).toBe(true);
        expect(isInAccountScope({ file: 'apps/web/src/components/venue/VenueCard.astro' })).toBe(
            false
        );
        expect(
            isInAccountScope({
                file: 'apps/web/src/components/shared/navigation/Breadcrumbs.astro'
            })
        ).toBe(false);
        expect(isInAccountScope({ file: 'apps/web/src/layouts/BaseLayout.astro' })).toBe(false);
        expect(
            isInAccountScope({ file: 'apps/web/src/components/account/ui/Button.test.tsx' })
        ).toBe(false);
    });
});

describe('frozen exceptions list', () => {
    const ceiling = { entries: 10, total: 10 };

    it('refuses an exceptions entry under the strict zone', () => {
        const result = compareWithExceptions({
            observed: {},
            exceptions: { [KIT_CSS]: { media: 1 } },
            ceiling
        });
        expect(result.strictEntries).toEqual([KIT_CSS]);
    });

    it('fails a strict-zone hit even when nothing is pinned elsewhere', () => {
        const result = compareWithExceptions({
            observed: { [KIT_CSS]: { media: 1 } },
            exceptions: {},
            ceiling
        });
        expect(result.strictHits).toEqual([KIT_CSS]);
    });

    it('fails a stale count (a hit was removed but the entry still pins it)', () => {
        const result = compareWithExceptions({
            observed: { [LEGACY_CSS]: { media: 1 } },
            exceptions: { [LEGACY_CSS]: { media: 2 } },
            ceiling
        });
        expect(result.stale).toHaveLength(1);
        expect(result.raised).toEqual([]);
    });

    it('fails a raised count and a new file', () => {
        const result = compareWithExceptions({
            observed: {
                [LEGACY_CSS]: { media: 3 },
                'apps/web/src/components/account/New.module.css': { media: 1 }
            },
            exceptions: { [LEGACY_CSS]: { media: 2 } },
            ceiling
        });
        expect(result.raised).toHaveLength(2);
    });

    it('fails when the list grows past its frozen ceiling', () => {
        const result = compareWithExceptions({
            observed: { [LEGACY_CSS]: { media: 11 } },
            exceptions: { [LEGACY_CSS]: { media: 11 } },
            ceiling
        });
        expect(result.ceilingBreach).not.toBeNull();
    });

    it('passes an exact match', () => {
        const result = compareWithExceptions({
            observed: { [LEGACY_CSS]: { media: 2 } },
            exceptions: { [LEGACY_CSS]: { media: 2 } },
            ceiling
        });
        expect(result).toEqual({
            strictHits: [],
            strictEntries: [],
            raised: [],
            stale: [],
            ceilingBreach: null
        });
    });
});

describe('repo-wide state', () => {
    const scan = scanAccountBreakpoints({ root: ROOT });
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

    it('never exceeds the size the list was born with (HOS-2413 PR-1: 38 entries, 60 hits)', () => {
        expect(EXCEPTIONS_CEILING.entries).toBeLessThanOrEqual(38);
        expect(EXCEPTIONS_CEILING.total).toBeLessThanOrEqual(60);
    });

    it('holds the drained list at zero, so any entry breaches the ceiling (HOS-2508)', () => {
        expect(EXCEPTIONS_CEILING).toEqual({ entries: 0, total: 0 });
        expect(exceptions).toEqual({});
        const result = compareWithExceptions({
            observed: { [LEGACY_CSS]: { media: 1 } },
            exceptions: { [LEGACY_CSS]: { media: 1 } },
            ceiling: EXCEPTIONS_CEILING
        });
        expect(result.ceilingBreach).not.toBeNull();
    });

    it('prints a baseline equal to the committed list', () => {
        expect(legacyBaseline({ counts: countHits({ hits: scan.hits }) })).toEqual(exceptions);
    });
});
