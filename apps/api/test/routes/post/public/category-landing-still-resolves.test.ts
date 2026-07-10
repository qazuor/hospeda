/**
 * Confirms the dedicated `/posts/category/:category` endpoint — the API
 * route backing the `/publicaciones/categoria/{slug}/` web landing's
 * internal singular-value query path — still resolves after HOS-96
 * (T-021, subtask "Verify dedicated landings still resolve via singular
 * path"). This route is untouched by HOS-96 (it predates the `categories`
 * array field and always used the singular `category` path param), so this
 * is a non-regression check, not new behavior.
 *
 * Uses the pre-baked global `PostService` mock (`getByCategory` already
 * implemented there) rather than a file-level override, since this file only
 * needs to confirm routing/wiring, not real filtered content.
 *
 * Events have no equivalent dedicated `/events/category/:category` route
 * (the `/alojamientos/tipo/hotel/` and events-side landings resolve through
 * the plain list endpoint's `?type=`/`?category=` query path instead, which
 * is already covered by the singular-param assertions in
 * `categories-backward-compat.test.ts` / `types-backward-compat.test.ts`).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';

describe('GET /api/v1/public/posts/category/:category — dedicated landing route (HOS-96 T-021)', () => {
    let app: ReturnType<typeof initApp>;
    const BASE = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    it('resolves for a valid category param (not a routing/validation error)', async () => {
        const res = await app.request(`${BASE}/category/CULTURE`, {
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });

        // Not 400 (schema rejection) and not 404 (route not found) — the
        // dedicated landing path is still wired and reachable.
        expect(res.status).not.toBe(400);
        expect(res.status).not.toBe(404);
    });

    it('returns 400 for an invalid category param', async () => {
        const res = await app.request(`${BASE}/category/NOT_A_CATEGORY`, {
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });

        expect(res.status).toBe(400);
    });
});
