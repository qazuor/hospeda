import {
    PartnerApplicationSubmitResponseSchema,
    PartnerApplicationSubmitSchema
} from '@repo/schemas';
import type { Context } from 'hono';
import { submitPartnerApplication } from '../../../services/partner-application/partner-application-submission.service';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';
import { getTurnstileSecret, verifyCfTurnstileToken } from '../../../utils/turnstile';
import { partnerApplicationPersonStateStep } from './person-state-step.middleware';

/** Public PP1 endpoint for submitting a Partner application. */
export const publicSubmitPartnerApplicationRoute = createPublicRoute({
    method: 'post',
    path: '/',
    summary: 'Submit a Partner application',
    description: 'Accepts a public Partner application after Turnstile verification.',
    tags: ['Partner applications'],
    successStatusCode: 201,
    requestBody: PartnerApplicationSubmitSchema,
    responseSchema: PartnerApplicationSubmitResponseSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const parsed = PartnerApplicationSubmitSchema.parse(body);
        if (parsed._hp) {
            apiLogger.debug(
                { path: ctx.req.path },
                '[partner-application] Honeypot triggered — discarding submission'
            );
            return { submitted: true };
        }

        const secret = getTurnstileSecret();
        if (!secret) {
            return ctx.json(
                {
                    success: false,
                    error: { code: 'FORBIDDEN', message: 'Security verification is not configured' }
                },
                403
            );
        }
        if (!parsed.cfTurnstileToken) {
            return ctx.json(
                {
                    success: false,
                    error: { code: 'FORBIDDEN', message: 'Security verification token is required' }
                },
                403
            );
        }
        try {
            const result = await verifyCfTurnstileToken({
                token: parsed.cfTurnstileToken,
                secret,
                ip:
                    ctx.req.header('cf-connecting-ip') ??
                    ctx.req.header('x-forwarded-for')?.split(',')[0]?.trim()
            });
            if (!result.success) {
                return ctx.json(
                    {
                        success: false,
                        error: { code: 'FORBIDDEN', message: 'Security verification failed' }
                    },
                    403
                );
            }
        } catch (error) {
            apiLogger.error(
                { error: error instanceof Error ? error.message : String(error) },
                'Turnstile verification failed'
            );
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'SERVICE_UNAVAILABLE',
                        message: 'Security verification is unavailable'
                    }
                },
                503
            );
        }
        return submitPartnerApplication({ email: parsed.email });
    },
    options: {
        customRateLimit: { requests: 5, windowMs: 60_000 },
        middlewares: [partnerApplicationPersonStateStep()]
    }
});
