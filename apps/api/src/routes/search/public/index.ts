/**
 * Public search router (SPEC-096 / REQ-096-04).
 * Mounts all public search endpoints under the search namespace.
 */
import { createRouter } from '../../../utils/create-app';
import { publicSearchRoute } from './search';

const router = createRouter();

router.route('/', publicSearchRoute);

export { router as publicSearchRoutes };
