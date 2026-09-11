/**
 * Regression suite for HOS-400 — the public experience FAQs endpoint must not
 * leak a FAQ marked `isVisibleOnListing: false`.
 *
 * See `gastronomy-faq-public-visibility.test.ts` for why the filter lives in
 * the ROUTE (`listExperienceFaqs` is shared with the unfiltered admin/owner
 * read) and why this file asserts the route's behaviour directly.
 *
 * @module test/routes/experience-faq-public-visibility
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
        listExperienceFaqs: mockListFaqs
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
const EXPERIENCE_ID = '00000000-0000-4000-8000-000000000005';
const URL = `/api/v1/public/experiences/${EXPERIENCE_ID}/faqs`;

const VISIBLE_FAQ = {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddd01',
    experienceId: EXPERIENCE_ID,
    question: '¿Se puede cancelar sin costo?',
    answer: 'Sí, hasta 24 horas antes de la salida.',
    category: null,
    displayOrder: 0,
    isVisibleOnListing: true,
    isUsableByAi: true
};

const HIDDEN_FAQ = {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddd02',
    experienceId: EXPERIENCE_ID,
    question: '¿Hay margen para negociar el precio a grupos frecuentes?',
    answer: 'Sí, pero preferimos manejarlo por privado y no publicarlo.',
    category: null,
    displayOrder: 1,
    isVisibleOnListing: false,
    isUsableByAi: true
};

/** `user-agent` is required by the global validation middleware. */
function buildHeaders(): Record<string, string> {
    return { 'user-agent': 'vitest', Accept: 'application/json' };
}

describe('GET /public/experiences/:id/faqs never leaks a hidden FAQ (HOS-400)', () => {
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
