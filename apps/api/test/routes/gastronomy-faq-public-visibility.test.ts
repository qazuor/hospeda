/**
 * Regression suite for HOS-400 — the public gastronomy FAQs endpoint must not
 * leak a FAQ marked `isVisibleOnListing: false`.
 *
 * `listGastronomyFaqs` (the service-core helper this route calls) is SHARED
 * with the admin/owner read, which must stay unfiltered — a hidden FAQ must
 * remain visible in the screen meant to manage it. So the route itself is
 * where the filter has to live, and this file asserts the ROUTE's behaviour,
 * not the shared helper's (which intentionally returns everything).
 *
 * Mirrors `apps/api/test/routes/accommodation/public/getBySlug.faq-visibility.test.ts`
 * for the vertical HOS-400 adopted the flags into.
 *
 * @module test/routes/gastronomy-faq-public-visibility
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockListFaqs } = vi.hoisted(() => ({
    mockListFaqs: vi.fn()
}));

vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    return {
        ...actual,
        listGastronomyFaqs: mockListFaqs
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
const GASTRONOMY_ID = '00000000-0000-4000-8000-000000000004';
const URL = `/api/v1/public/gastronomies/${GASTRONOMY_ID}/faqs`;

const VISIBLE_FAQ = {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccc01',
    gastronomyId: GASTRONOMY_ID,
    question: '¿Aceptan reservas para grupos grandes?',
    answer: 'Sí, hasta 20 personas con aviso previo.',
    category: null,
    displayOrder: 0,
    isVisibleOnListing: true,
    isUsableByAi: true
};

const HIDDEN_FAQ = {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccc02',
    gastronomyId: GASTRONOMY_ID,
    question: '¿Hacen descuentos a empleados de la zona?',
    answer: 'Sí, un 10% con credencial, pero preferimos no publicarlo.',
    category: null,
    displayOrder: 1,
    isVisibleOnListing: false,
    isUsableByAi: true
};

/** `user-agent` is required by the global validation middleware. */
function buildHeaders(): Record<string, string> {
    return { 'user-agent': 'vitest', Accept: 'application/json' };
}

describe('GET /public/gastronomies/:id/faqs never leaks a hidden FAQ (HOS-400)', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();
    });

    it('excludes a FAQ with isVisibleOnListing:false, keeping the visible one', async () => {
        mockListFaqs.mockResolvedValue({
            data: { faqs: [VISIBLE_FAQ, HIDDEN_FAQ] },
            error: undefined
        });

        const res = await app.request(URL, { method: 'GET', headers: buildHeaders() });
        expect(res.status).toBe(200);

        const body = (await res.json()) as { data: { faqs: Array<{ question: string }> } };
        const questions = body.data.faqs.map((faq) => faq.question);

        expect(questions).toContain(VISIBLE_FAQ.question);
        expect(questions).not.toContain(HIDDEN_FAQ.question);
    });

    it('treats a FAQ missing the field as visible (pre-migration default)', async () => {
        const { isVisibleOnListing: _drop, ...faqWithoutField } = VISIBLE_FAQ;
        mockListFaqs.mockResolvedValue({
            data: { faqs: [faqWithoutField] },
            error: undefined
        });

        const res = await app.request(URL, { method: 'GET', headers: buildHeaders() });
        const body = (await res.json()) as { data: { faqs: Array<{ question: string }> } };

        expect(body.data.faqs.map((faq) => faq.question)).toContain(VISIBLE_FAQ.question);
    });
});
