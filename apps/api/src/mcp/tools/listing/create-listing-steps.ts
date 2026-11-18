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
    type AccommodationCreateDraftHttp,
    AccommodationCreateDraftHttpSchema,
    DUPLICATE_LOCATION_REASON,
    ExperienceAdminCreateInputCheckedSchema,
    ServiceErrorCode,
    VenueAdminCreateInputSchema,
    type VenueOwnerCreateInput,
    VerticalEnum
} from '@repo/schemas';
import {
    type Actor,
    assertNoOwnLocationConflict,
    resolveLocationKeyPatch,
    ServiceError
} from '@repo/service-core';
import { z } from 'zod';
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

/** The slice of a created row the tool answers with. */
const CreatedRowSchema = z.looseObject({ id: z.string().min(1), slug: z.string().min(1) });

/** Where an issue of the commit-side schema lands in the tool's own input. */
const INPUT_FIELD_OF: Readonly<Record<string, string>> = {
    latitude: 'mapsUrl',
    longitude: 'mapsUrl',
    coordinates: 'mapsUrl',
    meetingPointLat: 'mapsUrl',
    meetingPointLong: 'mapsUrl',
    meetingPoint: 'street',
    location: 'street'
};

/** Maps a commit-side issue path to the input field the user can fix. */
function inputFieldOf(path: readonly PropertyKey[]): string {
    const [head, second] = path.map(String);
    if (head === 'location') {
        if (second === 'street' || second === 'number') return second;
        if (second === 'coordinates') return 'mapsUrl';
    }
    return INPUT_FIELD_OF[head ?? ''] ?? head ?? '';
}

/** The commit-side revalidation of a body, as each portal create path runs it. */
export type ValidatedCreate =
    | { readonly vertical: VerticalEnum.ACCOMMODATION; readonly body: AccommodationCreateDraftHttp }
    | {
          readonly vertical: VerticalEnum.VENUE | VerticalEnum.EXPERIENCE;
          readonly body: Record<string, unknown>;
      };

/** What {@link validateCreateBody} answers. */
export type ValidatedCreateResult =
    | { readonly ok: true; readonly value: ValidatedCreate }
    | { readonly ok: false; readonly error: ToolHandlerResult<never> };

/** A VALIDATION_ERROR naming the input fields a commit-side issue lands on. */
function commitSchemaError(error: z.ZodError): ToolHandlerResult<never> {
    const details = error.issues.map((issue) => ({
        path: [inputFieldOf(issue.path)],
        message: issue.message
    }));
    return {
        error: {
            code: ServiceErrorCode.VALIDATION_ERROR,
            message: details.map((detail) => `${detail.path[0]}: ${detail.message}`).join('; '),
            details
        }
    };
}

/**
 * Runs the schema the commit's write path re-parses the body with:
 * accommodation `AccommodationCreateDraftHttpSchema` (what `createForOnboarding`
 * validates), venue `VenueAdminCreateInputSchema` and experience
 * `ExperienceAdminCreateInputCheckedSchema` (with the server-forced `ownerId`,
 * as the route helpers parse). The preview runs it before issuing a token, so a
 * payload that would fail at commit fails at preview (L-6).
 *
 * @param input - Actor, vertical and the create body
 * @returns The typed body, or a VALIDATION_ERROR naming the input fields
 */
export function validateCreateBody(input: {
    readonly actor: Actor;
    readonly vertical: CreateListingInput['vertical'];
    readonly body: Record<string, unknown>;
}): ValidatedCreateResult {
    const { actor, vertical, body } = input;
    if (vertical === VerticalEnum.ACCOMMODATION) {
        const draft = AccommodationCreateDraftHttpSchema.safeParse(body);
        return draft.success
            ? { ok: true, value: { vertical, body: draft.data } }
            : { ok: false, error: commitSchemaError(draft.error) };
    }
    const checked =
        vertical === VerticalEnum.VENUE
            ? VenueAdminCreateInputSchema.safeParse({ ...body, ownerId: actor.id })
            : ExperienceAdminCreateInputCheckedSchema.safeParse({ ...body, ownerId: actor.id });
    // The route helpers re-parse the body themselves; they take it as sent.
    return checked.success
        ? { ok: true, value: { vertical, body } }
        : { ok: false, error: commitSchemaError(checked.error) };
}

/**
 * The single write: the portal route's own create function, then (accommodation)
 * the public cache eviction.
 *
 * @param input - Actor and the body {@link validateCreateBody} accepted
 * @returns The created listing, or the error to answer with
 * @throws {ServiceError} What the route's create function throws
 */
export async function writeOwnerCreate(input: {
    readonly actor: Actor;
    readonly create: ValidatedCreate;
}): Promise<ToolHandlerResult<CreatedListing>> {
    const { actor, create } = input;
    if (create.vertical === VerticalEnum.ACCOMMODATION) {
        const draft = await startHostOnboardingDraft({
            actor,
            source: 'assistant',
            body: create.body
        });
        for (const pathPrefix of ACCOMMODATION_CACHE_INVALIDATION_PREFIXES) {
            invalidateCacheByPathPrefix({ pathPrefix });
        }
        return { data: { id: draft.accommodationId, slug: draft.accommodationSlug } };
    }
    const row =
        create.vertical === VerticalEnum.VENUE
            ? await createVenueListingForOwner({ actor, body: create.body })
            : await createExperienceListingForOwner({ actor, body: create.body });
    const created = CreatedRowSchema.safeParse(row);
    if (!created.success) {
        return {
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: 'Owner create returned no listing'
            }
        };
    }
    return { data: { id: created.data.id, slug: created.data.slug } };
}
