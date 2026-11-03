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
        'venue.landing.benefits.title',
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
        'pricing.venue.pageTitle',
        'pricing.recommendedFor.default.venue',
        'pricing.recommendedFor.plan.venue-pro',
        'pricing.recommendedFor.plan.venue-premium',
        'pricing.index.cards.venue.audience',
        'pricing.index.cards.venue.highlights.item1',
        'pricing.index.cards.venue.highlights.item2',
        'account.doors.publish.options.venue.title',
        'account.doors.publish.options.venue.description',
        'account.doors.publish.options.venue.cta',
        'footer.venue'
    ],
    en: [
        'venue.listing.subtitle',
        'venue.landing.benefits.item1.desc',
        'venue.landing.benefits.title',
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
        'pricing.venue.pageTitle',
        'pricing.recommendedFor.default.venue',
        'pricing.recommendedFor.plan.venue-pro',
        'pricing.recommendedFor.plan.venue-premium',
        'pricing.index.cards.venue.audience',
        'pricing.index.cards.venue.highlights.item1',
        'pricing.index.cards.venue.highlights.item2',
        'account.doors.publish.options.venue.title',
        'account.doors.publish.options.venue.description',
        'account.doors.publish.options.venue.cta',
        'footer.listVenue',
        'footer.venue'
    ],
    pt: [
        'venue.listing.subtitle',
        'venue.landing.benefits.item1.desc',
        'venue.landing.benefits.title',
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
        'pricing.venue.pageTitle',
        'pricing.recommendedFor.default.venue',
        'pricing.recommendedFor.plan.venue-pro',
        'pricing.recommendedFor.plan.venue-premium',
        'pricing.index.cards.venue.audience',
        'pricing.index.cards.venue.highlights.item1',
        'pricing.index.cards.venue.highlights.item2',
        'account.doors.publish.options.venue.title',
        'account.doors.publish.options.venue.description',
        'account.doors.publish.options.venue.cta',
        'footer.venue'
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
function get(obj: Locale, key: string): unknown {
    let value: unknown = obj;
    for (const part of key.split('.')) {
        if (typeof value !== 'object' || value === null || !(part in value)) {
            throw new Error(`Missing locale key: ${key}`);
        }
        value = (value as Record<string, unknown>)[part];
    }
    return value;
}

function getString(obj: Locale, key: string): string {
    const value = get(obj, key);
    if (typeof value !== 'string') throw new Error(`Expected string locale key: ${key}`);
    return value;
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
                const value = getString(docs[file], key.join('.')).toLocaleLowerCase(lang);
                for (const word of banned[lang])
                    expect(value, `${lang} ${fullKey}`).not.toContain(word);
            }
        }
    });

    it('keeps the approved vertical name in account and footer titles', () => {
        const approved = {
            es: 'Comer y salir',
            en: 'Food & nightlife',
            pt: 'Comer e sair'
        } as const;
        for (const lang of ['es', 'en', 'pt'] as const) {
            const account = JSON.parse(
                readFileSync(`src/locales/${lang}/account.json`, 'utf8')
            ) as Locale;
            const footer = JSON.parse(
                readFileSync(`src/locales/${lang}/footer.json`, 'utf8')
            ) as Locale;
            expect(getString(account, 'doors.publish.options.venue.title')).toBe(approved[lang]);
            expect(getString(footer, 'venue')).toBe(approved[lang]);
        }
    });
});
