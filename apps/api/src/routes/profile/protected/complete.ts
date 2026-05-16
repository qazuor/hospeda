/**
 * @route POST /api/v1/protected/profile/complete
 *
 * Profile completion endpoint (SPEC-113 T-113-02).
 *
 * Authenticated users submit this after their first sign-in to persist
 * baseline profile data (displayName, optional firstName, optional phone,
 * optional locale, optional newsletter opt-in) and flip the
 * `profile_completed` flag to TRUE.
 *
 * The response includes `requiresSetPassword` so the web frontend knows
 * whether to next-route the user to `/mi-cuenta/agregar-contrasena/`.
 */

import type { z } from '@hono/zod-openapi';
import {
    CompleteProfileBodySchema,
    CompleteProfileResponseSchema,
    NewsletterChannelEnum,
    NewsletterSourceEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';
import { getDefaultNewsletterService, getDefaultUserService } from './_singletons';

/** Stable consent-version identifier for profile-completion newsletter opt-ins. */
const CONSENT_VERSION = 'spec-113-v1';

/**
 * Minimal slice of UserService used by the complete-profile handler.
 * Allows unit tests to stub the service without standing up the full stack.
 */
export interface CompleteProfileUserService {
    completeProfile: (
        actor: ReturnType<typeof getActorFromContext>,
        input: {
            userId: string;
            firstName: string;
            lastName: string;
            displayName?: string;
            birthDate?: string;
            imageUrl?: string;
            phone?: string;
            locale?: 'es' | 'en' | 'pt';
            newsletterOptIn?: boolean;
            bio?: string;
            website?: string;
            occupation?: string;
            socialNetworks?: {
                facebook?: string;
                instagram?: string;
                twitter?: string;
                linkedIn?: string;
                tiktok?: string;
                youtube?: string;
            };
            location?: { country: string; region?: string; city?: string };
            acceptedTerms: true;
        }
    ) => Promise<{
        data?: { profileCompleted: true; requiresSetPassword: boolean } | null;
        error?: { code: ServiceErrorCode; message: string } | null;
    }>;
}

/**
 * Minimal slice of NewsletterSubscriberService used by the handler.
 */
export interface CompleteProfileNewsletterService {
    subscribe: (
        actor: ReturnType<typeof getActorFromContext>,
        input: {
            userId: string;
            email: string;
            channel?: NewsletterChannelEnum;
            locale?: 'es' | 'en' | 'pt';
            source?: NewsletterSourceEnum;
            consentIp?: string;
            consentUa?: string;
            consentVersion?: string;
        }
    ) => Promise<{
        data: { status: string } | null;
        error: { code: ServiceErrorCode; message: string } | null;
    }>;
}

/** Dependency injection bag for the pure handler. */
export interface CompleteProfileDeps {
    userService?: CompleteProfileUserService;
    newsletterService?: CompleteProfileNewsletterService;
}

/** Body shape (post-Zod-parsed) consumed by the handler. */
export type CompleteProfileBody = z.infer<typeof CompleteProfileBodySchema>;

/**
 * Pure handler for the complete-profile route.
 *
 * Extracted so that tests can pass typed stubs without booting the full
 * service-core stack.  The route wiring below delegates directly to this.
 *
 * @param ctx - Hono request context (used for actor + request fingerprint).
 * @param body - Validated request body.
 * @param deps - Optional service dependency overrides (for testing).
 * @returns `{ profileCompleted: true, requiresSetPassword: boolean }`.
 */
export const completeProfileHandler = async (
    ctx: Context,
    body: CompleteProfileBody,
    deps: CompleteProfileDeps = {}
): Promise<{ profileCompleted: true; requiresSetPassword: boolean }> => {
    const actor = getActorFromContext(ctx);

    // TYPE-WORKAROUND: UserService structurally satisfies CompleteProfileUserService.
    const userSvc =
        deps.userService ?? (getDefaultUserService() as unknown as CompleteProfileUserService);

    // 1. Persist profile fields and flip profileCompleted = true.
    const profileResult = await userSvc.completeProfile(actor, {
        userId: actor.id,
        firstName: body.firstName,
        lastName: body.lastName,
        displayName: body.displayName,
        birthDate: body.birthDate,
        imageUrl: body.imageUrl,
        phone: body.phone,
        locale: body.locale,
        newsletterOptIn: body.newsletterOptIn,
        bio: body.bio,
        website: body.website,
        occupation: body.occupation,
        socialNetworks: body.socialNetworks,
        location: body.location,
        acceptedTerms: body.acceptedTerms
    });

    if (profileResult.error) {
        throw new ServiceError(profileResult.error.code, profileResult.error.message);
    }
    if (!profileResult.data) {
        throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'completeProfile returned no data');
    }

    // 2. Newsletter opt-in — delegate to NewsletterSubscriberService when requested.
    if (body.newsletterOptIn === true) {
        try {
            // TYPE-WORKAROUND: NewsletterSubscriberService satisfies the narrow interface.
            const newsletterSvc =
                deps.newsletterService ??
                (getDefaultNewsletterService() as unknown as CompleteProfileNewsletterService);

            // We need the user's email from actor (resolved by Better Auth + actorMiddleware).
            // The actor object exposes `email` via the session user.
            // If email is missing we skip newsletter without failing the whole flow.
            const userEmail = (actor as Record<string, unknown>).email as string | undefined;
            if (userEmail) {
                const consentIp =
                    ctx.req.header('cf-connecting-ip') ??
                    ctx.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
                    undefined;
                const consentUa = ctx.req.header('user-agent') ?? undefined;

                await newsletterSvc.subscribe(actor, {
                    userId: actor.id,
                    email: userEmail,
                    channel: NewsletterChannelEnum.EMAIL,
                    locale: body.locale,
                    source: NewsletterSourceEnum.ACCOUNT_PREFERENCES,
                    consentIp,
                    consentUa,
                    consentVersion: CONSENT_VERSION
                });
            }
        } catch {
            // Newsletter failure is non-blocking — profile completion still succeeds.
        }
    }

    return {
        profileCompleted: true as const,
        requiresSetPassword: profileResult.data.requiresSetPassword
    };
};

export const profileCompleteRoute = createProtectedRoute({
    method: 'post',
    path: '/complete',
    summary: 'Complete the post-signup profile',
    description:
        'Persists baseline profile data (displayName, optional phone, optional locale, optional newsletter opt-in) and flips profile_completed = true. Returns requiresSetPassword so the frontend can decide whether to route to the set-password step.',
    tags: ['Profile'],
    requestBody: CompleteProfileBodySchema,
    responseSchema: CompleteProfileResponseSchema,
    handler: async (ctx, _params, body) => completeProfileHandler(ctx, body as CompleteProfileBody),
    options: {
        customRateLimit: { requests: 10, windowMs: 60000 }
    }
});
