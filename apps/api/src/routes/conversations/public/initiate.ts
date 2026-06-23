/**
 * POST /api/v1/public/conversations/initiate
 *
 * Initiates a conversation from an anonymous guest.
 *
 * Rate limits:
 * - IP:    10 requests / 10 minutes
 * - Email: 5 requests / hour (keyed by the normalized guest email)
 */
import {
    CreateConversationAnonSchema,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
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
import {
    createErrorResponse,
    createResponse,
    handleRouteError
} from '../../../utils/response-helpers';

/** Minimal system actor for public endpoints that invoke services. */
const PUBLIC_SYSTEM_ACTOR = {
    id: '00000000-0000-0000-0000-000000000001',
    role: RoleEnum.ADMIN,
    permissions: [
        PermissionEnum.CONVERSATION_VIEW_OWN,
        PermissionEnum.CONVERSATION_VIEW_ANY,
        PermissionEnum.CONVERSATION_REPLY_OWN,
        PermissionEnum.CONVERSATION_REPLY_ANY
    ] as readonly PermissionEnum[],
    _isSystemActor: true
} as const;

/** Builds a `ConversationService` instance with API-level deps injected. */
function buildConversationService(): ConversationService {
    return new ConversationService(
        { logger: apiLogger },
        {
            authSecret: env.HOSPEDA_BETTER_AUTH_SECRET,
            siteUrl: env.HOSPEDA_SITE_URL,
            mailer: createConversationMailer()
        }
    );
}

/**
 * Response schema for the conversation initiation endpoint.
 * Declares the concrete shape returned on the 200 success path.
 * conversationId may be absent if the service omits it on the resent path.
 *
 * SPEC-210 PR5 — required by the fail-closed stripWithSchema backstop.
 */
const InitiateResponseSchema = z.object({
    status: z.enum(['pending_verification', 'resent']),
    conversationId: z.string().uuid().optional()
});

/** IP rate limiter: 10 requests per 10 minutes. */
const ipRateLimiter = createPerRouteRateLimitMiddleware({
    requests: 10,
    windowMs: 10 * 60 * 1000
});

/**
 * Email-keyed rate limiter: 5 requests per hour per normalized email address.
 *
 * The JSON body is parsed and validated BEFORE this middleware runs (via the
 * inline body-validation middleware), so the extractor can safely access
 * `c.get('_validatedBody')`.
 */
const emailRateLimiter = createKeyedRateLimitMiddleware({
    requests: 5,
    windowMs: 60 * 60 * 1000,
    keyPrefix: 'conv:initiate:email',
    keyExtractor: (c: Context) => {
        const body = c.get('_validatedBody' as never) as { guestEmail?: string } | undefined;
        if (!body?.guestEmail) return null;
        const normalised = body.guestEmail.toLowerCase().trim();
        return normalised.length > 0 ? normalised : null;
    }
});

/**
 * Inline body validation middleware.
 * Parses and validates the JSON body against `CreateConversationAnonSchema`.
 * Stores the validated body in context under `_validatedBody` for downstream use.
 */
async function validateBody(c: Context, next: () => Promise<void>): Promise<Response | undefined> {
    let rawBody: unknown;
    try {
        rawBody = await c.req.json();
    } catch {
        return createErrorResponse(
            { code: ServiceErrorCode.VALIDATION_ERROR, message: 'Invalid JSON body' },
            c,
            400
        );
    }

    const parseResult = CreateConversationAnonSchema.safeParse(rawBody);
    if (!parseResult.success) {
        return createErrorResponse(
            {
                code: ServiceErrorCode.VALIDATION_ERROR,
                message: 'Invalid request body',
                details: parseResult.error.issues.map((issue) => ({
                    field: issue.path.join('.'),
                    message: issue.message
                }))
            },
            c,
            400
        );
    }

    // TYPE-WORKAROUND: storing the Zod-validated body on a non-standard ctx property to pass it to the handler without a ContextVariableMap entry; cast widens to a writable record.
    (c as unknown as Record<string, unknown>)._validatedBody = parseResult.data;
    await next();
    return undefined;
}

/**
 * Route handler for POST /api/v1/public/conversations/initiate.
 *
 * Calls `ConversationService.initiateAnonymous` and maps the result to the
 * appropriate HTTP response:
 * - `pending_verification` or `resent` → 200 with status + conversationId
 * - ALREADY_EXISTS (verified duplicate) → 409 with reason CONVERSATION_DUPLICATE
 * - NOT_FOUND (accommodation deleted) → 404 with reason ACCOMMODATION_DELETED
 */
async function handler(c: Context): Promise<Response> {
    try {
        // TYPE-WORKAROUND: reading the upstream-stored validated body off the ctx; cast aligns the non-standard property with InitiateConversationSchema's parsed output shape.
        const body = (c as unknown as Record<string, unknown>)._validatedBody as {
            accommodationId: string;
            guestName: string;
            guestEmail: string;
            guestPhone?: string;
            message: string;
            locale?: string;
        };

        const conversationSvc = buildConversationService();

        const result = await conversationSvc.initiateAnonymous(PUBLIC_SYSTEM_ACTOR, {
            accommodationId: body.accommodationId,
            guestName: body.guestName,
            guestEmail: body.guestEmail,
            guestPhone: body.guestPhone,
            message: body.message,
            locale: body.locale
        });

        if (result.error) {
            if (result.error.code === ServiceErrorCode.ALREADY_EXISTS) {
                return createErrorResponse(
                    {
                        code: 'CONFLICT',
                        message: result.error.message,
                        reason: result.error.reason ?? 'CONVERSATION_DUPLICATE'
                    },
                    c,
                    409
                );
            }
            if (result.error.code === ServiceErrorCode.NOT_FOUND) {
                return createErrorResponse(
                    {
                        code: result.error.code,
                        message: result.error.message,
                        reason: result.error.reason
                    },
                    c,
                    404
                );
            }
            return createErrorResponse(
                {
                    code: result.error.code,
                    message: result.error.message,
                    reason: result.error.reason
                },
                c,
                400
            );
        }

        return createResponse(
            {
                status: result.data.status,
                conversationId: result.data.conversationId
            },
            c,
            200,
            InitiateResponseSchema
        );
    } catch (error) {
        return handleRouteError(error, c);
    }
}

/** Public conversation initiation router. */
export const initiatePublicConversationRoute = createRouter()
    .use('*', ipRateLimiter)
    .post('/', validateBody, emailRateLimiter, handler);
