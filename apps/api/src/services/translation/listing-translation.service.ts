/**
 * Owner-facing listing translation operations (HOS-2658, spec §9.2, §9.3).
 *
 * The protected `PUT /{id}/translations` and `POST /{id}/translations/ai`
 * handlers are thin wrappers over these two functions. Access (ownership,
 * coverage, `edit_*_info`, the `richDescription` trait) is resolved by the
 * route's `listingAccess` BEFORE they run; this module only reads the row,
 * writes through the single writer or the metered runner, and returns the
 * refreshed state.
 *
 * @module services/translation/listing-translation.service
 */

import { getDb } from '@repo/db';
import {
    type ListingTranslationField,
    type ListingTranslationsResponse,
    type ListingTranslationVertical,
    ServiceErrorCode
} from '@repo/schemas';
import { computeTranslationSourceHash, ServiceError } from '@repo/service-core';
import { eq } from 'drizzle-orm';
import {
    getListingTranslationState,
    LISTING_TRANSLATION_QUOTA_VERTICAL
} from './listing-translation-state.js';
import { type MeteredTranslationLocale, runMeteredTranslation } from './metered-translation.js';
import { readSourceText } from './read-source-text.js';
import { getEntityTable } from './translatable-entities.js';
import { writeTranslationPairs } from './translation-pair-writer.js';

/** Reads the listing row, throwing `NOT_FOUND` when it does not exist. */
async function loadListingRow({
    vertical,
    listingId
}: {
    readonly vertical: ListingTranslationVertical;
    readonly listingId: string;
}): Promise<Readonly<Record<string, unknown>>> {
    const table = getEntityTable(vertical);
    const [row] = await getDb().select().from(table).where(eq(table.id, listingId)).limit(1);
    if (!row) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Listing not found');
    }
    return row as Record<string, unknown>;
}

/**
 * Writes one owner-edited translation pair as MANUAL (AC-6, AC-9, AC-12).
 *
 * No `ai_translate` is needed and no `ai_usage` row is written (DL-5). The
 * pair records the hash of the CURRENT Spanish source, so saving a stale pair
 * again clears its warning.
 *
 * @param input - Listing vertical and id, the field, the locale and the value.
 * @returns The refreshed translations payload.
 * @throws ServiceError `NOT_FOUND` when the listing row does not exist.
 */
export async function writeManualTranslation({
    vertical,
    listingId,
    field,
    locale,
    value
}: {
    readonly vertical: ListingTranslationVertical;
    readonly listingId: string;
    readonly field: ListingTranslationField;
    readonly locale: MeteredTranslationLocale;
    readonly value: string;
}): Promise<ListingTranslationsResponse> {
    const row = await loadListingRow({ vertical, listingId });
    const { text } = readSourceText({ entityType: vertical, row, field });
    const { hash } = computeTranslationSourceHash({ text });
    const result = await writeTranslationPairs({
        entityType: vertical,
        entityId: listingId,
        writes: [{ field, locale, value, origin: 'manual', sourceHash: hash }]
    });
    if (!result.found) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Listing not found');
    }
    return getListingTranslationState({ vertical, listingId });
}

/**
 * Regenerates one field's translations with AI and returns them to AUTOMATIC
 * ("Traducir con IA", AC-16 to AC-20).
 *
 * The listing owner is gated and billed (DL-3). MANUAL pairs among the
 * requested locales are overwritten on purpose (`overrideManual`); every other
 * pair is untouched.
 *
 * @param input - Listing vertical and id, the field and the locales (default both).
 * @returns The refreshed translations payload.
 * @throws ServiceError `NOT_FOUND` (row absent), `VALIDATION_ERROR` with
 *   `details.reason = 'NO_SOURCE_TEXT'` (empty Spanish), `ENTITLEMENT_REQUIRED` /
 *   `LIMIT_REACHED` (gate), `PROVIDER_ERROR` (every provider call failed).
 */
export async function translateListingFieldWithAi({
    vertical,
    listingId,
    field,
    locales
}: {
    readonly vertical: ListingTranslationVertical;
    readonly listingId: string;
    readonly field: ListingTranslationField;
    readonly locales?: readonly MeteredTranslationLocale[];
}): Promise<ListingTranslationsResponse> {
    const row = await loadListingRow({ vertical, listingId });
    const { text: source } = readSourceText({ entityType: vertical, row, field });
    if (source.trim() === '') {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'The field has no Spanish source text to translate',
            { reason: 'NO_SOURCE_TEXT' },
            'NO_SOURCE_TEXT'
        );
    }

    const outcome = await runMeteredTranslation({
        trigger: 'button',
        entityType: vertical,
        entityId: listingId,
        vertical: LISTING_TRANSLATION_QUOTA_VERTICAL[vertical],
        billedUserId: typeof row.ownerId === 'string' ? row.ownerId : '',
        fields: { [field]: source },
        targetLocales: locales ?? ['en', 'pt'],
        overrideManual: true
    });
    if (outcome.outcome === 'all-failed') {
        throw new ServiceError(
            ServiceErrorCode.PROVIDER_ERROR,
            'The translation provider failed; nothing was changed'
        );
    }
    return getListingTranslationState({ vertical, listingId });
}
