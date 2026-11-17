/**
 * @file list-inquiries.ts
 * @description Tool `list_inquiries` (HOS-2184 T-020, spec §6.5, §6.6): the
 * accommodation inquiries the connected owner received.
 *
 * A thin adapter over the protected owner inbox route
 * (`GET /api/v1/protected/conversations/owner`): the same
 * `CONVERSATION_VIEW_OWN` gate, the same scope (the actor's own
 * accommodations) and the same `ConversationService.listForOwner` call, so
 * the tool never sees more than the owner's panel does. A foreign
 * conversation is never in the scope, hence never in the result (AC-6).
 *
 * Accommodation only (spec NG-1): venues and experiences have no inquiries in
 * the product. An owner without accommodations gets an empty list.
 *
 * Guest-written text (the guest's name and the last message preview) is
 * third-party content: it is returned inside the untrusted-data envelope
 * (§6.6), never as a bare string. Contact data (e-mail, phone) is not
 * returned: the owner reads it in the panel, the assistant does not need it.
 *
 * Listing does not mark anything as read: the tool is a pure read.
 */

import { ConversationStatusEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { defineTool, type ToolHandlerResult } from '../tool-definition';
import { UNTRUSTED_DATA_NOTICE, wrapUntrustedText } from '../untrusted-data';
import { readInquiryListContext, readOwnerAccommodationIds } from './inquiry-readers';
import { inquiryRefusalLink } from './inquiry-refusal-action';
import { getInquiryConversationService } from './inquiry-services';

/** Default page size. */
export const LIST_INQUIRIES_DEFAULT_PAGE_SIZE = 20;

/** Largest page. Smaller than the HTTP route's 100: previews go into the model context. */
export const LIST_INQUIRIES_MAX_PAGE_SIZE = 50;

/** Longest last-message preview, as the panel inbox shows it. */
export const LIST_INQUIRIES_PREVIEW_LENGTH = 200;

/** One inquiry in the result. */
export interface InquirySummary {
    /** Conversation id; the `id` input of `get_inquiry`. */
    readonly id: string;
    /** Accommodation the guest wrote about. */
    readonly accommodationId: string;
    /** Name of that accommodation, `null` when it no longer exists. */
    readonly accommodationName: string | null;
    /** Conversation state; `PENDING_OWNER` means the guest is waiting for a reply. */
    readonly status: ConversationStatusEnum;
    /** Guest name inside the untrusted-data envelope, `null` when unknown. */
    readonly guestName: string | null;
    /** First 200 characters of the latest message, inside the envelope; `null` when empty. */
    readonly lastMessagePreview: string | null;
    /** Messages the owner has not read yet. */
    readonly unreadCount: number;
    /** When the conversation last moved (ISO 8601), `null` if never. */
    readonly lastActivityAt: string | null;
    /** When the conversation started (ISO 8601). */
    readonly createdAt: string;
}

/** Result of `list_inquiries`. */
export interface ListInquiriesResult {
    /** The requested page, most recent activity first. */
    readonly inquiries: readonly InquirySummary[];
    /** Page position and totals. */
    readonly pagination: {
        readonly page: number;
        readonly pageSize: number;
        readonly total: number;
        readonly totalPages: number;
    };
}

/** Input schema of `list_inquiries`. */
export const ListInquiriesInputSchema = z
    .object({
        status: z
            .enum(ConversationStatusEnum)
            .optional()
            .describe(
                'Only inquiries in this state. PENDING_OWNER = waiting for the owner to reply (unanswered); OPEN = ongoing; PENDING_GUEST = the owner replied and awaits the guest; CLOSED; BLOCKED. Omit for all.'
            ),
        listingId: z
            .uuid()
            .optional()
            .describe(
                "Only inquiries about this accommodation (its id, from list_my_listings). An id that is not one of the user's own accommodations returns an empty list. Omit for all accommodations."
            ),
        page: z.number().int().min(1).default(1).describe('Page number, starting at 1.'),
        pageSize: z
            .number()
            .int()
            .min(1)
            .max(LIST_INQUIRIES_MAX_PAGE_SIZE)
            .default(LIST_INQUIRIES_DEFAULT_PAGE_SIZE)
            .describe(`Inquiries per page, up to ${LIST_INQUIRIES_MAX_PAGE_SIZE}.`)
    })
    .strict();

/** Serializes a timestamp. */
function iso(value: Date | string | null | undefined): string | null {
    if (value === null || value === undefined) {
        return null;
    }
    return (value instanceof Date ? value : new Date(value)).toISOString();
}

/**
 * `list_inquiries`: read-only. Not available to an unverified email: the HTTP
 * owner inbox route declares no `emailUnverifiedOperation` either.
 */
export const listInquiriesTool = defineTool({
    name: 'list_inquiries',
    title: 'Mis consultas',
    description: `Lists the inquiries (messages from guests) the connected Hospeda user received on their accommodations, most recent activity first. Returns, per inquiry: id, accommodation, status, guest name, a preview of the latest message, unread count and dates. Use status PENDING_OWNER to see the ones still waiting for a reply, and listingId to see only those of one accommodation. Only accommodations have inquiries; venues and experiences do not. Take an id to get_inquiry to read the whole conversation. ${UNTRUSTED_DATA_NOTICE}`,
    inputSchema: ListInquiriesInputSchema,
    refusalAction: ({ error }) => inquiryRefusalLink({ error }),
    isWrite: false,
    handler: async ({ actor, input }): Promise<ToolHandlerResult<ListInquiriesResult>> => {
        if (!actor.permissions.includes(PermissionEnum.CONVERSATION_VIEW_OWN)) {
            return {
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: 'Permission denied: conversation view permission required'
                }
            };
        }
        const { page, pageSize, status, listingId } = input;
        const emptyPage = {
            data: {
                inquiries: [],
                pagination: { page, pageSize, total: 0, totalPages: 0 }
            }
        } as const;

        const accommodationIds = await readOwnerAccommodationIds({ ownerId: actor.id });
        if (accommodationIds.length === 0) {
            return emptyPage;
        }

        const result = await getInquiryConversationService().listForOwner(actor, {
            userId: actor.id,
            accommodationIds: [...accommodationIds],
            page,
            pageSize,
            status,
            accommodationId: listingId
        });
        if (result.error) {
            return { error: result.error };
        }
        const { items, total } = result.data;

        const context = await readInquiryListContext({ conversations: items });
        const inquiries = items.map((item): InquirySummary => {
            const guestName =
                item.anonymousName?.trim() ||
                (item.userId ? context.guestNames.get(item.userId) : undefined) ||
                null;
            const preview = (context.lastMessages.get(item.id) ?? '').slice(
                0,
                LIST_INQUIRIES_PREVIEW_LENGTH
            );
            return {
                id: item.id,
                accommodationId: item.accommodationId,
                accommodationName: context.accommodationNames.get(item.accommodationId) ?? null,
                // The column is plain text guarded by a CHECK; the enum is its contract.
                status: item.status as ConversationStatusEnum,
                guestName: guestName
                    ? wrapUntrustedText({ text: guestName, source: 'guest_name' })
                    : null,
                lastMessagePreview: preview
                    ? wrapUntrustedText({ text: preview, source: 'guest_message' })
                    : null,
                unreadCount: context.unreadCounts.get(item.id) ?? 0,
                lastActivityAt: iso(item.lastActivityAt),
                createdAt: item.createdAt.toISOString()
            };
        });

        return {
            data: {
                inquiries,
                pagination: {
                    page: result.data.page,
                    pageSize: result.data.pageSize,
                    total,
                    totalPages: Math.ceil(total / result.data.pageSize)
                }
            }
        };
    }
});
