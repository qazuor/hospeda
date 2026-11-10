/**
 * HOS-2101 against a real database: the SQL of the host AI questions panel,
 * the retention purge, and the classifier's metering.
 *
 * - `listListingQuestions` pairs each question with its answer, newest first,
 *   counts unanswered over the whole horizon and never returns tourist data.
 * - `isListingOwnedBy` is false for a foreign or soft-deleted listing.
 * - `purgeExpiredChatQuestions` deletes only chat rows older than 12 months.
 * - A classified turn writes exactly ONE classifier `ai_usage` row and leaves
 *   every chat quota count unchanged (security review of the classifier).
 */

import { getMonthlyCallCount } from '@repo/ai-core';
import { accommodations, aiConversations, aiMessages, aiUsage, eq, getDb } from '@repo/db';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
    CHAT_ANSWER_CLASSIFIER_USAGE_FEATURE,
    type ClassifyChatAnswerDeps,
    classifyChatAnswer,
    recordClassifierUsage,
    writeClassifierVerdict
} from '../../../src/services/ai-chat-answer-classifier';
import { persistChatTurn } from '../../../src/services/ai-chat-persistence';
import {
    isListingOwnedBy,
    listListingQuestions
} from '../../../src/services/ai-listing-questions.service';
import { purgeExpiredChatQuestions } from '../../../src/services/ai-listing-questions-retention';
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
    readonly createdAt?: Date;
    /** `'search'` seeds a listing-less search conversation. */
    readonly feature?: 'chat' | 'search';
}): Promise<{ readonly conversationId: string; readonly assistantIds: readonly string[] }> {
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
    const assistantIds: string[] = [];
    for (const turn of input.turns) {
        await db.insert(aiMessages).values({
            conversationId,
            role: 'user',
            content: turn.question,
            tokens: 0,
            createdAt: turn.at
        });
        if (turn.answer !== null) {
            const [assistant] = await db
                .insert(aiMessages)
                .values({
                    conversationId,
                    role: 'assistant',
                    content: turn.answer,
                    provider: 'openai',
                    tokens: 10,
                    answerStatus: turn.status ?? null,
                    createdAt: new Date(turn.at.getTime() + 1000)
                })
                .returning({ id: aiMessages.id });
            assistantIds.push(assistant?.id as string);
        }
    }
    return { conversationId, assistantIds };
}

describe('HOS-2101 — AI listing questions (real DB)', () => {
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

    it('lists paired questions newest first, anonymously, with exact counts', async () => {
        // Arrange
        await seedConversation({
            touristId,
            listingId: seeded.id,
            turns: [
                {
                    question: '¿Aceptan mascotas?',
                    answer: 'No figura en la ficha.',
                    at: new Date('2026-11-01T10:00:00.000Z'),
                    status: 'unanswered'
                },
                {
                    question: '¿Hay wifi?',
                    answer: 'Sí, hay wifi.',
                    at: new Date('2026-11-02T10:00:00.000Z'),
                    status: 'answered'
                },
                {
                    question: '¿Tiene pileta?',
                    answer: 'Sí.',
                    at: new Date('2026-11-03T10:00:00.000Z')
                },
                // The answer insert failed: the question is dropped.
                { question: 'Huérfana', answer: null, at: new Date('2026-11-04T10:00:00.000Z') }
            ]
        });
        // Outside the 12-month horizon.
        await seedConversation({
            touristId,
            listingId: seeded.id,
            turns: [
                {
                    question: 'Vieja',
                    answer: 'No sé.',
                    at: new Date('2025-10-01T10:00:00.000Z'),
                    status: 'unanswered'
                }
            ]
        });

        // Act
        const response = await listListingQuestions({
            entityType: 'accommodation',
            entityId: seeded.id,
            now: NOW
        });

        // Assert
        expect(response.total).toBe(3);
        expect(response.unansweredCount).toBe(1);
        expect(response.truncated).toBe(false);
        expect(
            response.items.map((item) => [item.question, item.answer, item.answerStatus])
        ).toEqual([
            // Unanswered block first, then the rest; each newest first.
            ['¿Aceptan mascotas?', 'No figura en la ficha.', 'unanswered'],
            ['¿Tiene pileta?', 'Sí.', 'unclassified'],
            ['¿Hay wifi?', 'Sí, hay wifi.', 'answered']
        ]);
        expect(JSON.stringify(response)).not.toContain(touristId);
    });

    it('lists every unanswered question up to its cap, however many answered ones are newer', async () => {
        // Arrange: 3 old unanswered, then 5 newer answered.
        const day = (n: number) => new Date(Date.UTC(2026, 9, n, 10));
        await seedConversation({
            touristId,
            listingId: seeded.id,
            turns: [
                ...[1, 2, 3].map((n) => ({
                    question: `u${n}`,
                    answer: 'No sé.',
                    at: day(n),
                    status: 'unanswered'
                })),
                ...[4, 5, 6, 7, 8].map((n) => ({
                    question: `a${n}`,
                    answer: 'Sí.',
                    at: day(n),
                    status: 'answered'
                }))
            ]
        });

        // Act: room for 2 answered only.
        const fits = await listListingQuestions({
            entityType: 'accommodation',
            entityId: seeded.id,
            now: NOW,
            othersCap: 2
        });
        const capped = await listListingQuestions({
            entityType: 'accommodation',
            entityId: seeded.id,
            now: NOW,
            unansweredCap: 2,
            othersCap: 10
        });

        // Assert: all 3 unanswered survive the answered cap.
        expect(fits.items.map((item) => item.question)).toEqual(['u3', 'u2', 'u1', 'a8', 'a7']);
        expect(fits.unansweredCount).toBe(3);
        expect(fits.total).toBe(8);
        expect(fits.truncated).toBe(true);
        // The unanswered cap truncates honestly: the count stays exact.
        expect(capped.items.filter((item) => item.answerStatus === 'unanswered')).toHaveLength(2);
        expect(capped.unansweredCount).toBe(3);
        expect(capped.truncated).toBe(true);
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

    it('never appends a turn to a conversation that is not this user, feature and listing', async () => {
        // Arrange: listing A (seeded) has the tourist's conversation; listing B is another one.
        const listingB = await seedOwnedAccommodation({});
        const stranger = await createMockActorUser({ label: 'stranger' });
        const onA = await seedConversation({
            touristId,
            listingId: seeded.id,
            turns: [{ question: 'En A', answer: 'Resp', at: new Date('2026-11-01T10:00:00.000Z') }]
        });
        const search = await seedConversation({
            touristId,
            listingId: seeded.id,
            feature: 'search',
            turns: [{ question: 'busco', answer: 'Resp', at: new Date('2026-11-01T10:00:00.000Z') }]
        });
        const meta = {
            usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
            provider: 'openai',
            model: 'gpt-4o-mini',
            finishReason: 'stop'
        } as const;
        const turn = (overrides: { userId: string; entityId: string; conversationId: string }) =>
            persistChatTurn({
                entityType: 'accommodation',
                userMessage: 'intruso',
                assistantMessage: 'Resp',
                meta,
                ...overrides
            });

        // Act
        const onB = await turn({
            userId: touristId,
            entityId: listingB.id,
            conversationId: onA.conversationId
        });
        const byStranger = await turn({
            userId: stranger.id,
            entityId: seeded.id,
            conversationId: onA.conversationId
        });
        const fromSearch = await turn({
            userId: touristId,
            entityId: seeded.id,
            conversationId: search.conversationId
        });
        const legit = await turn({
            userId: touristId,
            entityId: seeded.id,
            conversationId: onA.conversationId
        });

        // Assert: three new conversations, one legit append.
        const fresh = [onB, byStranger, fromSearch].map((out) => out.conversationId);
        expect(new Set([...fresh, onA.conversationId, search.conversationId]).size).toBe(5);
        expect(legit.conversationId).toBe(onA.conversationId);
        const listedA = await listListingQuestions({
            entityType: 'accommodation',
            entityId: seeded.id,
            now: NOW
        });
        const listedB = await listListingQuestions({
            entityType: 'accommodation',
            entityId: listingB.id,
            now: NOW
        });
        // A: its own question, the legit append, the stranger's and the search-reuse
        // turn (both now in fresh conversations about A). B: only the B turn.
        expect(listedA.total).toBe(4);
        expect(listedB.total).toBe(1);
        const searchMessages = await getDb()
            .select({ id: aiMessages.id })
            .from(aiMessages)
            .where(eq(aiMessages.conversationId, search.conversationId));
        expect(searchMessages).toHaveLength(2);
    });

    it('meters a classified turn once and leaves every chat quota count unchanged', async () => {
        // Arrange: one real chat usage row (owner pays, tourist consumes).
        const db = getDb();
        await db.insert(aiUsage).values({
            userId: seeded.ownerId,
            consumerUserId: touristId,
            feature: 'chat',
            provider: 'openai',
            model: 'gpt-5.4-nano',
            tokensIn: 100,
            tokensOut: 20,
            costEstimateMicroUsd: 50,
            latencyMs: 100,
            status: 'success'
        });
        const { assistantIds } = await seedConversation({
            touristId,
            listingId: seeded.id,
            turns: [{ question: '¿Mascotas?', answer: 'No figura.', at: new Date() }]
        });
        const counts = async () => ({
            owner: await getMonthlyCallCount({
                userId: seeded.ownerId,
                feature: 'chat',
                now: new Date()
            }),
            consumer: await getMonthlyCallCount({
                userId: touristId,
                feature: 'chat',
                now: new Date(),
                keyedBy: 'consumer'
            })
        });
        const before = await counts();
        const deps: ClassifyChatAnswerDeps = {
            createAiService: async () => ({
                generateText: async () => ({
                    text: 'UNANSWERED',
                    usage: { promptTokens: 120, completionTokens: 2, totalTokens: 122 },
                    provider: 'openai',
                    model: 'gpt-5.4-nano',
                    finishReason: 'stop'
                })
            }),
            recordUsage: recordClassifierUsage,
            writeVerdict: writeClassifierVerdict
        };

        // Act
        const result = await classifyChatAnswer({
            assistantMessageId: assistantIds[0] as string,
            question: '¿Mascotas?',
            answer: 'No figura.',
            feature: 'chat',
            locale: 'es',
            deps
        });

        // Assert
        expect(result.verdict).toBe('unanswered');
        const classifierRows = await db
            .select({ userId: aiUsage.userId, consumerUserId: aiUsage.consumerUserId })
            .from(aiUsage)
            .where(eq(aiUsage.feature, CHAT_ANSWER_CLASSIFIER_USAGE_FEATURE));
        expect(classifierRows).toEqual([{ userId: null, consumerUserId: null }]);
        expect(await counts()).toEqual(before);
        expect(before).toEqual({ owner: 1, consumer: 1 });
        const [message] = await db
            .select({ answerStatus: aiMessages.answerStatus })
            .from(aiMessages)
            .where(eq(aiMessages.id, assistantIds[0] as string));
        expect(message?.answerStatus).toBe('unanswered');
    });
});
