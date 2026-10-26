import { events, getDb } from '@repo/db';
import { EventCategoryEnum, EventDatePrecisionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { createTestUser } from '../../e2e/setup/seed-helpers';
import { testDb } from '../../e2e/setup/test-database';

describe('GET /events (list)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    afterAll(async () => {
        await testDb.teardown();
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    let seededEventId: string;

    beforeEach(async () => {
        const suffix = crypto.randomUUID().slice(0, 8);
        const author = await createTestUser({
            email: `event-list-${suffix}@example.test`,
            slug: `event-list-${suffix}`
        });
        const rows = await getDb()
            .insert(events)
            .values({
                slug: `event-list-${suffix}`,
                name: `Event list fixture ${suffix}`,
                summary: 'Event seeded for the public list integration test.',
                description: 'Event description seeded for the public list integration test.',
                category: EventCategoryEnum.MUSIC,
                date: {
                    start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    precision: EventDatePrecisionEnum.EXACT
                },
                authorId: author.id,
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE',
                moderationState: 'APPROVED'
            })
            .returning({ id: events.id });
        seededEventId = rows[0]?.id ?? '';
        if (!seededEventId) throw new Error('event seed returned no row');
    });

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('lists events with default pagination (happy path)', async () => {
        const res = await app.request(base, { headers: { 'user-agent': 'vitest' } });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.items.map((item: { id: string }) => item.id)).toEqual([seededEventId]);
        expect(body.data.pagination).toMatchObject({ page: 1, total: 1, totalPages: 1 });
    });

    it('validates sort params (order must be ASC/DESC)', async () => {
        const res = await app.request(`${base}?sortOrder=INVALID`, {
            headers: { 'user-agent': 'vitest' }
        });
        expect(res.status).toBe(400);
    });

    it('supports pagination defaults when not provided', async () => {
        const res = await app.request(base, { headers: { 'user-agent': 'vitest' } });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.pagination).toHaveProperty('pageSize');
        expect(body.data.pagination).toMatchObject({ page: 1, total: 1 });
    });
});
