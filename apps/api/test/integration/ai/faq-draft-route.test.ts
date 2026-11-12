/** Real FAQ draft route, service and database coverage; only the AI provider is a stub. */

process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
process.env.HOSPEDA_AI_VAULT_MASTER_KEY = 'test-vault-master-key-for-integration-tests-32chr';

import { getMonthlyCallCount, invalidateConfigCache } from '@repo/ai-core';
import {
    aiConversations,
    aiMessages,
    aiSettings,
    aiUsage,
    eq,
    getDb,
    planVersionLimits,
    trials
} from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { createMockActorUser } from '../helpers/mock-actor';
import { seedOwnedAccommodation } from '../helpers/seed-owned-accommodation';

const BASE = '/api/v1/protected/ai/listing-questions';
const app = initApp();

async function requestHeaders(actorId: string): Promise<Record<string, string>> {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': actorId,
        'x-mock-actor-role': RoleEnum.USER,
        'x-mock-actor-permissions': '[]'
    };
}

describe('HOS-2105 FAQ draft route (real DB)', () => {
    let ownerId: string;
    let touristId: string;
    let listingId: string;
    let conversationId: string;
    let unansweredId: string;
    let answeredId: string;

    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
    });

    beforeEach(async () => {
        await testDb.clean();
        const owned = await seedOwnedAccommodation({});
        ownerId = owned.ownerId;
        listingId = owned.id;
        touristId = (await createMockActorUser({ label: 'faq-tourist' })).id;
        const db = getDb();
        const [conversation] = await db
            .insert(aiConversations)
            .values({
                userId: touristId,
                feature: 'chat',
                listingEntityType: 'accommodation',
                listingEntityId: listingId
            })
            .returning({ id: aiConversations.id });
        conversationId = conversation?.id as string;
        const questionAt = new Date('2026-11-10T10:00:00.000Z');
        const [unanswered] = await db
            .insert(aiMessages)
            .values({
                conversationId,
                role: 'user',
                content: '¿Hay estacionamiento?',
                tokens: 0,
                createdAt: questionAt
            })
            .returning({ id: aiMessages.id });
        unansweredId = unanswered?.id as string;
        await db.insert(aiMessages).values({
            conversationId,
            role: 'assistant',
            content: 'No aparece en la ficha.',
            tokens: 1,
            answerStatus: 'unanswered',
            provider: 'stub',
            createdAt: new Date(questionAt.getTime() + 1000)
        });
        const [answeredQuestion] = await db
            .insert(aiMessages)
            .values({
                conversationId,
                role: 'user',
                content: '¿Aceptan mascotas?',
                tokens: 0,
                createdAt: new Date(questionAt.getTime() + 2000)
            })
            .returning({ id: aiMessages.id });
        answeredId = answeredQuestion?.id as string;
        await db.insert(aiMessages).values({
            conversationId,
            role: 'assistant',
            content: 'Sí.',
            tokens: 1,
            answerStatus: 'answered',
            provider: 'stub',
            createdAt: new Date(questionAt.getTime() + 3000)
        });
        await db.insert(aiSettings).values({
            key: 'global',
            updatedBy: ownerId,
            value: {
                providers: { stub: { enabled: true } },
                features: Object.fromEntries(
                    [
                        'chat',
                        'chat_venue',
                        'chat_experience',
                        'text_improve',
                        'search',
                        'support',
                        'translate',
                        'accommodation_import',
                        'post_generate',
                        'faq_draft'
                    ].map((key) => [
                        key,
                        {
                            enabled: true,
                            primaryProvider: 'stub',
                            fallbackChain: [],
                            model: 'stub-model',
                            params: {}
                        }
                    ])
                ),
                costCeilings: { globalMonthlyMicroUsd: 100000000 }
            },
            createdAt: new Date(),
            updatedAt: new Date()
        });
        invalidateConfigCache();
    });

    afterEach(async () => {
        invalidateConfigCache();
        await testDb.clean();
    });

    afterAll(async () => testDb.teardown());

    it('bounds answer pairing by the next user turn and meters an eligible draft to the owner', async () => {
        // Arrange
        await getDb().insert(aiUsage).values({
            userId: ownerId,
            consumerUserId: touristId,
            feature: 'chat',
            provider: 'stub',
            model: 'stub-model',
            tokensIn: 3,
            tokensOut: 2,
            costEstimateMicroUsd: 0,
            latencyMs: 1,
            status: 'success'
        });
        const before = await Promise.all(
            [ownerId, touristId].map((userId) =>
                getMonthlyCallCount({ userId, feature: 'chat', now: new Date() })
            )
        );

        // Act
        const response = await app.request(`${BASE}/${unansweredId}/faq-draft`, {
            method: 'POST',
            headers: await requestHeaders(ownerId)
        });
        const answered = await app.request(`${BASE}/${answeredId}/faq-draft`, {
            method: 'POST',
            headers: await requestHeaders(ownerId)
        });

        // Assert
        expect(response.status, await response.clone().text()).toBe(200);
        expect(answered.status).toBe(409);
        expect((await answered.json()).error.code).toBe('FAQ_DRAFT_NOT_ELIGIBLE');
        const usage = await getDb().select().from(aiUsage);
        expect(usage).toHaveLength(2);
        expect(usage.at(-1)).toMatchObject({
            feature: 'faq_draft',
            userId: ownerId,
            consumerUserId: null
        });
        const after = await Promise.all(
            [ownerId, touristId].map((userId) =>
                getMonthlyCallCount({ userId, feature: 'chat', now: new Date() })
            )
        );
        expect(after).toEqual(before);
        expect(listingId).toBeTruthy();
    });

    it('returns the same anonymous 404 for a foreign and nonexistent message', async () => {
        const foreignOwner = (await createMockActorUser({ label: 'faq-foreign' })).id;
        const headers = await requestHeaders(foreignOwner);
        const foreign = await app.request(`${BASE}/${unansweredId}/faq-draft`, {
            method: 'POST',
            headers
        });
        const missingId = crypto.randomUUID();
        const missing = await app.request(`${BASE}/${missingId}/faq-draft`, {
            method: 'POST',
            headers
        });
        const normalize = async (response: Response) => {
            const body = await response.json();
            delete body.metadata.requestId;
            delete body.metadata.timestamp;
            return body;
        };
        expect(foreign.status).toBe(404);
        expect(missing.status).toBe(404);
        expect(await normalize(foreign)).toEqual(await normalize(missing));
    });

    it('rejects anonymous and malformed requests before reading the message', async () => {
        const anonymous = await app.request(`${BASE}/${unansweredId}/faq-draft`, {
            method: 'POST',
            headers: { 'user-agent': 'vitest' }
        });
        const malformed = await app.request(`${BASE}/not-a-uuid/faq-draft`, {
            method: 'POST',
            headers: await requestHeaders(ownerId)
        });
        expect(anonymous.status).toBe(401);
        expect(malformed.status).toBe(400);
    });

    it('returns the plan quota error when the owner has a zero FAQ draft limit', async () => {
        const db = getDb();
        const [trial] = await db
            .select({ limitsVersionId: trials.floorLimitsVersionId })
            .from(trials)
            .where(eq(trials.userId, ownerId))
            .limit(1);
        if (!trial?.limitsVersionId)
            throw new Error('seedOwnedAccommodation did not create an owner trial limit version');
        await db
            .insert(planVersionLimits)
            .values({
                planVersionId: trial.limitsVersionId,
                key: 'max_ai_faq_draft_per_month',
                value: 0
            })
            .onConflictDoUpdate({
                target: [planVersionLimits.planVersionId, planVersionLimits.key],
                set: { value: 0 }
            });

        const response = await app.request(`${BASE}/${unansweredId}/faq-draft`, {
            method: 'POST',
            headers: await requestHeaders(ownerId)
        });

        expect(response.status).toBe(403);
        expect((await response.json()).error.code).toBe('LIMIT_REACHED');
    });
});
