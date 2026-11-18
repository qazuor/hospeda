/**
 * @file create-listing-steps.ts
 * @description The steps `create_listing` runs around the portal's own create
 * code (HOS-2329, spec HOS-2335 §6.4, C-1 and C-6). Every write goes through the
 * function the portal route itself calls, so the side effects are the route's:
 *
 * | Vertical | Portal route | Access step | Write (shared with the route) |
 * |---|---|---|---|
 * | accommodation | `POST /protected/host-onboarding/start` (D-6) | none: the route declares no `listingAccess` | `startHostOnboardingDraft`: `createForOnboarding` (insert + HOST promotion in one transaction) + the two analytics events |
 * | venue | `POST /protected/venues/` | `CREATE`, `businessLinesFromBody` + `listingSection` from the body | `createVenueListingForOwner`: admin re-parse + `createForOwner` (role grant in the same transaction) |
 * | experience | `POST /protected/experiences/` | `CREATE` | `createExperienceListingForOwner`: checked re-parse + `createForOwner` |
 *
 * Public cache eviction (accommodation) runs after the write, like the edit
 * tools do (`listing-owner-write.ts`), even though the host-onboarding mount is
 * outside `ACCOMMODATION_WRITE_MOUNT_PATHS`: harmless for a draft, and what C-1
 * asks for (AC-C22).
 *
 * Coordinates come only from the point the preview resolved (§5.5); the
 * `location_key` is written by the services' create hooks from street + number
 * + destination, never from coordinates (D-4).
 */

import {
    DUPLICATE_LOCATION_REASON,
    ServiceErrorCode,
    type VenueOwnerCreateInput,
    VerticalEnum
} from '@repo/schemas';
import {
    type Actor,
    assertNoOwnLocationConflict,
    resolveLocationKeyPatch,
    ServiceError
} from '@repo/service-core';
import { ACCOMMODATION_CACHE_INVALIDATION_PREFIXES } from '../../../middlewares/accommodation-cache-invalidation';
import { invalidateCacheByPathPrefix } from '../../../middlewares/cache';
import {
    decideListingAccess,
    throwListingAccessRefusal
} from '../../../middlewares/listing-access';
import {
    createExperienceListingForOwner,
    EXPERIENCE_OWNER_CREATE_LISTING_ACCESS
} from '../../../routes/experience/protected/create';
import { startHostOnboardingDraft } from '../../../routes/host-onboarding/protected/start';
import {
    createVenueListingForOwner,
    VENUE_OWNER_CREATE_LISTING_ACCESS
} from '../../../routes/venue/protected/create';
import type { ToolHandlerResult } from '../tool-definition';
import { type CreateListingInput, priceOnRequestDefaults } from './create-listing-input';
import type { MapsPoint } from './google-maps-link';

/** The id of a listing that does not exist yet, for the duplicate-address read. */
const NOT_YET_CREATED_ID = '00000000-0000-0000-0000-000000000000';

/** Venue `location` as the owner create schema takes it. */
type VenueLocation = NonNullable<VenueOwnerCreateInput['location']>;

/** Copies the keys of an input that are present. */
function present(
    input: Readonly<Record<string, unknown>>,
    keys: readonly string[]
): Record<string, unknown> {
    return Object.fromEntries(
        keys.filter((key) => input[key] !== undefined).map((key) => [key, input[key]])
    );
}

/** Fields each vertical's body takes as is from the input. */
const BODY_FIELDS: Readonly<Record<CreateListingInput['vertical'], readonly string[]>> = {
    [VerticalEnum.ACCOMMODATION]: [
        'name',
        'summary',
        'type',
        'destinationId',
        'description',
        'maxGuests',
        'bedrooms',
        'bathrooms',
        'beds',
        'street',
        'number'
    ],
    [VerticalEnum.VENUE]: [
        'name',
        'summary',
        'description',
        'type',
        'destinationId',
        'businessLines'
    ],
    [VerticalEnum.EXPERIENCE]: [
        'name',
        'summary',
        'description',
        'type',
        'destinationId',
        'priceFrom',
        'priceUnit',
        'isPriceOnRequest',
        'businessLines'
    ]
};

/**
 * The body the portal route would receive for this input and point.
 *
 * - accommodation: the draft's flat `latitude`/`longitude`/`street`/`number`;
 * - venue: `location` (`coordinates` as strings, `street`, `number`);
 * - experience: `meetingPoint` (street + number as text) and
 *   `meetingPointLat`/`meetingPointLong`. Experiences have no `location_key`.
 *
 * @param args - The validated input and the previewed point (or `null`)
 * @returns The create body
 */
export function buildCreateBody({
    input,
    point
}: {
    readonly input: CreateListingInput;
    readonly point: MapsPoint | null;
}): Record<string, unknown> {
    const body = present(input, BODY_FIELDS[input.vertical]);
    if (input.vertical === VerticalEnum.ACCOMMODATION) {
        return point ? { ...body, latitude: point.lat, longitude: point.lng } : body;
    }
    if (input.vertical === VerticalEnum.VENUE) {
        const location: VenueLocation = {
            ...(point
                ? { coordinates: { lat: point.lat.toString(), long: point.lng.toString() } }
                : {}),
            ...(input.street === undefined ? {} : { street: input.street }),
            ...(input.number === undefined ? {} : { number: input.number })
        };
        return Object.keys(location).length > 0 ? { ...body, location } : body;
    }
    const meetingPoint = [input.street, input.number].filter(Boolean).join(' ').trim();
    return {
        ...body,
        ...priceOnRequestDefaults({ input }),
        ...(meetingPoint === '' ? {} : { meetingPoint }),
        ...(point ? { meetingPointLat: point.lat, meetingPointLong: point.lng } : {})
    };
}

/** Whether the body sets any location (address or point). */
export function bodyHasLocation({
    vertical,
    body
}: {
    readonly vertical: CreateListingInput['vertical'];
    readonly body: Readonly<Record<string, unknown>>;
}): boolean {
    if (vertical === VerticalEnum.ACCOMMODATION) {
        return ['latitude', 'street', 'number'].some((key) => body[key] !== undefined);
    }
    if (vertical === VerticalEnum.VENUE) {
        return body.location !== undefined;
    }
    return body.meetingPoint !== undefined || body.meetingPointLat !== undefined;
}

/**
 * Runs the create route's listing-access step, owner-only and side-effect
 * free. Accommodation runs none, as `/host-onboarding/start` declares none.
 * A refusal (`NO_COVERAGE`, a section the business lines lack, ...) is thrown
 * as the route throws it; a role never decides (it is the access pipeline).
 *
 * @param input - Actor, vertical and the create body
 * @returns `undefined` when allowed
 */
export async function authorizeOwnerCreate(input: {
    readonly actor: Actor;
    readonly vertical: CreateListingInput['vertical'];
    readonly body: Record<string, unknown>;
}): Promise<undefined> {
    if (input.vertical === VerticalEnum.ACCOMMODATION) {
        return undefined;
    }
    const config =
        input.vertical === VerticalEnum.VENUE
            ? VENUE_OWNER_CREATE_LISTING_ACCESS
            : EXPERIENCE_OWNER_CREATE_LISTING_ACCESS;
    const decision = await decideListingAccess({
        actor: input.actor,
        listingId: '',
        config,
        tier: 'protected',
        body: input.body,
        ownerOnly: true
    });
    if (decision === null || decision.result.allowed) {
        return undefined;
    }
    const { result, subjectId, ports } = decision;
    return throwListingAccessRefusal({ config, result, subjectId, ports });
}

/**
 * Whether the confirmed address equals the one of another PUBLISHED listing of
 * the same owner in the same destination (AC-C23f). Reads with the publish
 * rule's own helper; the draft is still created (with the same key), and
 * publishing it is refused with `DUPLICATE_LOCATION`.
 *
 * @param input - Actor, vertical and the create body
 * @returns `true` when publishing would hit the one-address rule
 */
export async function hasDuplicateAddress(input: {
    readonly actor: Actor;
    readonly vertical: CreateListingInput['vertical'];
    readonly body: Readonly<Record<string, unknown>>;
}): Promise<boolean> {
    if (input.vertical === VerticalEnum.EXPERIENCE) {
        return false; // experiences carry no location_key
    }
    const { body } = input;
    const payload =
        input.vertical === VerticalEnum.ACCOMMODATION
            ? {
                  destinationId: body.destinationId,
                  location: present(body, ['street', 'number'])
              }
            : { destinationId: body.destinationId, location: body.location };
    const { locationKey } = resolveLocationKeyPatch({ payload, current: null });
    try {
        await assertNoOwnLocationConflict({
            vertical: input.vertical,
            listingId: NOT_YET_CREATED_ID,
            ownerId: input.actor.id,
            locationKey: locationKey ?? null
        });
        return false;
    } catch (error) {
        if (error instanceof ServiceError && error.reason === DUPLICATE_LOCATION_REASON) {
            return true;
        }
        throw error;
    }
}

/** What a successful create answers. */
export interface CreatedListing {
    readonly id: string;
    readonly slug: string;
}

/** Reads the id and slug of a created row. */
function readCreated(row: unknown): CreatedListing | undefined {
    if (typeof row !== 'object' || row === null) {
        return undefined;
    }
    const { id, slug } = row as { readonly id?: unknown; readonly slug?: unknown };
    return typeof id === 'string' && typeof slug === 'string' ? { id, slug } : undefined;
}

/**
 * The single write: the portal route's own create function, then (accommodation)
 * the public cache eviction.
 *
 * @param input - Actor, vertical and the create body
 * @returns The created listing, or the error to answer with
 * @throws {ServiceError} What the route's create function throws
 */
export async function writeOwnerCreate(input: {
    readonly actor: Actor;
    readonly vertical: CreateListingInput['vertical'];
    readonly body: Record<string, unknown>;
}): Promise<ToolHandlerResult<CreatedListing>> {
    const { actor, vertical, body } = input;
    if (vertical === VerticalEnum.ACCOMMODATION) {
        const draft = await startHostOnboardingDraft({
            actor,
            source: 'assistant',
            body: body as Parameters<typeof startHostOnboardingDraft>[0]['body']
        });
        for (const pathPrefix of ACCOMMODATION_CACHE_INVALIDATION_PREFIXES) {
            invalidateCacheByPathPrefix({ pathPrefix });
        }
        return { data: { id: draft.accommodationId, slug: draft.accommodationSlug } };
    }
    const row =
        vertical === VerticalEnum.VENUE
            ? await createVenueListingForOwner({ actor, body })
            : await createExperienceListingForOwner({ actor, body });
    const created = readCreated(row);
    if (!created) {
        return {
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: 'Owner create returned no listing'
            }
        };
    }
    return { data: created };
}
