/**
 * Owner self-service experience listing create endpoint (HOS-166 §7.2).
 *
 *   POST /api/v1/protected/experiences/
 *
 * Mirrors the accommodation owner create (`POST /protected/accommodations/`)
 * and the admin create at `experience/admin/create.ts`. Owners may leave draft
 * description and pricing unfinished; the venue route lives in `venue/protected/create.ts`.
 *
 * ## D-3 — server-forced fields
 *
 * `ExperienceOwnerCreateInputCheckedSchema` already OMITS `ownerId`, `slug`,
 * `publicationStatus` and `isFeatured` — this handler is the only place
 * `ownerId` comes from:
 * - `ownerId` — always `actor.id`.
 * - `slug` — never set here; `BaseListingService._beforeCreate` derives it
 *   server-side from `name` (HOS-166 OQ-3).
 * - `publicationStatus` — never set here: every listing is born `DRAFT` by
 *   the model (V6.9b, HOS-1641); only the publication machine moves it.
 *
 * ## Permission — an authenticated session, and nothing else (HOS-687)
 *
 * No `requiredPermissions`: this route is how an account BECOMES an
 * experience owner (`createForOwner` grants the role in the same transaction
 * as the insert). Authentication is still enforced by `createProtectedRoute`'s
 * factory middleware (401 before the handler runs, HOS-589 AC-8). The ADMIN
 * create route still carries the CREATE permission.
 *
 * @module routes/experience/protected/create
 */

import {
    ExperienceDraftCreateInputSchema,
    type ExperienceOwnerCreateInput,
    ExperienceOwnerCreateInputCheckedSchema,
    ExperienceProtectedSchema,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import { type Actor, ExperienceService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';

import type { ListingAccessWithSections } from '../../../middlewares/listing-access';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * Creates an experience listing for its owner exactly as this route does: the
 * server-forced `ownerId`, the re-parse through the owner draft persistence schema,
 * then `ExperienceService.createForOwner` (role grant + insert in one
 * transaction). Shared by this route and the owner assistant's `create_listing`
 * tool (HOS-2329, spec HOS-2335 C-6), which runs the route's listing-access step
 * itself before calling it.
 *
 * @param input - The actor and the validated owner-create body
 * @returns The created experience
 * @throws {ServiceError} VALIDATION_ERROR on a body the draft schema refuses,
 *   or the service's error
 */
export async function createExperienceListingForOwner(input: {
    readonly actor: Actor;
    readonly body: Record<string, unknown>;
}) {
    const { actor } = input;
    const data = input.body as ExperienceOwnerCreateInput;

    // Preserve admin defaults and required destination/owner fields while allowing
    // unfinished content. Missing pricing persists as NULL/NULL/false (HOS-2641).
    // safeParse maps re-validation errors to 4xx rather than a raw ZodError/500.
    const parsed = ExperienceDraftCreateInputSchema.safeParse({
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

    // `createForOwner`, not `create`: the role grant and the insert share one
    // transaction (HOS-687 / HOS-589 §6.1).
    const result = await experienceService.createForOwner(actor, parsed.data);

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message, result.error.details);
    }

    return result.data;
}

/**
 * Handler for the experience owner-create endpoint. Exported standalone so it
 * is unit-testable against a mocked `Context` + spied service.
 */
export async function handleCreateExperienceListing(ctx: Context, body: Record<string, unknown>) {
    return createExperienceListingForOwner({ actor: getActorFromContext(ctx), body });
}

/**
 * This route's listing-access step, as a route-config fragment. The
 * `listingAccess` literal lives here (the G2 / G-R3-C scanners read it) and the
 * route spreads it, so the route and `create_listing` (HOS-2329) run the SAME
 * declaration object: {@link EXPERIENCE_OWNER_CREATE_LISTING_ACCESS}.
 */
export const EXPERIENCE_OWNER_CREATE_ROUTE_ACCESS = {
    listingAccess: { vertical: VerticalEnum.EXPERIENCE, operation: 'CREATE' }
} as const satisfies { readonly listingAccess: ListingAccessWithSections };

/** The experience owner-create listing-access declaration, shared with `create_listing`. */
export const EXPERIENCE_OWNER_CREATE_LISTING_ACCESS: ListingAccessWithSections =
    EXPERIENCE_OWNER_CREATE_ROUTE_ACCESS.listingAccess;

/**
 * POST /api/v1/protected/experiences/
 *
 * Creates an experience listing owned by the caller. Starts as a
 * `DRAFT` (D-3) — see module docstring.
 */
export const protectedCreateExperienceListingRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    ...EXPERIENCE_OWNER_CREATE_ROUTE_ACCESS,
    summary: 'Create an experience listing (owner self-service)',
    description:
        'Creates an experience listing owned by the authenticated caller and grants them the EXPERIENCE_OWNER role in the same transaction. Starts hidden (DRAFT) until the owner completes it. Requires an authenticated session and no experience permission.',
    tags: ['Experience'],
    // No `requiredPermissions` on purpose (HOS-687) — see the module docstring.
    // The checked draft contract requires a unit only when a price is supplied.
    requestBody: ExperienceOwnerCreateInputCheckedSchema,
    responseSchema: ExperienceProtectedSchema,
    successStatusCode: 201,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => handleCreateExperienceListing(ctx, body)
});
