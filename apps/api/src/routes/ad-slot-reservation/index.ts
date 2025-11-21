import { createRouter } from '../../utils/create-app';
import { adSlotReservationCreateRoute } from './create';
import { adSlotReservationDeleteRoute } from './delete';
import { adSlotReservationGetByIdRoute } from './getById';
import { adSlotReservationListRoute } from './list';
import { adSlotReservationUpdateRoute } from './update';

const router = createRouter();

router.route('/', adSlotReservationListRoute);
router.route('/', adSlotReservationCreateRoute);
router.route('/', adSlotReservationGetByIdRoute);
router.route('/', adSlotReservationUpdateRoute);
router.route('/', adSlotReservationDeleteRoute);

export default router;
