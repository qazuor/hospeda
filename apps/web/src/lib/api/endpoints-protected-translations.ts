/**
 * @file endpoints-protected-translations.ts
 * @description Owner listing translation endpoints (HOS-2658).
 *
 * One client for the three listing verticals. Every call answers the same
 * `ListingTranslationsResponse` payload, so the editor section replaces its
 * whole state with whatever comes back.
 */
import type { ListingTranslationsResponse, ListingTranslationVertical } from '@repo/schemas';
import { apiClient } from './client';
import type { ApiResult } from './types';

const PROTECTED = '/api/v1/protected';

/** URL segment of each vertical's protected listing routes. */
export const LISTING_TRANSLATION_PATH_SEGMENT: Readonly<
    Record<ListingTranslationVertical, string>
> = {
    accommodation: 'accommodations',
    venue: 'venues',
    experience: 'experiences'
};

/** Target locale of a listing translation (Spanish is always the source). */
export type ListingTranslationTargetLocale = 'en' | 'pt';

/**
 * AI calls translate up to two locales sequentially; the default 10s client
 * budget is too short for that (same reason as BETA-135).
 */
const AI_TIMEOUT_MS = 90_000;

function translationsPath({
    vertical,
    id
}: {
    readonly vertical: ListingTranslationVertical;
    readonly id: string;
}): string {
    return `${PROTECTED}/${LISTING_TRANSLATION_PATH_SEGMENT[vertical]}/${encodeURIComponent(id)}/translations`;
}

/** Reads, writes by hand and regenerates with AI the translations of one listing. */
export const listingTranslationsApi = {
    /**
     * Read the per-pair translation state of a listing.
     * @example const result = await listingTranslationsApi.get({ vertical: 'venue', id });
     */
    get({
        vertical,
        id
    }: {
        readonly vertical: ListingTranslationVertical;
        readonly id: string;
    }): Promise<ApiResult<ListingTranslationsResponse>> {
        return apiClient.getProtected({ path: translationsPath({ vertical, id }) });
    },

    /**
     * Write one `(field, locale)` pair by hand; the pair becomes MANUAL.
     * @example await listingTranslationsApi.saveManual({ vertical, id, field: 'name', locale: 'en', value });
     */
    saveManual({
        vertical,
        id,
        field,
        locale,
        value
    }: {
        readonly vertical: ListingTranslationVertical;
        readonly id: string;
        readonly field: string;
        readonly locale: ListingTranslationTargetLocale;
        readonly value: string;
    }): Promise<ApiResult<ListingTranslationsResponse>> {
        return apiClient.put({
            path: translationsPath({ vertical, id }),
            body: { field, locale, value }
        });
    },

    /**
     * Regenerate one field with AI; the requested locales return to AUTOMATIC.
     * @example await listingTranslationsApi.translateWithAi({ vertical, id, field: 'name', locales: ['en'] });
     */
    translateWithAi({
        vertical,
        id,
        field,
        locales
    }: {
        readonly vertical: ListingTranslationVertical;
        readonly id: string;
        readonly field: string;
        readonly locales: readonly ListingTranslationTargetLocale[];
    }): Promise<ApiResult<ListingTranslationsResponse>> {
        return apiClient.postProtected({
            path: `${translationsPath({ vertical, id })}/ai`,
            body: { field, locales: [...locales] },
            timeoutMs: AI_TIMEOUT_MS
        });
    }
};
