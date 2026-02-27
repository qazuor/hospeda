import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const localesDir = resolve(__dirname, '../../../../../packages/i18n/src/locales');

function readLocale(locale: string): string {
    return readFileSync(resolve(localesDir, locale, 'destination.json'), 'utf8');
}

describe('Destination i18n - Featured section keys', () => {
    const locales = ['es', 'en', 'pt'] as const;

    const requiredKeys = [
        'featured.title',
        'featured.subtitle',
        'featured.seeAll',
        'featured.carousel.label',
        'featured.carousel.previous',
        'featured.carousel.next',
        'featured.map.label',
        'featured.map.showOnPage',
        'featured.preview.gallery',
        'featured.preview.topRatings',
        'featured.preview.viewAccommodations',
        'featured.preview.dimensions.landscape',
        'featured.preview.dimensions.gastronomy',
        'featured.preview.dimensions.safety',
        'featured.preview.dimensions.nightlife',
        'featured.preview.dimensions.culture',
        'featured.preview.dimensions.nature',
        'featured.preview.dimensions.beaches',
        'featured.preview.dimensions.activities',
        'featured.card.accommodationSingular',
        'featured.card.accommodationPlural',
        'featured.card.eventSingular',
        'featured.card.eventPlural',
        'featured.card.ratingLabel',
        'featured.card.featured',
        'featured.card.attractions'
    ];

    for (const locale of locales) {
        describe(`Locale: ${locale}`, () => {
            const content = readLocale(locale);
            const parsed = JSON.parse(content);

            it('should have featured section', () => {
                expect(parsed.featured).toBeDefined();
            });

            for (const key of requiredKeys) {
                it(`should have key: ${key}`, () => {
                    const parts = key.split('.');
                    let current: Record<string, unknown> = parsed;
                    for (const part of parts) {
                        expect(current[part], `Missing key "${key}" in ${locale}`).toBeDefined();
                        current = current[part] as Record<string, unknown>;
                    }
                });
            }
        });
    }
});
