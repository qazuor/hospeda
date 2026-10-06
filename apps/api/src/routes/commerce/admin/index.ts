/**
 * Admin commerce routes barrel
 * Mounts under /api/v1/admin/commerce.
 *
 * The admin start-subscription route was removed with the legacy billing
 * system (HOS-1416). HOS-695 (release C) removed the leads sub-tree
 * (`GET /leads`, `POST /leads/:id/handle`) — the commerce lead-intake funnel
 * no longer accepts new submissions (its public form and admin provisioning
 * flow were retired by HOS-693), and its remaining three rows were
 * smoke-test fixtures the owner confirmed have nothing worth reviewing.
 * `commerce_leads` itself was dropped in the same release.
 */
import { createRouter } from '../../../utils/create-app';

const adminCommerceRoutes = createRouter();

export { adminCommerceRoutes };
