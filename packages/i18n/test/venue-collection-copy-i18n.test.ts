import { vi } from 'vitest';
import { listPublicBusinessLines } from '../../schemas/src/catalog/business-lines';

vi.unmock('node:fs');
vi.unmock('node:path');

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const locales = ['es', 'en', 'pt'] as const;
type Copy = Record<string, string>;
type VenueLocale = { collections?: Record<string, Copy> };
const translations = Object.fromEntries(
    locales.map((locale) => [
        locale,
        JSON.parse(
            readFileSync(
                resolve(import.meta.dirname, `../src/locales/${locale}/venue.json`),
                'utf8'
            )
        )
    ])
) as Record<(typeof locales)[number], VenueLocale>;
const forbidden = new RegExp(['[Gg]astro', 'nom[ií]a'].join(''));
const approvedTitles = {
    nightlife: [
        'Boliches, bares y pubs en {{destino}}',
        'Nightclubs, bars and pubs in {{destino}}',
        'Baladas, bares e pubs em {{destino}}'
    ],
    food: ['Dónde comer en {{destino}}', 'Where to eat in {{destino}}', 'Onde comer em {{destino}}']
};

describe('venue collection copy locales', () => {
    for (const { value } of listPublicBusinessLines({ vertical: 'venue' })) {
        it(`provides complete copy for ${value} in every locale`, () => {
            const titles: string[] = [];
            for (const locale of locales) {
                const copy = translations[locale].collections?.[value];
                expect(copy).toBeDefined();
                for (const key of ['pageTitle', 'description', 'heading', 'intro', 'ogTagline']) {
                    expect(copy[key]).toEqual(expect.any(String));
                    expect(copy[key].trim()).not.toBe('');
                    expect(copy[key]).not.toMatch(forbidden);
                }
                expect(copy.pageTitle).toContain('{{destino}}');
                expect(copy.description).toContain('{{destino}}');
                expect(copy.intro).toContain('{{destino}}');
                titles.push(copy.pageTitle);
            }
            expect(titles).toEqual(approvedTitles[value as keyof typeof approvedTitles]);
        });
    }
});
