/**
 * POST /api/v1/protected/conversations/initiate
 *
 * Initiates or resumes a conversation from an authenticated guest.
 *
 * Two outcomes:
 * - `isNew = true`  — new conversation was created by ConversationService.
 *   The opening message was inserted inside the same transaction; this route
 *   fetches its id via MessageService.getMessages({ limit: 1 }).
 * - `isNew = false` — an existing conversation was returned.
 *   The route appends the new message via MessageService.createMessage and
 *   returns its id.
 *
 * `messageId` is ALWAYS present in the response (spec AC-002-01).
 */

import {
    CreateConversationAuthSchema,
    InitiateAuthResponseSchema,
    MessageSenderTypeEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { ConversationService, MessageService, ServiceError } from '@repo/service-core';
import { createConversationMailer } from '../../../lib/conversation-mailer';
import { getActorFromContext } from '../../../utils/actor';
import { createRouter } from '../../../utils/create-app';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import {
    createErrorResponse,
    createResponse,
    handleRouteError
} from '../../../utils/response-helpers';

/** System-level actor used when calling services that require conversation permissions. */
const SYSTEM_ACTOR = {
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

const router = createRouter();

/**
 * POST /
 * Initiates or resumes a conversation for the authenticated guest.
 * Returns `{ conversationId, isNew, messageId }`.
 */
router.post('/', async (c) => {
    try {
        const rawBody = await c.req.json().catch(() => null);
        const parseResult = CreateConversationAuthSchema.safeParse(rawBody);

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

        const body = parseResult.data;
        const actor = getActorFromContext(c);

        const conversationSvc = new ConversationService(
            { logger: apiLogger },
            {
                authSecret: env.HOSPEDA_BETTER_AUTH_SECRET,
                siteUrl: env.HOSPEDA_SITE_URL,
                mailer: createConversationMailer()
            }
        );

        const initiateResult = await conversationSvc.initiateAuthenticated(
            { id: actor.id, role: actor.role, permissions: actor.permissions },
            {
                accommodationId: body.accommodationId,
                message: body.message,
                locale: body.locale
            }
        );

        if (initiateResult.error) {
            throw new ServiceError(
                initiateResult.error.code,
                initiateResult.error.message,
                initiateResult.error.details
            );
        }

        const { conversationId, isNew } = initiateResult.data;
        const messageSvc = new MessageService({ logger: apiLogger });

        if (isNew) {
            // Opening message was inserted by ConversationService; fetch its id.
            const msgListResult = await messageSvc.getMessages(SYSTEM_ACTOR, {
                conversationId,
                limit: 1
            });

            const messageId =
                msgListResult.data?.messages?.[0]?.id ?? '00000000-0000-0000-0000-000000000000';

            return createResponse(
                { conversationId, isNew: true, messageId },
                c,
                201,
                InitiateAuthResponseSchema
            );
        }

        // Existing conversation: append the new message.
        const msgResult = await messageSvc.createMessage(SYSTEM_ACTOR, {
            conversationId,
            senderType: MessageSenderTypeEnum.GUEST,
            body: body.message,
            userId: actor.id
        });

        if (msgResult.error) {
            throw new ServiceError(
                msgResult.error.code,
                msgResult.error.message,
                msgResult.error.details
            );
        }

        return createResponse(
            { conversationId, isNew: false, messageId: msgResult.data.id },
            c,
            201,
            InitiateAuthResponseSchema
        );
    } catch (error) {
        return handleRouteError(error, c);
    }
});

export { router as initiateProtectedConversationRoute };
