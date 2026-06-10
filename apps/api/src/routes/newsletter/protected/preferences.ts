/**
 * @route PATCH /api/v1/protected/newsletter/preferences
 *
 * Updates the authenticated subscriber's per-content opt-in flags. Owner-only.
 * Accepts a partial map (`offers` / `events` / `guides` / `productNews` →
 * boolean) and merges it onto the stored `newsletter_subscribers.preferences`
 * JSONB via PostgreSQL `||`, so keys the client doesn't send retain their
 * stored value.
 *
 * Service-layer behavior:
 *   - Throws `NEWSLETTER_SUBSCRIBER_NOT_FOUND` when the user has no active
 *     subscription row (call POST /subscribe first).
 *   - Throws `NEWSLETTER_SUBSCRIBER_BLOCKED` on bounced / complained rows
 *     (terminal-state policy — the UI surfaces a "contact support" banner).
 */

import { z } from '@hono/zod-openapi';
import {
    NewsletterContentPreferencesSchema,
    type ServiceErrorCode,
    UpdateNewsletterPreferencesInputSchema
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';
import { getDefaultNewsletterService } from './_singletons';

/** Response payload: full merged preferences after the partial was applied. */
const PreferencesResponseSchema = z.object({
    preferences: NewsletterContentPreferencesSchema
});

/** Request body shape (post-Zod-parsed) consumed by the handler. */
export type PreferencesBody = z.infer<typeof UpdateNewsletterPreferencesInputSchema>;

/**
 * Minimal slice of `NewsletterSubscriberService` consumed by the handler.
 * Allows unit tests to stub the service without standing up service-core.
 */
export interface PreferencesNewsletterService {
    updatePreferences: (
        actor: ReturnType<typeof getActorFromContext>,
        input: {
            userId: string;
            preferences: Record<string, boolean>;
        }
    ) => Promise<{
        data: { preferences: Record<string, boolean> } | null;
        error: { code: ServiceErrorCode; message: string } | null;
    }>;
}

/**
 * Pure preferences handler — extractable so unit tests can pass typed stubs.
 */
export const preferencesHandler = async (
    ctx: Context,
    body: PreferencesBody,
    deps: { newsletterService?: PreferencesNewsletterService } = {}
): Promise<{ preferences: Record<string, boolean> }> => {
    const actor = getActorFromContext(ctx);
    const svc =
        deps.newsletterService ??
        // TYPE-WORKAROUND: route declares a narrow PreferencesNewsletterService interface (only updatePreferences) for the testability seam; the singleton returns the full concrete class which structurally satisfies the narrow shape.
        (getDefaultNewsletterService() as unknown as PreferencesNewsletterService);

    const result = await svc.updatePreferences(actor, {
        userId: actor.id,
        preferences: body
    });
    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }
    if (!result.data) {
        throw new ServiceError(
            'INTERNAL_ERROR' as ServiceErrorCode,
            'updatePreferences returned no data'
        );
    }
    return { preferences: result.data.preferences };
};

export const newsletterPreferencesRoute = createProtectedRoute({
    method: 'patch',
    path: '/newsletter/preferences',
    summary: 'Update the authenticated subscriber per-content opt-in flags',
    description:
        'Accepts a partial map of NewsletterContentTypeEnum → boolean. Merges it onto the stored preferences JSONB and returns the resulting full preferences object.',
    tags: ['Newsletter'],
    requestBody: UpdateNewsletterPreferencesInputSchema,
    responseSchema: PreferencesResponseSchema,
    handler: async (ctx, _params, body) => preferencesHandler(ctx, body as PreferencesBody),
    options: {
        customRateLimit: { requests: 10, windowMs: 60000 }
    }
});
