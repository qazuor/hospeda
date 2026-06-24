/**
 * @file Accommodation Gallery Route Test
 *
 * SPEC-204: the legacy redirect stub at `/accommodations/:id/gallery` (which
 * forwarded to `/accommodations/:id/edit#gallery-section`) has been replaced by
 * the real GalleryManager page — the relational `accommodation_media` table is
 * now the source of truth for accommodation photos.
 *
 * This test verifies the route mounts a page component rather than performing a
 * redirect. The page's rendering behavior is covered by the GalleryManager
 * component tests.
 */

import { describe, expect, it, vi } from 'vitest';
import * as mod from '../../../../src/routes/_authed/accommodations/$id_.gallery';

vi.mock('@tanstack/react-router', () => {
    return {
        createFileRoute:
            (_path: string) =>
            <T extends Record<string, unknown>>(options: T) =>
                options
    };
});

describe('Route /_authed/accommodations/$id_/gallery', () => {
    it('mounts a page component instead of a redirect stub', () => {
        const route = mod.Route as unknown as {
            component?: unknown;
            beforeLoad?: unknown;
        };

        // The real page route exposes a render component...
        expect(typeof route.component).toBe('function');
        // ...and, unlike the old redirect stub, has no beforeLoad redirect.
        expect(route.beforeLoad).toBeUndefined();
    });
});
