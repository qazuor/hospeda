/**
 * Owner self-service gastronomy listing create endpoint (HOS-166 §7.2).
 *
 *   POST /api/v1/protected/gastronomies/
 *
 * Mirrors the accommodation owner create (`POST /protected/accommodations/`)
 * and the admin create at `gastronomy/admin/create.ts`. The gastronomy
 * owner-create payload has its own required shape
 * (`priceFrom`/`priceUnit`/`isPriceOnRequest`), so this vertical has its own
 * route; the experience one lives in `experience/protected/create.ts`.
 *
 * ## D-3 — server-forced fields
 *
 * `GastronomyOwnerCreateInputSchema` already OMITS `ownerId`, `slug`,
 * `lifecycleState`, `visibility`, `isFeatured`, `moderationState` — this
 * handler is the only place those values come from:
 * - `ownerId` — always `actor.id`. An owner can only ever create a listing
 *   for themselves.
 * - `slug` — never set here; `BaseListingService._beforeCreate` derives it
 *   server-side from `name` (HOS-166 OQ-3).
 * - `visibility: PRIVATE`, `lifecycleState: DRAFT` — every owner-created
 *   listing starts hidden.
 *
 * ## Permission — an authenticated session, and nothing else (HOS-687)
 *
 * This route declares NO `requiredPermissions`: it is how an account BECOMES a
 * gastronomy owner (`createForOwner` grants the owner role inside the same
 * transaction as the insert, mirror of
 * `AccommodationService.createForOnboarding`), so demanding the owner's
 * permission to reach it would make the role unreachable. Authentication is
 * still enforced by `createProtectedRoute`'s own factory middleware: an
 * anonymous caller is refused with 401 before the handler is ever entered, and
 * that must stay a factory concern rather than an in-handler check
 * (HOS-589 AC-8). The ADMIN create route still carries the CREATE permission.
 *
 * @module routes/gastronomy/protected/create
 */

import {
    GastronomyAdminCreateInputSchema,
    type GastronomyOwnerCreateInput,
    GastronomyOwnerCreateInputSchema,
    GastronomyProtectedSchema,
    LifecycleStatusEnum,
    VerticalEnum,
    VisibilityEnum
} from '@repo/schemas';
import { GastronomyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';

import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * Handler for the gastronomy owner-create endpoint. Exported standalone so it
 * is unit-testable against a mocked `Context` + spied service without booting
 * the full Hono app.
 */
export async function handleCreateGastronomyListing(ctx: Context, body: Record<string, unknown>) {
    const actor = getActorFromContext(ctx);
    const data = body as GastronomyOwnerCreateInput;

    // Re-parse through the FULL admin create schema so every other
    // .default() field (isFeatured, moderationState, reviewsCount,
    // averageRating) is populated the same way an admin create would be —
    // `create()` re-validates against this exact schema internally, so this
    // is a cheap, type-correct way to merge the server-forced fields without
    // hand-listing every default (D-3).
    const createInput = GastronomyAdminCreateInputSchema.parse({
        ...data,
        ownerId: actor.id,
        visibility: VisibilityEnum.PRIVATE,
        lifecycleState: LifecycleStatusEnum.DRAFT
    });

    // `createForOwner`, not `create`: the role grant and the insert share one
    // transaction (HOS-687 / HOS-589 §6.1).
    const result = await gastronomyService.createForOwner(actor, createInput);

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return result.data;
}

/**
 * POST /api/v1/protected/gastronomies/
 *
 * Creates a gastronomy listing owned by the caller. Starts `visibility:
 * PRIVATE`, `lifecycleState: DRAFT` (D-3) — see module docstring.
 */
export const protectedCreateGastronomyListingRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    listingAccess: { vertical: VerticalEnum.GASTRONOMY, operation: 'CREATE' },
    summary: 'Create a gastronomy listing (owner self-service)',
    description:
        'Creates a gastronomy listing owned by the authenticated caller and grants them the GASTRONOMY_OWNER role in the same transaction. Starts hidden (PRIVATE/DRAFT) until the owner completes it. Requires an authenticated session and no gastronomy permission.',
    tags: ['Gastronomy'],
    // No `requiredPermissions` on purpose (HOS-687): this route is how an
    // account BECOMES a gastronomy owner, so demanding the owner's permission
    // to reach it made the role unreachable. Authentication is still enforced
    // by the factory — see the module docstring.
    requestBody: GastronomyOwnerCreateInputSchema,
    responseSchema: GastronomyProtectedSchema,
    successStatusCode: 201,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => handleCreateGastronomyListing(ctx, body)
});
