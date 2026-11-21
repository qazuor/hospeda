/**
 * @file listing-refusal-actions.ts
 * @description Where a refused listing tool call points the owner (HOS-2326,
 * spec HOS-2335 §5.1): the shared `refusalAction` logic of the listing tools.
 *
 * Two questions are answered here:
 * - which editor section owns a field or an unmet publish requirement
 *   ({@link sectionForField}, {@link firstMissingSection});
 * - the generic fallbacks every listing tool shares ({@link listingRefusalLink}).
 *
 * The publication refusals have their own file (`publication-refusal-link.ts`).
 *
 * The result is a destination, never a URL: the executor builds it and applies
 * the rules of a refusal link (`../refusal-action.ts`), so nothing here can leak
 * an id into a not-found answer.
 */

import {
    EDITOR_SECTION_SLUGS,
    type PortalDestination,
    type PortalListingVertical,
    type PortalSectionId
} from '@repo/portal-routes';
import {
    ACCOMMODATION_PUBLISH_REQUIREMENTS,
    type ListingSectionId,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import { z } from 'zod';
import type { ToolErrorPayload, ToolRefusalLink } from '../tool-definition';
import { ListingToolVerticalSchema } from './listing-services';

/** What an input field is about, independent of the vertical's section ids. */
type SectionTopic =
    | 'basicInfo'
    | 'location'
    | 'media'
    | 'price'
    | 'capacity'
    | 'contact'
    | 'openingHours'
    | 'amenities';

/** Per field name (as an input or a completeness check spells it), its topic. */
const FIELD_TOPIC: Readonly<Record<string, SectionTopic>> = {
    name: 'basicInfo',
    slug: 'basicInfo',
    summary: 'basicInfo',
    description: 'basicInfo',
    richDescription: 'basicInfo',
    type: 'basicInfo',
    destinationId: 'basicInfo',
    businessLines: 'basicInfo',
    tags: 'basicInfo',
    location: 'location',
    latitude: 'location',
    longitude: 'location',
    street: 'location',
    number: 'location',
    address: 'location',
    coordinates: 'location',
    meetingPoint: 'location',
    meetingPointLat: 'location',
    meetingPointLong: 'location',
    media: 'media',
    photos: 'media',
    images: 'media',
    gallery: 'media',
    featuredImage: 'media',
    'media.featuredImage': 'media',
    videos: 'media',
    price: 'price',
    priceFrom: 'price',
    priceUnit: 'price',
    priceRange: 'price',
    basePrice: 'price',
    currency: 'price',
    isPriceOnRequest: 'price',
    capacity: 'capacity',
    maxGuests: 'capacity',
    bedrooms: 'capacity',
    bathrooms: 'capacity',
    beds: 'capacity',
    minNights: 'capacity',
    phone: 'contact',
    website: 'contact',
    email: 'contact',
    contactInfo: 'contact',
    socialNetworks: 'contact',
    openingHours: 'openingHours',
    amenityIds: 'amenities',
    featureIds: 'amenities'
};

/**
 * Per vertical, the section each topic lives in. A topic a vertical has no
 * section for (opening hours of an accommodation) is absent: the link then goes
 * to the editor hub.
 */
const TOPIC_SECTION = {
    accommodation: {
        basicInfo: 'basicInfo',
        location: 'location',
        media: 'photos',
        price: 'capacityPricing',
        capacity: 'capacityPricing',
        contact: 'contact',
        amenities: 'amenities'
    },
    venue: {
        basicInfo: 'basicInfo',
        location: 'location',
        media: 'media',
        price: 'price',
        contact: 'contact',
        openingHours: 'openingHours',
        amenities: 'amenities'
    },
    experience: {
        basicInfo: 'basicInfo',
        location: 'meetingPoint',
        media: 'media',
        price: 'price',
        contact: 'contact',
        openingHours: 'openingHours',
        amenities: 'amenities'
    }
} as const satisfies {
    readonly [V in PortalListingVertical]: Partial<Record<SectionTopic, ListingSectionId<V>>>;
};

/** Narrows a string to a section id the vertical's editor has (a type guard, so positional). */
function isSectionOf(vertical: PortalListingVertical, value: string): value is PortalSectionId {
    return Object.hasOwn(EDITOR_SECTION_SLUGS[vertical], value);
}

/**
 * The editor section that owns an input field or a completeness field name.
 *
 * @param args - The vertical and the field
 * @returns The section id, or `undefined` when the field has no section there
 */
export function sectionForField(args: {
    readonly vertical: PortalListingVertical;
    readonly field: string;
}): PortalSectionId | undefined {
    const topic = Object.hasOwn(FIELD_TOPIC, args.field) ? FIELD_TOPIC[args.field] : undefined;
    if (topic === undefined) {
        return undefined;
    }
    const topics: Readonly<Partial<Record<SectionTopic, string>>> = TOPIC_SECTION[args.vertical];
    const section = topics[topic];
    return section !== undefined && isSectionOf(args.vertical, section) ? section : undefined;
}

/**
 * The editor section of the FIRST unmet publish requirement.
 *
 * - Accommodation: `missing` holds requirement ids; each names its own section.
 * - Venue and experience: `missing` holds completeness field names.
 *
 * @param args - The vertical and the missing requirements, in the order reported
 * @returns The section id, or `undefined` when none of them has a section
 */
export function firstMissingSection(args: {
    readonly vertical: PortalListingVertical;
    readonly missing: readonly string[];
}): PortalSectionId | undefined {
    for (const item of args.missing) {
        const section =
            args.vertical === VerticalEnum.ACCOMMODATION
                ? ACCOMMODATION_PUBLISH_REQUIREMENTS.find((r) => r.id === item)?.editorSectionId
                : undefined;
        if (section !== undefined && isSectionOf(args.vertical, section)) {
            return section;
        }
        const byField = sectionForField({ vertical: args.vertical, field: item });
        if (byField !== undefined) {
            return byField;
        }
    }
    return undefined;
}

/** The listing a call is about, read defensively from raw or validated input. */
export interface ListingRef {
    /** The listing's vertical. */
    readonly vertical: PortalListingVertical;
    /** The listing id, when the input carries a valid one. */
    readonly id?: string;
}

/**
 * Reads the vertical and listing id of a call's input. The input may be the RAW
 * arguments of a malformed call, so nothing is assumed about it.
 *
 * @param args - The input, and the key that holds the listing id (`id` or `listingId`)
 * @returns The listing, or `undefined` when the input has no valid vertical
 */
export function readListingRef(args: {
    readonly input: unknown;
    readonly idKey?: 'id' | 'listingId';
}): ListingRef | undefined {
    const parsed = z.looseObject({ vertical: ListingToolVerticalSchema }).safeParse(args.input);
    if (!parsed.success) {
        return undefined;
    }
    const raw: Readonly<Record<string, unknown>> = parsed.data;
    const id = z.uuid().safeParse(raw[args.idKey ?? 'id']);
    return { vertical: parsed.data.vertical, ...(id.success ? { id: id.data } : {}) };
}

/**
 * The editor of a listing, at a section when it has one. Without a listing id
 * there is no editor to open, so it falls back to the owner's list.
 *
 * @param args - The listing and the optional section
 * @returns The destination
 */
export function editorLink(args: {
    readonly ref: ListingRef;
    readonly section?: PortalSectionId;
}): PortalDestination {
    const { ref, section } = args;
    return ref.id === undefined
        ? { kind: 'ownerListings', vertical: ref.vertical }
        : {
              kind: 'listingEditor',
              vertical: ref.vertical,
              id: ref.id,
              ...(section === undefined ? {} : { section })
          };
}

/**
 * The link every listing tool shares for a refusal it has no specific page for.
 * A missing or foreign listing and a plain permission refusal point at the
 * owner's list of that vertical, which names no id (AC-C4); a missing plan
 * capability points at the vertical's plans.
 *
 * @param args - The refusal and the listing
 * @returns The link, or `undefined` when no page helps
 */
export function listingRefusalLink(args: {
    readonly error: ToolErrorPayload;
    readonly ref: ListingRef;
}): ToolRefusalLink | undefined {
    const { error, ref } = args;
    switch (error.code) {
        case ServiceErrorCode.NOT_FOUND:
        case ServiceErrorCode.GONE:
        case ServiceErrorCode.FORBIDDEN:
            return { destination: { kind: 'ownerListings', vertical: ref.vertical } };
        case ServiceErrorCode.ENTITLEMENT_REQUIRED:
            return { destination: { kind: 'plans', vertical: ref.vertical } };
        case ServiceErrorCode.LIMIT_REACHED:
            return { destination: { kind: 'subscription' } };
        default:
            return undefined;
    }
}
