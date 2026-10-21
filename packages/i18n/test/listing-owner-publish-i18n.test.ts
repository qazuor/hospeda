/** TEST:1729:7 publish confirmation and plan labels are translated in every supported locale. */

import { describe, expect, it } from 'vitest';
import englishListing from '../src/locales/en/listing.json';
import spanishListing from '../src/locales/es/listing.json';
import portugueseListing from '../src/locales/pt/listing.json';

const locales = [spanishListing, englishListing, portugueseListing];

describe('listing owner publish translations — TEST:1729:7', () => {
    it('has matching vertical copy in es, en, and pt', () => {
        for (const locale of locales) {
            expect(Object.keys(locale.owner.publish.confirmTitle).sort()).toEqual([
                'experience',
                'gastronomy'
            ]);
            expect(Object.keys(locale.owner.publish.choosePlan).sort()).toEqual([
                'experience',
                'gastronomy'
            ]);
            expect(locale.owner.publish.missingRequirements).toBeTruthy();
        }
        expect(spanishListing.owner.publish.confirmTitle.gastronomy).toBe(
            '¿Publicar este comercio?'
        );
        expect(englishListing.owner.publish.confirmTitle.experience).toBe(
            'Publish this experience?'
        );
        expect(portugueseListing.owner.publish.choosePlan.gastronomy).toBe(
            'Escolher plano de gastronomia'
        );
    });
});
