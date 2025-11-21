import { createRouter } from '../../utils/create-app';
import { discountCodeUsageListRoute } from './list';

/**
 * Discount Code Usage Routes
 *
 * DiscountCodeUsage is a READ-ONLY analytics service.
 * Usage recording is done internally by DiscountCodeService when applying discounts.
 *
 * Available routes:
 * - GET / (list/search) - Get usage analytics with filters
 *
 * CRUD operations (create/update/delete/getById) are NOT supported
 * because usage is tracked automatically and should not be manually modified.
 */
const router = createRouter();

router.route('/', discountCodeUsageListRoute);

export default router;
