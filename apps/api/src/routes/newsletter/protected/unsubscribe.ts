/**
 * @route DELETE /api/v1/protected/newsletter/unsubscribe
 *
 * Authenticated unsubscribe endpoint (SPEC-101 T-101-21). Distinct from the
 * PUBLIC unsubscribe endpoint (T-101-23) that takes a stable HMAC token —
 * this one trusts the session and unsubscribes the current user directly.
 *
 * Returns a status discriminator so the client can tell whether anything
 * actually changed (`unsubscribed`) or there was no active row in the first
 * place (`not_subscribed`).
 */

import { z } from '@hono/zod-openapi';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';
import { getDefaultNewsletterService } from './_singletons';

const UnsubscribeResponseSchema = z.object({
    status: z.enum(['unsubscribed', 'not_subscribed'])
});

/** Minimal slice of NewsletterSubscriberService consumed by the handler. */
export interface UnsubscribeNewsletterService {
    unsubscribeAuthenticated: (
        actor: ReturnType<typeof getActorFromContext>,
        userId: string
    ) => Promise<{
        data: { status: 'unsubscribed' | 'not_subscribed' } | null;
        error: { code: ServiceErrorCode; message: string } | null;
    }>;
}

/**
 * Pure unsubscribe handler — extractable so unit tests can stub the service.
 */
export const unsubscribeHandler = async (
    ctx: Context,
    deps: { newsletterService?: UnsubscribeNewsletterService } = {}
): Promise<{ status: 'unsubscribed' | 'not_subscribed' }> => {
    const actor = getActorFromContext(ctx);
    const svc =
        deps.newsletterService ??
        // TYPE-WORKAROUND: route declares a narrow UnsubscribeNewsletterService interface for the testability seam; the singleton returns the full concrete class which structurally satisfies the narrow shape.
        (getDefaultNewsletterService() as unknown as UnsubscribeNewsletterService);

    const result = await svc.unsubscribeAuthenticated(actor, actor.id);
    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }
    if (!result.data) {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Newsletter unsubscribe returned no data'
        );
    }
    return { status: result.data.status };
};

export const newsletterUnsubscribeRoute = createProtectedRoute({
    method: 'delete',
    path: '/newsletter/unsubscribe',
    summary: 'Unsubscribe the authenticated user from the newsletter',
    description:
        'Flips the subscriber row to status=unsubscribed and stamps unsubscribedAt. Returns { status: "unsubscribed" } when a row changed, { status: "not_subscribed" } when there was nothing to do.',
    tags: ['Newsletter'],
    responseSchema: UnsubscribeResponseSchema,
    handler: async (ctx) => unsubscribeHandler(ctx),
    options: {
        customRateLimit: { requests: 5, windowMs: 60000 }
    }
});
