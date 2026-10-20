/**
 * Admin webhook routes
 *
 * The legacy billing webhook event log and dead-letter queue were removed
 * with the legacy billing system (HOS-1416). The router is kept as the mount
 * point in case a webhook admin surface returns for the new system.
 */
import { createRouter } from '../../../utils/create-app';

const adminWebhookRouter = createRouter();

export { adminWebhookRouter };
