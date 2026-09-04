/**
 * Regression suite for HOS-400 — experience FAQ channel-visibility flags reach
 * the service, mirroring `accommodation-faq-channel-visibility.test.ts`
 * (H-119 / H-59) and `gastronomy-faq-channel-visibility.test.ts` for the other
 * vertical HOS-400 adopted the flags into.
 *
 * See `gastronomy-faq-channel-visibility.test.ts` for why this spies on the
 * service call instead of the HTTP status code.
 *
 * @module test/routes/experience-faq-channel-visibility
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockAddFaq, mockUpdateFaq } = vi.hoisted(() => ({
    mockAddFaq: vi.fn(),
    mockUpdateFaq: vi.fn()
}));

vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    return {
        ...actual,
        addExperienceFaq: mockAddFaq,
        updateExperienceFaq: mockUpdateFaq
    };
});

const mockActor = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    roles: ['HOST'],
    permissions: ['commerce.edit.own', 'access.panelProtected']
};
vi.mock('../../src/utils/actor.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/utils/actor.js')>();
    return {
        ...actual,
        getActorFromContext: () => mockActor
    };
});

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Import app AFTER mocks
// ---------------------------------------------------------------------------
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const EXPERIENCE_ID = '00000000-0000-4000-8000-000000000003';
const FAQ_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03';
const ADD_URL = `/api/v1/protected/experiences/${EXPERIENCE_ID}/faqs`;
const UPDATE_URL = `${ADD_URL}/${FAQ_ID}`;

const QUESTION = '¿Hay un límite de peso para hacer la actividad?';
const ANSWER = 'Sí, el límite es de 120 kg por participante.';

/**
 * A complete FAQ row, shaped to satisfy `ExperienceFaqSingleOutputSchema`.
 *
 * The route factory validates the RESPONSE against the declared schema and
 * answers `500 INTERNAL_ERROR` when it does not match, so a partial fixture
 * here would mask the very assertions this file exists to make.
 */
const FAQ_ROW = {
    id: FAQ_ID,
    experienceId: EXPERIENCE_ID,
    question: QUESTION,
    answer: ANSWER,
    category: null,
    displayOrder: 0,
    isVisibleOnListing: false,
    isUsableByAi: false,
    lifecycleState: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdById: null,
    updatedById: null
} as const;

/** `user-agent` is required by the global validation middleware. */
function buildHeaders(): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        'user-agent': 'vitest',
        Accept: 'application/json',
        Authorization: 'Bearer test-protected-token'
    };
}

describe('Experience FAQ channel-visibility flags reach the service (HOS-400)', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();
        mockAddFaq.mockResolvedValue({ data: { faq: FAQ_ROW }, error: undefined });
        mockUpdateFaq.mockResolvedValue({ data: { faq: FAQ_ROW }, error: undefined });
    });

    describe('POST /{id}/faqs', () => {
        it('hands the service isVisibleOnListing:false and isUsableByAi:false', async () => {
            const res = await app.request(ADD_URL, {
                method: 'POST',
                headers: buildHeaders(),
                body: JSON.stringify({
                    question: QUESTION,
                    answer: ANSWER,
                    isVisibleOnListing: false,
                    isUsableByAi: false
                })
            });

            expect(res.status).toBe(201);
            expect(mockAddFaq).toHaveBeenCalledTimes(1);

            const [, , input] = mockAddFaq.mock.calls[0] as [unknown, unknown, { faq: unknown }];
            expect(input.faq).toEqual({
                question: QUESTION,
                answer: ANSWER,
                isVisibleOnListing: false,
                isUsableByAi: false
            });
        });

        it('defaults both flags to true when the client does not send them', async () => {
            await app.request(ADD_URL, {
                method: 'POST',
                headers: buildHeaders(),
                body: JSON.stringify({ question: QUESTION, answer: ANSWER })
            });

            const [, , input] = mockAddFaq.mock.calls[0] as [unknown, unknown, { faq: unknown }];
            expect(input.faq).toEqual({
                question: QUESTION,
                answer: ANSWER,
                isVisibleOnListing: true,
                isUsableByAi: true
            });
        });
    });

    describe('PUT /{id}/faqs/{faqId}', () => {
        it('hands the service isVisibleOnListing:false on a flags-only edit', async () => {
            const res = await app.request(UPDATE_URL, {
                method: 'PUT',
                headers: buildHeaders(),
                body: JSON.stringify({ isVisibleOnListing: false, isUsableByAi: false })
            });

            expect(res.status).toBe(200);
            expect(mockUpdateFaq).toHaveBeenCalledTimes(1);

            const [, , input] = mockUpdateFaq.mock.calls[0] as [unknown, unknown, { faq: unknown }];
            expect(input.faq).toEqual({ isVisibleOnListing: false, isUsableByAi: false });
        });

        it('leaves the flags untouched when only the question text is edited', async () => {
            await app.request(UPDATE_URL, {
                method: 'PUT',
                headers: buildHeaders(),
                body: JSON.stringify({ question: QUESTION })
            });

            const [, , input] = mockUpdateFaq.mock.calls[0] as [unknown, unknown, { faq: object }];
            expect(input.faq).toEqual({ question: QUESTION });
        });
    });

    describe('the API stops accepting what it cannot process', () => {
        it('rejects an unsupported body key with 400 instead of dropping it', async () => {
            const res = await app.request(ADD_URL, {
                method: 'POST',
                headers: buildHeaders(),
                body: JSON.stringify({
                    question: QUESTION,
                    answer: ANSWER,
                    isVisibleOnLisitng: false // typo — a key the route cannot honour
                })
            });

            expect(res.status).toBe(400);
            expect(mockAddFaq).not.toHaveBeenCalled();
        });
    });
});
