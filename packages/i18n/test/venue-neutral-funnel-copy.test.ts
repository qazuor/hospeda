import type * as Fs from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';

type Locale = Record<string, unknown>;
const files = [
    'venue.json',
    'publish.json',
    'pricing.json',
    'account.json',
    'footer.json'
] as const;
const paths: Record<string, readonly string[]> = {
    es: [
        'venue.listing.subtitle',
        'venue.landing.benefits.item1.desc',
        'venue.landing.benefits.item2.desc',
        'venue.landing.howItWorks.step2.desc',
        'venue.landing.howItWorks.step3.desc',
        'venue.landing.lead.subtitle',
        'publish.venue.meta.description',
        'publish.venue.hero.body',
        'publish.venue.steps.step2.desc',
        'publish.venue.steps.step3.desc',
        'publish.venue.benefits.item1.desc',
        'publish.venue.benefits.item2.desc',
        'pricing.venue.pageDescription',
        'account.doors.publish.options.venue.description'
    ],
    en: [
        'venue.listing.subtitle',
        'venue.landing.benefits.item1.desc',
        'venue.landing.benefits.item2.desc',
        'venue.landing.howItWorks.step2.desc',
        'venue.landing.howItWorks.step3.desc',
        'venue.landing.lead.subtitle',
        'publish.venue.meta.description',
        'publish.venue.hero.tagline',
        'publish.venue.hero.body',
        'publish.venue.steps.step2.desc',
        'publish.venue.steps.step3.desc',
        'publish.venue.benefits.item1.desc',
        'publish.venue.benefits.item2.desc',
        'pricing.venue.pageDescription',
        'account.doors.publish.options.venue.title',
        'account.doors.publish.options.venue.description',
        'footer.listVenue'
    ],
    pt: [
        'venue.listing.subtitle',
        'venue.landing.benefits.item1.desc',
        'venue.landing.benefits.item2.desc',
        'venue.landing.howItWorks.step2.desc',
        'venue.landing.howItWorks.step3.desc',
        'venue.landing.lead.subtitle',
        'publish.venue.meta.description',
        'publish.venue.hero.body',
        'publish.venue.steps.step2.desc',
        'publish.venue.steps.step3.desc',
        'publish.venue.benefits.item1.desc',
        'publish.venue.benefits.item2.desc',
        'pricing.venue.pageDescription',
        'account.doors.publish.options.venue.description'
    ]
};
const banned: Record<string, string[]> = {
    es: ['restaurante', 'platos', 'menú', 'comensales', 'dónde comer'],
    en: ['restaurant', 'dishes', 'menu', 'diners', 'food business', 'where to eat'],
    pt: ['restaurante', 'pratos', 'cardápio', 'onde comer']
};
let readFileSync: typeof Fs.readFileSync;
beforeAll(async () => {
    const realFs = await vi.importActual<typeof Fs>('node:fs');
    readFileSync = realFs.readFileSync;
});
function get(obj: Locale, key: string): string {
    return key.split('.').reduce((v: any, k) => v[k], obj) as string;
}
describe('neutral venue funnel copy', () => {
    it('keeps every inventoried promise neutral in all locales', () => {
        for (const lang of ['es', 'en', 'pt'] as const) {
            const docs = Object.fromEntries(
                files.map((file) => [
                    file.slice(0, -5),
                    JSON.parse(readFileSync(`src/locales/${lang}/${file}`, 'utf8'))
                ])
            ) as Record<string, Locale>;
            for (const fullKey of paths[lang]) {
                const [file, ...key] = fullKey.split('.');
                const value = get(docs[file], key.join('.')).toLocaleLowerCase(lang);
                for (const word of banned[lang])
                    expect(value, `${lang} ${fullKey}`).not.toContain(word);
            }
        }
    });
});
