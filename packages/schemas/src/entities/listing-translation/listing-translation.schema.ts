import { z } from 'zod';

/** Locales editable independently of the Spanish source. */
export const LISTING_TRANSLATION_TARGET_LOCALES = ['en', 'pt'] as const;

/** Target locale for one listing translation. */
export const ListingTranslationLocaleSchema = z.enum(LISTING_TRANSLATION_TARGET_LOCALES);

const commonFields = ['name', 'summary', 'description', 'richDescription'] as const;

/** Field order and allowlist for each listing editor. */
export const LISTING_TRANSLATION_FIELDS = {
    accommodation: commonFields,
    venue: [...commonFields, 'entryNote'],
    experience: commonFields
} as const;

/** Listing verticals with an owner translation editor. */
export type ListingTranslationVertical = keyof typeof LISTING_TRANSLATION_FIELDS;

/** A translatable field in at least one listing vertical. */
export type ListingTranslationField =
    (typeof LISTING_TRANSLATION_FIELDS)[ListingTranslationVertical][number];

/** Maximum manual translation length by field, in UTF-16 code units. */
export const LISTING_TRANSLATION_MAX_LENGTH = {
    name: 100,
    summary: 300,
    description: 2000,
    richDescription: 5000,
    entryNote: 200
} as const satisfies Record<ListingTranslationField, number>;

/** Display state of one field and locale. */
export const ListingTranslationPairStateSchema = z.enum([
    'auto',
    'manual',
    'stale',
    'pending',
    'noQuota',
    'noEntitlement',
    'noSource'
]);

/** AI availability for the listing owner's plan. */
export const ListingTranslationAiStatusSchema = z.enum(['available', 'quota', 'entitlement']);

/** Builds the strict manual-write body with a limit specific to the requested field. */
export function buildListingTranslationManualWriteSchema({
    vertical
}: {
    readonly vertical: ListingTranslationVertical;
}) {
    return z
        .strictObject({
            field: z.enum(LISTING_TRANSLATION_FIELDS[vertical]),
            locale: ListingTranslationLocaleSchema,
            value: z.string()
        })
        .superRefine(({ field, value }, context) => {
            if (value.length > LISTING_TRANSLATION_MAX_LENGTH[field]) {
                context.addIssue({
                    code: 'custom',
                    path: ['value'],
                    message: 'zodError.listingTranslation.value.max'
                });
            }
        });
}

/** Builds the strict AI request body; omitted locales select both targets. */
export function buildListingTranslationAiInputSchema({
    vertical
}: {
    readonly vertical: ListingTranslationVertical;
}) {
    return z.strictObject({
        field: z.enum(LISTING_TRANSLATION_FIELDS[vertical]),
        locales: z.array(ListingTranslationLocaleSchema).min(1).max(2).optional()
    });
}

/** Stored value and computed state for a target locale. */
export const ListingTranslationPairSchema = z.object({
    value: z.string(),
    state: ListingTranslationPairStateSchema,
    translatedAt: z.string().nullable()
});

/** Response payload shared by the listing translation endpoints. */
export const ListingTranslationsResponseSchema = z.object({
    listingId: z.uuid(),
    vertical: z.enum(['accommodation', 'venue', 'experience']),
    ai: z.object({ status: ListingTranslationAiStatusSchema }),
    fields: z.array(
        z.object({
            field: z.enum(LISTING_TRANSLATION_FIELDS.venue),
            source: z.string(),
            locales: z.object({
                en: ListingTranslationPairSchema,
                pt: ListingTranslationPairSchema
            })
        })
    )
});

/** Parsed listing translation response payload. */
export type ListingTranslationsResponse = z.infer<typeof ListingTranslationsResponseSchema>;
