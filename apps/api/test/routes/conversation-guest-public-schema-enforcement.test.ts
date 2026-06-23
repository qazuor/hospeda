/**
 * Regression tests for SPEC-210 PR3 — conversation guest public schema enforcement.
 *
 * Guards against two classes of leak on the anonymous guest conversation endpoints:
 *
 *   1. MessageGuestPublicSchema — POST /api/v1/public/conversations/guest/:token/messages
 *      Before SPEC-210 the route returned the raw service SelectMessage which includes
 *      `conversationId`, `userId`, `status`, and all audit timestamps. These must be
 *      stripped and only { id, body, senderType, createdAt } returned.
 *
 *   2. ConversationGuestPublicSchema — GET /api/v1/public/conversations/guest/:token
 *      Before SPEC-210 the route returned the raw SelectConversation (~30 fields),
 *      including critical PII: `anonymousEmail`, `anonymousPhone`. It also lacked
 *      the route-enriched display fields `accommodationName`, `accommodationSlug`,
 *      and `ownerName` which caused undefined values on the guest messages page.
 *
 * These schema-level unit tests always run without a database so a regression is
 * caught even in the DB-less CI environment.
 */

import {
    ConversationGuestPublicSchema,
    GuestThreadResponseSchema,
    MessageGuestPublicSchema
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

/** UUID factory helpers for test readability. */
const UUID = {
    conversation: '550e8400-e29b-41d4-a716-446655440001',
    message: '550e8400-e29b-41d4-a716-446655440002',
    accommodation: '550e8400-e29b-41d4-a716-446655440003',
    user: '550e8400-e29b-41d4-a716-446655440004'
} as const;

/**
 * Raw DB message row as returned by MessageService.createMessage.
 * Includes ALL fields from the messages table — the schema must strip internals.
 *
 * Enum values match the TypeScript enums used by MessageSchema:
 *   senderType: MessageSenderTypeEnum ('GUEST' | 'OWNER' | 'SYSTEM')
 *   status:     MessageStatusEnum      ('VISIBLE' | 'SYSTEM')
 */
const RAW_MESSAGE_ROW = {
    // Public fields — must survive
    id: UUID.message,
    body: 'Hola, me interesa el alojamiento.',
    senderType: 'GUEST',
    createdAt: new Date('2025-01-15T10:00:00.000Z'),
    // Internal / audit fields — must be stripped
    conversationId: UUID.conversation,
    userId: UUID.user,
    status: 'VISIBLE',
    updatedAt: new Date('2025-01-15T10:00:01.000Z'),
    deletedAt: null,
    createdById: UUID.user,
    updatedById: null,
    deletedById: null
} as const;

/**
 * Raw DB conversation row + route-enriched fields.
 * Includes ALL fields from the conversations table plus injected PII and
 * internal fields — the schema must strip everything not in the public tier.
 */
const RAW_CONVERSATION_ROW = {
    // Public fields — must survive
    id: UUID.conversation,
    status: 'PENDING_OWNER',
    accommodationId: UUID.accommodation,
    lastReadAtByOwner: null,
    createdAt: new Date('2025-01-15T09:00:00.000Z'),
    // Route-enriched display fields — must survive
    accommodationName: 'Cabaña del Río',
    accommodationSlug: 'cabana-del-rio',
    ownerName: 'Carlos',
    // PII fields — MUST be stripped
    anonymousEmail: 'guest@example.com',
    anonymousPhone: '+54911234567',
    anonymousEmailVerified: true,
    anonymousName: 'Ana García',
    // Owner-private / internal fields — must be stripped
    userId: UUID.user,
    blockReason: null,
    blockedAt: null,
    archivedByOwner: false,
    archivedByGuest: false,
    lastReadAtByGuest: null,
    closedAt: null,
    locale: 'es',
    firstGuestMessageAt: null,
    firstOwnerReplyAt: null,
    lastActivityAt: new Date('2025-01-15T10:00:00.000Z'),
    lastGuestMessageAt: new Date('2025-01-15T10:00:00.000Z'),
    lastOwnerMessageAt: null,
    guestMessageCount: 1,
    ownerMessageCount: 0,
    // Audit fields — must be stripped
    updatedAt: new Date('2025-01-15T10:00:01.000Z'),
    deletedAt: null,
    createdById: UUID.user,
    updatedById: null,
    deletedById: null
} as const;

// ---------------------------------------------------------------------------
// MessageGuestPublicSchema
// ---------------------------------------------------------------------------

describe('MessageGuestPublicSchema — schema enforcement (SPEC-210 PR3)', () => {
    /** Fields the raw service row includes that MUST be stripped from the public response. */
    const FORBIDDEN_FIELDS = [
        'conversationId',
        'userId',
        'status',
        'updatedAt',
        'deletedAt',
        'createdById',
        'updatedById',
        'deletedById'
    ] as const;

    /** Fields that must survive on the public message response. */
    const REQUIRED_PUBLIC_FIELDS = ['id', 'body', 'senderType', 'createdAt'] as const;

    it('accepts the raw service message shape', () => {
        const result = MessageGuestPublicSchema.safeParse(RAW_MESSAGE_ROW);
        expect(result.success).toBe(true);
    });

    it('strips all internal / audit fields from the raw service message', () => {
        const result = MessageGuestPublicSchema.safeParse(RAW_MESSAGE_ROW);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            for (const field of FORBIDDEN_FIELDS) {
                expect(data, `field "${field}" must be absent`).not.toHaveProperty(field);
            }
        }
    });

    it('preserves the required public message fields (id, body, senderType, createdAt)', () => {
        const result = MessageGuestPublicSchema.safeParse(RAW_MESSAGE_ROW);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            for (const field of REQUIRED_PUBLIC_FIELDS) {
                expect(data, `field "${field}" must be present`).toHaveProperty(field);
            }
        }
    });

    it('preserves the actual field values (regression: data fidelity)', () => {
        const result = MessageGuestPublicSchema.safeParse(RAW_MESSAGE_ROW);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.id).toBe(UUID.message);
            expect(result.data.body).toBe('Hola, me interesa el alojamiento.');
            expect(result.data.senderType).toBe('GUEST');
        }
    });

    it('rejects input missing the required id field', () => {
        const { id: _id, ...withoutId } = RAW_MESSAGE_ROW;
        const result = MessageGuestPublicSchema.safeParse(withoutId);
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// ConversationGuestPublicSchema
// ---------------------------------------------------------------------------

describe('ConversationGuestPublicSchema — schema enforcement (SPEC-210 PR3)', () => {
    /** PII fields that MUST be stripped from the public conversation response. */
    const FORBIDDEN_PII_FIELDS = [
        'anonymousEmail',
        'anonymousPhone',
        'anonymousEmailVerified',
        'anonymousName'
    ] as const;

    /** Owner-private / internal fields that MUST be stripped. */
    const FORBIDDEN_INTERNAL_FIELDS = [
        'userId',
        'blockReason',
        'blockedAt',
        'archivedByOwner',
        'archivedByGuest',
        'lastReadAtByGuest',
        'closedAt',
        'locale',
        'firstGuestMessageAt',
        'firstOwnerReplyAt',
        'lastActivityAt',
        'lastGuestMessageAt',
        'lastOwnerMessageAt',
        'guestMessageCount',
        'ownerMessageCount'
    ] as const;

    /** Audit fields that MUST be stripped. */
    const FORBIDDEN_AUDIT_FIELDS = [
        'updatedAt',
        'deletedAt',
        'createdById',
        'updatedById',
        'deletedById'
    ] as const;

    /** Fields that must survive on the public conversation response. */
    const REQUIRED_PUBLIC_FIELDS = [
        'id',
        'status',
        'accommodationId',
        'lastReadAtByOwner',
        'createdAt',
        'accommodationName',
        'accommodationSlug',
        'ownerName'
    ] as const;

    it('accepts the enriched conversation row (DB row + route-enriched display fields)', () => {
        const result = ConversationGuestPublicSchema.safeParse(RAW_CONVERSATION_ROW);
        expect(result.success).toBe(true);
    });

    it('strips PII fields (anonymousEmail, anonymousPhone, anonymousEmailVerified, anonymousName)', () => {
        const result = ConversationGuestPublicSchema.safeParse(RAW_CONVERSATION_ROW);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            for (const field of FORBIDDEN_PII_FIELDS) {
                expect(data, `PII field "${field}" must be absent`).not.toHaveProperty(field);
            }
        }
    });

    it('strips owner-private / internal fields', () => {
        const result = ConversationGuestPublicSchema.safeParse(RAW_CONVERSATION_ROW);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            for (const field of FORBIDDEN_INTERNAL_FIELDS) {
                expect(data, `internal field "${field}" must be absent`).not.toHaveProperty(field);
            }
        }
    });

    it('strips all audit fields (updatedAt, deletedAt, createdById, updatedById, deletedById)', () => {
        const result = ConversationGuestPublicSchema.safeParse(RAW_CONVERSATION_ROW);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            for (const field of FORBIDDEN_AUDIT_FIELDS) {
                expect(data, `audit field "${field}" must be absent`).not.toHaveProperty(field);
            }
        }
    });

    it('preserves all required public fields including route-enriched display names', () => {
        const result = ConversationGuestPublicSchema.safeParse(RAW_CONVERSATION_ROW);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            for (const field of REQUIRED_PUBLIC_FIELDS) {
                expect(data, `public field "${field}" must be present`).toHaveProperty(field);
            }
        }
    });

    it('preserves the actual route-enriched display field values (regression: ownerName/accommodationName bug)', () => {
        const result = ConversationGuestPublicSchema.safeParse(RAW_CONVERSATION_ROW);
        expect(result.success).toBe(true);
        if (result.success) {
            // These were undefined before SPEC-210 PR3 — the enrichment was missing
            // from the public route, causing the guest messages page to render blank.
            expect(result.data.ownerName).toBe('Carlos');
            expect(result.data.accommodationName).toBe('Cabaña del Río');
            expect(result.data.accommodationSlug).toBe('cabana-del-rio');
        }
    });

    it('accepts null for route-enriched display fields (accommodation/owner deleted after conversation start)', () => {
        const withNullEnrichment = {
            ...RAW_CONVERSATION_ROW,
            accommodationName: null,
            accommodationSlug: null,
            ownerName: null
        };
        const result = ConversationGuestPublicSchema.safeParse(withNullEnrichment);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.accommodationName).toBeNull();
            expect(result.data.accommodationSlug).toBeNull();
            expect(result.data.ownerName).toBeNull();
        }
    });

    it('rejects input missing the required id field', () => {
        const { id: _id, ...withoutId } = RAW_CONVERSATION_ROW;
        const result = ConversationGuestPublicSchema.safeParse(withoutId);
        expect(result.success).toBe(false);
    });

    it('rejects input missing the route-enriched accommodationName field', () => {
        const { accommodationName: _name, ...withoutName } = RAW_CONVERSATION_ROW;
        const result = ConversationGuestPublicSchema.safeParse(withoutName);
        // accommodationName is z.string().nullable() (not optional) — missing key fails
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// GuestThreadResponseSchema — wrapper
// ---------------------------------------------------------------------------

describe('GuestThreadResponseSchema — wrapper enforcement (SPEC-210 PR3)', () => {
    const VALID_THREAD_PAYLOAD = {
        conversation: RAW_CONVERSATION_ROW,
        messages: [RAW_MESSAGE_ROW],
        hasMore: false
    } as const;

    it('accepts a valid thread payload (conversation + messages + hasMore)', () => {
        const result = GuestThreadResponseSchema.safeParse(VALID_THREAD_PAYLOAD);
        expect(result.success).toBe(true);
    });

    it('strips internal fields on both conversation and each message item', () => {
        const result = GuestThreadResponseSchema.safeParse(VALID_THREAD_PAYLOAD);
        expect(result.success).toBe(true);
        if (result.success) {
            const conv = result.data.conversation as Record<string, unknown>;
            // PII must not appear on the conversation
            expect(conv).not.toHaveProperty('anonymousEmail');
            expect(conv).not.toHaveProperty('anonymousPhone');
            expect(conv).not.toHaveProperty('userId');

            const msg = result.data.messages[0] as Record<string, unknown> | undefined;
            if (msg) {
                // Audit / internal must not appear on the message
                expect(msg).not.toHaveProperty('conversationId');
                expect(msg).not.toHaveProperty('userId');
                expect(msg).not.toHaveProperty('status');
            }
        }
    });

    it('preserves hasMore flag', () => {
        const withMore = { ...VALID_THREAD_PAYLOAD, hasMore: true };
        const result = GuestThreadResponseSchema.safeParse(withMore);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.hasMore).toBe(true);
        }
    });

    it('accepts an empty messages array (no messages in thread)', () => {
        const emptyMessages = { ...VALID_THREAD_PAYLOAD, messages: [] };
        const result = GuestThreadResponseSchema.safeParse(emptyMessages);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.messages).toHaveLength(0);
        }
    });

    it('rejects payload missing the conversation field', () => {
        const { conversation: _conv, ...withoutConv } = VALID_THREAD_PAYLOAD;
        const result = GuestThreadResponseSchema.safeParse(withoutConv);
        expect(result.success).toBe(false);
    });
});
