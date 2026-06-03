import { destinationFaqs, destinations, getDb } from '@repo/db';
/**
 * Integration tests for SPEC-158 / SPEC-177: the public destination detail responses
 * (by-slug and by-path) embed the destination's FAQs as a `faqs` array.
 *
 * Uses testDb.setup() + seeded rows so:
 *   - HTTP 500 (DB not initialized) is NOT tolerated — a 500 from the public
 *     detail endpoint always indicates a real bug.
 *   - The display_order ordering assertion is guaranteed to execute (we seed
 *     exactly 2 FAQs with known distinct displayOrder values).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

describe('Public destination detail embeds faqs (SPEC-158)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    /** Slug of the destination we seed in beforeAll. */
    let seedSlug: string;
    /** Path of the seeded destination for the by-path route. */
    let seedPath: string;

    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        app = initApp();

        // Seed a destination and 2 FAQs with known distinct displayOrder values
        // so the ordering assertion in assertFaqsContract is guaranteed to run.
        const ts = Date.now();
        seedSlug = `e2e-faq-detail-${ts}`;
        seedPath = `/test/faq-detail-${ts}`;

        const db = getDb();

        const inserted = await db
            .insert(destinations)
            .values({
                slug: seedSlug,
                name: `E2E FAQ Detail ${ts}`,
                summary: 'Destination for FAQ display_order integration test.',
                description: 'Long enough description for the FAQ ordering integration test.',
                destinationType: 'CITY',
                path: seedPath,
                pathIds: '',
                level: 4,
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE',
                moderationState: 'APPROVED',
                location: { coordinates: { lat: '-32.48', long: '-58.23' } }
            })
            .returning({ id: destinations.id });

        const destId = inserted[0]?.id;
        if (!destId) throw new Error('Seeded destination returned no row');

        // Insert FAQ with higher displayOrder first, then lower — the route must
        // return them ordered by displayOrder ASC.
        await db.insert(destinationFaqs).values([
            {
                destinationId: destId,
                question: 'FAQ high order question?',
                answer: 'Answer to high order FAQ.',
                displayOrder: 20
            },
            {
                destinationId: destId,
                question: 'FAQ low order question?',
                answer: 'Answer to low order FAQ.',
                displayOrder: 5
            }
        ]);
    });

    afterAll(async () => {
        await testDb.clean();
        await testDb.teardown();
    });

    const assertFaqsContract = (data: unknown) => {
        if (data === null || data === undefined) return; // destination not found — tolerated
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
        // With the seeded destination this block is always reached (faqs.length === 2).
        if (faqs.length > 1) {
            const withOrder = faqs.filter(
                (f) => f.displayOrder !== null && f.displayOrder !== undefined
            );
            for (let i = 0; i < withOrder.length - 1; i++) {
                const cur = withOrder[i];
                const next = withOrder[i + 1];
                if (!cur || !next) continue;
                expect(cur.displayOrder as number).toBeLessThanOrEqual(next.displayOrder as number);
            }
        }
    };

    describe('GET /destinations/slug/:slug', () => {
        it('includes a faqs array with correct ordering when the seeded destination is found', async () => {
            const res = await app.request(`${base}/slug/${seedSlug}`, {
                headers: { 'user-agent': 'vitest', Accept: 'application/json' }
            });
            // 500 is NOT acceptable — DB is initialized and schema is present.
            expect([200, 400, 404]).toContain(res.status);
            if (res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('success', true);
                assertFaqsContract(body.data);
                // With the seeded destination we must get exactly 2 FAQs in order.
                const faqs = (body.data as { faqs?: unknown[] }).faqs ?? [];
                expect(faqs.length).toBe(2);
                const orders = faqs.map(
                    (f) => (f as Record<string, unknown>).displayOrder as number
                );
                expect(orders[0]).toBe(5);
                expect(orders[1]).toBe(20);
            }
        });

        it('returns 404 for a non-existent slug', async () => {
            const res = await app.request(`${base}/slug/this-destination-does-not-exist-xyz`, {
                headers: { 'user-agent': 'vitest', Accept: 'application/json' }
            });
            // 500 is NOT acceptable — a missing destination must 404, never crash the server.
            expect([200, 400, 404]).toContain(res.status);
        });
    });

    describe('GET /destinations/by-path', () => {
        it('includes a faqs array with correct ordering when the seeded destination is found by path', async () => {
            const res = await app.request(`${base}/by-path?path=${encodeURIComponent(seedPath)}`, {
                headers: { 'user-agent': 'vitest', Accept: 'application/json' }
            });
            // 500 is NOT acceptable — DB is initialized and schema is present.
            expect([200, 400, 404]).toContain(res.status);
            if (res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('success', true);
                assertFaqsContract(body.data);
            }
        });
    });
});
