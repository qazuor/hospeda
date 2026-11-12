/** Real database coverage for AI question dismissal and digest filtering. */

import { accommodations, aiConversations, aiMessages, and, eq, getDb } from '@repo/db';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
    isListingOwnedBy,
    listListingQuestions,
    setQuestionDismissed
} from '../../../src/services/ai-listing-questions.service';
import { purgeExpiredChatQuestions } from '../../../src/services/ai-listing-questions-retention';
import { readDigestRows } from '../../../src/services/ai-questions-digest.selection';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { createMockActorUser } from '../helpers/mock-actor';
import {
    type SeededOwnedAccommodation,
    seedOwnedAccommodation
} from '../helpers/seed-owned-accommodation';

const NOW = new Date('2026-11-10T12:00:00.000Z');

/** Seeds one chat conversation about the listing with the given turns. */
async function seedConversation(input: {
    readonly touristId: string;
    readonly listingId: string;
    readonly turns: ReadonlyArray<{
        readonly question: string;
        readonly answer: string | null;
        readonly at: Date;
        readonly status?: string | null;
    }>;
    readonly feature?: 'chat' | 'search';
    readonly createdAt?: Date;
}): Promise<{ readonly conversationId: string }> {
    const db = getDb();
    const [conversation] = await db
        .insert(aiConversations)
        .values({
            userId: input.touristId,
            feature: input.feature ?? 'chat',
            listingEntityType: input.feature === 'search' ? null : 'accommodation',
            listingEntityId: input.feature === 'search' ? null : input.listingId,
            createdAt: input.createdAt ?? input.turns[0]?.at ?? NOW
        })
        .returning({ id: aiConversations.id });
    const conversationId = conversation?.id as string;
    for (const turn of input.turns) {
        await db.insert(aiMessages).values({
            conversationId,
            role: 'user',
            content: turn.question,
            tokens: 0,
            createdAt: turn.at
        });
        if (turn.answer !== null)
            await db.insert(aiMessages).values({
                conversationId,
                role: 'assistant',
                content: turn.answer,
                provider: 'openai',
                tokens: 10,
                answerStatus: turn.status ?? null,
                createdAt: new Date(turn.at.getTime() + 1000)
            });
    }
    return { conversationId };
}

describe('HOS-2105 — AI question dismissal (real DB)', () => {
    let seeded: SeededOwnedAccommodation;
    let touristId: string;
    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        validateApiEnv();
    });
    beforeEach(async () => {
        seeded = await seedOwnedAccommodation({});
        touristId = (await createMockActorUser({ label: 'tourist' })).id;
    });
    afterEach(async () => {
        await testDb.clean();
    });
    afterAll(async () => {
        await testDb.teardown();
    });

    it('reports ownership only for the owner of a live listing', async () => {
        const other = await createMockActorUser({ label: 'stranger' });

        const asOwner = await isListingOwnedBy({
            entityType: 'accommodation',
            entityId: seeded.id,
            userId: seeded.ownerId
        });
        const asStranger = await isListingOwnedBy({
            entityType: 'accommodation',
            entityId: seeded.id,
            userId: other.id
        });
        await getDb()
            .update(accommodations)
            .set({ deletedAt: NOW })
            .where(eq(accommodations.id, seeded.id));
        const afterDelete = await isListingOwnedBy({
            entityType: 'accommodation',
            entityId: seeded.id,
            userId: seeded.ownerId
        });

        expect([asOwner.owned, asStranger.owned, afterDelete.owned]).toEqual([true, false, false]);
    });

    it('purges only chat rows older than the retention horizon', async () => {
        // Arrange
        await seedConversation({
            touristId,
            listingId: seeded.id,
            turns: [{ question: 'Vieja', answer: 'Resp', at: new Date('2025-10-01T10:00:00.000Z') }]
        });
        const recent = await seedConversation({
            touristId,
            listingId: seeded.id,
            turns: [{ question: 'Nueva', answer: 'Resp', at: new Date('2026-11-01T10:00:00.000Z') }]
        });

        // Act
        const result = await purgeExpiredChatQuestions({ now: NOW });

        // Assert
        expect(result.deletedMessages).toBe(2);
        expect(result.deletedConversations).toBe(1);
        const left = await getDb().select({ id: aiConversations.id }).from(aiConversations);
        expect(left.map((row) => row.id)).toEqual([recent.conversationId]);
    });

    it('purges in batches and never touches an old search conversation', async () => {
        // Arrange: 3 old chat conversations, 1 old search conversation.
        const old = new Date('2025-09-01T10:00:00.000Z');
        for (const n of [1, 2, 3]) {
            await seedConversation({
                touristId,
                listingId: seeded.id,
                turns: [{ question: `chat${n}`, answer: 'Resp', at: old }]
            });
        }
        const search = await seedConversation({
            touristId,
            listingId: seeded.id,
            feature: 'search',
            turns: [{ question: 'busco cabaña', answer: 'Mirá estas', at: old }]
        });

        // Act: batches of 2 force several statements per table.
        const result = await purgeExpiredChatQuestions({ now: NOW, batchSize: 2 });

        // Assert
        expect(result.deletedMessages).toBe(6);
        expect(result.deletedConversations).toBe(3);
        const conversations = await getDb()
            .select({ id: aiConversations.id })
            .from(aiConversations);
        expect(conversations.map((row) => row.id)).toEqual([search.conversationId]);
        const messages = await getDb()
            .select({ id: aiMessages.id })
            .from(aiMessages)
            .where(eq(aiMessages.conversationId, search.conversationId));
        expect(messages).toHaveLength(2);
    });

    it('dismisses idempotently, removes an unanswered question from active counts, and restores it', async () => {
        const { conversationId } = await seedConversation({
            touristId,
            listingId: seeded.id,
            turns: [
                {
                    question: '¿Mascotas?',
                    answer: 'No sé.',
                    at: new Date('2026-11-01T10:00:00Z'),
                    status: 'unanswered'
                }
            ]
        });
        const [question] = await getDb()
            .select({ id: aiMessages.id })
            .from(aiMessages)
            .where(and(eq(aiMessages.conversationId, conversationId), eq(aiMessages.role, 'user')));
        const messageId = question?.id as string;
        const first = await setQuestionDismissed({
            messageId,
            userId: seeded.ownerId,
            dismissed: true
        });
        const repeated = await setQuestionDismissed({
            messageId,
            userId: seeded.ownerId,
            dismissed: true
        });
        const dismissed = await listListingQuestions({
            entityType: 'accommodation',
            entityId: seeded.id,
            now: NOW
        });
        expect(first).not.toBeNull();
        expect(repeated).not.toBeNull();
        expect(first?.ownerDismissedAt).toEqual(repeated?.ownerDismissedAt);
        expect(dismissed.unansweredCount).toBe(0);
        expect(dismissed.dismissedCount).toBe(1);
        expect(dismissed.dismissed[0]?.id).toBe(messageId);
        await setQuestionDismissed({ messageId, userId: seeded.ownerId, dismissed: false });
        const restored = await listListingQuestions({
            entityType: 'accommodation',
            entityId: seeded.id,
            now: NOW
        });
        expect(restored.unansweredCount).toBe(1);
        expect(restored.dismissedCount).toBe(0);
    });

    it('excludes dismissed unanswered questions from the weekly digest while retaining active questions', async () => {
        const { conversationId } = await seedConversation({
            touristId,
            listingId: seeded.id,
            turns: [
                {
                    question: 'Descartada',
                    answer: 'No sé.',
                    at: new Date('2026-11-08T10:00:00Z'),
                    status: 'unanswered'
                },
                {
                    question: 'Activa',
                    answer: 'No sé.',
                    at: new Date('2026-11-09T10:00:00Z'),
                    status: 'unanswered'
                }
            ]
        });
        const questions = await getDb()
            .select({ id: aiMessages.id, content: aiMessages.content })
            .from(aiMessages)
            .where(and(eq(aiMessages.conversationId, conversationId), eq(aiMessages.role, 'user')));
        const dismissed = questions.find((item) => item.content === 'Descartada');
        await setQuestionDismissed({
            messageId: dismissed?.id as string,
            userId: seeded.ownerId,
            dismissed: true
        });
        const digest = await readDigestRows({
            windowStart: new Date('2026-11-08T00:00:00Z'),
            windowEnd: new Date('2026-11-10T00:00:00Z')
        });
        expect(digest.rows.map((row) => row.question)).toContain('Activa');
        expect(digest.rows.map((row) => row.question)).not.toContain('Descartada');
    });

    it('does not dismiss or undo a message on another owner’s listing', async () => {
        const foreign = await seedOwnedAccommodation({});
        const { conversationId } = await seedConversation({
            touristId,
            listingId: foreign.id,
            turns: [
                {
                    question: 'Foreign question',
                    answer: 'Answer',
                    at: new Date('2026-11-01T10:00:00Z'),
                    status: 'unanswered'
                }
            ]
        });
        const [question] = await getDb()
            .select({ id: aiMessages.id, ownerDismissedAt: aiMessages.ownerDismissedAt })
            .from(aiMessages)
            .where(and(eq(aiMessages.conversationId, conversationId), eq(aiMessages.role, 'user')));
        expect(question).toBeDefined();
        const dismiss = await setQuestionDismissed({
            messageId: question!.id,
            userId: seeded.ownerId,
            dismissed: true
        });
        expect(dismiss).toBeNull();
        const [afterDismiss] = await getDb()
            .select({ ownerDismissedAt: aiMessages.ownerDismissedAt })
            .from(aiMessages)
            .where(eq(aiMessages.id, question!.id));
        expect(afterDismiss?.ownerDismissedAt).toBeNull();

        await getDb()
            .update(aiMessages)
            .set({ ownerDismissedAt: NOW })
            .where(eq(aiMessages.id, question!.id));
        const undo = await setQuestionDismissed({
            messageId: question!.id,
            userId: seeded.ownerId,
            dismissed: false
        });
        expect(undo).toBeNull();
        const [afterUndo] = await getDb()
            .select({ ownerDismissedAt: aiMessages.ownerDismissedAt })
            .from(aiMessages)
            .where(eq(aiMessages.id, question!.id));
        expect(afterUndo?.ownerDismissedAt).toEqual(NOW);
    });
});
