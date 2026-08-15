/**
 * Regression suite for H-119 / H-59 — the accommodation FAQ channel-visibility
 * flags never reached the service.
 *
 * ## The bug
 *
 * `POST`/`PUT` on `/protected/accommodations/:id/faqs` declared
 * `FaqCreatePayloadSchema` / `FaqUpdatePayloadSchema` as their `requestBody`.
 * Those are a `.pick()` of three text fields; the two HOS-393 flags are not in
 * them. Zod strips unknown keys, so `isVisibleOnListing: false` died at the HTTP
 * boundary. The service schema (`AccommodationFaqUpdateInputSchema`) DID declare
 * both flags, the web client DID send them, and the request answered `200` — so
 * a FAQ the owner marked private was written and served public.
 *
 * ## Why no existing test caught it
 *
 * The contract broke BETWEEN two layers that each test correctly. A service test
 * passes (the service accepts the flags), a client test passes (the form sends
 * them), and the endpoint returns `200`. Nothing asserted what the route hands
 * the service. That is what this file does: it spies on the service input, not
 * on the status code.
 *
 * ## Scope note — this is a one-entity feature
 *
 * Only `accommodation_faqs` carries `is_visible_on_listing` / `is_usable_by_ai`
 * (verified against the production schema). `destination_faqs`,
 * `gastronomy_faqs` and `experience_faqs` have no such columns and no UI for
 * them; adding the flags there is HOS-400. For those entities the correct
 * behaviour is a `400`, not a silent drop — asserted in
 * `packages/schemas/test/common/faq-channel-visibility-payload.test.ts` at the
 * schema level and, at the HTTP level, by the unsupported-key case below.
 *
 * Admin-tier FAQ routes are covered by the static guard
 * (`faq-payload-schema.guard.test.ts`) rather than duplicated here: a missing
 * schema on a route is a call-site problem, and a guard states that invariant
 * once for every present and future route.
 *
 * @module test/routes/accommodation-faq-channel-visibility
 */

import { EntitlementKey, type LimitKey } from '@repo/billing';
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
        AccommodationService: vi.fn().mockImplementation(function () {
            return {
                addFaq: mockAddFaq,
                updateFaq: mockUpdateFaq
            };
        })
    };
});

const mockActor = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    roles: ['HOST'],
    permissions: ['accommodation.update.own', 'access.panelProtected']
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

vi.mock('../../src/middlewares/entitlement', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/middlewares/entitlement')>();
    return {
        ...actual,
        entitlementMiddleware:
            () => async (c: import('hono').Context, next: () => Promise<void>) => {
                c.set('userEntitlements', new Set([EntitlementKey.EDIT_ACCOMMODATION_INFO]));
                c.set('userLimits', new Map<LimitKey, number>());
                c.set('billingLoadFailed', false);
                await next();
            }
    };
});

// ---------------------------------------------------------------------------
// Import app AFTER mocks
// ---------------------------------------------------------------------------
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const ACCOMMODATION_ID = '00000000-0000-4000-8000-000000000001';
const FAQ_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01';
const ADD_URL = `/api/v1/protected/accommodations/${ACCOMMODATION_ID}/faqs`;
const UPDATE_URL = `${ADD_URL}/${FAQ_ID}`;

const QUESTION = '¿A qué hora es el check-in y el check-out?';
const ANSWER = 'El check-in es desde las 14:00 y el check-out hasta las 10:00.';

/**
 * A complete FAQ row, shaped to satisfy `AccommodationFaqSingleOutputSchema`.
 *
 * The route factory validates the RESPONSE against the declared schema and
 * answers `500 INTERNAL_ERROR` when it does not match, so a partial fixture
 * here would mask the very assertions this file exists to make.
 */
const FAQ_ROW = {
    id: FAQ_ID,
    accommodationId: ACCOMMODATION_ID,
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

describe('Accommodation FAQ channel-visibility flags reach the service (H-119 / H-59)', () => {
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

            // Exact comparison on the faq payload. `expect.objectContaining` is
            // deliberately avoided: it cannot fail on a MISSING key, which is
            // exactly how this bug survived every existing test.
            const [, input] = mockAddFaq.mock.calls[0] as [unknown, { faq: unknown }];
            expect(input.faq).toEqual({
                question: QUESTION,
                answer: ANSWER,
                isVisibleOnListing: false,
                isUsableByAi: false
            });
        });

        it('defaults both flags to true when the client does not send them', async () => {
            // On CREATE the flags carry `.default(true)`, deliberately: a client
            // that predates HOS-393 keeps producing valid payloads and its FAQs
            // behave exactly as every FAQ did before the flags existed. This
            // mirrors the NOT NULL DEFAULT true columns.
            await app.request(ADD_URL, {
                method: 'POST',
                headers: buildHeaders(),
                body: JSON.stringify({ question: QUESTION, answer: ANSWER })
            });

            const [, input] = mockAddFaq.mock.calls[0] as [unknown, { faq: unknown }];
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

            const [, input] = mockUpdateFaq.mock.calls[0] as [unknown, { faq: unknown }];
            expect(input.faq).toEqual({ isVisibleOnListing: false, isUsableByAi: false });
        });

        it('leaves the flags untouched when only the question text is edited', async () => {
            // Guards against a `.default()` creeping back into the update
            // schema: it would fire on every partial edit and silently flip a
            // private FAQ back to public.
            await app.request(UPDATE_URL, {
                method: 'PUT',
                headers: buildHeaders(),
                body: JSON.stringify({ question: QUESTION })
            });

            const [, input] = mockUpdateFaq.mock.calls[0] as [unknown, { faq: object }];
            expect(input.faq).toEqual({ question: QUESTION });
        });
    });

    describe('the API stops accepting what it cannot process', () => {
        it('rejects an unsupported body key with 400 instead of dropping it', async () => {
            // The core lesson of H-119: a silent discard WITH a success
            // acknowledgement is worse than a field that fails to persist,
            // because the user believes they saved. Anything the route cannot
            // process must say so.
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
