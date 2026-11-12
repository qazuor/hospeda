/**
 * GET /api/v1/protected/ai/listing-questions (HOS-2101).
 *
 * Refusal order and anonymity, through the real app:
 * - no session → 401 (and the service is never reached);
 * - non-UUID id / unknown vertical → 400 before any read;
 * - missing or foreign listing → 404, never 403;
 * - owner → 200 with EXACT keys, no tourist data.
 *
 * The service is mocked; its SQL is covered against a real database in
 * `test/integration/ai/listing-questions.test.ts`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockIsOwned,
    mockList,
    mockSetDismissed,
    mockReadDraft,
    mockGenerateDraft,
    mockEnforceQuota,
    mockMeter
} = vi.hoisted(() => ({
    mockIsOwned: vi.fn(),
    mockList: vi.fn(),
    mockSetDismissed: vi.fn(),
    mockReadDraft: vi.fn(),
    mockGenerateDraft: vi.fn(),
    mockEnforceQuota: vi.fn(),
    mockMeter: vi.fn()
}));

// The global setup swaps `ServiceError` for a test double the error handler
// does not recognise (it answers 500). This route's 404 IS the subject, so the
// real class is restored here.
vi.mock('@repo/service-core', async () => vi.importActual('@repo/service-core'));

vi.mock('../../src/services/ai-listing-questions.service.js', () => ({
    isListingOwnedBy: mockIsOwned,
    listListingQuestions: mockList,
    setQuestionDismissed: mockSetDismissed
}));
vi.mock('../../src/services/ai-faq-draft.service.js', () => ({
    readFaqDraftQuestion: mockReadDraft,
    generateFaqDraft: mockGenerateDraft
}));
vi.mock('../../src/utils/listing-access/ai-quota-gate.js', () => ({
    enforceAiQuota: mockEnforceQuota
}));
vi.mock('../../src/utils/ai-usage-metering.js', () => ({ meterAiUsage: mockMeter }));
vi.mock('../../src/utils/listing-access/ports.js', () => ({
    getListingAccessPorts: () => ({ effectiveSet: vi.fn().mockResolvedValue({}) })
}));

import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LISTING_ID = '11111111-1111-4111-8111-111111111111';
const BASE = '/api/v1/protected/ai/listing-questions';
const MESSAGE_ID = '22222222-2222-4222-8222-222222222222';

/** The app's route-test actor convention (see add-featured-media test). */
const AUTH_HEADERS = {
    'user-agent': 'vitest',
    'x-mock-actor-id': ACTOR_ID,
    'x-mock-actor-role': 'HOST',
    'x-mock-actor-permissions': JSON.stringify(['accommodation.update.own'])
};

const ITEM = {
    id: '22222222-2222-4222-8222-222222222222',
    question: '¿Aceptan mascotas?',
    answer: 'Ese dato no está en la ficha.',
    askedAt: '2026-11-09T12:00:00.000Z',
    answerStatus: 'unanswered'
} as const;

describe('GET /protected/ai/listing-questions', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();
        mockIsOwned.mockResolvedValue({ owned: true });
        mockList.mockResolvedValue({
            items: [ITEM],
            total: 1,
            unansweredCount: 1,
            truncated: false,
            othersNextCursor: null,
            dismissed: [],
            dismissedCount: 0
        });
        mockSetDismissed.mockResolvedValue({ ownerDismissedAt: new Date('2026-11-10T12:00:00Z') });
        mockReadDraft.mockResolvedValue({
            messageId: MESSAGE_ID,
            ownerId: ACTOR_ID,
            businessLines: [],
            entityType: 'accommodation',
            entityId: LISTING_ID,
            question: '¿Hay Wi-Fi?',
            answerStatus: 'unanswered'
        });
        mockEnforceQuota.mockResolvedValue(undefined);
        mockGenerateDraft.mockResolvedValue({
            response: { messageId: MESSAGE_ID, hasData: true, draft: 'Sí, hay Wi-Fi.' },
            usage: {
                provider: 'stub',
                model: 'test',
                promptTokens: 8,
                completionTokens: 4,
                latencyMs: 2
            }
        });
    });

    it('answers 401 without a session and never reads', async () => {
        const res = await app.request(`${BASE}?entityType=accommodation&entityId=${LISTING_ID}`, {
            headers: { 'user-agent': 'vitest' }
        });

        expect(res.status).toBe(401);
        expect(mockIsOwned).not.toHaveBeenCalled();
    });

    it('answers 404 for a foreign listing before checking quota', async () => {
        mockReadDraft.mockResolvedValueOnce({
            messageId: MESSAGE_ID,
            ownerId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            businessLines: [],
            entityType: 'accommodation',
            entityId: LISTING_ID,
            question: 'question',
            answerStatus: null
        });
        const foreign = await app.request(`${BASE}/${MESSAGE_ID}/faq-draft`, {
            method: 'POST',
            headers: AUTH_HEADERS
        });
        mockReadDraft.mockResolvedValueOnce(null);
        const missing = await app.request(`${BASE}/${MESSAGE_ID}/faq-draft`, {
            method: 'POST',
            headers: AUTH_HEADERS
        });
        const normalize = async (response: Response) => {
            const body = (await response.json()) as {
                metadata: { requestId: string; timestamp: string };
            } & Record<string, unknown>;
            const { metadata, ...rest } = body;
            const { requestId: _requestId, timestamp: _timestamp, ...stableMetadata } = metadata;
            return { ...rest, metadata: stableMetadata };
        };
        expect(foreign.status).toBe(404);
        expect(missing.status).toBe(404);
        expect(await normalize(foreign)).toEqual(await normalize(missing));
        expect(mockEnforceQuota).not.toHaveBeenCalled();
    });

    it('rejects answered questions with FAQ_DRAFT_NOT_ELIGIBLE', async () => {
        mockReadDraft.mockResolvedValueOnce({
            messageId: MESSAGE_ID,
            ownerId: ACTOR_ID,
            businessLines: [],
            entityType: 'accommodation',
            entityId: LISTING_ID,
            question: 'question',
            answerStatus: 'answered'
        });
        const res = await app.request(`${BASE}/${MESSAGE_ID}/faq-draft`, {
            method: 'POST',
            headers: AUTH_HEADERS
        });
        expect(res.status, await res.clone().text()).toBe(409);
        expect((await res.json()).error.code).toBe('FAQ_DRAFT_NOT_ELIGIBLE');
        expect(mockGenerateDraft).not.toHaveBeenCalled();
    });

    it('returns quota exhaustion and never calls generation', async () => {
        const { ServiceError } = await import('@repo/service-core');
        const { ServiceErrorCode } = await import('@repo/schemas');
        mockEnforceQuota.mockRejectedValueOnce(
            new ServiceError(ServiceErrorCode.LIMIT_REACHED, 'quota', {
                limitKey: 'max_ai_faq_draft_per_month',
                currentCount: 50,
                maxAllowed: 50
            })
        );
        const res = await app.request(`${BASE}/${MESSAGE_ID}/faq-draft`, {
            method: 'POST',
            headers: AUTH_HEADERS
        });
        expect(res.status).toBe(403);
        expect(mockGenerateDraft).not.toHaveBeenCalled();
    });

    it('meters drafts to the owner under faq_draft without visitor attribution', async () => {
        const res = await app.request(`${BASE}/${MESSAGE_ID}/faq-draft`, {
            method: 'POST',
            headers: AUTH_HEADERS
        });
        expect(res.status).toBe(200);
        expect(mockEnforceQuota).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: ACTOR_ID,
                feature: 'faq_draft',
                entitlementKey: 'ai_faq_draft',
                limitKey: 'max_ai_faq_draft_per_month'
            })
        );
        expect(mockEnforceQuota.mock.calls[0]?.[0]).not.toHaveProperty('usageAttribution');
        expect(mockMeter).toHaveBeenCalledWith(
            expect.objectContaining({ userId: ACTOR_ID, feature: 'faq_draft', status: 'success' })
        );
        expect(mockMeter.mock.calls[0]?.[0]).not.toHaveProperty('consumerUserId');
    });

    it.each([
        ['a non-uuid id', 'entityType=accommodation&entityId=abc'],
        ['an unknown vertical', `entityType=partner&entityId=${LISTING_ID}`],
        ['a missing id', 'entityType=venue'],
        ['a malformed page cursor', `entityType=venue&entityId=${LISTING_ID}&othersCursor=!!!`],
        [
            'a malformed encoded page cursor',
            `entityType=venue&entityId=${LISTING_ID}&othersCursor=aaaa`
        ],
        [
            'a non-canonical cursor date',
            `entityType=venue&entityId=${LISTING_ID}&othersCursor=${Buffer.from('2026-11-05T10:00:00Z|22222222-2222-4222-8222-222222222222').toString('base64url')}`
        ]
    ])('answers 400 for %s before any read', async (_label, query) => {
        const res = await app.request(`${BASE}?${query}`, { headers: AUTH_HEADERS });

        expect(res.status).toBe(400);
        expect(mockIsOwned).not.toHaveBeenCalled();
    });

    it('answers 404, never 403, for a listing the actor does not own', async () => {
        // Arrange
        mockIsOwned.mockResolvedValue({ owned: false });

        // Act
        const res = await app.request(`${BASE}?entityType=venue&entityId=${LISTING_ID}`, {
            headers: AUTH_HEADERS
        });

        // Assert
        expect(res.status).toBe(404);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe('NOT_FOUND');
        expect(mockList).not.toHaveBeenCalled();
        expect(mockIsOwned).toHaveBeenCalledWith({
            entityType: 'venue',
            entityId: LISTING_ID,
            userId: ACTOR_ID
        });
    });

    it('returns the owner the anonymous list with exact keys', async () => {
        // Act
        const res = await app.request(`${BASE}?entityType=experience&entityId=${LISTING_ID}`, {
            headers: AUTH_HEADERS
        });

        // Assert
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            data: { items: Record<string, unknown>[] } & Record<string, unknown>;
        };
        expect(Object.keys(body.data).sort()).toEqual(
            [
                'items',
                'total',
                'truncated',
                'unansweredCount',
                'othersNextCursor',
                'dismissed',
                'dismissedCount'
            ].sort()
        );
        expect(Object.keys(body.data.items[0] ?? {}).sort()).toEqual(
            ['answer', 'answerStatus', 'askedAt', 'id', 'question'].sort()
        );
        expect(JSON.stringify(body)).not.toContain(ACTOR_ID);
        expect(mockList).toHaveBeenCalledWith({
            entityType: 'experience',
            entityId: LISTING_ID,
            othersCursor: undefined
        });
    });

    it('rejects malformed action ids before calling the ownership service', async () => {
        const response = await app.request(`${BASE}/bad/dismiss`, {
            method: 'POST',
            headers: AUTH_HEADERS
        });
        expect(response.status).toBe(400);
        expect(mockSetDismissed).not.toHaveBeenCalled();
    });

    it('answers 401 to dismiss without a session', async () => {
        const response = await app.request(`${BASE}/22222222-2222-4222-8222-222222222222/dismiss`, {
            method: 'POST',
            headers: { 'user-agent': 'vitest' }
        });
        expect(response.status).toBe(401);
        expect(mockSetDismissed).not.toHaveBeenCalled();
    });

    it('answers 404 when the atomic dismissal update finds no owned question', async () => {
        mockSetDismissed.mockResolvedValue(null);
        const response = await app.request(`${BASE}/22222222-2222-4222-8222-222222222222/dismiss`, {
            method: 'POST',
            headers: AUTH_HEADERS
        });
        expect(response.status).toBe(404);
        expect(mockSetDismissed).toHaveBeenCalledWith({
            messageId: '22222222-2222-4222-8222-222222222222',
            userId: ACTOR_ID,
            dismissed: true
        });
    });

    it('dismisses an owned message and returns its persisted timestamp', async () => {
        const response = await app.request(`${BASE}/22222222-2222-4222-8222-222222222222/dismiss`, {
            method: 'POST',
            headers: AUTH_HEADERS
        });
        expect(response.status).toBe(200);
        expect((await response.json()).data).toEqual({
            messageId: '22222222-2222-4222-8222-222222222222',
            ownerDismissedAt: '2026-11-10T12:00:00.000Z'
        });
    });
});
