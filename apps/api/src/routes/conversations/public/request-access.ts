/**
 * POST /api/v1/public/conversations/request-access
 *
 * Allows an anonymous guest to request a new magic-link to their existing
 * verified conversation. Anti-enumeration: the response is IDENTICAL whether
 * or not the email matches an existing conversation.
 *
 * Rate limits:
 * - IP:    10 requests / 10 minutes
 * - Email: 3 requests / hour (keyed by the normalized guest email)
 */
import { ConversationService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { createConversationMailer } from '../../../lib/conversation-mailer';
import {
    createKeyedRateLimitMiddleware,
    createPerRouteRateLimitMiddleware
} from '../../../middlewares/rate-limit';
import { createRouter } from '../../../utils/create-app';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { createResponse } from '../../../utils/response-helpers';

/** Request body schema for the request-access endpoint. */
const RequestAccessSchema = z
    .object({
        /** Email address of the anonymous guest. */
        email: z.string().email().max(255)
    })
    .strict();

/**
 * Response schema for the request-access endpoint.
 * Anti-enumeration: every code path returns this identical shape.
 *
 * SPEC-210 PR5 — required by the fail-closed stripWithSchema backstop.
 */
const RequestAccessResponseSchema = z.object({
    status: z.literal('sent_if_exists')
});

/** IP rate limiter: 10 requests per 10 minutes. */
const ipRateLimiter = createPerRouteRateLimitMiddleware({
    requests: 10,
    windowMs: 10 * 60 * 1000
});

/**
 * Email-keyed rate limiter: 3 requests per hour per normalized email address.
 * Extractor reads the validated body stored in context.
 */
const emailRateLimiter = createKeyedRateLimitMiddleware({
    requests: 3,
    windowMs: 60 * 60 * 1000,
    keyPrefix: 'conv:request-access:email',
    keyExtractor: (c: Context) => {
        const body = c.get('_validatedBody' as never) as { email?: string } | undefined;
        if (!body?.email) return null;
        const normalised = body.email.toLowerCase().trim();
        return normalised.length > 0 ? normalised : null;
    }
});

/**
 * Inline body validation middleware.
 * Parses and validates the JSON body against `RequestAccessSchema`.
 */
async function validateBody(c: Context, next: () => Promise<void>): Promise<Response | undefined> {
    let rawBody: unknown;
    try {
        rawBody = await c.req.json();
    } catch {
        return createResponse({ status: 'sent_if_exists' }, c, 200, RequestAccessResponseSchema);
    }

    const parseResult = RequestAccessSchema.safeParse(rawBody);
    if (!parseResult.success) {
        // Anti-enumeration: return the same 200 response on malformed input too
        return createResponse({ status: 'sent_if_exists' }, c, 200, RequestAccessResponseSchema);
    }

    // TYPE-WORKAROUND: storing the Zod-validated body on a non-standard ctx property to pass it to the handler without a ContextVariableMap entry; cast widens to a writable record.
    (c as unknown as Record<string, unknown>)._validatedBody = parseResult.data;
    await next();
    return undefined;
}

/**
 * Route handler for POST /api/v1/public/conversations/request-access.
 *
 * Delegates to `ConversationService.requestAccessByEmail` which internally
 * finds the verified conversation, generates a fresh access token, and dispatches
 * the magic-link email. The service never throws (anti-enumeration).
 * Whether found or not, the response body and HTTP status are IDENTICAL.
 */
async function handler(c: Context): Promise<Response> {
    // TYPE-WORKAROUND: reading the upstream-stored validated body off the ctx; cast aligns the non-standard property with the schema's parsed output shape.
    const body = (c as unknown as Record<string, unknown>)._validatedBody as
        | { email?: string }
        | undefined;

    // Anti-enumeration: if body extraction failed somehow, return sentinel
    if (!body?.email) {
        return createResponse({ status: 'sent_if_exists' }, c, 200, RequestAccessResponseSchema);
    }

    const normalizedEmail = body.email.toLowerCase().trim();

    const conversationSvc = new ConversationService(
        { logger: apiLogger },
        {
            authSecret: env.HOSPEDA_BETTER_AUTH_SECRET,
            siteUrl: env.HOSPEDA_SITE_URL,
            mailer: createConversationMailer()
        }
    );

    // requestAccessByEmail is anti-enumeration: never throws, silently handles all paths
    await conversationSvc.requestAccessByEmail(normalizedEmail);

    return createResponse({ status: 'sent_if_exists' }, c, 200, RequestAccessResponseSchema);
}

/** Public request-access router. */
export const requestAccessPublicConversationRoute = createRouter()
    .use('*', ipRateLimiter)
    .post('/', validateBody, emailRateLimiter, handler);
