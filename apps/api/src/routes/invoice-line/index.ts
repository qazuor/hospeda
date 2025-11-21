import { createRouter } from '../../utils/create-app';
import { invoiceLineCreateRoute } from './create';
import { invoiceLineDeleteRoute } from './delete';
import { invoiceLineGetByIdRoute } from './getById';
import { invoiceLineListRoute } from './list';
import { invoiceLineUpdateRoute } from './update';

const router = createRouter();

// Register all invoice line routes
router.route('/', invoiceLineListRoute);
router.route('/', invoiceLineCreateRoute);
router.route('/', invoiceLineGetByIdRoute);
router.route('/', invoiceLineUpdateRoute);
router.route('/', invoiceLineDeleteRoute);

export default router;
