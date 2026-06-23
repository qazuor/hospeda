/**
 * Admin social hashtag set routes.
 * All operations require SOCIAL_HASHTAG_SET_MANAGE permission.
 */
import { createRouter } from '../../../../utils/create-app';
import { adminCreateSocialHashtagSetRoute } from './create';
import { adminDeleteSocialHashtagSetRoute } from './delete';
import { adminGetSocialHashtagSetByIdRoute } from './getById';
import { adminListSocialHashtagSetsRoute } from './list';
import { adminPatchSocialHashtagSetRoute } from './patch';

const app = createRouter();

app.route('/', adminListSocialHashtagSetsRoute);
app.route('/', adminCreateSocialHashtagSetRoute);
app.route('/', adminGetSocialHashtagSetByIdRoute);
app.route('/', adminPatchSocialHashtagSetRoute);
app.route('/', adminDeleteSocialHashtagSetRoute);

export { app as adminSocialHashtagSetRoutes };
