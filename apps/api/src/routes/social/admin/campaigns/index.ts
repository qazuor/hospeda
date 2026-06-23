/**
 * Admin social campaign routes.
 * All operations require SOCIAL_CAMPAIGN_MANAGE permission.
 */
import { createRouter } from '../../../../utils/create-app';
import { adminCreateSocialCampaignRoute } from './create';
import { adminDeleteSocialCampaignRoute } from './delete';
import { adminGetSocialCampaignByIdRoute } from './getById';
import { adminListSocialCampaignsRoute } from './list';
import { adminPatchSocialCampaignRoute } from './patch';

const app = createRouter();

app.route('/', adminListSocialCampaignsRoute);
app.route('/', adminCreateSocialCampaignRoute);
app.route('/', adminGetSocialCampaignByIdRoute);
app.route('/', adminPatchSocialCampaignRoute);
app.route('/', adminDeleteSocialCampaignRoute);

export { app as adminSocialCampaignRoutes };
