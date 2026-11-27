/**
 * Real-router regression for the admin breadcrumb (HOS-2664).
 *
 * TanStack's `<Link>` marks every link whose path is a prefix of the current
 * location as active and adds `aria-current="page"` on its own. The breadcrumb
 * must keep that attribute on the LAST item only, so this test uses the real
 * router instead of the module mock the sibling suite uses.
 */

import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

vi.unmock('@tanstack/react-router');
vi.mock('@/utils/logger', () => ({ adminLogger: { warn: vi.fn() } }));

const ID = '04c89660-09eb-40ec-8294-35a1c165192b';

const renderAt = async (path: string) => {
    const root = createRootRoute({ component: () => <Breadcrumbs /> });
    const routes = [
        '/dashboard',
        '/posts',
        '/posts/$id',
        '/posts/$id/gallery',
        '/posts/$id/seo'
    ].map((p) => createRoute({ getParentRoute: () => root, path: p }));
    const router = createRouter({
        routeTree: root.addChildren(routes),
        history: createMemoryHistory({ initialEntries: [path] })
    });
    render(<RouterProvider router={router} />);
    await screen.findByRole('navigation');
};

describe('admin Breadcrumbs with the real router (HOS-2664)', () => {
    it.each([
        'gallery',
        'seo'
    ])('marks only the last item current on /posts/<id>/%s', async (leaf) => {
        await renderAt(`/posts/${ID}/${leaf}`);
        const nav = screen.getByRole('navigation');
        expect(nav.querySelectorAll('a').length).toBeGreaterThan(1);
        const current = nav.querySelectorAll('[aria-current="page"]');
        expect(current).toHaveLength(1);
        expect(current[0]?.closest('li')).toBe(
            nav.querySelectorAll('li').item(nav.querySelectorAll('li').length - 1)
        );
    });
});
