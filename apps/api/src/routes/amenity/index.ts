import { createRouter } from '../../utils/create-app';
import { addAmenityToAccommodationRoute } from './addAmenityToAccommodation';
import { createAmenityRoute } from './create';
import { getAccommodationsByAmenityRoute } from './getAccommodationsByAmenity';
import { getAmenitiesForAccommodationRoute } from './getAmenitiesForAccommodation';
import { amenityListRoute } from './list';
import { restoreAmenityRoute } from './restore';
import { searchAmenitiesRoute } from './search';
import { amenityGetByIdRoute } from './show.ts';
import { softDeleteAmenityRoute } from './softDelete';
import { updateAmenityRoute } from './update';

const app = createRouter();

// Public routes
app.route('/', amenityListRoute);
app.route('/', amenityGetByIdRoute);
app.route('/', getAccommodationsByAmenityRoute);
app.route('/', getAmenitiesForAccommodationRoute);
app.route('/', addAmenityToAccommodationRoute);
// CRUD
app.route('/', createAmenityRoute);
app.route('/', updateAmenityRoute);
app.route('/', softDeleteAmenityRoute);
app.route('/', restoreAmenityRoute);
// Search
app.route('/', searchAmenitiesRoute);

export { app as amenityRoutes };
