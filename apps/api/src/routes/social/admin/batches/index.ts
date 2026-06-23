/**
 * Admin social content batch routes.
 * All operations require SOCIAL_BATCH_MANAGE permission.
 */
import { createRouter } from '../../../../utils/create-app';
import { adminCreateSocialBatchRoute } from './create';
import { adminDeleteSocialBatchRoute } from './delete';
import { adminGetSocialBatchByIdRoute } from './getById';
import { adminListSocialBatchesRoute } from './list';
import { adminPatchSocialBatchRoute } from './patch';

const app = createRouter();

app.route('/', adminListSocialBatchesRoute);
app.route('/', adminCreateSocialBatchRoute);
app.route('/', adminGetSocialBatchByIdRoute);
app.route('/', adminPatchSocialBatchRoute);
app.route('/', adminDeleteSocialBatchRoute);

export { app as adminSocialBatchRoutes };
