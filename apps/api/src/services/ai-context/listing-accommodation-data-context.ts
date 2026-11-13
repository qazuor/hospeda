import {
    accommodationIaData,
    amenities,
    features,
    getDb,
    rAccommodationAmenity,
    rAccommodationFeature
} from '@repo/db';
import type { Actor } from '@repo/service-core';
import { and, eq } from 'drizzle-orm';
import { apiLogger } from '../../utils/logger.js';
import type { IaDataEntry, NameOnlyEntity } from '../accommodation-ai-context.js';

/**
 * Row ceiling for the amenity/feature reads. Higher than the render caps so the
 * prioritization runs over the whole set rather than an arbitrary DB slice.
 */
const CONTEXT_CATALOG_FETCH_MAX = 300;
/** Maximum IA data entries included in the context block (SPEC-200 Delta 1). */
export const CONTEXT_IADATA_MAX = 10;

/**
 * Loads FAQs for the given accommodation, falling back to `[]` on any
 * error. Logs the failure with `apiLogger.warn` so ops can investigate.
 *
 * HOS-670: `AccommodationService.getFaqs()` runs through
 * `runWithLoggingAndValidation` — same as `getById` — so it RESOLVES a
 * `ServiceOutput` envelope (`{ data: { faqs } } | { error }`), it never
 * returns the unwrapped `{ faqs }` shape directly. This function used to read
 * `result.faqs` (undefined on the real envelope) and silently fall back to
 * `[]` via `?? []` — no thrown error, so the `catch` block below never fired
 * and no warning was ever logged. Every AI-usable FAQ a host marked for the
 * chat therefore never reached {@link buildMarkdownContext}, regardless of
 * `isUsableByAi`, while `getById`'s sibling unwrapping a few lines up in
 * {@link assembleAccommodationContext} worked correctly — this was the exact
 * asymmetry the F-59 smoke finding observed (description/name reaching the
 * model, FAQs silently empty, no warning in the logs).
 */
export async function safeLoadFaqs(
    service: {
        getFaqs: (
            actor: Actor,
            input: { accommodationId: string }
        ) => Promise<{
            data?: { faqs?: Array<{ question: string; answer: string; isUsableByAi?: boolean }> };
            error?: { code?: string; message?: string };
        }>;
    },
    actor: Actor,
    accommodationId: string
): Promise<Array<{ question: string; answer: string; isUsableByAi?: boolean }>> {
    try {
        const result = await service.getFaqs(actor, { accommodationId });
        if (result.error) {
            apiLogger.warn(
                { accommodationId, error: result.error.message ?? result.error.code },
                'accommodation-ai-context: failed to load FAQs; continuing with empty list'
            );
            return [];
        }
        return result.data?.faqs ?? [];
    } catch (error) {
        apiLogger.warn(
            { accommodationId, error: error instanceof Error ? error.message : String(error) },
            'accommodation-ai-context: failed to load FAQs; continuing with empty list'
        );
        return [];
    }
}

/**
 * Loads the accommodation's amenities via Drizzle direct. Returns `[]` on any
 * error (graceful — the chat request must not fail because the amenities join
 * is missing or the DB is flaky).
 *
 * The `name` column was dropped in SPEC-266 T-001: the slug is loaded and the
 * builder resolves it to its localized label (HOS-2095). The curation columns
 * are loaded so the builder can prioritize before capping; the read used to be
 * `LIMIT 20` in arbitrary order, which is how amenity #37 got dropped. The
 * `locale` parameter is kept in the signature for backward compatibility.
 */
export async function safeLoadAmenities(
    accommodationId: string,
    _locale: 'es' | 'en' | 'pt'
): Promise<NameOnlyEntity[]> {
    try {
        const db = getDb();
        const rows = await db
            .select({
                slug: amenities.slug,
                isFeatured: amenities.isFeatured,
                displayWeight: amenities.displayWeight
            })
            .from(rAccommodationAmenity)
            .innerJoin(amenities, eq(rAccommodationAmenity.amenityId, amenities.id))
            .where(eq(rAccommodationAmenity.accommodationId, accommodationId))
            .limit(CONTEXT_CATALOG_FETCH_MAX);
        return rows.map((r) => ({
            name: r.slug ?? '',
            isFeatured: r.isFeatured ?? false,
            displayWeight: r.displayWeight ?? 50
        }));
    } catch (error) {
        apiLogger.warn(
            { accommodationId, error: error instanceof Error ? error.message : String(error) },
            'accommodation-ai-context: failed to load amenities; continuing with empty list'
        );
        return [];
    }
}

/**
 * Loads the accommodation's features via Drizzle direct. Returns `[]` on any
 * error (graceful — same rationale as {@link safeLoadAmenities}). Same slug +
 * curation-column shape as the amenities read (HOS-2095).
 */
export async function safeLoadFeatures(
    accommodationId: string,
    _locale: 'es' | 'en' | 'pt'
): Promise<NameOnlyEntity[]> {
    try {
        const db = getDb();
        const rows = await db
            .select({
                slug: features.slug,
                isFeatured: features.isFeatured,
                displayWeight: features.displayWeight
            })
            .from(rAccommodationFeature)
            .innerJoin(features, eq(rAccommodationFeature.featureId, features.id))
            .where(eq(rAccommodationFeature.accommodationId, accommodationId))
            .limit(CONTEXT_CATALOG_FETCH_MAX);
        return rows.map((r) => ({
            name: r.slug ?? '',
            isFeatured: r.isFeatured ?? false,
            displayWeight: r.displayWeight ?? 50
        }));
    } catch (error) {
        apiLogger.warn(
            { accommodationId, error: error instanceof Error ? error.message : String(error) },
            'accommodation-ai-context: failed to load features; continuing with empty list'
        );
        return [];
    }
}

/**
 * Loads ACTIVE IA data entries for the given accommodation via Drizzle
 * direct. Returns `[]` on any error (graceful — same rationale as
 * {@link safeLoadAmenities}).
 *
 * IA data entries are owner-authored content specifically written for the
 * AI chatbot (house rules, policies, neighborhood info, etc.). Only entries
 * with `lifecycleState = 'ACTIVE'` are included.
 */
export async function safeLoadIaData(accommodationId: string): Promise<IaDataEntry[]> {
    try {
        const db = getDb();
        const rows = await db
            .select({
                title: accommodationIaData.title,
                content: accommodationIaData.content,
                category: accommodationIaData.category
            })
            .from(accommodationIaData)
            .where(
                and(
                    eq(accommodationIaData.accommodationId, accommodationId),
                    eq(accommodationIaData.lifecycleState, 'ACTIVE')
                )
            )
            .limit(CONTEXT_IADATA_MAX);
        return rows.map((r) => ({
            title: r.title,
            content: r.content,
            category: r.category
        }));
    } catch (error) {
        apiLogger.warn(
            { accommodationId, error: error instanceof Error ? error.message : String(error) },
            'accommodation-ai-context: failed to load iaData; continuing with empty list'
        );
        return [];
    }
}
