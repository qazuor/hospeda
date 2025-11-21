import { createRouter } from '../../utils/create-app';
import { invoiceCreateRoute } from './create';
import { invoiceDeleteRoute } from './delete';
import { invoiceGetByIdRoute } from './getById';
import { invoiceListRoute } from './list';
import { invoiceUpdateRoute } from './update';

const router = createRouter();

// Register all invoice routes
router.route('/', invoiceListRoute);
router.route('/', invoiceCreateRoute);
router.route('/', invoiceGetByIdRoute);
router.route('/', invoiceUpdateRoute);
router.route('/', invoiceDeleteRoute);

export default router;
