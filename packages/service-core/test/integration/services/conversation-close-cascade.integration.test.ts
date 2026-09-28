/**
 * HOS-1383 — the accommodation-delete conversation cascade, against a real
 * PostgreSQL database.
 *
 * Two properties are asserted here that a mocked query builder cannot see:
 *
 *  1. `ConversationService.closeAllForAccommodation` closes only conversations
 *     that are still open. BLOCKED is terminal in the conversation state
 *     machine, while CLOSED → OPEN / PENDING_OWNER is allowed. So writing
 *     CLOSED over a BLOCKED row would let a delete + restore un-block a
 *     blocked guest. An already-CLOSED row must also keep its original
 *     `closed_at`. Notification schedules are cancelled only for the rows
 *     this call actually closed.
 *  2. When the caller passes its own transaction, a failing cascade must not
 *     abort it. Postgres marks the whole transaction as aborted after any
 *     failed statement, so the cascade has to run inside a savepoint for the
 *     "non-blocking" promise to hold.
 */
import {
    conversationNotificationSchedules,
    conversations,
    type DrizzleClient,
    eq,
    inArray,
    sql
} from '@repo/db';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { ConversationService } from '../../../src/services/conversation/conversation.service';
import { createSuperAdminActor } from '../../factories/actorFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedAccommodation,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();

const ORIGINAL_CLOSED_AT = new Date('2026-01-15T10:00:00.000Z');
const ORIGINAL_BLOCKED_AT = new Date('2026-02-20T10:00:00.000Z');

type ConversationStatus = 'PENDING_VERIFICATION' | 'PENDING_OWNER' | 'OPEN' | 'CLOSED' | 'BLOCKED';

/** Inserts one conversation (plus one active notification schedule) and returns its id. */
const seedConversation = async ({
    tx,
    accommodationId,
    status
}: {
    readonly tx: DrizzleClient;
    readonly accommodationId: string;
    readonly status: ConversationStatus;
}): Promise<string> => {
    const [row] = await tx
        .insert(conversations)
        .values({
            accommodationId,
            anonymousName: `Guest ${status}`,
            anonymousEmail: `guest-${status.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}@example.com`,
            status,
            closedAt: status === 'CLOSED' ? ORIGINAL_CLOSED_AT : null,
            blockedAt: status === 'BLOCKED' ? ORIGINAL_BLOCKED_AT : null
        })
        .returning({ id: conversations.id });
    if (!row) throw new Error('conversation insert returned no row');

    await tx.insert(conversationNotificationSchedules).values({
        conversationId: row.id,
        recipientSide: 'OWNER',
        pendingNotificationAt: new Date(),
        streakStartedAt: new Date()
    });
    return row.id;
};

describe('HOS-1383 — conversation close cascade (real DB)', () => {
    let conversationService: ConversationService;

    beforeAll(() => {
        if (!dbAvailable) return;
        getServiceTestDb();
        conversationService = new ConversationService(
            { logger: createLoggerMock() },
            {
                authSecret: 'integration-test-secret-at-least-32-characters-long',
                siteUrl: ''
            }
        );
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await closeServiceTestPool();
    });

    it.skipIf(!dbAvailable)(
        'closes only open conversations: BLOCKED stays BLOCKED and CLOSED keeps its closed_at',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const { accommodationId } = await seedAccommodation(tx);
                const openId = await seedConversation({ tx, accommodationId, status: 'OPEN' });
                const pendingId = await seedConversation({
                    tx,
                    accommodationId,
                    status: 'PENDING_OWNER'
                });
                const blockedId = await seedConversation({
                    tx,
                    accommodationId,
                    status: 'BLOCKED'
                });
                const closedId = await seedConversation({ tx, accommodationId, status: 'CLOSED' });

                // Act
                const count = await conversationService.closeAllForAccommodation(
                    accommodationId,
                    tx
                );

                // Assert
                expect(count).toBe(2);
                const rows = await tx
                    .select({
                        id: conversations.id,
                        status: conversations.status,
                        closedAt: conversations.closedAt,
                        blockedAt: conversations.blockedAt
                    })
                    .from(conversations)
                    .where(eq(conversations.accommodationId, accommodationId));
                const byId = new Map(rows.map((r) => [r.id, r]));

                expect(byId.get(openId)?.status).toBe('CLOSED');
                expect(byId.get(openId)?.closedAt).not.toBeNull();
                expect(byId.get(pendingId)?.status).toBe('CLOSED');
                expect(byId.get(pendingId)?.closedAt).not.toBeNull();

                expect(byId.get(blockedId)?.status).toBe('BLOCKED');
                expect(byId.get(blockedId)?.closedAt).toBeNull();
                expect(byId.get(blockedId)?.blockedAt?.toISOString()).toBe(
                    ORIGINAL_BLOCKED_AT.toISOString()
                );

                expect(byId.get(closedId)?.status).toBe('CLOSED');
                expect(byId.get(closedId)?.closedAt?.toISOString()).toBe(
                    ORIGINAL_CLOSED_AT.toISOString()
                );

                // Schedules: cancelled only for the two rows this call closed.
                const schedules = await tx
                    .select({
                        conversationId: conversationNotificationSchedules.conversationId,
                        cancelledAt: conversationNotificationSchedules.cancelledAt
                    })
                    .from(conversationNotificationSchedules)
                    .where(
                        inArray(conversationNotificationSchedules.conversationId, [
                            openId,
                            pendingId,
                            blockedId,
                            closedId
                        ])
                    );
                const cancelled = schedules
                    .filter((s) => s.cancelledAt !== null)
                    .map((s) => s.conversationId)
                    .sort();
                expect(cancelled).toEqual([openId, pendingId].sort());
            });
        }
    );

    it.skipIf(!dbAvailable)(
        "a failing cascade does not abort the caller's transaction",
        async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const { accommodationId, userId } = await seedAccommodation(tx);
                const logger = createLoggerMock();
                const accommodationService = new AccommodationService({ logger });
                // Make the cascade run a statement Postgres rejects, then
                // throw, the way a real mid-cascade failure would.
                const conversationServiceField = accommodationService as unknown as {
                    conversationService: {
                        closeAllForAccommodation: (
                            id: string,
                            tx: DrizzleClient
                        ) => Promise<number>;
                    };
                };
                vi.spyOn(
                    conversationServiceField.conversationService,
                    'closeAllForAccommodation'
                ).mockImplementation(async (_id, innerTx) => {
                    await innerTx.execute(sql`select 1 / 0`);
                    return 0;
                });

                // Act
                const result = await accommodationService.softDelete(
                    createSuperAdminActor({ id: userId }),
                    accommodationId,
                    { tx }
                );

                // Assert: the delete succeeded, the failure was logged, and the
                // caller's transaction is still usable afterwards.
                expect(result.error).toBeUndefined();
                expect(result.data?.count).toBe(1);
                expect(logger.warn).toHaveBeenCalledWith(
                    expect.objectContaining({ accommodationId }),
                    'closeAllForAccommodation failed (non-blocking)'
                );
                const probe = await tx.execute(sql`select 1 as ok`);
                expect(probe.rows?.[0]).toEqual({ ok: 1 });
            });
        }
    );
});
