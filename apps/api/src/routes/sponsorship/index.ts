import { createRouter } from '../../utils/create-app';
import { sponsorshipCreateRoute } from './create';
import { sponsorshipDeleteRoute } from './delete';
import { sponsorshipGetByIdRoute } from './getById';
import { sponsorshipListRoute } from './list';
import { sponsorshipUpdateRoute } from './update';

const router = createRouter();

router.route('/', sponsorshipListRoute);
router.route('/', sponsorshipCreateRoute);
router.route('/', sponsorshipGetByIdRoute);
router.route('/', sponsorshipUpdateRoute);
router.route('/', sponsorshipDeleteRoute);

export default router;
