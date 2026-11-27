import { describe, expect, it } from 'vitest';
import {
    buildListingTranslationAiInputSchema,
    buildListingTranslationManualWriteSchema,
    ListingTranslationsResponseSchema
} from '../listing-translation.schema.js';

describe('listing translation contracts', () => {
    it('accepts entryNote only for venues in both write contracts', () => {
        const manual = { field: 'entryNote', locale: 'en', value: 'Book ahead' };
        const ai = { field: 'entryNote', locales: ['pt'] };

        expect(
            buildListingTranslationManualWriteSchema({ vertical: 'venue' }).parse(manual)
        ).toEqual(manual);
        expect(buildListingTranslationAiInputSchema({ vertical: 'venue' }).parse(ai)).toEqual(ai);

        for (const vertical of ['accommodation', 'experience'] as const) {
            for (const result of [
                buildListingTranslationManualWriteSchema({ vertical }).safeParse(manual),
                buildListingTranslationAiInputSchema({ vertical }).safeParse(ai)
            ]) {
                expect(result.error?.issues.map(({ code, path }) => ({ code, path }))).toEqual([
                    { code: 'invalid_value', path: ['field'] }
                ]);
            }
        }
    });

    it.each([
        ['name', 100],
        ['summary', 300],
        ['description', 2000],
        ['richDescription', 5000],
        ['entryNote', 200]
    ])('accepts %s at its %i-character limit and rejects one more', (field, max) => {
        const schema = buildListingTranslationManualWriteSchema({ vertical: 'venue' });
        const body = { field, locale: 'pt', value: 'a'.repeat(max) };

        const accepted = schema.parse(body);
        const rejected = schema.safeParse({ ...body, value: `${body.value}a` });

        expect(accepted).toEqual(body);
        expect(rejected.error?.issues).toEqual([
            { code: 'custom', path: ['value'], message: 'zodError.listingTranslation.value.max' }
        ]);
    });

    it('allows clearing a translation but rejects Spanish and unknown input keys', () => {
        const schema = buildListingTranslationManualWriteSchema({ vertical: 'accommodation' });
        const body = { field: 'name', locale: 'en', value: '' };

        const accepted = schema.parse(body);
        const source = schema.safeParse({ ...body, locale: 'es' });
        const extra = schema.safeParse({ ...body, autoTranslated: true });

        expect(accepted).toEqual(body);
        expect(source.error?.issues.map(({ code, path }) => ({ code, path }))).toEqual([
            { code: 'invalid_value', path: ['locale'] }
        ]);
        expect(extra.error?.issues.map(({ code, path }) => ({ code, path }))).toEqual([
            { code: 'unrecognized_keys', path: [] }
        ]);
    });

    it('accepts omitted or one to two AI locales and rejects invalid lists', () => {
        const schema = buildListingTranslationAiInputSchema({ vertical: 'experience' });
        const body = { field: 'summary' };

        expect(schema.parse(body)).toEqual(body);
        expect(schema.parse({ ...body, locales: ['en'] })).toEqual({ ...body, locales: ['en'] });
        expect(schema.parse({ ...body, locales: ['en', 'pt'] })).toEqual({
            ...body,
            locales: ['en', 'pt']
        });
        for (const [locales, issue] of [
            [[], { code: 'too_small', path: ['locales'] }],
            [['en', 'pt', 'en'], { code: 'too_big', path: ['locales'] }],
            [['es'], { code: 'invalid_value', path: ['locales', 0] }]
        ] as const) {
            const result = schema.safeParse({ ...body, locales });

            expect(result.error?.issues.map(({ code, path }) => ({ code, path }))).toEqual([issue]);
        }
    });

    it('parses the venue response with quota exhausted from the spec', () => {
        const response = {
            listingId: '0c9fa2bc-6ef3-465b-9db8-60bc5d29c678',
            vertical: 'venue',
            ai: { status: 'quota' },
            fields: [
                {
                    field: 'name',
                    source: 'La Parrilla del Puerto',
                    locales: {
                        en: {
                            value: 'The Port Grill',
                            state: 'auto',
                            translatedAt: '2026-11-20T10:00:00.000Z'
                        },
                        pt: { value: '', state: 'noQuota', translatedAt: null }
                    }
                }
            ]
        };

        const parsed = ListingTranslationsResponseSchema.parse(response);

        expect(parsed).toEqual(response);
    });
});
