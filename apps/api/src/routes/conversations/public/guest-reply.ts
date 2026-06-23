/**
 * POST /api/v1/public/conversations/guest/:token/messages
 *
 * Creates a new message in a conversation on behalf of an anonymous guest.
 * All reason-coded service errors are propagated via `handleRouteError`.
 *
 * Rate limit: 10 requests / 10 minutes (IP-based; tighter than thread GET).
 */
import {
    CreateMessageSchema,
    MessageGuestPublicSchema,
    MessageSenderTypeEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { AccessTokenService, MessageService } from '@repo/service-core';
import type { Context } from 'hono';
import { createPerRouteRateLimitMiddleware } from '../../../middlewares/rate-limit';
import { createRouter } from '../../../utils/create-app';
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

/** IP rate limiter: 10 requests per 10 minutes. */
const ipRateLimiter = createPerRouteRateLimitMiddleware({
    requests: 10,
    windowMs: 10 * 60 * 1000
});

/**
 * Inline body validation middleware.
 * Parses and validates the JSON body against `CreateMessageSchema`.
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

    const parseResult = CreateMessageSchema.safeParse(rawBody);
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
 * Route handler for POST /api/v1/public/conversations/guest/:token/messages.
 *
 * 1. Validates the raw access token via `AccessTokenService.validateToken`.
 * 2. On TOKEN_EXPIRED or TOKEN_REVOKED: returns 401 with the reason code.
 * 3. On valid: calls `MessageService.createMessage` with senderType = GUEST.
 * 4. Propagates all service errors with their reason codes.
 */
async function handler(c: Context): Promise<Response> {
    try {
        const rawToken = c.req.param('token');
        if (!rawToken) {
            return createErrorResponse(
                {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Missing access token',
                    reason: 'TOKEN_REVOKED'
                },
                c,
                401
            );
        }

        // TYPE-WORKAROUND: reading the upstream-stored validated body off the ctx; cast aligns the non-standard property with the schema's parsed output shape.
        const body = (c as unknown as Record<string, unknown>)._validatedBody as
            | { body?: string }
            | undefined;

        // Validate access token
        const accessTokenSvc = new AccessTokenService({ logger: apiLogger });
        const tokenResult = await accessTokenSvc.validateToken(PUBLIC_SYSTEM_ACTOR, { rawToken });

        if (tokenResult.error) {
            const reason = tokenResult.error.reason ?? 'TOKEN_REVOKED';
            return createErrorResponse(
                {
                    code: ServiceErrorCode.UNAUTHORIZED,
                    message: tokenResult.error.message,
                    reason
                },
                c,
                401
            );
        }

        const conversationId = tokenResult.data.conversationId;

        // Create message
        const messageSvc = new MessageService({ logger: apiLogger });
        const messageResult = await messageSvc.createMessage(PUBLIC_SYSTEM_ACTOR, {
            conversationId,
            senderType: MessageSenderTypeEnum.GUEST,
            body: body?.body ?? ''
        });

        if (messageResult.error) {
            const code = messageResult.error.code;
            const reason = messageResult.error.reason;

            // BLOCKED conversation
            if (reason === 'CONVERSATION_BLOCKED') {
                return createErrorResponse(
                    {
                        code,
                        message: messageResult.error.message,
                        reason
                    },
                    c,
                    403
                );
            }

            // Content moderation errors (blocked content, too long)
            if (reason === 'MESSAGE_CONTENT_BLOCKED' || reason === 'MESSAGE_TOO_LONG') {
                return createErrorResponse(
                    {
                        code,
                        message: messageResult.error.message,
                        reason
                    },
                    c,
                    422
                );
            }

            // NOT_FOUND
            if (code === ServiceErrorCode.NOT_FOUND) {
                return createErrorResponse(
                    {
                        code,
                        message: messageResult.error.message,
                        reason
                    },
                    c,
                    404
                );
            }

            return createErrorResponse(
                {
                    code,
                    message: messageResult.error.message,
                    reason
                },
                c,
                400
            );
        }

        // Strip all internal / audit fields via MessageGuestPublicSchema before
        // serializing. Zod .parse() on an object schema drops unknown keys by
        // default, so any field not declared in the schema is silently removed.
        const safeMessage = MessageGuestPublicSchema.parse(messageResult.data);

        return createResponse(safeMessage, c, 201, MessageGuestPublicSchema);
    } catch (error) {
        return handleRouteError(error, c);
    }
}

/** Public guest reply router. */
export const guestReplyPublicConversationRoute = createRouter()
    .use('*', ipRateLimiter)
    .post('/:token/messages', validateBody, handler);
