/**
 * GET /api/v1/public/conversations/guest/:token
 *
 * Returns the conversation thread for an anonymous guest identified by their
 * access token. Updates `lastReadAtByGuest` inside `getThread`.
 *
 * The response is narrowed to {@link GuestThreadResponseSchema} before
 * serialization so internal / PII fields never leak to anonymous callers.
 *
 * Rate limit: 20 requests / 10 minutes (IP-based; loose because users may reload).
 */
import { AccommodationModel, UserModel } from '@repo/db';
import {
    GuestThreadResponseSchema,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { AccessTokenService, ConversationService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { createPerRouteRateLimitMiddleware } from '../../../middlewares/rate-limit';
import { createRouter } from '../../../utils/create-app';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import {
    createErrorResponse,
    createResponse,
    handleRouteError
} from '../../../utils/response-helpers';

/** Accommodation model instance reused across requests. */
const accommodationModel = new AccommodationModel();

/** User model instance reused across requests. */
const userModel = new UserModel();

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

/** Thread query schema for cursor-based pagination. */
const ThreadQuerySchema = z.object({
    cursor: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50)
});

/** IP rate limiter: 20 requests per 10 minutes. */
const ipRateLimiter = createPerRouteRateLimitMiddleware({
    requests: 20,
    windowMs: 10 * 60 * 1000
});

/**
 * Route handler for GET /api/v1/public/conversations/guest/:token.
 *
 * 1. Validates the raw access token via `AccessTokenService.validateToken`.
 * 2. On TOKEN_EXPIRED or TOKEN_REVOKED: returns 401 with the reason code.
 * 3. On valid: loads the thread via `ConversationService.getThread`.
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

        // Validate query params
        const queryParseResult = ThreadQuerySchema.safeParse({
            cursor: c.req.query('cursor'),
            limit: c.req.query('limit')
        });
        if (!queryParseResult.success) {
            return createErrorResponse(
                {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Invalid query parameters',
                    details: queryParseResult.error.issues.map((issue) => ({
                        field: issue.path.join('.'),
                        message: issue.message
                    }))
                },
                c,
                400
            );
        }
        const query = queryParseResult.data;

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

        const tokenRow = tokenResult.data;
        const conversationId = tokenRow.conversationId;

        // Load thread
        const conversationSvc = new ConversationService(
            { logger: apiLogger },
            {
                authSecret: env.HOSPEDA_BETTER_AUTH_SECRET,
                siteUrl: env.HOSPEDA_SITE_URL
            }
        );

        const cursor = query.cursor ? new Date(query.cursor) : undefined;

        const threadResult = await conversationSvc.getThread(
            PUBLIC_SYSTEM_ACTOR,
            {
                conversationId,
                actorSide: 'GUEST',
                cursor,
                limit: query.limit
            },
            [] // No owner accommodation IDs needed for GUEST side
        );

        if (threadResult.error) {
            const status = threadResult.error.code === ServiceErrorCode.NOT_FOUND ? 404 : 400;
            return createErrorResponse(
                {
                    code: threadResult.error.code,
                    message: threadResult.error.message,
                    reason: threadResult.error.reason
                },
                c,
                status
            );
        }

        const { conversation, messages, hasMore } = threadResult.data;

        // Enrich the conversation with display-friendly fields that are NOT
        // in the DB row. This mirrors the enrichment in the protected thread
        // route (apps/api/src/routes/conversations/protected/thread.ts) so the
        // web guest thread page can render the accommodation name and owner name
        // without a separate round trip.
        const accommodation = (conversation as { accommodationId: string }).accommodationId
            ? await accommodationModel.findById(
                  (conversation as { accommodationId: string }).accommodationId
              )
            : null;
        const owner =
            accommodation && (accommodation as { ownerId?: string }).ownerId
                ? await userModel.findById((accommodation as { ownerId: string }).ownerId)
                : null;

        const enrichedConversation = {
            ...conversation,
            accommodationName: (accommodation as { name?: string } | null)?.name ?? null,
            accommodationSlug: (accommodation as { slug?: string } | null)?.slug ?? null,
            ownerName:
                (owner as { displayName?: string } | null)?.displayName ??
                (owner as { firstName?: string } | null)?.firstName ??
                null
        };

        // Strip all internal / PII fields via GuestThreadResponseSchema before
        // serializing. Zod .parse() on an object schema drops unknown keys by
        // default, so any field not declared in the schema is silently removed.
        const safePayload = GuestThreadResponseSchema.parse({
            conversation: enrichedConversation,
            messages,
            hasMore
        });

        return createResponse(safePayload, c, 200);
    } catch (error) {
        return handleRouteError(error, c);
    }
}

/** Public guest thread router. */
export const guestThreadPublicConversationRoute = createRouter()
    .use('*', ipRateLimiter)
    .get('/:token', handler);
