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
 * ## Permission — an authenticated session, and nothing else (HOS-687)
 *
 * These two routes declare NO `requiredPermissions`. Authentication is still
 * enforced, by `createProtectedRoute`'s own factory middleware: an anonymous
 * caller is refused with 401 before this module's handler is ever entered, and
 * that must stay a factory concern rather than an in-handler check
 * (HOS-589 AC-8).
 *
 * Until HOS-687 the same door was bolted three times — `requiredPermissions:
 * [COMMERCE_CREATE]` here, `checkCanCreateCommerce` in the service's
 * `_canCreate`, and `hasCommerceNavAccess` on the web create page. All three
 * turned away the signed-in person holding no commerce role, which is exactly
 * everyone this flow exists for: nobody could reach the create call that would
 * have granted them the role. The three were opened together, because opening
 * two of three leaves the flow just as broken while looking fixed.
 *
 * The ADMIN create routes (`gastronomy/admin/create.ts` and its experience
 * twin) still carry `requiredPermissions: [COMMERCE_CREATE]`, so relaxing the
 * shared service predicate did not widen the admin path.
 *
 * ## The role grant
 *
 * Creating the listing IS what makes the caller a commerce owner:
 * `createForOwner` grants `COMMERCE_OWNER` inside the same transaction as the
 * insert (mirror of `AccommodationService.createForOnboarding`). It is
 * idempotent on `(user_id, role)` and additive, so a second listing changes
 * nothing and an account that already holds `HOST` keeps it.
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
    ExperienceAdminCreateInputCheckedSchema,
    type ExperienceOwnerCreateInput,
    ExperienceOwnerCreateInputCheckedSchema,
    ExperienceProtectedSchema,
    GastronomyAdminCreateInputSchema,
    type GastronomyOwnerCreateInput,
    GastronomyOwnerCreateInputSchema,
    GastronomyProtectedSchema,
    LifecycleStatusEnum,
    ServiceErrorCode,
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

    // `createForOwner`, not `create`: the role grant and the insert share one
    // transaction (HOS-687 / HOS-589 §6.1).
    const result = await gastronomyService.createForOwner(actor, createInput);

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
        'Creates a gastronomy listing owned by the authenticated caller and grants them the COMMERCE_OWNER role in the same transaction. Starts hidden (PRIVATE/DRAFT) until the owner completes and pays for it. Requires an authenticated session and no commerce permission.',
    tags: ['Commerce'],
    // No `requiredPermissions` on purpose (HOS-687): this route is how an
    // account BECOMES a commerce owner, so demanding the owner's permission to
    // reach it made the role unreachable. Authentication is still enforced by
    // the factory — see the module docstring.
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
    //
    // `safeParse`, not `.parse()` (H-156): the CHECKED schema carries the
    // cross-field pricing rule, and the route factory does NOT enforce
    // refinements at the requestBody boundary — verified against a running API,
    // where a listing with a price but no unit sailed past validation and blew
    // up here as an unmapped ZodError, i.e. a 500 for what is plainly a bad
    // request. Mapping it to a 422 keeps the field name reaching the caller.
    const parsed = ExperienceAdminCreateInputCheckedSchema.safeParse({
        ...data,
        ownerId: actor.id,
        visibility: VisibilityEnum.PRIVATE,
        lifecycleState: LifecycleStatusEnum.DRAFT
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
    const result = await experienceService.createForOwner(actor, createInput);

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
        'Creates an experience listing owned by the authenticated caller and grants them the COMMERCE_OWNER role in the same transaction. Starts hidden (PRIVATE/DRAFT) until the owner completes and pays for it. Requires an authenticated session and no commerce permission.',
    tags: ['Commerce'],
    // No `requiredPermissions` on purpose (HOS-687) — see the gastronomy route
    // above and the module docstring.
    // H-156: the CHECKED variant carries the cross-field pricing rule
    // (priceUnit required unless the price is on request).
    requestBody: ExperienceOwnerCreateInputCheckedSchema,
    responseSchema: ExperienceProtectedSchema,
    successStatusCode: 201,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => handleCreateExperienceListing(ctx, body)
});
