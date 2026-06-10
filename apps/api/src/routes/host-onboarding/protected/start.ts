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
 * A USER who creates or resumes onboarding is promoted to HOST during the
 * onboarding flow so they can access host surfaces immediately. The billing
 * trial still starts later, on the first DRAFT -> ACTIVE publish.
 */
import {
    AccommodationCreateDraftHttpSchema,
    AccommodationIdSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getQZPayBilling } from '../../../middlewares/billing';
import { enforceAccommodationLimit } from '../../../middlewares/limit-enforcement';
import { BillingCustomerSyncService } from '../../../services/billing-customer-sync';
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

        // SPEC-143 Block 1: ensure a billing_customer row exists for the newly
        // promoted host. This is idempotent — if the customer already exists
        // (e.g. resumed path), the call is a no-op. We call it AFTER the
        // transaction so we never block the host-promotion on a billing error.
        // Failures are logged but do NOT fail the request; the entitlement
        // middleware falls back to owner-basico defaults based on role alone
        // when no billing customer is found, so the UX is unaffected.
        //
        // `actor.email` is populated by actorMiddleware from `user.email`
        // (Better Auth session) for all authenticated users. If for any reason
        // it is absent, we skip the sync rather than crash.
        if (actor.email) {
            try {
                const billing = getQZPayBilling();
                const syncService = new BillingCustomerSyncService(billing ?? null, {
                    throwOnError: false
                });
                const customerId = await syncService.ensureCustomerExists({
                    userId: actor.id,
                    email: actor.email,
                    name: actor.name
                });
                if (customerId) {
                    apiLogger.info(
                        { userId: actor.id, customerId },
                        'host-onboarding/start: billing customer ensured'
                    );
                }
            } catch (billingError) {
                // Should never reach here (throwOnError: false), but guard anyway.
                const msg =
                    billingError instanceof Error ? billingError.message : String(billingError);
                apiLogger.warn(
                    { userId: actor.id, error: msg },
                    'host-onboarding/start: billing customer sync failed (non-fatal)'
                );
            }
        } else {
            apiLogger.warn(
                { userId: actor.id },
                'host-onboarding/start: actor has no email — skipping billing customer sync'
            );
        }

        return {
            status: data.status,
            accommodationId: data.accommodation.id,
            accommodationSlug: data.accommodation.slug
        };
    },
    options: {
        // Funnel exception: `/host-onboarding/start` is the public publish entry
        // point for authenticated tourists. A tourist-free user must be able to
        // create the onboarding draft; the 14-day owner trial starts later on the
        // first DRAFT -> ACTIVE publish, not here. Keep ONLY the limit guard so
        // existing hosts still cannot exceed max_accommodations via this shortcut.
        middlewares: [enforceAccommodationLimit()]
    }
});
