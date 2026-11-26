/**
 * Computed translation state of a listing (HOS-2658, spec §8.5, DL-7).
 *
 * The raw `translationMeta` column is never shown to the owner: this module
 * projects it, together with the current Spanish sources and the owner's live
 * AI availability, into one state per `(field, locale)` pair.
 *
 * @module services/translation/listing-translation-state
 */

import { getDb } from '@repo/db';
import {
    type I18nText,
    LISTING_TRANSLATION_FIELDS,
    type ListingTranslationAiStatusSchema,
    type ListingTranslationPairStateSchema,
    type ListingTranslationsResponse,
    type ListingTranslationVertical,
    ServiceErrorCode,
    type TranslationMeta,
    VerticalEnum
} from '@repo/schemas';
import { computeTranslationSourceHash, ServiceError } from '@repo/service-core';
import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import { evaluateAiQuota } from '../../utils/listing-access/ai-quota-gate.js';
import { ownerHasEntitlement } from '../../utils/listing-access/owner-has-entitlement.js';
import { apiLogger } from '../../utils/logger.js';
import { readSourceText } from './read-source-text.js';
import { getEntityTable, I18N_COLUMN_MAP } from './translatable-entities.js';

/** One pair's display state. */
export type ListingTranslationPairState = z.infer<typeof ListingTranslationPairStateSchema>;

/** The owner's AI availability for the listing's vertical. */
export type ListingTranslationAiStatus = z.infer<typeof ListingTranslationAiStatusSchema>;

/** Stored metadata of one pair. */
export type TranslationPairMeta = TranslationMeta[string][string];

/** The quota vertical of each listing translation vertical. */
export const LISTING_TRANSLATION_QUOTA_VERTICAL: Readonly<
    Record<ListingTranslationVertical, VerticalEnum>
> = {
    accommodation: VerticalEnum.ACCOMMODATION,
    venue: VerticalEnum.VENUE,
    experience: VerticalEnum.EXPERIENCE
};

/**
 * Derives the display state of one pair (spec §8.5, first match wins).
 *
 * 1. empty source → `noSource`;
 * 2. MANUAL → `stale` when a stored `sourceHash` differs from the current one,
 *    otherwise `manual` (no hash = unknown baseline, never a false warning, AC-14);
 * 3. non-empty value whose hash matches (or is absent) → `auto`;
 * 4. behind: `noQuota` / `noEntitlement` by AI status, else `pending`.
 *
 * @param input - Source, stored value, stored meta, current source hash and AI status.
 * @returns Object with the pair `state`.
 */
export function derivePairState({
    source,
    value,
    meta,
    currentHash,
    aiStatus
}: {
    readonly source: string;
    readonly value: string;
    readonly meta: TranslationPairMeta | undefined;
    readonly currentHash: string;
    readonly aiStatus: ListingTranslationAiStatus;
}): { readonly state: ListingTranslationPairState } {
    if (source.trim() === '') {
        return { state: 'noSource' };
    }
    if (meta?.autoTranslated === false) {
        return {
            state: meta.sourceHash && meta.sourceHash !== currentHash ? 'stale' : 'manual'
        };
    }
    if (value.trim() !== '' && (!meta?.sourceHash || meta.sourceHash === currentHash)) {
        return { state: 'auto' };
    }
    if (aiStatus === 'quota') return { state: 'noQuota' };
    if (aiStatus === 'entitlement') return { state: 'noEntitlement' };
    return { state: 'pending' };
}

/** Evaluates the owner's AI availability; fails OPEN for display only. */
async function resolveAiStatus({
    ownerId,
    vertical,
    listingId
}: {
    readonly ownerId: string;
    readonly vertical: ListingTranslationVertical;
    readonly listingId: string;
}): Promise<ListingTranslationAiStatus> {
    try {
        const decision = await evaluateAiQuota({
            userId: ownerId,
            vertical: LISTING_TRANSLATION_QUOTA_VERTICAL[vertical],
            feature: 'translate',
            entitlementKey: 'ai_translate',
            limitKey: 'max_ai_translate_per_month'
        });
        return decision.allowed ? 'available' : decision.reason;
    } catch (error) {
        // Display only: the write paths still enforce the gate.
        apiLogger.warn(
            {
                vertical,
                listingId,
                error: error instanceof Error ? error.message : String(error)
            },
            'listing-translation: AI availability lookup failed, showing it as available'
        );
        return 'available';
    }
}

/**
 * Builds the translations payload of one listing.
 *
 * Reads the row (sources, i18n columns, meta), evaluates the owner's AI
 * availability, drops `richDescription` when the owner lacks
 * `can_use_rich_description` (AC-23), and derives each pair's state.
 *
 * @param input - The listing vertical and id.
 * @returns The `ListingTranslationsResponse` payload.
 * @throws ServiceError `NOT_FOUND` when the row does not exist.
 */
export async function getListingTranslationState({
    vertical,
    listingId
}: {
    readonly vertical: ListingTranslationVertical;
    readonly listingId: string;
}): Promise<ListingTranslationsResponse> {
    const table = getEntityTable(vertical);
    const [row] = await getDb().select().from(table).where(eq(table.id, listingId)).limit(1);
    if (!row) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Listing not found');
    }
    const data = row as Record<string, unknown>;
    const ownerId = typeof data.ownerId === 'string' ? data.ownerId : '';

    const [aiStatus, richDescription] = await Promise.all([
        resolveAiStatus({ ownerId, vertical, listingId }),
        ownerHasEntitlement({
            ownerId,
            vertical: LISTING_TRANSLATION_QUOTA_VERTICAL[vertical],
            key: 'can_use_rich_description'
        })
    ]);

    const meta = (data.translationMeta as TranslationMeta | null) ?? {};
    const columnMap = I18N_COLUMN_MAP[vertical];
    const fields = LISTING_TRANSLATION_FIELDS[vertical]
        .filter((field) => field !== 'richDescription' || richDescription.has)
        .map((field) => {
            const { text: source } = readSourceText({ entityType: vertical, row: data, field });
            const { hash: currentHash } = computeTranslationSourceHash({ text: source });
            const column = columnMap[field] as string;
            const stored = (data[column] as I18nText | null) ?? null;
            const pair = (locale: 'en' | 'pt') => {
                const value = stored?.[locale] ?? '';
                const pairMeta = meta[field]?.[locale];
                return {
                    value,
                    state: derivePairState({ source, value, meta: pairMeta, currentHash, aiStatus })
                        .state,
                    translatedAt: pairMeta?.translatedAt ?? null
                };
            };
            return { field, source, locales: { en: pair('en'), pt: pair('pt') } };
        });

    return { listingId, vertical, ai: { status: aiStatus }, fields };
}
