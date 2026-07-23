/**
 * Owner self-service commerce listing create endpoints (HOS-166 §7.2).
 *
 * Two routes, one per vertical (mirrors the admin create routes at
 * `gastronomy/admin/create.ts` / `experience/admin/create.ts`), both mounted
 * under the NEW `apps/api/src/routes/commerce/protected/` tier:
 *
 *   POST /api/v1/protected/commerce/listings/gastronomy
 *   POST /api/v1/protected/commerce/listings/experience
 *
 * A single generic `:entityType`-dispatched route was considered and
 * rejected: gastronomy and experience owner-create payloads have genuinely
 * different required shapes (`priceFrom`/`priceUnit`/`isPriceOnRequest` vs
 * `openingHours`/`priceRange`), and OpenAPI + `createProtectedRoute` need ONE
 * concrete Zod schema per route — a `z.union(...)` would blur validation
 * errors and response typing for no real benefit over two small, explicit
 * routes.
 *
 * ## D-3 — server-forced fields
 *
 * The owner-create schemas (`GastronomyOwnerCreateInputSchema` /
 * `ExperienceOwnerCreateInputSchema`) already OMIT `ownerId`, `slug`,
 * `lifecycleState`, `visibility`, `isFeatured`, `moderationState` — this
 * handler is the only place those values come from:
 * - `ownerId` — always `actor.id`. An owner can only ever create a listing
 *   for themselves.
 * - `slug` — never set here; `BaseCommerceListingService._beforeCreate`
 *   derives it server-side from `name` (HOS-166 OQ-3).
 * - `visibility: PRIVATE`, `lifecycleState: DRAFT` — every owner-created
 *   listing starts hidden. Completing it and paying (the protected
 *   start-subscription route) is what makes it eligible to go public via the
 *   visibility reconciler (HOS-166 D-3, G-3).
 *
 * ## Permission
 *
 * Gated on `COMMERCE_CREATE` at BOTH the route (`requiredPermissions`, mirrors
 * the admin create route's defense-in-depth) AND the service
 * (`GastronomyService`/`ExperienceService`'s `_canCreate` →
 * `checkGastronomyCanCreate`/`checkExperienceCanCreate`). `COMMERCE_OWNER`
 * holds this permission as of the HOS-166 PR-A seed grant.
 *
 * ## D-4 compliance
 *
 * This module has never heard of `commerce_leads`. It takes plain listing
 * data from the request body — pre-filling that body from a lead is a
 * web-layer (PR-C) concern, not an API concern (spec §6.1 / §7.2).
 *
 * @module routes/commerce/protected/create
 */
import {
    ExperienceAdminCreateInputSchema,
    type ExperienceOwnerCreateInput,
    ExperienceOwnerCreateInputSchema,
    ExperienceProtectedSchema,
    GastronomyAdminCreateInputSchema,
    type GastronomyOwnerCreateInput,
    GastronomyOwnerCreateInputSchema,
    GastronomyProtectedSchema,
    LifecycleStatusEnum,
    PermissionEnum,
    VisibilityEnum
} from '@repo/schemas';
import { ExperienceService, GastronomyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });
const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * Handler for the gastronomy owner-create endpoint. Exported standalone
 * (mirrors `handleCommerceStartSubscription`) so it is unit-testable against
 * a mocked `Context` + spied service without booting the full Hono app.
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

    const result = await gastronomyService.create(actor, createInput);

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return result.data;
}

/**
 * POST /api/v1/protected/commerce/listings/gastronomy
 *
 * Creates a gastronomy listing owned by the caller. Starts `visibility:
 * PRIVATE`, `lifecycleState: DRAFT` (D-3) — see module docstring.
 */
export const protectedCreateGastronomyListingRoute = createProtectedRoute({
    method: 'post',
    path: '/listings/gastronomy',
    summary: 'Create a gastronomy listing (owner self-service)',
    description:
        'Creates a gastronomy listing owned by the authenticated caller. Starts hidden (PRIVATE/DRAFT) until the owner completes and pays for it. Requires COMMERCE_CREATE.',
    tags: ['Commerce'],
    requiredPermissions: [PermissionEnum.COMMERCE_CREATE],
    requestBody: GastronomyOwnerCreateInputSchema,
    responseSchema: GastronomyProtectedSchema,
    successStatusCode: 201,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => handleCreateGastronomyListing(ctx, body)
});

/**
 * Handler for the experience owner-create endpoint. Exported standalone —
 * see {@link handleCreateGastronomyListing}'s docstring for the rationale.
 */
export async function handleCreateExperienceListing(ctx: Context, body: Record<string, unknown>) {
    const actor = getActorFromContext(ctx);
    const data = body as ExperienceOwnerCreateInput;

    // Same rationale as the gastronomy handler above: re-parse through the
    // full admin create schema so isFeatured/moderationState/reviewsCount/
    // averageRating/hasActiveSubscription get their schema defaults.
    const createInput = ExperienceAdminCreateInputSchema.parse({
        ...data,
        ownerId: actor.id,
        visibility: VisibilityEnum.PRIVATE,
        lifecycleState: LifecycleStatusEnum.DRAFT
    });

    const result = await experienceService.create(actor, createInput);

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return result.data;
}

/**
 * POST /api/v1/protected/commerce/listings/experience
 *
 * Creates an experience listing owned by the caller. Starts `visibility:
 * PRIVATE`, `lifecycleState: DRAFT` (D-3) — see module docstring.
 */
export const protectedCreateExperienceListingRoute = createProtectedRoute({
    method: 'post',
    path: '/listings/experience',
    summary: 'Create an experience listing (owner self-service)',
    description:
        'Creates an experience listing owned by the authenticated caller. Starts hidden (PRIVATE/DRAFT) until the owner completes and pays for it. Requires COMMERCE_CREATE.',
    tags: ['Commerce'],
    requiredPermissions: [PermissionEnum.COMMERCE_CREATE],
    requestBody: ExperienceOwnerCreateInputSchema,
    responseSchema: ExperienceProtectedSchema,
    successStatusCode: 201,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => handleCreateExperienceListing(ctx, body)
});
