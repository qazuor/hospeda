/**
 * Location-exception requests (HOS-2192): the queue of owner requests to publish
 * at an address another listing holds, with approve and reject.
 */

import { createFileRoute } from '@tanstack/react-router';
import { LocationExceptionRequestsPage } from '@/features/location-exception-requests/LocationExceptionRequestsPage';
import { requireAdminApiAccess } from '@/lib/admin-api-access';

export const Route = createFileRoute('/_authed/platform/location-exception-requests/')({
    beforeLoad: ({ context }) => requireAdminApiAccess(context),
    component: LocationExceptionRequestsPage
});
