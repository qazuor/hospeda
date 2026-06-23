/**
 * Admin social platform-format routes.
 * Seed-only entity: no create, no delete — list + patch only.
 * SOCIAL_PLATFORM_FORMAT_VIEW for list; SOCIAL_PLATFORM_MANAGE for patch.
 */
import { createRouter } from '../../../../utils/create-app';
import { adminListSocialPlatformFormatsRoute } from './list';
import { adminPatchSocialPlatformFormatRoute } from './patch';

const app = createRouter();

app.route('/', adminListSocialPlatformFormatsRoute);
app.route('/', adminPatchSocialPlatformFormatRoute);

export { app as adminSocialPlatformFormatRoutes };
