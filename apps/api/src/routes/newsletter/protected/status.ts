/**
 * @route GET /api/v1/protected/newsletter/status
 *
 * Returns the current newsletter subscription snapshot for the authenticated
 * user (SPEC-101 T-101-20). Used by the footer island to render the
 * "subscribed" / "pending" / "not subscribed" state, and by the account
 * preferences page.
 */

import { z } from '@hono/zod-openapi';
import {
    NewsletterContentPreferencesSchema,
    NewsletterSubscriberStatusEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import type { NewsletterContentPreferences } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';
import { getDefaultNewsletterService } from './_singletons';

const StatusResponseSchema = z.object({
    subscribed: z.boolean(),
    status: z.nativeEnum(NewsletterSubscriberStatusEnum).nullable(),
    subscribedAt: z.string().nullable(),
    verifiedAt: z.string().nullable(),
    /**
     * Per-content-type opt-in flags. `null` when no subscriber row exists for
     * the user yet — clients default to the canonical all-true preset (see
     * DEFAULT_NEWSLETTER_PREFERENCES in @repo/schemas) on null.
     */
    preferences: NewsletterContentPreferencesSchema.nullable()
});

/**
 * Minimal slice of `NewsletterSubscriberService` consumed by the status
 * handler. Allows unit tests to stub the service.
 */
export interface StatusNewsletterService {
    getStatus: (
        actor: ReturnType<typeof getActorFromContext>,
        userId: string
    ) => Promise<{
        data: {
            subscribed: boolean;
            status: NewsletterSubscriberStatusEnum | null;
            subscribedAt: Date | null;
            verifiedAt: Date | null;
            preferences: NewsletterContentPreferences | null;
        } | null;
        error: { code: ServiceErrorCode; message: string } | null;
    }>;
}

/**
 * Pure status handler — extractable so unit tests can stub the service.
 */
export const statusHandler = async (
    ctx: Context,
    deps: { newsletterService?: StatusNewsletterService } = {}
): Promise<{
    subscribed: boolean;
    status: NewsletterSubscriberStatusEnum | null;
    subscribedAt: string | null;
    verifiedAt: string | null;
    preferences: NewsletterContentPreferences | null;
}> => {
    const actor = getActorFromContext(ctx);
    const newsletterSvc =
        deps.newsletterService ??
        // TYPE-WORKAROUND: route declares a narrow StatusNewsletterService interface (only getStatus) for the testability seam; the singleton returns the full concrete class which structurally satisfies the narrow shape.
        (getDefaultNewsletterService() as unknown as StatusNewsletterService);

    const result = await newsletterSvc.getStatus(actor, actor.id);
    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }
    const data = result.data;
    if (!data) {
        // getStatus always returns data in the happy path — defensive fallback.
        return {
            subscribed: false,
            status: null,
            subscribedAt: null,
            verifiedAt: null,
            preferences: null
        };
    }
    return {
        subscribed: data.subscribed,
        status: data.status,
        subscribedAt: data.subscribedAt?.toISOString() ?? null,
        verifiedAt: data.verifiedAt?.toISOString() ?? null,
        preferences: data.preferences
    };
};

export const newsletterStatusRoute = createProtectedRoute({
    method: 'get',
    path: '/newsletter/status',
    summary: 'Get the authenticated user newsletter subscription status',
    description:
        'Returns subscribed flag, lifecycle status (pending_verification / active / unsubscribed / bounced / complained), and ISO timestamps for subscribedAt and verifiedAt.',
    tags: ['Newsletter'],
    responseSchema: StatusResponseSchema,
    handler: async (ctx) => statusHandler(ctx),
    options: {
        customRateLimit: { requests: 30, windowMs: 60000 }
    }
});
