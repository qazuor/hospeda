/**
 * @file audience-card-content.test.ts
 * @description Executes what the plan index's five cards SAY and how they are
 * marked (HOS-942 AC-1b / AC-2b).
 *
 * The page file can only ever be source-read — Vitest cannot render `.astro` —
 * and a source-reading assertion cannot tell "this card shows three
 * audience-specific bullets" from "this card shows the same line five times",
 * which is exactly the defect the owner reported. So the content lives in a
 * module and is asserted here, against real locale data.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    AUDIENCE_CARD_ICONS,
    AUDIENCE_HIGHLIGHT_COUNT,
    audienceHighlightKeys,
    resolveAudienceHighlights
} from '@/lib/billing/audience-card-content';
import { AUDIENCE_CARD_ORDER } from '@/lib/billing/audience-plans';
import type { TranslationFn } from '@/lib/i18n';

/**
 * The real Spanish locale file, read from disk rather than through
 * `createTranslations`: this suite has to prove the bullets EXIST as translated
 * copy, and a translator stubbed to echo its fallback would pass with the locale
 * file empty.
 */
const es = JSON.parse(
    readFileSync(
        resolve(__dirname, '../../../../../packages/i18n/src/locales/es/pricing.json'),
        'utf8'
    )
) as Record<string, unknown>;

/** Resolve a dot-notation key against a locale document, or `undefined`. */
function lookup(doc: Record<string, unknown>, key: string): string | undefined {
    let node: unknown = doc;
    for (const segment of key.split('.')) {
        if (typeof node !== 'object' || node === null) return undefined;
        node = (node as Record<string, unknown>)[segment];
    }
    return typeof node === 'string' ? node : undefined;
}

/** A translator backed by the real `es` file, minus its `pricing.` prefix. */
const t: TranslationFn = (key, fallback) =>
    lookup(es, key.replace(/^pricing\./, '')) ?? fallback ?? key;

/** A translator that resolves nothing — the "locale file lost a key" case. */
const emptyT: TranslationFn = (key, fallback) => fallback ?? key;

describe('audienceHighlightKeys', () => {
    it('asks for one key per highlight slot, in order', () => {
        expect(audienceHighlightKeys({ id: 'host' })).toEqual([
            'pricing.index.cards.host.highlights.item1',
            'pricing.index.cards.host.highlights.item2',
            'pricing.index.cards.host.highlights.item3'
        ]);
    });

    it('derives the slot count from the constant, not a literal', () => {
        for (const id of AUDIENCE_CARD_ORDER) {
            expect(audienceHighlightKeys({ id })).toHaveLength(AUDIENCE_HIGHLIGHT_COUNT);
        }
    });
});

describe('resolveAudienceHighlights — every audience actually has copy', () => {
    it('gives all five audiences the full set of bullets', () => {
        for (const id of AUDIENCE_CARD_ORDER) {
            expect(resolveAudienceHighlights({ id, t }), id).toHaveLength(AUDIENCE_HIGHLIGHT_COUNT);
        }
    });

    it('says something different to each audience — no interchangeable line', () => {
        // This is the owner's complaint stated as an assertion: five cards whose
        // only difference was a paragraph read as a list of links. Every bullet
        // across the whole index must be unique, so a line copied between two
        // verticals fails here rather than shipping.
        const all = AUDIENCE_CARD_ORDER.flatMap((id) => resolveAudienceHighlights({ id, t }));

        expect(all).toHaveLength(AUDIENCE_CARD_ORDER.length * AUDIENCE_HIGHLIGHT_COUNT);
        expect(new Set(all).size).toBe(all.length);
    });

    it('never writes a price, a trial length or a payment condition into a bullet', () => {
        // A number here would go stale the moment an operator edits the
        // catalogue, and nothing would report it. "sin tarjeta" is banned copy.
        for (const id of AUDIENCE_CARD_ORDER) {
            for (const line of resolveAudienceHighlights({ id, t })) {
                expect(line, `${id}: ${line}`).not.toMatch(/\$\s?\d/);
                expect(line, `${id}: ${line}`).not.toMatch(/\d+\s*d[ií]as/i);
                expect(line, `${id}: ${line}`).not.toMatch(/sin tarjeta/i);
            }
        }
    });

    it('never names a partner TIER, which is never rendered publicly', () => {
        // HOS-294: the tier decides whether a partner gets its own page and is
        // deliberately absent from every public surface.
        for (const line of resolveAudienceHighlights({ id: 'partner', t })) {
            expect(line).not.toMatch(/\b(gold|silver|oro|plata)\b/i);
        }
    });

    it('drops a bullet whose key did not translate instead of printing the key', () => {
        // `resolve()` returns the raw dotted key when it finds nothing, so a
        // locale file that lost a line would otherwise print
        // `pricing.index.cards.host.highlights.item3` inside the card.
        expect(resolveAudienceHighlights({ id: 'host', t: emptyT })).toEqual([]);
    });

    it('drops the dev-mode missing marker too', () => {
        const devT: TranslationFn = (key) => `[MISSING: ${key}]`;

        expect(resolveAudienceHighlights({ id: 'tourist', t: devT })).toEqual([]);
    });

    it('keeps a translated sentence that merely ends in a full stop', () => {
        // The drop rule compares the resolved value against the key that
        // produced it. A blanket "looks like a dotted key" test would delete
        // every bullet here, all of which end in a period.
        const resolved = resolveAudienceHighlights({ id: 'gastronomy', t });

        expect(resolved).toHaveLength(AUDIENCE_HIGHLIGHT_COUNT);
        expect(resolved.every((line) => line.endsWith('.'))).toBe(true);
    });

    it('drops a bullet that translated to whitespace', () => {
        const blankT: TranslationFn = (key) => (key.endsWith('item2') ? '   ' : `copy for ${key}`);
        const resolved = resolveAudienceHighlights({ id: 'experience', t: blankT });

        expect(resolved).toHaveLength(AUDIENCE_HIGHLIGHT_COUNT - 1);
        expect(resolved.some((line) => line.trim().length === 0)).toBe(false);
    });
});

describe('AUDIENCE_CARD_ICONS — the non-textual mark', () => {
    it('marks every audience', () => {
        for (const id of AUDIENCE_CARD_ORDER) {
            expect(AUDIENCE_CARD_ICONS[id], id).toBeDefined();
        }
    });

    it('gives each audience its OWN glyph — a repeated one distinguishes nothing', () => {
        const glyphs = AUDIENCE_CARD_ORDER.map((id) => AUDIENCE_CARD_ICONS[id]);

        expect(new Set(glyphs).size).toBe(AUDIENCE_CARD_ORDER.length);
    });
});
