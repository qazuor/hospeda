import { createRouter } from '../../utils/create-app';
import { featuredAccommodationCreateRoute } from './create';
import { featuredAccommodationDeleteRoute } from './delete';
import { featuredAccommodationGetByIdRoute } from './getById';
import { featuredAccommodationListRoute } from './list';
import { featuredAccommodationUpdateRoute } from './update';

const router = createRouter();

router.route('/', featuredAccommodationListRoute);
router.route('/', featuredAccommodationCreateRoute);
router.route('/', featuredAccommodationGetByIdRoute);
router.route('/', featuredAccommodationUpdateRoute);
router.route('/', featuredAccommodationDeleteRoute);

export default router;
