import { createRouter } from '../../utils/create-app';
import { adMediaAssetCreateRoute } from './create';
import { adMediaAssetDeleteRoute } from './delete';
import { adMediaAssetGetByIdRoute } from './getById';
import { adMediaAssetListRoute } from './list';
import { adMediaAssetUpdateRoute } from './update';

const router = createRouter();

router.route('/', adMediaAssetListRoute);
router.route('/', adMediaAssetCreateRoute);
router.route('/', adMediaAssetGetByIdRoute);
router.route('/', adMediaAssetUpdateRoute);
router.route('/', adMediaAssetDeleteRoute);

export default router;
