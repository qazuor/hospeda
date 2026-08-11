/**
 * @file accommodation-editor-data.ts
 * @description Shared SSR loader for the accommodation editor pages (HOS-318).
 *
 * Before the editor was split into one page per section, its single page loaded
 * everything at once with five raw `fetch()` calls in the Astro frontmatter —
 * which `apps/web/CLAUDE.md` explicitly forbids ("NEVER call fetch() directly in
 * pages or components.. always use lib/api/"), and which would have been copied
 * into ten pages by the split.
 *
 * This loader replaces that block. Each page declares only what it needs, so
 * editing the price no longer pays for the amenity catalog, the feature catalog
 * and the destinations list.
 */

import type { AccommodationFaqItem } from '@/components/host/editor/FaqSection.client';
import { amenitiesApi, destinationsApi, featuresApi } from '@/lib/api/endpoints';
import { accommodationEditApi, accommodationFaqApi } from '@/lib/api/endpoints-protected';
import {
    transformAccommodationEdit,
    transformAccommodationMedia,
    transformAccommodationTranslations,
    transformAmenityList,
    transformDestinationList
} from '@/lib/api/transforms';
import type { AccommodationTranslationData, MediaImage } from '@/lib/api/types';
import { webLogger as logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The optional payloads a page can ask for beyond the accommodation itself. */
export type EditorDataNeed = 'catalog' | 'destinations' | 'faqs' | 'media' | 'translations';

/** Everything a section page might receive. Absent payloads keep their empty default. */
export interface AccommodationEditorData {
    readonly accommodation: ReturnType<typeof transformAccommodationEdit>;
    readonly destinations: ReturnType<typeof transformDestinationList>;
    readonly amenities: ReturnType<typeof transformAmenityList>;
    readonly features: ReturnType<typeof transformAmenityList>;
    readonly translations: AccommodationTranslationData | null;
    readonly featuredImage: MediaImage | null;
    readonly gallery: readonly MediaImage[];
    readonly faqs: readonly AccommodationFaqItem[];
}

/**
 * Outcome of a load attempt.
 *
 * `redirect` is deliberately distinct from `error`: a 404/403/410 means this
 * accommodation is not the caller's to edit (or is gone), which the page must
 * answer with a clean redirect to the property list rather than an error state.
 */
export type AccommodationEditorLoadResult =
    | { readonly status: 'ok'; readonly data: AccommodationEditorData }
    | { readonly status: 'redirect' }
    | { readonly status: 'error' };

/** The public endpoints cap `pageSize` at 100. */
const CATALOG_PAGE_SIZE = 100;

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Loads exactly the data one editor section page needs.
 *
 * The accommodation itself is always fetched — every page shows its name in the
 * breadcrumbs. Everything else is opt-in through `need`.
 *
 * Secondary payloads degrade to their empty default on failure and never block
 * the page: a broken amenity catalog must not stop a host from editing photos.
 * Only the accommodation fetch can fail the load.
 *
 * @param params - Accommodation id, the SSR cookie header, and the needed payloads.
 * @returns The loaded data, or a redirect/error signal for the page to act on.
 */
export async function loadAccommodationEditorData({
    accommodationId,
    cookieHeader,
    need = []
}: {
    readonly accommodationId: string;
    readonly cookieHeader?: string;
    readonly need?: readonly EditorDataNeed[];
}): Promise<AccommodationEditorLoadResult> {
    // Without a session cookie there is nothing to authorize the protected read
    // with — treat it as "not yours", same as a 403.
    if (!cookieHeader) return { status: 'redirect' };

    const wants = new Set(need);

    try {
        const [accomResult, destinationsResult, amenitiesResult, featuresResult, faqsResult] =
            await Promise.all([
                accommodationEditApi.getById({ id: accommodationId, cookieHeader }),
                wants.has('destinations')
                    ? destinationsApi.list({ page: 1, pageSize: CATALOG_PAGE_SIZE })
                    : Promise.resolve(null),
                wants.has('catalog')
                    ? amenitiesApi.list({
                          pageSize: CATALOG_PAGE_SIZE,
                          applicableVertical: 'accommodation'
                      })
                    : Promise.resolve(null),
                wants.has('catalog')
                    ? featuresApi.list({
                          pageSize: CATALOG_PAGE_SIZE,
                          applicableVertical: 'accommodation'
                      })
                    : Promise.resolve(null),
                wants.has('faqs')
                    ? accommodationFaqApi.list({ accommodationId, cookieHeader })
                    : Promise.resolve(null)
            ]);

        if (!accomResult.ok || !accomResult.data) {
            // 410 Gone: the owner's own accommodation was soft-deleted (HOS-117
            // T-022 — the shared _canView returns 410 for a deleted PUBLIC
            // listing, not 404). Redirect cleanly like a 404 rather than logging
            // a false "fetch failed".
            const status = accomResult.ok ? 404 : (accomResult.error?.status ?? 0);
            if (status === 404 || status === 403 || status === 410) {
                return { status: 'redirect' };
            }
            logger.warn('accommodation-editor-data: accommodation fetch failed', {
                status,
                accommodationId
            });
            return { status: 'error' };
        }

        const raw = accomResult.data as Record<string, unknown>;
        const media = wants.has('media')
            ? transformAccommodationMedia({ item: raw })
            : { featuredImage: null, gallery: [] as readonly MediaImage[] };

        return {
            status: 'ok',
            data: {
                accommodation: transformAccommodationEdit({ item: raw }),
                translations: wants.has('translations')
                    ? transformAccommodationTranslations({ item: raw })
                    : null,
                featuredImage: media.featuredImage,
                gallery: media.gallery,
                destinations: readCatalog({
                    result: destinationsResult,
                    label: 'destinations',
                    transform: (items) => transformDestinationList({ items })
                }),
                amenities: readCatalog({
                    result: amenitiesResult,
                    label: 'amenities',
                    transform: (items) => transformAmenityList({ items })
                }),
                features: readCatalog({
                    result: featuresResult,
                    label: 'features',
                    transform: (items) => transformAmenityList({ items })
                }),
                faqs: readFaqs({ result: faqsResult, accommodationId })
            }
        };
    } catch (error) {
        logger.error('accommodation-editor-data: unexpected error', { error, accommodationId });
        return { status: 'error' };
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Reads one paginated catalog response, degrading to an empty list on failure.
 *
 * Also warns when the response hits the 100-item page cap — the select/checkbox
 * group would silently truncate, so we want to know before it bites.
 *
 * @param params - The API result, a label for logging, and the list transform.
 * @returns The transformed items, or an empty array.
 */
function readCatalog<T>({
    result,
    label,
    transform
}: {
    readonly result: { readonly ok: boolean; readonly data?: unknown } | null;
    readonly label: string;
    readonly transform: (items: Record<string, unknown>[]) => readonly T[];
}): readonly T[] {
    if (!result?.ok) return [];

    const items = (result.data as { items?: Record<string, unknown>[] } | undefined)?.items ?? [];
    const transformed = transform(items);

    if (transformed.length >= CATALOG_PAGE_SIZE) {
        logger.warn(`accommodation-editor-data: ${label} hit the ${CATALOG_PAGE_SIZE}-item cap`, {
            count: transformed.length
        });
    }

    return transformed;
}

/**
 * Reads the FAQ response, degrading to an empty list on failure.
 *
 * HOS-393 preloads FAQs server-side so `FaqSection` paints real data on first
 * paint. A failure here must never block the page.
 *
 * @param params - The API result and the accommodation id (for logging).
 * @returns The FAQ list, or an empty array.
 */
function readFaqs({
    result,
    accommodationId
}: {
    readonly result: { readonly ok: boolean; readonly data?: unknown } | null;
    readonly accommodationId: string;
}): readonly AccommodationFaqItem[] {
    if (result === null) return [];
    if (!result.ok) {
        logger.warn('accommodation-editor-data: faqs fetch failed', { accommodationId });
        return [];
    }

    return (result.data as { faqs?: readonly AccommodationFaqItem[] } | undefined)?.faqs ?? [];
}
