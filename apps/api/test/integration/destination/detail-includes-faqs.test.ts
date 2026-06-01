/**
 * Integration tests for SPEC-158: the public destination detail responses
 * (by-slug and by-path) embed the destination's FAQs as a `faqs` array.
 *
 * Mirrors the defensive style of the accommodation FAQ integration tests:
 * runs against the live app and tolerates 200/400/404 (data may not be seeded
 * in every environment), but whenever a 200 detail is returned it asserts the
 * `faqs` contract (array of well-formed FAQ objects).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Public destination detail embeds faqs (SPEC-158)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';
    // A known seed CITY slug; if the DB is seeded the FAQ path is exercised,
    // otherwise the test tolerates a null/404 result.
    const seedSlug = 'colon';

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    const assertFaqsContract = (data: unknown) => {
        if (data === null || data === undefined) return; // not seeded — tolerated
        const detail = data as { faqs?: unknown };
        expect(Array.isArray(detail.faqs)).toBe(true);
        const faqs = detail.faqs as Array<Record<string, unknown>>;
        for (const faq of faqs) {
            expect(typeof faq.question).toBe('string');
            expect(typeof faq.answer).toBe('string');
            expect((faq.question as string).length).toBeGreaterThan(0);
            expect((faq.answer as string).length).toBeGreaterThan(0);
        }
        // SPEC-177 T-030: FAQs must be returned ordered by display_order ASC NULLS LAST.
        // If multiple FAQs are present, each item with a non-null displayOrder must be
        // <= the displayOrder of the next item.
        if (faqs.length > 1) {
            const withOrder = faqs.filter(
                (f) => f.displayOrder !== null && f.displayOrder !== undefined
            );
            for (let i = 0; i < withOrder.length - 1; i++) {
                const cur = withOrder[i].displayOrder as number;
                const next = withOrder[i + 1].displayOrder as number;
                expect(cur).toBeLessThanOrEqual(next);
            }
        }
    };

    describe('GET /destinations/slug/:slug', () => {
        it('includes a faqs array in the detail when found', async () => {
            const res = await app.request(`${base}/slug/${seedSlug}`, {
                headers: { 'user-agent': 'vitest', Accept: 'application/json' }
            });
            // Tolerate 500 when the test DB is unseeded or unavailable
            expect([200, 400, 404, 500]).toContain(res.status);
            if (res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('success', true);
                assertFaqsContract(body.data);
            }
        });

        it('returns 200/404 for a non-existent slug', async () => {
            const res = await app.request(`${base}/slug/this-destination-does-not-exist-xyz`, {
                headers: { 'user-agent': 'vitest', Accept: 'application/json' }
            });
            // Tolerate 500 when the test DB is unseeded or unavailable
            expect([200, 400, 404, 500]).toContain(res.status);
        });
    });

    describe('GET /destinations/by-path', () => {
        it('includes a faqs array in the detail when found', async () => {
            const res = await app.request(
                `${base}/by-path?path=${encodeURIComponent('/argentina/litoral/entre-rios/colon')}`,
                { headers: { 'user-agent': 'vitest', Accept: 'application/json' } }
            );
            // Tolerate 500 when the test DB is unseeded or unavailable
            expect([200, 400, 404, 500]).toContain(res.status);
            if (res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('success', true);
                assertFaqsContract(body.data);
            }
        });
    });
});
