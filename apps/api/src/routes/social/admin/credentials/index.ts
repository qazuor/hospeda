/**
 * Admin social credential vault routes (HOS-64 G-4, T-026).
 * All operations require SOCIAL_SETTINGS_MANAGE permission (reused per T-001,
 * mirroring how the AI vault reuses AI_SETTINGS_MANAGE rather than minting a
 * dedicated permission).
 */
import { createRouter } from '../../../../utils/create-app';
import { adminCreateSocialCredentialRoute } from './create';
import { adminListSocialCredentialsRoute } from './list';

const app = createRouter();

app.route('/', adminListSocialCredentialsRoute);
app.route('/', adminCreateSocialCredentialRoute);

export { app as adminSocialCredentialRoutes };
