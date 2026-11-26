/**
 * Owner self-service venue listing create endpoint (HOS-166 §7.2).
 *
 *   POST /api/v1/protected/venues/
 *
 * Mirrors the accommodation owner create (`POST /protected/accommodations/`)
 * and the admin create at `venue/admin/create.ts`. Owners may leave the draft
 * description unfinished; the experience route lives in `experience/protected/create.ts`.
 *
 * ## D-3 — server-forced fields
 *
 * `VenueOwnerCreateInputSchema` already OMITS `ownerId`, `slug`,
 * `publicationStatus` and `isFeatured` — this handler is the only place
 * `ownerId` comes from:
 * - `ownerId` — always `actor.id`. An owner can only ever create a listing
 *   for themselves.
 * - `slug` — never set here; `BaseListingService._beforeCreate` derives it
 *   server-side from `name` (HOS-166 OQ-3).
 * - `publicationStatus` — never set here: every listing is born `DRAFT` by
 *   the model (V6.9b, HOS-1641); only the publication machine moves it.
 *
 * ## Permission — an authenticated session, and nothing else (HOS-687)
 *
 * This route declares NO `requiredPermissions`: it is how an account BECOMES a
 * venue owner (`createForOwner` grants the owner role inside the same
 * transaction as the insert, mirror of
 * `AccommodationService.createForOnboarding`), so demanding the owner's
 * permission to reach it would make the role unreachable. Authentication is
 * still enforced by `createProtectedRoute`'s own factory middleware: an
 * anonymous caller is refused with 401 before the handler is ever entered, and
 * that must stay a factory concern rather than an in-handler check
 * (HOS-589 AC-8). The ADMIN create route still carries the CREATE permission.
 *
 * @module routes/venue/protected/create
 */

import {
    BUSINESS_LINE_RULES,
    type BusinessLine,
    ServiceErrorCode,
    sectionsTouchedByBody,
    sectionTraitsTouchedByBody,
    VenueDraftCreateInputSchema,
    type VenueOwnerCreateInput,
    VenueOwnerCreateInputSchema,
    VenueProtectedSchema,
    VerticalEnum
} from '@repo/schemas';
import { type Actor, ServiceError, VenueService } from '@repo/service-core';
import type { Context } from 'hono';

import type { ListingAccessWithSections } from '../../../middlewares/listing-access';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/**
 * Creates a venue listing for its owner exactly as this route does: the
 * server-forced `ownerId`, the re-parse through the owner draft persistence schema,
 * then `VenueService.createForOwner` (role grant + insert in one transaction).
 * Shared by this route and the owner assistant's `create_listing` tool
 * (HOS-2329, spec HOS-2335 C-6), which runs the route's listing-access step
 * itself before calling it.
 *
 * @param input - The actor and the validated owner-create body
 * @returns The created venue
 * @throws {ServiceError} VALIDATION_ERROR on a body the draft schema refuses,
 *   or the service's error
 */
export async function createVenueListingForOwner(input: {
    readonly actor: Actor;
    readonly body: Record<string, unknown>;
}) {
    const { actor } = input;
    const data = input.body as VenueOwnerCreateInput;

    // Preserve admin defaults and required destination/owner fields, but permit
    // an unfinished description in this owner-only draft path (HOS-2641).
    // safeParse keeps re-validation errors mapped to 4xx (HOS-1954).
    const parsed = VenueDraftCreateInputSchema.safeParse({
        ...data,
        description: data.description ?? '',
        ownerId: actor.id
    });

    if (!parsed.success) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            parsed.error.issues
                .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                .join('; ')
        );
    }

    const createInput = parsed.data;

    // `createForOwner`, not `create`: the role grant and the insert share one
    // transaction (HOS-687 / HOS-589 §6.1).
    const result = await venueService.createForOwner(actor, createInput);

    if (result.error) {
        throw new ServiceError(
            result.error.code,
            result.error.message,
            result.error.details,
            result.error.reason
        );
    }

    return result.data;
}

/**
 * Handler for the venue owner-create endpoint. Exported standalone so it
 * is unit-testable against a mocked `Context` + spied service without booting
 * the full Hono app.
 */
export async function handleCreateVenueListing(ctx: Context, body: Record<string, unknown>) {
    return createVenueListingForOwner({ actor: getActorFromContext(ctx), body });
}

/**
 * The business lines a venue owner-create body asks for (the listing-access
 * step's `businessLinesFromBody`): the body's own `businessLines`, otherwise the
 * preselection of its `type`. Shared with `create_listing` (HOS-2329) so the
 * tool's CREATE step sees the same lines as this route's.
 *
 * @param args - The validated body
 * @returns The requested business lines
 */
export function venueCreateBusinessLines({
    body
}: {
    readonly body: Record<string, unknown> | undefined;
}): readonly BusinessLine[] {
    if (Array.isArray(body?.businessLines))
        return body.businessLines.filter(
            (line): line is string => typeof line === 'string'
        ) as BusinessLine[];
    const type = body?.type as keyof typeof BUSINESS_LINE_RULES.venue.typeRules | undefined;
    return type ? (BUSINESS_LINE_RULES.venue.typeRules[type]?.preselect ?? []) : [];
}

/**
 * The sections a venue owner-create body writes (the listing-access step's
 * `listingSection`). Shared with `create_listing` (HOS-2329).
 *
 * @param args - The validated body
 * @returns One `write` declaration per touched section
 */
export function venueCreateSections({
    body
}: {
    readonly body: Record<string, unknown> | undefined;
}): { readonly id: string; readonly intent: 'write' }[] {
    return sectionsTouchedByBody({ vertical: 'venue', body }).map((id) => ({
        id,
        intent: 'write' as const
    }));
}

/**
 * The section traits a venue owner-create body touches (HOS-2258: `videos`,
 * gated by `can_embed_video`). Shared with `create_listing`.
 *
 * @param args - The validated body
 * @returns The touched trait ids
 */
export function venueCreateSectionTraits({
    body
}: {
    readonly body: Record<string, unknown> | undefined;
}): readonly string[] {
    return sectionTraitsTouchedByBody({ vertical: 'venue', body });
}

/**
 * This route's listing-access step, as a route-config fragment. The
 * `listingAccess` literal lives here (the G2 / G-R3-C scanners read it) and the
 * route spreads it, so the route and `create_listing` (HOS-2329) run the SAME
 * declaration object: {@link VENUE_OWNER_CREATE_LISTING_ACCESS}.
 */
export const VENUE_OWNER_CREATE_ROUTE_ACCESS = {
    listingAccess: {
        vertical: VerticalEnum.VENUE,
        operation: 'CREATE',
        businessLinesFromBody: venueCreateBusinessLines,
        listingSection: venueCreateSections,
        sectionTraits: venueCreateSectionTraits
    }
} as const satisfies { readonly listingAccess: ListingAccessWithSections };

/** The venue owner-create listing-access declaration, shared with `create_listing`. */
export const VENUE_OWNER_CREATE_LISTING_ACCESS: ListingAccessWithSections =
    VENUE_OWNER_CREATE_ROUTE_ACCESS.listingAccess;

/**
 * POST /api/v1/protected/venues/
 *
 * Creates a venue listing owned by the caller. Starts as a
 * `DRAFT` (D-3) — see module docstring.
 */
export const protectedCreateVenueListingRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    ...VENUE_OWNER_CREATE_ROUTE_ACCESS,
    summary: 'Create a venue listing (owner self-service)',
    description:
        'Creates a venue listing owned by the authenticated caller and grants them the VENUE_OWNER role in the same transaction. Starts hidden (DRAFT) until the owner completes it. Requires an authenticated session and no venue permission.',
    tags: ['Venue'],
    // No `requiredPermissions` on purpose (HOS-687): this route is how an
    // account BECOMES a venue owner, so demanding the owner's permission
    // to reach it made the role unreachable. Authentication is still enforced
    // by the factory — see the module docstring.
    requestBody: VenueOwnerCreateInputSchema,
    responseSchema: VenueProtectedSchema,
    successStatusCode: 201,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => handleCreateVenueListing(ctx, body)
});
