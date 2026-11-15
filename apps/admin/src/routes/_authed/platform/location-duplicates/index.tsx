/**
 * Repeated-address report (HOS-1810): groups of published listings that share an
 * address, with the admin exception action.
 */

import { createFileRoute } from '@tanstack/react-router';
import { LocationDuplicatesPage } from '@/features/location-duplicates/LocationDuplicatesPage';
import { requireAdminApiAccess } from '@/lib/admin-api-access';

export const Route = createFileRoute('/_authed/platform/location-duplicates/')({
    beforeLoad: ({ context }) => requireAdminApiAccess(context),
    component: LocationDuplicatesPage
});
