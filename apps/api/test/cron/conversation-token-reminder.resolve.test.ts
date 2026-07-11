/**
 * Tests for `resolveTokenContext` — token resolution branches (HOS-129)
 *
 * Mocking strategy: `@repo/db` is mocked minimally to the `conversations`
 * table identity ref `resolveTokenContext` reads from, plus a per-test fake
 * `db` object built by `createFakeDb()`. `drizzle-orm`'s `and`/`eq`/`isNull`
 * are mocked to plain descriptor objects — `resolveTokenContext` only passes
 * their return value through to `db.where()`, it never inspects the shape
 * itself.
 *
 * Branches covered (each returns `null`, logged at `warn`, per
 * `resolveTokenContext`'s documented contract):
 * - conversation deleted / not found
 * - conversation has no `anonymousEmail`
 * - accommodation missing
 *
 * Happy path:
 * - fully resolvable token (recipient email, accommodation name, locale)
 *
 * @module test/cron/conversation-token-reminder.resolve
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { conversationsTableRef } = vi.hoisted(() => ({
    conversationsTableRef: { id: 'id', deletedAt: 'deletedAt' }
}));

vi.mock('@repo/db', () => ({
    conversations: conversationsTableRef
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => ({ and: args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ eq: { col, val } })),
    isNull: vi.fn((col: unknown) => ({ isNull: col }))
}));

import { resolveTokenContext } from '../../src/cron/jobs/conversation-token-reminder.resolve.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Builds a fake `db` matching the exact call shape `resolveTokenContext`
 * uses: `select().from(conversations).where(...).limit(1)`.
 */
function createFakeDb(conversationRow: Record<string, unknown> | null) {
    return {
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: vi.fn(() => ({
                    limit: vi.fn().mockResolvedValue(conversationRow ? [conversationRow] : [])
                }))
            }))
        }))
    };
}

function createLoggerMock() {
    return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

const TOKEN_ID = 'token-resolve-1';
const CONVERSATION_ID = 'conv-resolve-1';
const ACCOMMODATION_ID = 'acc-resolve-1';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveTokenContext', () => {
    let accommodationModel: { findById: ReturnType<typeof vi.fn> };
    let logger: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        vi.clearAllMocks();
        accommodationModel = { findById: vi.fn() };
        logger = createLoggerMock();
    });

    describe('unresolvable branches', () => {
        it('returns null when the conversation is deleted or not found', async () => {
            const db = createFakeDb(null);

            const result = await resolveTokenContext({
                tokenId: TOKEN_ID,
                conversationId: CONVERSATION_ID,
                db: db as never,
                accommodationModel: accommodationModel as never,
                logger: logger as never
            });

            expect(result).toBeNull();
            expect(logger.warn).toHaveBeenCalledWith(
                'Conversation not found or deleted — skipping token reminder',
                expect.objectContaining({ tokenId: TOKEN_ID, conversationId: CONVERSATION_ID })
            );
            expect(accommodationModel.findById).not.toHaveBeenCalled();
        });

        it('returns null when the conversation has no anonymousEmail', async () => {
            const db = createFakeDb({
                id: CONVERSATION_ID,
                accommodationId: ACCOMMODATION_ID,
                anonymousEmail: null,
                locale: 'es'
            });

            const result = await resolveTokenContext({
                tokenId: TOKEN_ID,
                conversationId: CONVERSATION_ID,
                db: db as never,
                accommodationModel: accommodationModel as never,
                logger: logger as never
            });

            expect(result).toBeNull();
            expect(logger.warn).toHaveBeenCalledWith(
                'No anonymous email on conversation — skipping token reminder',
                expect.objectContaining({ tokenId: TOKEN_ID })
            );
            expect(accommodationModel.findById).not.toHaveBeenCalled();
        });

        it('returns null when the accommodation is missing', async () => {
            const db = createFakeDb({
                id: CONVERSATION_ID,
                accommodationId: ACCOMMODATION_ID,
                anonymousEmail: 'guest@example.com',
                locale: 'es'
            });
            accommodationModel.findById.mockResolvedValue(null);

            const result = await resolveTokenContext({
                tokenId: TOKEN_ID,
                conversationId: CONVERSATION_ID,
                db: db as never,
                accommodationModel: accommodationModel as never,
                logger: logger as never
            });

            expect(result).toBeNull();
            expect(logger.warn).toHaveBeenCalledWith(
                'Accommodation not found — skipping token reminder',
                expect.objectContaining({ tokenId: TOKEN_ID, accommodationId: ACCOMMODATION_ID })
            );
        });
    });

    describe('happy path', () => {
        it('resolves recipient email, accommodation name, and locale', async () => {
            const db = createFakeDb({
                id: CONVERSATION_ID,
                accommodationId: ACCOMMODATION_ID,
                anonymousEmail: 'guest@example.com',
                locale: 'en'
            });
            accommodationModel.findById.mockResolvedValue({
                id: ACCOMMODATION_ID,
                name: 'Test Accommodation',
                slug: 'test-accommodation'
            });

            const result = await resolveTokenContext({
                tokenId: TOKEN_ID,
                conversationId: CONVERSATION_ID,
                db: db as never,
                accommodationModel: accommodationModel as never,
                logger: logger as never
            });

            expect(result).toEqual({
                recipientEmail: 'guest@example.com',
                accommodationName: 'Test Accommodation',
                locale: 'en'
            });
        });

        it('falls back to accommodation slug when name is missing', async () => {
            const db = createFakeDb({
                id: CONVERSATION_ID,
                accommodationId: ACCOMMODATION_ID,
                anonymousEmail: 'guest@example.com',
                locale: undefined
            });
            accommodationModel.findById.mockResolvedValue({
                id: ACCOMMODATION_ID,
                name: null,
                slug: 'test-accommodation'
            });

            const result = await resolveTokenContext({
                tokenId: TOKEN_ID,
                conversationId: CONVERSATION_ID,
                db: db as never,
                accommodationModel: accommodationModel as never,
                logger: logger as never
            });

            expect(result?.accommodationName).toBe('test-accommodation');
            expect(result?.locale).toBe('es');
        });
    });
});
