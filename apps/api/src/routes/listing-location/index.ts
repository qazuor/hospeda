import { PermissionEnum, VerticalEnum } from '@repo/schemas';
import { createAdminLocationRoutes } from './admin-location-routes';

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
