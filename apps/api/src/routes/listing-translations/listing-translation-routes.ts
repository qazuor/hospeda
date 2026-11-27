/**
 * Owner translation routes of the three listing verticals (HOS-2658, spec §9).
 *
 * One shape, built once and mounted per vertical:
 *
 * - `GET  /{id}/translations`    — the per-pair state projection (READ_OWN).
 * - `PUT  /{id}/translations`    — write one pair by hand; it becomes MANUAL
 *   (EDIT; never needs `ai_translate`, DL-5).
 * - `POST /{id}/translations/ai` — regenerate one field with AI; the requested
 *   pairs return to AUTOMATIC (EDIT, plus the AI gate inside the handler).
 *
 * Access is decided by `listingAccess`: a listing of somebody else answers 404,
 * never 403 (`apps/api/docs/error-contract.md`). `richDescription` is a premium
 * field: a write that names it also demands `can_use_rich_description` on the
 * subject (AC-23), and the GET projection omits the field when the owner's plan
 * lacks it.
 *
 * @module routes/listing-translations/listing-translation-routes
 */
import {
    buildListingTranslationAiInputSchema,
    buildListingTranslationManualWriteSchema,
    type ListingTranslationField,
    ListingTranslationsResponseSchema,
    type ListingTranslationVertical,
    VerticalEnum
} from '@repo/schemas';
import type { Context } from 'hono';
import { z } from 'zod';
import {
    translateListingFieldWithAi,
    writeManualTranslation
} from '../../services/translation/listing-translation.service';
import { getListingTranslationState } from '../../services/translation/listing-translation-state';
import type { MeteredTranslationLocale } from '../../services/translation/metered-translation';
import { createProtectedRoute } from '../../utils/route-factory';

/** Entitlement a write naming `richDescription` demands (AC-23). */
const RICH_DESCRIPTION_KEY = 'can_use_rich_description';

/**
 * Capability keys a translation write demands from its body: the rich
 * description is premium, every other field is free (DL-5). Called with
 * `body: undefined` at route construction, so it must not throw.
 *
 * @param args.body - The already-validated request body.
 * @returns The extra step-6 keys of this request.
 */
export function translationWriteCapabilities({
    body
}: {
    readonly body: Record<string, unknown> | undefined;
}): readonly string[] {
    return body?.field === 'richDescription' ? [RICH_DESCRIPTION_KEY] : [];
}

const idParams = { id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }) };

/**
 * The three route option objects of one vertical, WITHOUT `listingAccess`: the
 * one-vertical guard (G2) wants each route to name its `VerticalEnum` member
 * literally, so that property is written at each call site below (precedent
 * `listing-location/owner-location-routes.ts`).
 *
 * @param args.vertical - The listing vertical.
 * @param args.tag - OpenAPI tag.
 * @returns `{ get, putManual, postAi }` route options.
 */
export function listingTranslationRouteOptions(args: {
    readonly vertical: ListingTranslationVertical;
    readonly tag: string;
}) {
    const { vertical, tag } = args;
    return {
        get: {
            method: 'get' as const,
            path: '/{id}/translations',
            summary: 'Get the listing translations',
            description:
                'Returns the English and Portuguese translation of every translatable field of the listing, with the state of each pair (auto, manual, stale, pending, noQuota, noEntitlement, noSource) and whether AI translation is available on the owner plan. richDescription is omitted when the plan lacks can_use_rich_description. A listing of somebody else answers 404.',
            tags: [tag],
            requestParams: idParams,
            responseSchema: ListingTranslationsResponseSchema,
            handler: async (_ctx: Context, params: Record<string, unknown>) =>
                getListingTranslationState({ vertical, listingId: params.id as string })
        },
        putManual: {
            method: 'put' as const,
            path: '/{id}/translations',
            summary: 'Write one translation by hand',
            description:
                'Writes one (field, locale) translation. The pair becomes MANUAL: AI never overwrites it, even when the Spanish text changes. An empty value is a valid manual edit (the public page then shows the Spanish text). Does not need ai_translate. richDescription needs can_use_rich_description. Returns the updated translations state.',
            tags: [tag],
            requestParams: idParams,
            requestBody: buildListingTranslationManualWriteSchema({ vertical }),
            responseSchema: ListingTranslationsResponseSchema,
            handler: async (
                _ctx: Context,
                params: Record<string, unknown>,
                body: Record<string, unknown>
            ) =>
                writeManualTranslation({
                    vertical,
                    listingId: params.id as string,
                    field: body.field as ListingTranslationField,
                    locale: body.locale as MeteredTranslationLocale,
                    value: body.value as string
                })
        },
        postAi: {
            method: 'post' as const,
            path: '/{id}/translations/ai',
            // Answers the updated state, not a created resource (spec §9.3).
            successStatusCode: 200 as const,
            summary: 'Translate one field with AI',
            description:
                'Regenerates the requested locales of one field from its current Spanish text and returns them to AUTOMATIC, even when they were MANUAL. Gated and metered on the owner plan: 403 ENTITLEMENT_REQUIRED without ai_translate, 403 LIMIT_REACHED at the monthly limit, 400 with reason NO_SOURCE_TEXT when the Spanish text is empty, 502 PROVIDER_ERROR when every provider call failed. Returns the updated translations state.',
            tags: [tag],
            requestParams: idParams,
            requestBody: buildListingTranslationAiInputSchema({ vertical }),
            responseSchema: ListingTranslationsResponseSchema,
            handler: async (
                _ctx: Context,
                params: Record<string, unknown>,
                body: Record<string, unknown>
            ) =>
                translateListingFieldWithAi({
                    vertical,
                    listingId: params.id as string,
                    field: body.field as ListingTranslationField,
                    ...(Array.isArray(body.locales)
                        ? { locales: body.locales as MeteredTranslationLocale[] }
                        : {})
                })
        }
    };
}

const accommodationOptions = listingTranslationRouteOptions({
    vertical: 'accommodation',
    tag: 'Accommodations'
});

/** Owner translation routes of accommodations (HOS-2658). */
export const ownerAccommodationTranslationRoutes = {
    get: createProtectedRoute({
        ...accommodationOptions.get,
        listingAccess: {
            vertical: VerticalEnum.ACCOMMODATION,
            operation: 'READ_OWN',
            idParam: 'id'
        }
    }),
    putManual: createProtectedRoute({
        ...accommodationOptions.putManual,
        listingAccess: {
            vertical: VerticalEnum.ACCOMMODATION,
            operation: 'EDIT',
            idParam: 'id',
            capabilities: translationWriteCapabilities
        }
    }),
    postAi: createProtectedRoute({
        ...accommodationOptions.postAi,
        listingAccess: {
            vertical: VerticalEnum.ACCOMMODATION,
            operation: 'EDIT',
            idParam: 'id',
            capabilities: translationWriteCapabilities
        }
    })
} as const;

const venueOptions = listingTranslationRouteOptions({ vertical: 'venue', tag: 'Venue' });

/** Owner translation routes of venues (HOS-2658). */
export const ownerVenueTranslationRoutes = {
    get: createProtectedRoute({
        ...venueOptions.get,
        listingAccess: { vertical: VerticalEnum.VENUE, operation: 'READ_OWN', idParam: 'id' }
    }),
    putManual: createProtectedRoute({
        ...venueOptions.putManual,
        listingAccess: {
            vertical: VerticalEnum.VENUE,
            operation: 'EDIT',
            idParam: 'id',
            capabilities: translationWriteCapabilities
        }
    }),
    postAi: createProtectedRoute({
        ...venueOptions.postAi,
        listingAccess: {
            vertical: VerticalEnum.VENUE,
            operation: 'EDIT',
            idParam: 'id',
            capabilities: translationWriteCapabilities
        }
    })
} as const;

const experienceOptions = listingTranslationRouteOptions({
    vertical: 'experience',
    tag: 'Experience'
});

/** Owner translation routes of experiences (HOS-2658). */
export const ownerExperienceTranslationRoutes = {
    get: createProtectedRoute({
        ...experienceOptions.get,
        listingAccess: {
            vertical: VerticalEnum.EXPERIENCE,
            operation: 'READ_OWN',
            idParam: 'id'
        }
    }),
    putManual: createProtectedRoute({
        ...experienceOptions.putManual,
        listingAccess: {
            vertical: VerticalEnum.EXPERIENCE,
            operation: 'EDIT',
            idParam: 'id',
            capabilities: translationWriteCapabilities
        }
    }),
    postAi: createProtectedRoute({
        ...experienceOptions.postAi,
        listingAccess: {
            vertical: VerticalEnum.EXPERIENCE,
            operation: 'EDIT',
            idParam: 'id',
            capabilities: translationWriteCapabilities
        }
    })
} as const;
