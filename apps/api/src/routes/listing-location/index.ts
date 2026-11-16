import { PermissionEnum, VerticalEnum } from '@repo/schemas';
import { createAdminLocationRoutes } from './admin-location-routes';
import { createOwnerLocationRoutes } from './owner-location-routes';

/** Admin one-address routes of accommodations (HOS-1810). */
export const adminAccommodationLocationRoutes = createAdminLocationRoutes({
    vertical: VerticalEnum.ACCOMMODATION,
    permission: PermissionEnum.LISTING_LOCATION_EXCEPTION_MANAGE,
    tag: 'Accommodations'
});

/** Admin one-address routes of venues (HOS-1810). */
export const adminVenueLocationRoutes = createAdminLocationRoutes({
    vertical: VerticalEnum.VENUE,
    permission: PermissionEnum.LISTING_LOCATION_EXCEPTION_MANAGE,
    tag: 'Venue'
});

/** Owner exception-request route of accommodations (HOS-2192). */
export const ownerAccommodationLocationRoutes = createOwnerLocationRoutes({
    vertical: VerticalEnum.ACCOMMODATION,
    tag: 'Accommodations'
});

/** Owner exception-request route of venues (HOS-2192). */
export const ownerVenueLocationRoutes = createOwnerLocationRoutes({
    vertical: VerticalEnum.VENUE,
    tag: 'Venue'
});
