/**
 * Feature-local types for the conversations feature.
 *
 * These types map to the API response shapes for
 * GET /api/v1/admin/conversations (list) and
 * GET /api/v1/admin/conversations/:id (thread).
 */

/** Conversation status values as returned by the API */
export type ConversationStatus =
    | 'PENDING_VERIFICATION'
    | 'PENDING_OWNER'
    | 'PENDING_GUEST'
    | 'OPEN'
    | 'CLOSED'
    | 'BLOCKED';

/** Who sent a message */
export type SenderType = 'GUEST' | 'OWNER' | 'SYSTEM';

/** Guest identity shown in the inbox list */
export interface GuestIdentity {
    /** Anonymous name provided at initiation (if no user account) */
    anonName?: string;
    /** Platform user name (if authenticated guest) */
    name?: string;
    /** Email address of the guest */
    email?: string;
}

/** Accommodation stub used in conversation list items */
export interface AccommodationStub {
    id: string;
    name: string;
}

/** A single row in the inbox list */
export interface ConversationListItem {
    id: string;
    status: ConversationStatus;
    guest: GuestIdentity;
    accommodation: AccommodationStub;
    unreadCountByOwner: number;
    lastActivityAt: string;
    /** Whether the owner has archived this conversation */
    archivedByOwner: boolean;
    /** Optional block reason */
    blockReason?: string;
}

/** Paginated API response for conversations list */
export interface ConversationListResponse {
    items: ConversationListItem[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}

/** A single message within a thread */
export interface MessageWithSender {
    id: string;
    conversationId: string;
    senderType: SenderType;
    body: string;
    createdAt: string;
    /** ISO timestamp when the owner read this message (if applicable) */
    readAtByOwner?: string;
    /** ISO timestamp when the guest read this message (if applicable) */
    readAtByGuest?: string;
}

/** Full conversation detail including messages (thread) */
export interface ConversationThread {
    id: string;
    status: ConversationStatus;
    guest: GuestIdentity;
    accommodation: AccommodationStub;
    archivedByOwner: boolean;
    blockReason?: string;
    messages: MessageWithSender[];
    /** Cursor for fetching older messages */
    olderCursor?: string;
    unreadCountByOwner: number;
    lastActivityAt: string;
}

/** API response shape for the thread endpoint */
export interface ConversationThreadResponse {
    conversation: ConversationThread;
    messages: MessageWithSender[];
    olderCursor?: string;
}

/** Filters for the inbox list query */
export interface ConversationListFilters {
    page?: number;
    pageSize?: number;
    status?: ConversationStatus;
    accommodationId?: string;
    ownerId?: string;
    guestEmail?: string;
}

/** Unread count API response */
export interface UnreadCountResponse {
    count: number;
}
