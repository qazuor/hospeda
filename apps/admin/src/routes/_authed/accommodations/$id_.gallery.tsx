/**
 * Accommodation Gallery Redirect Route
 *
 * The standalone accommodation gallery page has been merged into the edit
 * page (the gallery section is now part of the consolidated edit form). This
 * route exists only to redirect any inbound link to the legacy URL onto the
 * edit page, anchored at the gallery section. See SPEC-078-GAPS GAP-073.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/accommodations/$id_/gallery')({
    beforeLoad: ({ params }) => {
        throw redirect({
            to: '/accommodations/$id/edit',
            params: { id: params.id },
            hash: 'gallery-section',
            replace: true
        });
    },
    component: () => null
});
