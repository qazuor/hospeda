import { describe, expect, it } from 'vitest';
import { entityTypeLabelKey, tabLabelKey } from '@/components/account/favorites/favorites-tabs';
import { createT } from '@/lib/i18n';

describe('favorite entity labels', () => {
    it.each([
        ['es', 'Alojamiento', 'Alojamientos'],
        ['en', 'Accommodation', 'Accommodations'],
        ['pt', 'Hospedagem', 'Acomodações']
    ] as const)('uses singular cards and plural tabs in %s', (locale, singular, plural) => {
        const t = createT(locale);
        expect(t(entityTypeLabelKey({ entityType: 'ACCOMMODATION' }) ?? '')).toBe(singular);
        expect(t(tabLabelKey({ tab: 'ACCOMMODATION' }))).toBe(plural);
    });

    it.each([
        'DESTINATION',
        'VENUE',
        'EXPERIENCE',
        'EVENT',
        'POST',
        'ATTRACTION'
    ])('has a translated singular label for %s', (entityType) => {
        const key = entityTypeLabelKey({ entityType });
        expect(key).not.toBeNull();
        for (const locale of ['es', 'en', 'pt'] as const) {
            expect(createT(locale)(key ?? '')).not.toBe(key);
        }
    });

    it('does not invent labels for unknown types', () => {
        expect(entityTypeLabelKey({ entityType: 'UNKNOWN' })).toBeNull();
    });
});
