/** GET /protected/user-bookmarks `uncollected` query param (HOS-2420). */
import { RoleEnum } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

const listBookmarksByUserMock = vi.fn();

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        UserBookmarkService: class {
            listBookmarksByUser = listBookmarksByUserMock;
        }
    };
});

const { listUserBookmarksRoute } = await import('../../../src/routes/user-bookmark/protected/list');

const USER_ID = '00000000-0000-0000-0000-000000000020';

function buildApp(): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.use((c, next) => {
        c.set('actor', { id: USER_ID, roles: [RoleEnum.USER], permissions: [] });
        return next();
    });
    app.route('/', listUserBookmarksRoute);
    return app;
}

/** Second argument of the service call (the search params). */
function serviceParams(): Record<string, unknown> {
    return listBookmarksByUserMock.mock.calls[0]?.[1] as Record<string, unknown>;
}

describe('GET /protected/user-bookmarks uncollected param (HOS-2420)', () => {
    beforeEach(() => {
        listBookmarksByUserMock.mockReset();
        listBookmarksByUserMock.mockResolvedValue({ data: { bookmarks: [], total: 0 } });
    });

    it('passes uncollected: true to the service for ?uncollected=true', async () => {
        const res = await buildApp().request('/?uncollected=true');
        expect(res.status).toBe(200);
        expect(serviceParams()).toMatchObject({ userId: USER_ID, uncollected: true });
    });

    it('does not pass the key for ?uncollected=false', async () => {
        const res = await buildApp().request('/?uncollected=false');
        expect(res.status).toBe(200);
        expect('uncollected' in serviceParams()).toBe(false);
    });

    it('does not pass the key when the param is absent', async () => {
        const res = await buildApp().request('/');
        expect(res.status).toBe(200);
        expect('uncollected' in serviceParams()).toBe(false);
    });
});
