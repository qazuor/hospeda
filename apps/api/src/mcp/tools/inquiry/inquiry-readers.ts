/**
 * @file inquiry-readers.ts
 * @description The display data the owner panel shows next to an inquiry and
 * the services do not return (HOS-2184 T-020/T-021): accommodation name, guest
 * name, last message preview and unread count.
 *
 * The protected owner routes assemble the same data inline
 * (`routes/conversations/protected/owner/{list,thread}.ts`) with the same
 * models. Every database read of the inquiry tools lives here, behind named
 * functions, so the tool modules stay free of persistence and tests replace
 * one module.
 *
 * Models are built lazily: nothing here touches `@repo/db` at import time.
 */

import { AccommodationModel, MessageModel, UserModel } from '@repo/db';

let accommodationModel: AccommodationModel | undefined;
let messageModel: MessageModel | undefined;
let userModel: UserModel | undefined;

const accommodations = (): AccommodationModel => {
    accommodationModel ??= new AccommodationModel();
    return accommodationModel;
};
const messagesModel = (): MessageModel => {
    messageModel ??= new MessageModel();
    return messageModel;
};
const users = (): UserModel => {
    userModel ??= new UserModel();
    return userModel;
};

/** A user row, narrowed to the name fields the panel resolves a guest from. */
interface GuestUserRow {
    readonly id: string;
    readonly displayName?: string | null;
    readonly firstName?: string | null;
    readonly lastName?: string | null;
}

/**
 * Display name of a registered guest: display name, else first and last name.
 * Unlike the panel, never falls back to the e-mail address: a name is all an
 * assistant needs, and the address stays in the panel.
 */
function userDisplayName(row: GuestUserRow): string | null {
    return (
        row.displayName?.trim() ||
        [row.firstName, row.lastName].filter(Boolean).join(' ').trim() ||
        null
    );
}

/**
 * Ids of the accommodations an owner holds, the scope `listForOwner` and
 * `getThread` take. Soft-deleted accommodations are excluded.
 *
 * @param args - The owner's user id
 * @returns The accommodation ids (empty when the owner has none)
 */
export async function readOwnerAccommodationIds({
    ownerId
}: {
    readonly ownerId: string;
}): Promise<readonly string[]> {
    return accommodations().findIdsByOwnerId(ownerId);
}

/** One conversation to enrich: just the keys the lookups need. */
export interface InquiryEnrichmentKey {
    /** Conversation id. */
    readonly id: string;
    /** Accommodation the conversation is about. */
    readonly accommodationId: string;
    /** Registered guest, `null` for an anonymous one. */
    readonly userId: string | null;
}

/** Display data of a page of conversations, keyed for lookup. */
export interface InquiryListContext {
    /** Accommodation id to name. */
    readonly accommodationNames: ReadonlyMap<string, string>;
    /** Registered guest user id to display name. */
    readonly guestNames: ReadonlyMap<string, string>;
    /** Conversation id to the body of its latest message. */
    readonly lastMessages: ReadonlyMap<string, string>;
    /** Conversation id to the number of unread messages for the owner. */
    readonly unreadCounts: ReadonlyMap<string, number>;
}

/**
 * Reads the display data for a page of conversations in a fixed number of
 * queries, whatever the page size.
 *
 * @param args - The conversations of the page
 * @returns Lookup maps for names, last message and unread count
 */
export async function readInquiryListContext({
    conversations
}: {
    readonly conversations: readonly InquiryEnrichmentKey[];
}): Promise<InquiryListContext> {
    const accommodationIds = [...new Set(conversations.map((c) => c.accommodationId))];
    const userIds = [
        ...new Set(conversations.map((c) => c.userId).filter((id): id is string => id !== null))
    ];
    const conversationIds = conversations.map((c) => c.id);

    const [accommodationRows, userRows, lastMessages, unreadCounts] = await Promise.all([
        accommodationIds.length > 0 ? accommodations().findByIds(accommodationIds) : [],
        userIds.length > 0 ? users().findByIds(userIds) : [],
        messagesModel().getLastMessagePreviews(conversationIds),
        messagesModel().countUnreadForOwnerByConversation(conversationIds)
    ]);

    const accommodationNames = new Map<string, string>();
    for (const row of accommodationRows) {
        accommodationNames.set(row.id, row.name);
    }
    const guestNames = new Map<string, string>();
    for (const row of userRows as readonly GuestUserRow[]) {
        const name = userDisplayName(row);
        if (name) {
            guestNames.set(row.id, name);
        }
    }
    return { accommodationNames, guestNames, lastMessages, unreadCounts };
}

/** Display data of one conversation. */
export interface InquiryThreadContext {
    /** Name of the accommodation, `null` when it no longer exists. */
    readonly accommodationName: string | null;
    /** Display name of the registered guest, `null` when anonymous or unresolved. */
    readonly guestName: string | null;
}

/**
 * Reads the display data of one conversation.
 *
 * @param args - The accommodation and the registered guest (if any)
 * @returns Accommodation name and registered-guest name
 */
export async function readInquiryThreadContext({
    accommodationId,
    userId
}: {
    readonly accommodationId: string;
    readonly userId: string | null;
}): Promise<InquiryThreadContext> {
    const [accommodation, userRows] = await Promise.all([
        accommodations().findById(accommodationId),
        userId ? users().findByIds([userId]) : []
    ]);
    const user = (userRows as readonly GuestUserRow[])[0];
    return {
        accommodationName: accommodation?.name ?? null,
        guestName: user ? userDisplayName(user) : null
    };
}
