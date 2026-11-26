import { expect, it } from 'vitest';
import enAccount from '../src/locales/en/account.json';
import enBilling from '../src/locales/en/billing.json';
import esAccount from '../src/locales/es/account.json';
import esBilling from '../src/locales/es/billing.json';
import ptAccount from '../src/locales/pt/account.json';
import ptBilling from '../src/locales/pt/billing.json';

it.each([
    [esAccount, esBilling, 'No se muestra: superás tu tope', 'Ver packs de fotos'],
    [enAccount, enBilling, 'Not shown: over your limit', 'View photo packs'],
    [ptAccount, ptBilling, 'Não aparece: você passou do seu limite', 'Ver pacotes de fotos']
] as const)('provides complete photo copy with the expected interpolations (%s)', (account, billing, badge, cta) => {
    const photos = account.listingPhotos;
    const keys = ['max_photos_per_venue', 'max_photos_per_experience'] as const;
    const placeholders = (value: string) => value.match(/\{\{\w+\}\}/g) ?? [];

    expect(photos.overCapBadge).toBe(badge);
    expect(Object.keys(photos.description)).toEqual([
        'accommodation_one',
        'accommodation_other',
        'venue_one',
        'venue_other',
        'experience_one',
        'experience_other'
    ]);
    expect(Object.values(photos.description).map(placeholders)).toEqual(Array(6).fill(['{{cap}}']));
    expect([photos.overCapSummary_one, photos.overCapSummary_other].map(placeholders)).toEqual([
        ['{{count}}'],
        ['{{count}}']
    ]);
    expect(placeholders(photos.breakdown.total)).toEqual(['{{parts}}', '{{cap}}']);
    expect(keys.map((key) => billing.limit[key].cta)).toEqual([cta, cta]);
    expect(
        keys
            .flatMap((key) => [billing.limit[key].message_one, billing.limit[key].message_other])
            .map(placeholders)
    ).toEqual(Array(4).fill(['{{currentCount}}', '{{maxAllowed}}']));
});
