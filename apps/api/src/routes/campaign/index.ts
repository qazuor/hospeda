import { createRouter } from '../../utils/create-app';
import { campaignCreateRoute } from './create';
import { campaignDeleteRoute } from './delete';
import { campaignGetByIdRoute } from './getById';
import { campaignListRoute } from './list';
import { campaignUpdateRoute } from './update';

const router = createRouter();

router.route('/', campaignListRoute);
router.route('/', campaignCreateRoute);
router.route('/', campaignGetByIdRoute);
router.route('/', campaignUpdateRoute);
router.route('/', campaignDeleteRoute);

export default router;
