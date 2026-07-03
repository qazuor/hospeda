/**
 * Admin social credential vault routes (HOS-64 G-4, T-026/T-027).
 * All operations require SOCIAL_SETTINGS_MANAGE permission (reused per T-001,
 * mirroring how the AI vault reuses AI_SETTINGS_MANAGE rather than minting a
 * dedicated permission).
 */
import { createRouter } from '../../../../utils/create-app';
import { adminCreateSocialCredentialRoute } from './create';
import { adminDeleteSocialCredentialRoute } from './delete';
import { adminListSocialCredentialsRoute } from './list';
import { adminRotateSocialCredentialRoute } from './rotate';
import { adminUpdateSocialCredentialRoute } from './update';

const app = createRouter();

app.route('/', adminListSocialCredentialsRoute);
app.route('/', adminCreateSocialCredentialRoute);
app.route('/', adminRotateSocialCredentialRoute);
app.route('/', adminUpdateSocialCredentialRoute);
app.route('/', adminDeleteSocialCredentialRoute);

export { app as adminSocialCredentialRoutes };
