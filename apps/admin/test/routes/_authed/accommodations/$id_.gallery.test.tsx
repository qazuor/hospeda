/**
 * @file Accommodation Gallery Redirect Route Test
 *
 * SPEC-078-GAPS GAP-073: The standalone accommodation gallery page has been
 * removed. The legacy `/accommodations/:id/gallery` URL must redirect to
 * `/accommodations/:id/edit#gallery-section` so any existing inbound link
 * lands on the merged edit page anchored at the gallery section.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => {
    return {
        createFileRoute:
            (_path: string) =>
            <T extends Record<string, unknown>>(options: T) =>
                options,
        redirect: (options: unknown) => {
            const error = new Error('redirect') as Error & {
                isRedirect: true;
                options: unknown;
            };
            error.isRedirect = true;
            error.options = options;
            return error;
        }
    };
});

describe('Route /_authed/accommodations/$id_/gallery', () => {
    it('redirects to the edit page anchored at the gallery section', async () => {
        const mod = await import('../../../../src/routes/_authed/accommodations/$id_.gallery');
        const route = mod.Route as unknown as {
            beforeLoad: (ctx: { params: { id: string } }) => void;
            component: () => null;
        };

        const params = { id: 'acc-123' };

        let thrown: unknown;
        try {
            route.beforeLoad({ params });
        } catch (error) {
            thrown = error;
        }

        const redirectError = thrown as
            | (Error & { isRedirect?: boolean; options?: Record<string, unknown> })
            | undefined;

        expect(redirectError).toBeDefined();
        expect(redirectError?.isRedirect).toBe(true);
        expect(redirectError?.options).toEqual({
            to: '/accommodations/$id/edit',
            params: { id: 'acc-123' },
            hash: 'gallery-section',
            replace: true
        });
    });

    it('exposes a no-op fallback component', async () => {
        const mod = await import('../../../../src/routes/_authed/accommodations/$id_.gallery');
        const route = mod.Route as unknown as { component: () => null };

        expect(route.component()).toBeNull();
    });
});
