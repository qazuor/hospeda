import { createRouter } from '../../utils/create-app';
import { adPricingCatalogCreateRoute } from './create';
import { adPricingCatalogDeleteRoute } from './delete';
import { adPricingCatalogGetByIdRoute } from './getById';
import { adPricingCatalogListRoute } from './list';
import { adPricingCatalogUpdateRoute } from './update';

const router = createRouter();

router.route('/', adPricingCatalogListRoute);
router.route('/', adPricingCatalogCreateRoute);
router.route('/', adPricingCatalogGetByIdRoute);
router.route('/', adPricingCatalogUpdateRoute);
router.route('/', adPricingCatalogDeleteRoute);

export default router;
