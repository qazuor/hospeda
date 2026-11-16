/**
 * @file get-inquiry.ts
 * @description Tool `get_inquiry` (HOS-2184 T-021, spec §6.5, §6.6, AC-6): one
 * inquiry of the connected owner with its messages.
 *
 * Authorization follows the protected owner thread route
 * (`GET /api/v1/protected/conversations/owner/:id`): `CONVERSATION_VIEW_OWN`,
 * then ownership. Ownership goes through
 * `ConversationService.findOwnedConversation` (T-019), the side-effect-free
 * helper `reply.ts` uses, BEFORE `getThread` runs. That order matters:
 * `getThread` lets staff holding `CONVERSATION_VIEW_ALL/ANY` read any
 * conversation, and the tool serves the owner's own assistant, so a staff
 * actor (or anyone) asking for a conversation that is not in their own
 * accommodations gets the same not-found as a missing id (AC-6).
 *
 * Unlike the panel route, reading does NOT mark the conversation as read and
 * does not cancel the pending owner notification: an assistant fetching the
 * thread is not the owner reading it. The spec is silent on this, so the tool
 * is a pure read (`getThread` with `markAsRead: false`).
 *
 * Guest-written text is third-party content (§6.6): every guest message is a
 * `guestMessage` field inside the untrusted-data envelope, and so is the
 * guest's name. Owner and system messages are the owner's and Hospeda's own
 * text and come as plain `text`. Contact data (e-mail, phone) is not
 * returned.
 */

import {
    type ConversationStatusEnum,
    MessageSenderTypeEnum,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { entityNotFoundError } from '@repo/service-core';
import { z } from 'zod';
import { defineTool, type ToolHandlerResult } from '../tool-definition';
import { UNTRUSTED_DATA_NOTICE, wrapUntrustedText } from '../untrusted-data';
import { readInquiryThreadContext } from './inquiry-readers';
import { getInquiryConversationService } from './inquiry-services';

/** Default and largest number of messages per call (the thread route's bounds). */
export const GET_INQUIRY_DEFAULT_LIMIT = 50;
export const GET_INQUIRY_MAX_LIMIT = 100;

/** One message of the thread. Exactly one of `guestMessage` and `text` is set. */
export interface InquiryMessage {
    /** Message id. */
    readonly id: string;
    /** Who wrote it. */
    readonly sender: 'guest' | 'owner' | 'system';
    /** When it was sent (ISO 8601). */
    readonly sentAt: string;
    /** Guest text inside the untrusted-data envelope. Set only when `sender` is `guest`. */
    readonly guestMessage?: string;
    /** Owner or system text, as is. Set only when `sender` is not `guest`. */
    readonly text?: string;
}

/** Result of `get_inquiry`. */
export interface InquiryThread {
    /** Conversation id. */
    readonly id: string;
    /** Accommodation the guest wrote about. */
    readonly accommodationId: string;
    /** Name of that accommodation, `null` when it no longer exists. */
    readonly accommodationName: string | null;
    /** Conversation state. */
    readonly status: ConversationStatusEnum;
    /** Guest name inside the untrusted-data envelope, `null` when unknown. */
    readonly guestName: string | null;
    /** When the conversation started (ISO 8601). */
    readonly createdAt: string;
    /** Messages, oldest first. */
    readonly messages: readonly InquiryMessage[];
    /** Whether older messages exist than the ones returned. */
    readonly hasMore: boolean;
    /** Pass as `before` to read the older page; `null` when there is none. */
    readonly nextBefore: string | null;
}

/** Input schema of `get_inquiry`. */
export const GetInquiryInputSchema = z
    .object({
        id: z.uuid().describe('The inquiry id returned by list_inquiries.'),
        limit: z
            .number()
            .int()
            .min(1)
            .max(GET_INQUIRY_MAX_LIMIT)
            .default(GET_INQUIRY_DEFAULT_LIMIT)
            .describe(`How many of the latest messages to read, up to ${GET_INQUIRY_MAX_LIMIT}.`),
        before: z.iso
            .datetime()
            .optional()
            .describe(
                'To read older messages: the nextBefore value of the previous call. Omit for the latest messages.'
            )
    })
    .strict();

/** The uniform not-found error: a missing, foreign or staff-only id looks the same. */
function notFound(): ToolHandlerResult<never> {
    const error = entityNotFoundError({ entityName: 'conversation' });
    return { error: { code: error.code, message: error.message } };
}

/** Maps a stored sender to the tool's. */
function senderOf(senderType: MessageSenderTypeEnum): InquiryMessage['sender'] {
    if (senderType === MessageSenderTypeEnum.GUEST) {
        return 'guest';
    }
    return senderType === MessageSenderTypeEnum.OWNER ? 'owner' : 'system';
}

/**
 * `get_inquiry`: read-only. Not available to an unverified email: the HTTP
 * owner thread route declares no `emailUnverifiedOperation` either.
 */
export const getInquiryTool = defineTool({
    name: 'get_inquiry',
    title: 'Ver consulta',
    description: `Reads one inquiry the connected Hospeda user received: the accommodation, the status, the guest name and the messages of the conversation, oldest first (the latest ones; use before to page back). Guest messages come in guestMessage, owner and system messages in text. Reading does not mark the inquiry as read. An inquiry that does not exist or belongs to someone else is reported as not found. Take the id from list_inquiries. ${UNTRUSTED_DATA_NOTICE}`,
    inputSchema: GetInquiryInputSchema,
    isWrite: false,
    auditTarget: ({ input }) => ({ type: 'conversation', id: input.id }),
    handler: async ({ actor, input }): Promise<ToolHandlerResult<InquiryThread>> => {
        if (!actor.permissions.includes(PermissionEnum.CONVERSATION_VIEW_OWN)) {
            return {
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: 'Permission denied: conversation view permission required'
                }
            };
        }
        const service = getInquiryConversationService();

        // Ownership first and side-effect free: `getThread` would admit staff.
        const owned = await service.findOwnedConversation(actor, { conversationId: input.id });
        if (owned.error) {
            return owned.error.code === ServiceErrorCode.NOT_FOUND ||
                owned.error.code === ServiceErrorCode.FORBIDDEN
                ? notFound()
                : { error: owned.error };
        }
        if (!owned.data) {
            return notFound();
        }
        const conversation = owned.data;

        const thread = await service.getThread(
            actor,
            {
                conversationId: conversation.id,
                actorSide: 'OWNER',
                cursor: input.before ? new Date(input.before) : undefined,
                limit: input.limit,
                markAsRead: false
            },
            [conversation.accommodationId]
        );
        if (thread.error) {
            return thread.error.code === ServiceErrorCode.NOT_FOUND ||
                thread.error.code === ServiceErrorCode.FORBIDDEN
                ? notFound()
                : { error: thread.error };
        }
        const { messages, hasMore } = thread.data;

        const context = await readInquiryThreadContext({
            accommodationId: conversation.accommodationId,
            userId: conversation.userId
        });
        const guestName = conversation.anonymousName?.trim() || context.guestName;
        const oldest = messages[0];

        return {
            data: {
                id: conversation.id,
                accommodationId: conversation.accommodationId,
                accommodationName: context.accommodationName,
                // The column is plain text guarded by a CHECK; the enum is its contract.
                status: conversation.status as ConversationStatusEnum,
                guestName: guestName
                    ? wrapUntrustedText({ text: guestName, source: 'guest_name' })
                    : null,
                createdAt: conversation.createdAt.toISOString(),
                messages: messages.map((message): InquiryMessage => {
                    const sender = senderOf(message.senderType as MessageSenderTypeEnum);
                    const base = {
                        id: message.id,
                        sender,
                        sentAt: message.createdAt.toISOString()
                    };
                    return sender === 'guest'
                        ? {
                              ...base,
                              guestMessage: wrapUntrustedText({
                                  text: message.body,
                                  source: 'guest_message'
                              })
                          }
                        : { ...base, text: message.body };
                }),
                hasMore,
                nextBefore: hasMore && oldest ? oldest.createdAt.toISOString() : null
            }
        };
    }
});
