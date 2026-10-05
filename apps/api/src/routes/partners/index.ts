export {
    adminCreatePartnerRoute,
    adminDeletePartnerRoute,
    adminGetPartnerRoute,
    adminListPartnersRoute,
    adminManualPaymentRoute,
    adminReviewPartnerContentRoute,
    adminReviewPartnerPaymentRoute,
    adminRevokePartnerRoute,
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
