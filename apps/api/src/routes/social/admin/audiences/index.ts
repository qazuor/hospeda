/**
 * Admin social audience routes.
 * All operations require SOCIAL_AUDIENCE_MANAGE permission.
 */
import { createRouter } from '../../../../utils/create-app';
import { adminCreateSocialAudienceRoute } from './create';
import { adminDeleteSocialAudienceRoute } from './delete';
import { adminGetSocialAudienceByIdRoute } from './getById';
import { adminListSocialAudiencesRoute } from './list';
import { adminPatchSocialAudienceRoute } from './patch';

const app = createRouter();

app.route('/', adminListSocialAudiencesRoute);
app.route('/', adminCreateSocialAudienceRoute);
app.route('/', adminGetSocialAudienceByIdRoute);
app.route('/', adminPatchSocialAudienceRoute);
app.route('/', adminDeleteSocialAudienceRoute);

export { app as adminSocialAudienceRoutes };
