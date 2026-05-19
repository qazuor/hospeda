/**
 * Newsletter subscription toggle endpoint.
 * Toggles the user's newsletter email preference at `settings.newsletter`.
 *
 * @route POST /api/v1/protected/users/me/newsletter/toggle
 *
 * @deprecated Slated for removal once SPEC-101 ships the `newsletter_subscribers`
 * table and the new `/protected/newsletter/subscribe` + `/unsubscribe` endpoints.
 * Until then, the field still backs the legacy footer toggle and is the source
 * for the SPEC-101 one-time seed migration (T-101-03). Do not write new callers
 * against this route.
 */
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const userService = new UserService({ logger: apiLogger });

/** Response schema for newsletter toggle */
const NewsletterToggleResponseSchema = z.object({
    subscribed: z.boolean()
});

/**
 * Minimal slice of UserService used by the toggle handler. Exposed so the
 * regression test can pass a fully-typed stub without standing up the full
 * service-core stack.
 */
export interface NewsletterToggleUserService {
    getById: (
        actor: ReturnType<typeof getActorFromContext>,
        id: string
    ) => Promise<{
        data: { id: string; settings?: Record<string, unknown> } | null;
        error: { code: ServiceErrorCode; message: string } | null;
    }>;
    update: (
        actor: ReturnType<typeof getActorFromContext>,
        id: string,
        patch: { settings: Record<string, unknown> }
    ) => Promise<{
        data: unknown;
        error: { code: ServiceErrorCode; message: string } | null;
    }>;
}

/**
 * Pure handler for the newsletter toggle route. Extracted so it can be
 * unit-tested against a stub UserService without booting the full app.
 *
 * @param ctx - Hono context (used only to resolve the authenticated actor).
 * @param svc - UserService stub or instance.
 * @returns `{ subscribed: <new state> }` reflecting the toggled value.
 */
export const newsletterToggleHandler = async (
    ctx: Context,
    // TYPE-WORKAROUND: handler declares a narrow NewsletterToggleUserService interface (only getById + update) for the testability seam; UserService structurally satisfies the narrow shape.
    svc: NewsletterToggleUserService = userService as unknown as NewsletterToggleUserService
): Promise<{ subscribed: boolean }> => {
    const actor = getActorFromContext(ctx);

    const getResult = await svc.getById(actor, actor.id);

    if (getResult.error) {
        throw new ServiceError(getResult.error.code, getResult.error.message);
    }

    const user = getResult.data;
    if (!user) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found');
    }

    const currentSettings = user.settings ?? {
        notifications: { enabled: true, allowEmails: false, allowSms: false, allowPush: false },
        newsletter: false
    };
    const currentNewsletter = (currentSettings.newsletter as boolean | undefined) ?? false;
    const nextNewsletter = !currentNewsletter;

    const updateResult = await svc.update(actor, actor.id, {
        settings: {
            ...currentSettings,
            newsletter: nextNewsletter
        }
    });

    if (updateResult.error) {
        throw new ServiceError(updateResult.error.code, updateResult.error.message);
    }

    return { subscribed: nextNewsletter };
};

export const newsletterToggleRoute = createProtectedRoute({
    method: 'post',
    path: '/me/newsletter/toggle',
    summary: 'Toggle newsletter subscription',
    description:
        'Toggles the authenticated user newsletter email preference at user.settings.newsletter. Deprecated: superseded by /protected/newsletter/* endpoints in SPEC-101.',
    tags: ['Users'],
    responseSchema: NewsletterToggleResponseSchema,
    handler: (ctx: Context) => newsletterToggleHandler(ctx),
    options: {
        customRateLimit: { requests: 10, windowMs: 60000 }
    }
});
