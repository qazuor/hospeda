/**
 * @file night-info.test.ts
 * @description Behaviour tests for the pure `nightInfo` mapper (HOS-1849 / 4.5).
 *
 * The component is `.astro` and cannot be rendered by Vitest in this app, so
 * every decision that would otherwise hide in its template lives in the helper
 * under test here: the price only with `paid`, the update date only with a
 * price, the note fallback to `es`, the fixed legal text and the heading that
 * `multiLine` selects. The component test then only proves it consumes those
 * decisions.
 */

import { describe, expect, it } from 'vitest';
import { createTranslations, type SupportedLocale } from '../../../src/lib/i18n';
import {
    ageNotice,
    hasNightInfoContent,
    nightInfoHeadingKey,
    toVenueNightInfo,
    type VenueNightInfoData
} from '../../../src/lib/venue/night-info';

const LOCALES: readonly SupportedLocale[] = ['es', 'en', 'pt'];

const APPROVED_LEGAL_TEXT: Record<SupportedLocale, string> = {
    es: 'Prohibida la venta de bebidas alcohólicas a menores de 18 años (Ley 24.788).',
    en: 'Sale of alcoholic beverages to persons under 18 is prohibited (Argentine Law 24.788).',
    pt: 'Proibida a venda de bebidas alcoólicas a menores de 18 anos (Lei argentina 24.788).'
};

function fullItem(): Record<string, unknown> {
    return {
        entryKind: 'paid',
        entryNoteI18n: { es: 'Hasta la 1', en: 'Until 1 am', pt: 'Até a 1' },
        entryPriceFrom: 500000,
        entryPriceUpdatedAt: '2026-03-01T00:00:00.000Z',
        // HOS-2060: the night house rules live in `policies`.
        policies: {
            minAge: 18,
            dressCode: 'smart_casual',
            dressCodeNote: { es: 'Salvo verano', en: 'Except summer', pt: 'Exceto verão' }
        },
        multiLine: true
    };
}

function emptyData(): VenueNightInfoData {
    return {
        entryKind: null,
        entryNote: null,
        entryPriceFromCents: null,
        entryPriceUpdatedAt: null,
        minAge: null,
        dressCode: null,
        dressCodeNote: null,
        multiLine: false
    };
}

describe('toVenueNightInfo', () => {
    it('maps every published field', () => {
        const data = toVenueNightInfo({ item: fullItem(), locale: 'es' });

        expect(data).toEqual({
            entryKind: 'paid',
            entryNote: 'Hasta la 1',
            entryPriceFromCents: 500000,
            entryPriceUpdatedAt: '2026-03-01T00:00:00.000Z',
            minAge: 18,
            dressCode: 'smart_casual',
            dressCodeNote: 'Salvo verano',
            multiLine: true
        });
    });

    it('TEST:4.5:4 resolves a note to the locale and falls back to es', () => {
        const item = {
            entryNoteI18n: { es: 'Nota en español', en: 'English note' },
            policies: { dressCodeNote: { es: 'Código en español', en: '', pt: '' } }
        };

        const english = toVenueNightInfo({ item, locale: 'en' });
        expect(english.entryNote).toBe('English note');

        const portuguese = toVenueNightInfo({ item, locale: 'pt' });
        expect(portuguese.entryNote).toBe('Nota en español');
        expect(portuguese.dressCodeNote).toBe('Código en español');
    });

    it('TEST:4.5:4 keeps the price only when entryKind is paid', () => {
        const paid = toVenueNightInfo({ item: { ...fullItem(), entryKind: 'paid' }, locale: 'es' });
        expect(paid.entryPriceFromCents).toBe(500000);

        const free = toVenueNightInfo({ item: { ...fullItem(), entryKind: 'free' }, locale: 'es' });
        expect(free.entryPriceFromCents).toBeNull();

        const varies = toVenueNightInfo({
            item: { ...fullItem(), entryKind: 'varies' },
            locale: 'es'
        });
        expect(varies.entryPriceFromCents).toBeNull();
    });

    it('TEST:4.5:4 keeps the updated date only while a price is shown', () => {
        expect(toVenueNightInfo({ item: fullItem(), locale: 'es' }).entryPriceUpdatedAt).toBe(
            '2026-03-01T00:00:00.000Z'
        );

        // Free with a date: the date describes a price nobody sees.
        const free = toVenueNightInfo({ item: { ...fullItem(), entryKind: 'free' }, locale: 'es' });
        expect(free.entryPriceUpdatedAt).toBeNull();

        // Paid but price not informed: same reason.
        const noPrice = toVenueNightInfo({
            item: { ...fullItem(), entryPriceFrom: null },
            locale: 'es'
        });
        expect(noPrice.entryPriceFromCents).toBeNull();
        expect(noPrice.entryPriceUpdatedAt).toBeNull();
    });

    it('treats an unknown entryKind or dressCode as not informed', () => {
        const data = toVenueNightInfo({
            item: { entryKind: 'bogus', policies: { dressCode: 'bogus' } },
            locale: 'es'
        });
        expect(data.entryKind).toBeNull();
        expect(data.dressCode).toBeNull();
    });

    it('collapses a blank note to null', () => {
        const data = toVenueNightInfo({
            item: { entryNoteI18n: { es: '   ' }, policies: { dressCodeNote: { es: '' } } },
            locale: 'es'
        });
        expect(data.entryNote).toBeNull();
        expect(data.dressCodeNote).toBeNull();
    });
});

describe('hasNightInfoContent', () => {
    it('is false when every field is absent', () => {
        expect(hasNightInfoContent(emptyData())).toBe(false);
    });

    it.each([
        ['entryKind', { entryKind: 'free' as const }],
        ['entryNote', { entryNote: 'Note' }],
        ['entryPriceFromCents', { entryPriceFromCents: 100 }],
        ['entryPriceUpdatedAt', { entryPriceUpdatedAt: '2026-03-01T00:00:00.000Z' }],
        ['minAge', { minAge: 18 }],
        ['dressCode', { dressCode: 'casual' as const }],
        ['dressCodeNote', { dressCodeNote: 'Note' }]
    ] as const)('is true when %s is present', (_field, patch) => {
        expect(hasNightInfoContent({ ...emptyData(), ...patch })).toBe(true);
    });
});

describe('ageNotice (AC:4:5)', () => {
    it('TEST:4.5:3 returns +18 and the approved legal text in every locale', () => {
        const notice = ageNotice({ minAge: 18 });
        expect(notice).not.toBeNull();
        expect(notice?.badge).toBe('+18');

        for (const locale of LOCALES) {
            const { t } = createTranslations(locale);
            expect(t(notice?.legalTextKey as string)).toBe(APPROVED_LEGAL_TEXT[locale]);
        }
    });

    it('TEST:4.5:3 keeps the same fixed legal text for +21 (the age is not interpolated)', () => {
        const eighteen = ageNotice({ minAge: 18 });
        const twentyOne = ageNotice({ minAge: 21 });

        expect(twentyOne?.badge).toBe('+21');
        expect(twentyOne?.legalTextKey).toBe(eighteen?.legalTextKey);

        for (const locale of LOCALES) {
            const { t } = createTranslations(locale);
            const legal = t(twentyOne?.legalTextKey as string);
            expect(legal).toBe(APPROVED_LEGAL_TEXT[locale]);
            expect(legal).not.toContain('+21');
        }
    });

    it('TEST:4.5:3 returns null when minAge is not informed', () => {
        expect(ageNotice({ minAge: null })).toBeNull();
    });
});

describe('nightInfoHeadingKey (AC:4:4, DEC-FAC-050)', () => {
    it('uses the catalog key only when multiLine is true', () => {
        expect(nightInfoHeadingKey({ multiLine: true })).toBe(
            'venue.detail.nightInfo.headingMultiLine'
        );
        expect(nightInfoHeadingKey({ multiLine: false })).toBe('venue.detail.nightInfo.heading');
        expect(nightInfoHeadingKey({ multiLine: false })).not.toBe(
            nightInfoHeadingKey({ multiLine: true })
        );
    });

    it.each(LOCALES)('resolves the multiLine heading in %s', (locale) => {
        const { t } = createTranslations(locale);
        const multiLine = t(nightInfoHeadingKey({ multiLine: true }));
        const singleLine = t(nightInfoHeadingKey({ multiLine: false }));

        expect(multiLine.trim().length).toBeGreaterThan(0);
        expect(singleLine.trim().length).toBeGreaterThan(0);
        expect(singleLine).not.toBe(multiLine);
    });

    it('renders "De noche" in es for multiLine and never for a single line', () => {
        const { t } = createTranslations('es');
        expect(t(nightInfoHeadingKey({ multiLine: true }))).toBe('De noche');
        expect(t(nightInfoHeadingKey({ multiLine: false }))).not.toBe('De noche');
    });
});
