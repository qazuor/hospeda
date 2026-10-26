import { getDb, posts } from '@repo/db';
import { PostCategoryEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { createTestUser } from '../../e2e/setup/seed-helpers';
import { testDb } from '../../e2e/setup/test-database';

describe('GET /posts (list)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    afterAll(async () => {
        await testDb.teardown();
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    let seededPostId: string;

    beforeEach(async () => {
        const suffix = crypto.randomUUID().slice(0, 8);
        const author = await createTestUser({
            email: `post-list-${suffix}@example.test`,
            slug: `post-list-${suffix}`
        });
        const rows = await getDb()
            .insert(posts)
            .values({
                slug: `post-list-${suffix}`,
                category: PostCategoryEnum.CULTURE,
                title: `Post list fixture ${suffix}`,
                summary: 'Post seeded for the public list integration test.',
                content: `Post content seeded for the public list integration test. ${'x'.repeat(100)}`,
                authorId: author.id,
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE',
                moderationState: 'APPROVED',
                publishedAt: new Date(Date.now() - 60 * 60 * 1000)
            })
            .returning({ id: posts.id });
        seededPostId = rows[0]?.id ?? '';
        if (!seededPostId) throw new Error('post seed returned no row');
    });

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('lists posts (happy path)', async () => {
        const res = await app.request(base, { headers: { 'user-agent': 'vitest' } });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.items.map((item: { id: string }) => item.id)).toEqual([seededPostId]);
        expect(body.data.pagination).toMatchObject({ page: 1, total: 1 });
    });
});
