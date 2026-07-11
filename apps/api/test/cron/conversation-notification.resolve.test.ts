/**
 * Tests for `resolveNotification` — schedule resolution branches (HOS-112)
 *
 * Mocking strategy: `@repo/db` is mocked minimally to just the two table
 * identity refs `resolveNotification` reads from (`conversations`,
 * `messages`) plus a per-test fake `db` object built by `createFakeDb()`.
 * `drizzle-orm`'s `and`/`eq`/`isNull`/`desc` are mocked to plain descriptor
 * objects — `resolveNotification` only passes their return value through to
 * `db.where()`/`db.orderBy()`, it never inspects the shape itself, so the
 * fake `db` doesn't need to interpret them either; each test just returns
 * the canned row(s) for its scenario directly. `@repo/notifications`
 * templates are mocked to avoid rendering real React Email components.
 *
 * Branches covered (each returns `null`, logged at `warn`, per
 * `resolveNotification`'s documented contract):
 * - conversation deleted / not found
 * - accommodation missing
 * - anonymous guest with no email
 * - owner recipient with no `ownerId`
 * - no recipient email resolved (authenticated guest whose user has no email)
 *
 * Happy paths:
 * - authenticated guest recipient (renders `ConversationNewMessage`)
 * - anonymous guest recipient (renders `ConversationNewMessageAnon`)
 * - owner recipient (renders `ConversationNewMessage`)
 *
 * @module test/cron/conversation-notification.resolve
 */

import { NotificationRecipientSideEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted table identity refs — shared between the `@repo/db` mock factory
// and `createFakeDb()` below so `table === messagesTableRef` identity checks
// work regardless of module-eval order.
// ---------------------------------------------------------------------------

const { conversationsTableRef, messagesTableRef } = vi.hoisted(() => ({
    conversationsTableRef: { id: 'id', deletedAt: 'deletedAt' },
    messagesTableRef: { conversationId: 'conversationId', createdAt: 'createdAt', body: 'body' }
}));

vi.mock('@repo/db', () => ({
    conversations: conversationsTableRef,
    messages: messagesTableRef
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => ({ and: args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ eq: { col, val } })),
    isNull: vi.fn((col: unknown) => ({ isNull: col })),
    desc: vi.fn((col: unknown) => ({ desc: col }))
}));

vi.mock('@repo/notifications', () => ({
    ConversationNewMessage: vi.fn().mockReturnValue({ type: 'mock-email-template' }),
    ConversationNewMessageAnon: vi.fn().mockReturnValue({ type: 'mock-email-anon-template' })
}));

vi.mock('../../src/utils/env.js', () => ({
    env: { HOSPEDA_SITE_URL: 'https://hospeda.test' }
}));

import { ConversationNewMessage, ConversationNewMessageAnon } from '@repo/notifications';
import { resolveNotification } from '../../src/cron/jobs/conversation-notification.resolve.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Builds a fake `db` matching the exact call shape `resolveNotification`
 * uses: `select().from(conversations).where(...).limit(1)` for the
 * conversation row, and `select({...}).from(messages).where(...).orderBy(...).limit(n)`
 * for recent message excerpts. Each test controls the canned return values
 * directly — the `where`/`orderBy` clause contents are never inspected.
 */
function createFakeDb(params: {
    conversationRow?: Record<string, unknown> | null;
    messageRows?: Array<{ body: string; createdAt: Date }>;
}) {
    const { conversationRow = null, messageRows = [] } = params;

    return {
        select: vi.fn(() => ({
            from: vi.fn((table: unknown) => {
                if (table === messagesTableRef) {
                    return {
                        where: vi.fn(() => ({
                            orderBy: vi.fn(() => ({
                                limit: vi.fn().mockResolvedValue(messageRows)
                            }))
                        }))
                    };
                }
                return {
                    where: vi.fn(() => ({
                        limit: vi.fn().mockResolvedValue(conversationRow ? [conversationRow] : [])
                    }))
                };
            })
        }))
    };
}

function createLoggerMock() {
    return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

const SCHEDULE_ID = 'sched-resolve-1';
const CONVERSATION_ID = 'conv-resolve-1';
const ACCOMMODATION_ID = 'acc-resolve-1';

function makeSchedule(overrides: Partial<{ recipientSide: string; streakCount: number }> = {}) {
    return {
        id: SCHEDULE_ID,
        conversationId: CONVERSATION_ID,
        recipientSide: NotificationRecipientSideEnum.OWNER,
        streakCount: 1,
        ...overrides
    } as never;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveNotification', () => {
    let accommodationModel: { findById: ReturnType<typeof vi.fn> };
    let userModel: { findById: ReturnType<typeof vi.fn> };
    let logger: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        vi.clearAllMocks();
        accommodationModel = { findById: vi.fn() };
        userModel = { findById: vi.fn() };
        logger = createLoggerMock();
    });

    describe('unresolvable branches', () => {
        it('returns null when the conversation is deleted or not found', async () => {
            const db = createFakeDb({ conversationRow: null });
            const schedule = makeSchedule();

            const result = await resolveNotification({
                schedule,
                db: db as never,
                accommodationModel: accommodationModel as never,
                userModel: userModel as never,
                logger: logger as never
            });

            expect(result).toBeNull();
            expect(logger.warn).toHaveBeenCalledWith(
                'Conversation not found or deleted — skipping schedule',
                expect.objectContaining({ scheduleId: SCHEDULE_ID })
            );
            expect(accommodationModel.findById).not.toHaveBeenCalled();
        });

        it('returns null when the accommodation is missing', async () => {
            const db = createFakeDb({
                conversationRow: {
                    id: CONVERSATION_ID,
                    accommodationId: ACCOMMODATION_ID,
                    userId: null,
                    anonymousEmail: null,
                    anonymousName: null,
                    locale: 'es'
                }
            });
            accommodationModel.findById.mockResolvedValue(null);
            const schedule = makeSchedule();

            const result = await resolveNotification({
                schedule,
                db: db as never,
                accommodationModel: accommodationModel as never,
                userModel: userModel as never,
                logger: logger as never
            });

            expect(result).toBeNull();
            expect(logger.warn).toHaveBeenCalledWith(
                'Accommodation not found for conversation',
                expect.objectContaining({ scheduleId: SCHEDULE_ID })
            );
        });

        it('returns null when an anonymous guest has no email', async () => {
            const db = createFakeDb({
                conversationRow: {
                    id: CONVERSATION_ID,
                    accommodationId: ACCOMMODATION_ID,
                    userId: null,
                    anonymousEmail: null,
                    anonymousName: null,
                    locale: 'es'
                }
            });
            accommodationModel.findById.mockResolvedValue({
                id: ACCOMMODATION_ID,
                name: 'Test Accommodation',
                slug: 'test-accommodation',
                ownerId: 'owner-1'
            });
            const schedule = makeSchedule({ recipientSide: NotificationRecipientSideEnum.GUEST });

            const result = await resolveNotification({
                schedule,
                db: db as never,
                accommodationModel: accommodationModel as never,
                userModel: userModel as never,
                logger: logger as never
            });

            expect(result).toBeNull();
            expect(logger.warn).toHaveBeenCalledWith(
                'Anonymous guest has no email — skipping schedule',
                expect.objectContaining({ scheduleId: SCHEDULE_ID })
            );
            expect(userModel.findById).not.toHaveBeenCalled();
        });

        it('returns null when the owner recipient has no ownerId', async () => {
            const db = createFakeDb({
                conversationRow: {
                    id: CONVERSATION_ID,
                    accommodationId: ACCOMMODATION_ID,
                    userId: null,
                    anonymousEmail: 'guest@example.com',
                    anonymousName: 'Guest',
                    locale: 'es'
                }
            });
            accommodationModel.findById.mockResolvedValue({
                id: ACCOMMODATION_ID,
                name: 'Test Accommodation',
                slug: 'test-accommodation',
                ownerId: null
            });
            const schedule = makeSchedule({ recipientSide: NotificationRecipientSideEnum.OWNER });

            const result = await resolveNotification({
                schedule,
                db: db as never,
                accommodationModel: accommodationModel as never,
                userModel: userModel as never,
                logger: logger as never
            });

            expect(result).toBeNull();
            expect(logger.warn).toHaveBeenCalledWith(
                'Accommodation has no ownerId — skipping schedule',
                expect.objectContaining({ scheduleId: SCHEDULE_ID })
            );
            expect(userModel.findById).not.toHaveBeenCalled();
        });

        it('returns null when no recipient email can be resolved (authenticated guest, user has no email)', async () => {
            const db = createFakeDb({
                conversationRow: {
                    id: CONVERSATION_ID,
                    accommodationId: ACCOMMODATION_ID,
                    userId: 'user-1',
                    anonymousEmail: null,
                    anonymousName: null,
                    locale: 'es'
                }
            });
            accommodationModel.findById.mockResolvedValue({
                id: ACCOMMODATION_ID,
                name: 'Test Accommodation',
                slug: 'test-accommodation',
                ownerId: 'owner-1'
            });
            userModel.findById.mockResolvedValue({
                id: 'user-1',
                email: null,
                displayName: 'Guest User'
            });
            const schedule = makeSchedule({ recipientSide: NotificationRecipientSideEnum.GUEST });

            const result = await resolveNotification({
                schedule,
                db: db as never,
                accommodationModel: accommodationModel as never,
                userModel: userModel as never,
                logger: logger as never
            });

            expect(result).toBeNull();
            expect(logger.warn).toHaveBeenCalledWith(
                'No recipient email resolved — skipping schedule',
                expect.objectContaining({ scheduleId: SCHEDULE_ID })
            );
        });
    });

    describe('happy paths', () => {
        it('resolves an authenticated guest recipient (renders ConversationNewMessage)', async () => {
            const db = createFakeDb({
                conversationRow: {
                    id: CONVERSATION_ID,
                    accommodationId: ACCOMMODATION_ID,
                    userId: 'user-1',
                    anonymousEmail: null,
                    anonymousName: null,
                    locale: 'es'
                },
                messageRows: [{ body: 'Hola', createdAt: new Date() }]
            });
            accommodationModel.findById.mockResolvedValue({
                id: ACCOMMODATION_ID,
                name: 'Test Accommodation',
                slug: 'test-accommodation',
                ownerId: 'owner-1'
            });
            userModel.findById.mockResolvedValue({
                id: 'user-1',
                email: 'guest@example.com',
                displayName: 'Guest User'
            });
            const schedule = makeSchedule({ recipientSide: NotificationRecipientSideEnum.GUEST });

            const result = await resolveNotification({
                schedule,
                db: db as never,
                accommodationModel: accommodationModel as never,
                userModel: userModel as never,
                logger: logger as never
            });

            expect(result).not.toBeNull();
            expect(result?.recipientEmail).toBe('guest@example.com');
            expect(result?.scheduleId).toBe(SCHEDULE_ID);
            expect(ConversationNewMessage).toHaveBeenCalled();
            expect(ConversationNewMessageAnon).not.toHaveBeenCalled();
        });

        it('resolves an anonymous guest recipient (renders ConversationNewMessageAnon)', async () => {
            const db = createFakeDb({
                conversationRow: {
                    id: CONVERSATION_ID,
                    accommodationId: ACCOMMODATION_ID,
                    userId: null,
                    anonymousEmail: 'anon@example.com',
                    anonymousName: 'Anon Guest',
                    locale: 'es'
                }
            });
            accommodationModel.findById.mockResolvedValue({
                id: ACCOMMODATION_ID,
                name: 'Test Accommodation',
                slug: 'test-accommodation',
                ownerId: 'owner-1'
            });
            const schedule = makeSchedule({ recipientSide: NotificationRecipientSideEnum.GUEST });

            const result = await resolveNotification({
                schedule,
                db: db as never,
                accommodationModel: accommodationModel as never,
                userModel: userModel as never,
                logger: logger as never
            });

            expect(result).not.toBeNull();
            expect(result?.recipientEmail).toBe('anon@example.com');
            expect(ConversationNewMessageAnon).toHaveBeenCalled();
            expect(ConversationNewMessage).not.toHaveBeenCalled();
            // Anonymous guests never trigger a user lookup.
            expect(userModel.findById).not.toHaveBeenCalled();
        });

        it('resolves an owner recipient (renders ConversationNewMessage)', async () => {
            const db = createFakeDb({
                conversationRow: {
                    id: CONVERSATION_ID,
                    accommodationId: ACCOMMODATION_ID,
                    userId: null,
                    anonymousEmail: 'guest@example.com',
                    anonymousName: 'Guest',
                    locale: 'es'
                }
            });
            accommodationModel.findById.mockResolvedValue({
                id: ACCOMMODATION_ID,
                name: 'Test Accommodation',
                slug: 'test-accommodation',
                ownerId: 'owner-1'
            });
            userModel.findById.mockResolvedValue({
                id: 'owner-1',
                email: 'owner@example.com',
                displayName: 'Owner Name'
            });
            const schedule = makeSchedule({ recipientSide: NotificationRecipientSideEnum.OWNER });

            const result = await resolveNotification({
                schedule,
                db: db as never,
                accommodationModel: accommodationModel as never,
                userModel: userModel as never,
                logger: logger as never
            });

            expect(result).not.toBeNull();
            expect(result?.recipientEmail).toBe('owner@example.com');
            expect(userModel.findById).toHaveBeenCalledWith('owner-1');
            expect(ConversationNewMessage).toHaveBeenCalled();
        });
    });
});
