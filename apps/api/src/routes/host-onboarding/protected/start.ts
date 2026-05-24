/**
 * Protected host-onboarding start endpoint.
 *
 * Specialized entry point for the public web "publicar" flow. Unlike the
 * generic `/api/v1/protected/accommodations/draft` endpoint, this one is
 * callable by any authenticated USER because it does NOT require the
 * `ACCOMMODATION_CREATE` permission. It encodes three terminal states the
 * caller can hit:
 *
 *  - `created`     - a fresh DRAFT was inserted and the user can resume on
 *                    the admin panel to fill in the rest.
 *  - `resumed`     - the user already had an active DRAFT; reuse that one.
 *  - `already_host` - the user is already HOST/ADMIN/CLIENT_MANAGER/SUPER_ADMIN;
 *                    no draft is created. The caller is expected to redirect
 *                    straight to the admin panel.
 *
 * The HOST role is NOT assigned here. Promotion happens later, atomically,
 * when the draft transitions to ACTIVE through the publish flow.
 */
import {
    AccommodationCreateDraftHttpSchema,
    AccommodationIdSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { enforceAccommodationLimit } from '../../../middlewares/limit-enforcement';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Response shape for `/host-onboarding/start`. A discriminated union by
 * `status` would be more precise but the route factory expects a single
 * Zod object schema; we represent the variants with nullable id fields.
 */
const HostOnboardingStartResponseSchema = z.object({
    status: z.enum(['created', 'resumed', 'already_host']),
    accommodationId: AccommodationIdSchema.nullable(),
    accommodationSlug: z.string().nullable()
});

/**
 * POST /api/v1/protected/host-onboarding/start
 */
export const protectedHostOnboardingStartRoute = createProtectedRoute({
    method: 'post',
    path: '/start',
    summary: 'Start host onboarding',
    description:
        'Creates or resumes a host onboarding draft for the authenticated user. Skips creation entirely when the user already holds a privileged role. No special permissions required.',
    tags: ['Host Onboarding'],
    requestBody: AccommodationCreateDraftHttpSchema,
    responseSchema: HostOnboardingStartResponseSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await accommodationService.createForOnboarding(
            actor,
            body as Parameters<AccommodationService['createForOnboarding']>[1]
        );

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const data = result.data;
        if (!data) {
            // runWithLoggingAndValidation always populates data when error is
            // absent; this branch is unreachable but satisfies the type narrower.
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'createForOnboarding returned no data and no error'
            );
        }
        if (data.status === 'already_host') {
            return {
                status: 'already_host' as const,
                accommodationId: null,
                accommodationSlug: null
            };
        }
        return {
            status: data.status,
            accommodationId: data.accommodation.id,
            accommodationSlug: data.accommodation.slug
        };
    },
    options: {
        // SPEC-143 Finding #8: previously this route bypassed `enforceAccommodationLimit`,
        // letting a user with MAX_ACCOMMODATIONS at cap create one extra DRAFT via the
        // publicar/onboarding entry point. The service-layer short-circuits
        // (`already_host`, `resumed`) are now preceded by the middleware: callers at
        // limit get 403 LIMIT_REACHED before the create attempt. Privileged users
        // (HOST/ADMIN/etc) at limit also receive 403 here — this is acceptable: they
        // would have received `already_host` from the service anyway, indicating they
        // should go to the admin panel; the 403 conveys the same "you cannot create
        // more accommodations from this entry point" semantic with the right HTTP
        // code for limit-reached.
        middlewares: [enforceAccommodationLimit()]
    }
});
