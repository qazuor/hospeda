/**
 * Admin social post footer routes.
 * All operations require SOCIAL_FOOTER_MANAGE permission.
 */
import { createRouter } from '../../../../utils/create-app';
import { adminCreateSocialFooterRoute } from './create';
import { adminDeleteSocialFooterRoute } from './delete';
import { adminGetSocialFooterByIdRoute } from './getById';
import { adminListSocialFootersRoute } from './list';
import { adminPatchSocialFooterRoute } from './patch';

const app = createRouter();

app.route('/', adminListSocialFootersRoute);
app.route('/', adminCreateSocialFooterRoute);
app.route('/', adminGetSocialFooterByIdRoute);
app.route('/', adminPatchSocialFooterRoute);
app.route('/', adminDeleteSocialFooterRoute);

export { app as adminSocialFooterRoutes };
