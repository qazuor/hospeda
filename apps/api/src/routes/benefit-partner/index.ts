import { createRouter } from '../../utils/create-app';
import { benefitPartnerCreateRoute } from './create';
import { benefitPartnerDeleteRoute } from './delete';
import { benefitPartnerGetByIdRoute } from './getById';
import { benefitPartnerListRoute } from './list';
import { benefitPartnerUpdateRoute } from './update';

const router = createRouter();

router.route('/', benefitPartnerListRoute);
router.route('/', benefitPartnerCreateRoute);
router.route('/', benefitPartnerGetByIdRoute);
router.route('/', benefitPartnerUpdateRoute);
router.route('/', benefitPartnerDeleteRoute);

export default router;
