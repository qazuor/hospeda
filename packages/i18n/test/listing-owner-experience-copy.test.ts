/**
 * HOS-2610 F-22: the experience variants of the owner list and editor copy
 * never talk about a «comercio»; venue copy keeps its own wording.
 */

import { describe, expect, it } from 'vitest';
import en from '../src/locales/en/listing.json';
import es from '../src/locales/es/listing.json';
import pt from '../src/locales/pt/listing.json';

type Pair = { readonly venue: string; readonly experience: string };

const pairsOf = (locale: typeof es): readonly Pair[] => [
    locale.owner.list.subtitle,
    locale.owner.list.empty,
    locale.owner.list.emptyCta,
    locale.owner.list.createCta,
    locale.owner.list.loadError.title,
    locale.owner.editor.groups.amenities,
    locale.owner.editor.sections.name,
    locale.owner.editor.translationPanel.sectionDescription
];

describe('listing.owner experience copy (HOS-2610 F-22)', () => {
    it.each([
        ['es', es, /comercio/i],
        ['en', en, /business/i],
        ['pt', pt, /com[eé]rcio/i]
    ] as const)('%s: experience variants avoid the venue word', (_name, locale, venueWord) => {
        for (const pair of pairsOf(locale as typeof es)) {
            expect(pair.experience).not.toMatch(venueWord);
            expect(pair.experience).toMatch(/experi/i);
            expect(pair.experience).not.toBe(pair.venue);
        }
    });
});
