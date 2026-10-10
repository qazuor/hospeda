/**
 * Owner self-service experience listing create endpoint (HOS-166 §7.2).
 *
 *   POST /api/v1/protected/experiences/
 *
 * Mirrors the accommodation owner create (`POST /protected/accommodations/`)
 * and the admin create at `experience/admin/create.ts`. The experience
 * owner-create payload has its own required shape (`openingHours`/
 * `priceRange`), so this vertical has its own route; the gastronomy one lives
 * in `gastronomy/protected/create.ts`.
 *
 * ## D-3 — server-forced fields
 *
 * `ExperienceOwnerCreateInputCheckedSchema` already OMITS `ownerId`, `slug`,
 * `lifecycleState`, `visibility`, `isFeatured`, `moderationState` — this
 * handler is the only place those values come from:
 * - `ownerId` — always `actor.id`.
 * - `slug` — never set here; `BaseListingService._beforeCreate` derives it
 *   server-side from `name` (HOS-166 OQ-3).
 * - `visibility: PRIVATE`, `lifecycleState: DRAFT` — every owner-created
 *   listing starts hidden.
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
    ExperienceAdminCreateInputCheckedSchema,
    type ExperienceOwnerCreateInput,
    ExperienceOwnerCreateInputCheckedSchema,
    ExperienceProtectedSchema,
    LifecycleStatusEnum,
    ServiceErrorCode,
    VerticalEnum,
    VisibilityEnum
} from '@repo/schemas';
import { ExperienceService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';

import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * Handler for the experience owner-create endpoint. Exported standalone so it
 * is unit-testable against a mocked `Context` + spied service.
 */
export async function handleCreateExperienceListing(ctx: Context, body: Record<string, unknown>) {
    const actor = getActorFromContext(ctx);
    const data = body as ExperienceOwnerCreateInput;

    // Re-parse through the full admin create schema so moderationState/reviewsCount/averageRating get
    // their schema defaults.
    //
    // `safeParse`, not `.parse()` (H-156): the CHECKED schema carries the
    // cross-field pricing rule. The route's own
    // `ExperienceOwnerCreateInputCheckedSchema` already refuses a bad body with
    // a 400 before this line runs (HOS-425); `safeParse` stays because this
    // call re-checks a body that has had `ownerId`/`visibility`/
    // `lifecycleState` stamped onto it since validation, and an unmapped
    // ZodError would surface as a 500 for what is plainly a bad request.
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

    // `createForOwner`, not `create`: the role grant and the insert share one
    // transaction (HOS-687 / HOS-589 §6.1).
    const result = await experienceService.createForOwner(actor, parsed.data);

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return result.data;
}

/**
 * POST /api/v1/protected/experiences/
 *
 * Creates an experience listing owned by the caller. Starts `visibility:
 * PRIVATE`, `lifecycleState: DRAFT` (D-3) — see module docstring.
 */
export const protectedCreateExperienceListingRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    listingAccess: { vertical: VerticalEnum.EXPERIENCE, operation: 'CREATE' },
    summary: 'Create an experience listing (owner self-service)',
    description:
        'Creates an experience listing owned by the authenticated caller and grants them the EXPERIENCE_OWNER role in the same transaction. Starts hidden (PRIVATE/DRAFT) until the owner completes it. Requires an authenticated session and no experience permission.',
    tags: ['Experience'],
    // No `requiredPermissions` on purpose (HOS-687) — see the module docstring.
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
