export {
    adminCreatePartnerRoute,
    adminDeletePartnerRoute,
    adminGetPartnerRoute,
    adminListPartnerPlansRoute,
    adminListPartnersRoute,
    adminManualPaymentRoute,
    adminReviewPartnerContentRoute,
    adminRevokePartnerRoute,
    adminSendPaymentLinkRoute,
    adminUpdatePartnerRoute
} from './admin/index.js';
export {
    adminCreatePartnerMentionsRoute,
    adminDeletePartnerMentionRoute,
    adminListPartnerMentionsRoute,
    adminUpdatePartnerMentionRoute
} from './admin/mentions/index.js';
export { protectedPartnerRoutes } from './protected/index.js';
export { publicPartnersRoutes } from './public/index.js';
