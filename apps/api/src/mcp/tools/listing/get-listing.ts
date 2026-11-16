/**
 * @file get-listing.ts
 * @description Tool `get_listing` (HOS-2184 T-014, spec §6.5, AC-6): one of
 * the caller's listings, projected to the editable set `update_listing_basic`
 * writes (T-016/T-017) plus the public URL.
 *
 * Authorization is the protected get-own route's
 * (`routes/{accommodation,venue,experience}/protected/getById.ts`): the
 * vertical service's `getById`, then the shared resource step
 * (`resolveResourceStep`, operation `READ_OWN`) on the row it returned.
 *
 * One deliberate difference: the routes let staff holding `*_VIEW_ALL` read a
 * foreign row. This tool does not: it serves the owner's own assistant,
 * AC-6 requires every foreign listing to answer "not found", and the write
 * tools it feeds (`updateOwn`, the owner PATCH) are owner-only too.
 *
 * A missing id, a foreign id, a purged or soft-deleted row and a service
 * refusal (`FORBIDDEN`) all produce the SAME not-found error, so the answer
 * never tells whether an id exists (error contract).
 *
 * Editable set per vertical (mirrors the T-016/T-017 allowlists):
 * - accommodation: `summary`, `description`, `phone` (`contactInfo.mobilePhone`),
 *   `website` (`contactInfo.website`), amenities, features. No opening hours:
 *   accommodations have none.
 * - venue / experience: `description`, `openingHours`, `contactInfo`,
 *   amenities, features.
 *
 * All of it is the owner's own text, returned as is (§6.6 covers guest text).
 */

import {
    type Accommodation,
    type Experience,
    PublicationStatusEnum,
    ServiceErrorCode,
    type Venue,
    VerticalEnum
} from '@repo/schemas';
import { type Actor, entityNotFoundError } from '@repo/service-core';
import { readListingAccessFacts, resolveResourceStep } from '@repo/verticals';
import { z } from 'zod';
import { buildListingPublicUrl } from '../../../services/listing-qr-sheet/qr-sheet-content';
import {
    fetchProtectedAmenities,
    fetchProtectedFeatures
} from '../../../utils/accommodation-catalog-relations';
import { env } from '../../../utils/env';
import {
    fetchExperienceAmenities,
    fetchExperienceFeatures,
    fetchVenueAmenities,
    fetchVenueFeatures
} from '../../../utils/listing-catalog-relations';
import { defineTool, type ToolErrorPayload, type ToolHandlerResult } from '../tool-definition';
import {
    type ListingToolVertical,
    ListingToolVerticalSchema,
    listingToolAccommodationService,
    listingToolExperienceService,
    listingToolVenueService
} from './listing-services';

/** Locale of the public URL: the platform default (tool replies are Spanish). */
export const GET_LISTING_PUBLIC_URL_LOCALE = 'es';

/** A catalog entry (amenity or feature) linked to the listing. */
export interface ListingCatalogRef {
    /** Catalog id; what `amenityIds` / `featureIds` take on update. */
    readonly id: string;
    /** Catalog slug (also its i18n key), readable by the model. */
    readonly slug: string | null;
}

/** Fields every vertical's result carries. */
interface ListingDetailBase {
    /** Listing id (UUID). */
    readonly id: string;
    /** Public name. */
    readonly name: string;
    /** The single publication state. */
    readonly publicationStatus: PublicationStatusEnum;
    /**
     * Absolute URL of the public page. `null` unless the listing is
     * `PUBLISHED`: any other state has no public page (it answers 404).
     */
    readonly publicUrl: string | null;
    /** Amenities currently linked. */
    readonly amenities: readonly ListingCatalogRef[];
    /** Features currently linked. */
    readonly features: readonly ListingCatalogRef[];
}

/** `get_listing` result for an accommodation. No opening hours. */
export interface AccommodationListingDetail extends ListingDetailBase {
    readonly vertical: VerticalEnum.ACCOMMODATION;
    /** Short summary. */
    readonly summary: string | null;
    /** Long description. */
    readonly description: string | null;
    /** Mobile phone (`contactInfo.mobilePhone`). */
    readonly phone: string | null;
    /** Website (`contactInfo.website`). */
    readonly website: string | null;
}

/** `get_listing` result for a venue or an experience. */
export interface ScheduledListingDetail extends ListingDetailBase {
    readonly vertical: VerticalEnum.VENUE | VerticalEnum.EXPERIENCE;
    /** Long description. */
    readonly description: string | null;
    /** Weekly schedule, as stored. */
    readonly openingHours: Venue['openingHours'] | Experience['openingHours'] | null;
    /** Contact details, as stored. */
    readonly contactInfo: Venue['contactInfo'] | Experience['contactInfo'] | null;
}

/** Result of `get_listing`, discriminated by `vertical`. */
export type ListingDetail = AccommodationListingDetail | ScheduledListingDetail;

/** Input schema: which listing to read. */
export const GetListingInputSchema = z
    .object({
        vertical: ListingToolVerticalSchema.describe(
            'The vertical returned by list_my_listings for this listing.'
        ),
        id: z.uuid().describe('The listing id returned by list_my_listings.')
    })
    .strict();

/** Codes a get-by-id read reports for a row the caller may not see. */
const NOT_FOUND_LIKE_CODES: ReadonlySet<string> = new Set<string>([
    ServiceErrorCode.NOT_FOUND,
    ServiceErrorCode.GONE,
    ServiceErrorCode.FORBIDDEN
]);

/** The uniform not-found error, whatever the vertical. */
function notFound(): ToolHandlerResult<never> {
    const error = entityNotFoundError({ entityName: 'listing' });
    return { error: { code: error.code, message: error.message } };
}

/**
 * Applies the get-own gate to a service read: a refused, missing or foreign
 * row is not found; any other service error is reported as is.
 *
 * @returns The owned row, or the error to answer with
 */
function admitOwnRow<TRow>(input: {
    readonly actor: Actor;
    readonly result: { readonly data?: TRow | null; readonly error?: ToolErrorPayload };
}): { readonly row: TRow; readonly error?: never } | { readonly error: ToolHandlerResult<never> } {
    const { actor, result } = input;
    if (result.error) {
        if (NOT_FOUND_LIKE_CODES.has(result.error.code)) {
            return { error: notFound() };
        }
        return { error: { error: result.error } };
    }
    const row = result.data ?? null;
    const access = resolveResourceStep({
        actorId: actor.id,
        facts: readListingAccessFacts({ entity: row }),
        operation: 'READ_OWN'
    });
    if (!access.allowed || row === null) {
        return { error: notFound() };
    }
    return { row };
}

/** The public URL of a listing, or `null` when it has no public page. */
function publicUrlFor(input: {
    readonly vertical: ListingToolVertical;
    readonly slug: string;
    readonly publicationStatus: PublicationStatusEnum;
}): string | null {
    if (input.publicationStatus !== PublicationStatusEnum.PUBLISHED) {
        return null;
    }
    return buildListingPublicUrl({
        vertical: input.vertical,
        slug: input.slug,
        locale: GET_LISTING_PUBLIC_URL_LOCALE,
        siteUrl: env.HOSPEDA_SITE_URL
    });
}

/** Reads an owned accommodation. */
async function getAccommodation(input: {
    readonly actor: Actor;
    readonly id: string;
}): Promise<ToolHandlerResult<ListingDetail>> {
    const result = await listingToolAccommodationService.getById(input.actor, input.id);
    const admitted = admitOwnRow<Accommodation>({ actor: input.actor, result });
    if (admitted.error) {
        return admitted.error;
    }
    const { row } = admitted;
    // Loaded only after the gate, so a foreign or missing id never reaches them.
    const [amenities, features] = await Promise.all([
        fetchProtectedAmenities(row.id),
        fetchProtectedFeatures(row.id)
    ]);
    return {
        data: {
            id: row.id,
            vertical: VerticalEnum.ACCOMMODATION,
            name: row.name,
            publicationStatus: row.publicationStatus,
            publicUrl: publicUrlFor({
                vertical: VerticalEnum.ACCOMMODATION,
                slug: row.slug,
                publicationStatus: row.publicationStatus
            }),
            summary: row.summary ?? null,
            description: row.description ?? null,
            phone: row.contactInfo?.mobilePhone ?? null,
            website: row.contactInfo?.website ?? null,
            amenities: amenities.map((a) => ({ id: a.id, slug: a.slug ?? null })),
            features: features.map((f) => ({ id: f.id, slug: f.slug ?? null }))
        }
    };
}

/** Reads an owned venue or experience. */
async function getScheduledListing(input: {
    readonly actor: Actor;
    readonly id: string;
    readonly vertical: VerticalEnum.VENUE | VerticalEnum.EXPERIENCE;
}): Promise<ToolHandlerResult<ListingDetail>> {
    const { actor, id, vertical } = input;
    const isVenue = vertical === VerticalEnum.VENUE;
    const result = isVenue
        ? await listingToolVenueService.getById(actor, id)
        : await listingToolExperienceService.getById(actor, id);
    const admitted = admitOwnRow<Venue | Experience>({ actor, result });
    if (admitted.error) {
        return admitted.error;
    }
    const { row } = admitted;
    const [amenities, features] = await Promise.all(
        isVenue
            ? [fetchVenueAmenities(row.id), fetchVenueFeatures(row.id)]
            : [fetchExperienceAmenities(row.id), fetchExperienceFeatures(row.id)]
    );
    return {
        data: {
            id: row.id,
            vertical,
            name: row.name,
            publicationStatus: row.publicationStatus,
            publicUrl: publicUrlFor({
                vertical,
                slug: row.slug,
                publicationStatus: row.publicationStatus
            }),
            description: row.description ?? null,
            openingHours: row.openingHours ?? null,
            contactInfo: row.contactInfo ?? null,
            amenities: amenities.map((a) => ({ id: a.amenityId, slug: a.slug })),
            features: features.map((f) => ({ id: f.featureId, slug: f.slug }))
        }
    };
}

/**
 * Reads one of the actor's listings as `get_listing` returns it: the editable
 * set plus name, publication status and public URL. A missing, foreign or
 * refused row is the uniform not-found error. `update_listing_basic` answers
 * with it too, so the model sees the same shape before and after an edit.
 *
 * @param args - Actor, vertical and listing id
 * @returns The listing detail, or the error to answer with
 */
export async function readOwnListingDetail(args: {
    readonly actor: Actor;
    readonly vertical: ListingToolVertical;
    readonly id: string;
}): Promise<ToolHandlerResult<ListingDetail>> {
    const { actor, vertical, id } = args;
    if (vertical === VerticalEnum.ACCOMMODATION) {
        return getAccommodation({ actor, id });
    }
    return getScheduledListing({ actor, id, vertical });
}

/** The owned row of any vertical, as the vertical service returns it. */
export type OwnListingRow = Accommodation | Venue | Experience;

/**
 * Gates a listing id through the same get-own authorization as `get_listing`
 * (service `getById`, then resource step `READ_OWN`) and returns the row,
 * without loading the catalog relations. For tools that only need to know the
 * listing is the caller's (`get_listing_stats`). A missing, foreign or refused
 * row is the uniform not-found error.
 *
 * @param args - Actor, vertical and listing id
 * @returns The owned row, or the error to answer with
 */
export async function readOwnListingRow(args: {
    readonly actor: Actor;
    readonly vertical: ListingToolVertical;
    readonly id: string;
}): Promise<
    | { readonly row: OwnListingRow; readonly error?: never }
    | { readonly error: ToolHandlerResult<never> }
> {
    const { actor, vertical, id } = args;
    const result =
        vertical === VerticalEnum.ACCOMMODATION
            ? await listingToolAccommodationService.getById(actor, id)
            : vertical === VerticalEnum.VENUE
              ? await listingToolVenueService.getById(actor, id)
              : await listingToolExperienceService.getById(actor, id);
    return admitOwnRow<OwnListingRow>({
        actor,
        result: result as { data?: OwnListingRow | null; error?: ToolErrorPayload }
    });
}

/**
 * `get_listing`: read-only, available to an unverified email exactly as the
 * HTTP get-own routes are (`READ_OWN`).
 */
export const getListingTool = defineTool({
    name: 'get_listing',
    title: 'Ver publicación',
    description:
        'Reads one listing the connected Hospeda user owns: its name, publication status, public URL (only when published) and the fields update_listing_basic can change. Accommodations return summary, description, phone, website, amenities and features (accommodations have no opening hours). Venues and experiences return description, openingHours, contactInfo, amenities and features. Amenities and features come as { id, slug }. A listing that does not exist or belongs to someone else is reported as not found. Take vertical and id from list_my_listings.',
    inputSchema: GetListingInputSchema,
    isWrite: false,
    emailUnverifiedOperation: 'READ_OWN',
    handler: async ({ actor, input }): Promise<ToolHandlerResult<ListingDetail>> =>
        readOwnListingDetail({ actor, vertical: input.vertical, id: input.id })
});
