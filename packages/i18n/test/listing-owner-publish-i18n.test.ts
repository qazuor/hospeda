/** TEST:1729:7 publish confirmation and plan labels are translated in every supported locale. */

import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { locales as supportedLocales, trans } from '../src/config';
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

describe('locale namespace registration', () => {
    it('registers every on-disk namespace in each locale map with matching namespace sets', () => {
        const namespaceSets = supportedLocales.map((locale) => {
            const onDisk = readdirSync(new URL(`../src/locales/${locale}/`, import.meta.url))
                .filter((file) => file.endsWith('.json'))
                .map((file) => {
                    const namespace = file.slice(0, -'.json'.length);
                    return namespace === 'destination'
                        ? 'destinations'
                        : namespace === 'event'
                          ? 'events'
                          : namespace;
                })
                .sort();
            const registered = [
                ...new Set(Object.keys(trans[locale]).map((key) => key.split('.')[0] ?? ''))
            ].sort();

            expect(registered, `${locale} namespace map`).toEqual(onDisk);
            return registered;
        });

        for (const namespaceSet of namespaceSets.slice(1)) {
            expect(namespaceSet).toEqual(namespaceSets[0]);
        }
    });
});
