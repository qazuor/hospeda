/**
 * Admin social settings routes.
 * All operations require SOCIAL_SETTINGS_MANAGE permission.
 * Secret-typed values are masked in list; echoed in full on PATCH response.
 */
import { createRouter } from '../../../../utils/create-app';
import { adminListSocialSettingsRoute } from './list';
import { adminPatchSocialSettingByKeyRoute } from './patch-by-key';

const app = createRouter();

app.route('/', adminListSocialSettingsRoute);
app.route('/', adminPatchSocialSettingByKeyRoute);

export { app as adminSocialSettingRoutes };
