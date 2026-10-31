/**
 * HOS-1923 regression, end-to-end through the real middleware stack.
 *
 * The response cache runs BEFORE the auth and actor middlewares and keys
 * `/api/v1/public/posts/*` as `public:${path}?${query}`, with nothing of the
 * actor in it. Sequence B of the incident:
 *
 * 1. an editor holding `POST_VIEW_DRAFT` opens a draft by slug — the handler
 *    runs with the real actor and answers 200 with the draft;
 * 2. that 200 was stored under the public key;
 * 3. every anonymous caller received the draft for the whole TTL.
 *
 * The test authenticates the editor with the harness's mock-actor headers
 * (the integration global setup clears `CI` so `actorMiddleware` honours them).
 * The cache bypass recognises those headers under `NODE_ENV=test` exactly so
 * this sequence is reproducible here; in production the credential is the
 * Better Auth session cookie, covered by the unit suite and by the cookie case
 * below.
 */

import { getDb, posts } from '@repo/db';
import { PermissionEnum, PostCategoryEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { createTestUser } from '../../e2e/setup/seed-helpers';
import { testDb } from '../../e2e/setup/test-database';
import { buildMockActorHeaders, createMockActorUser } from '../helpers/mock-actor';

const BASE = '/api/v1/public/posts/slug';
const ANONYMOUS_HEADERS = { 'user-agent': 'vitest', accept: 'application/json' } as const;

describe('GET /api/v1/public/posts/slug/:slug — a draft never reaches the cache (HOS-1923)', () => {
    let app: ReturnType<typeof initApp>;
    let draftSlug: string;
    let editorHeaders: Record<string, string>;

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        validateApiEnv();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(async () => {
        clearCache();
        const suffix = crypto.randomUUID().slice(0, 8);
        const author = await createTestUser({
            email: `draft-cache-author-${suffix}@example.test`,
            slug: `draft-cache-author-${suffix}`
        });
        const editor = await createMockActorUser({ label: 'draft-cache-editor' });
        editorHeaders = buildMockActorHeaders({
            actorId: editor.id,
            permissions: [PermissionEnum.POST_VIEW_DRAFT]
        });

        draftSlug = `draft-cache-${suffix}`;
        await getDb()
            .insert(posts)
            .values({
                slug: draftSlug,
                category: PostCategoryEnum.CULTURE,
                title: `Draft cache fixture ${suffix}`,
                summary: 'Unpublished draft seeded for the HOS-1923 cache regression.',
                content: `Draft content that must never be served to anonymous callers. ${'x'.repeat(100)}`,
                authorId: author.id,
                visibility: 'PUBLIC',
                lifecycleState: 'DRAFT',
                moderationState: 'PENDING'
            });
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    it('control: an anonymous caller cannot read the draft, and that answer IS cached', async () => {
        const first = await app.request(`${BASE}/${draftSlug}`, { headers: ANONYMOUS_HEADERS });
        const second = await app.request(`${BASE}/${draftSlug}`, { headers: ANONYMOUS_HEADERS });

        expect(first.status).toBe(404);
        expect(first.headers.get('x-cache')).toBe('MISS');
        expect(second.status).toBe(404);
        expect(second.headers.get('x-cache')).toBe('HIT');
    });

    it('does not replay the editor’s draft to an anonymous caller', async () => {
        // Arrange + Act: the editor reads the draft first, then a stranger asks.
        const editor = await app.request(`${BASE}/${draftSlug}`, { headers: editorHeaders });
        const stranger = await app.request(`${BASE}/${draftSlug}`, {
            headers: ANONYMOUS_HEADERS
        });

        // Assert: since HOS-1924 the public route resolves as a guest for EVERYONE,
        // so even the editor is not served the draft here (drafts are read through
        // the protected/admin tiers). The editor request still bypasses the cache.
        expect(editor.status).toBe(404);
        expect(await editor.clone().text()).not.toContain('Draft content');

        // The leak: before HOS-1923 this was the editor's 200, served as a HIT.
        expect(await stranger.clone().text()).not.toContain('Draft content');
        expect(stranger.status).toBe(404);
        expect(stranger.headers.get('x-cache')).toBe('MISS');
        expect(editor.headers.get('x-cache')).toBe('BYPASS');
    });

    it('keeps the editor out of the cache and never serves the draft on the public route', async () => {
        const stranger = await app.request(`${BASE}/${draftSlug}`, {
            headers: ANONYMOUS_HEADERS
        });
        const editor = await app.request(`${BASE}/${draftSlug}`, { headers: editorHeaders });

        expect(stranger.status).toBe(404);
        // HOS-1924: guest actor on the public route, so the draft stays hidden.
        expect(editor.status).toBe(404);
        expect(await editor.clone().text()).not.toContain('Draft content');
        expect(editor.headers.get('x-cache')).toBe('BYPASS');
    });

    it('bypasses the cache for a request carrying a Better Auth session cookie', async () => {
        // The cookie is not a live session, so the request resolves to a guest
        // (404). What is asserted is the cache decision, which runs before auth.
        const res = await app.request(`${BASE}/${draftSlug}`, {
            headers: {
                ...ANONYMOUS_HEADERS,
                cookie: 'hospeda_vid=v; better-auth.session_token=not-a-real-session'
            }
        });

        expect(res.status).toBe(404);
        expect(res.headers.get('x-cache')).toBe('BYPASS');
    });
});
