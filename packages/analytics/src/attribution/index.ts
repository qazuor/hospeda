export {
    buildEmailTemplateCampaign,
    buildNewsletterCampaignSlug,
    toUtmToken
} from './email-attribution-slugs.js';
export { buildOwnWebOrigins, isOwnWebUrl } from './own-origin.js';
export type {
    DirectOutreachUtmParams,
    EmailUtmParams,
    PresentationAudience,
    PrintUtmParams,
    ProfileUtmParams,
    QrCampaign,
    ShareCampaign,
    ShareUtmParams,
    UtmMedium,
    UtmParams,
    UtmSource
} from './vocabulary.js';
export {
    DIRECT_OUTREACH_SOURCES,
    PRESENTATION_AUDIENCES,
    PROFILE_SOURCES,
    QR_CAMPAIGNS,
    SHARE_CAMPAIGNS,
    SHARE_SOURCES,
    UTM_CONTENT_MAX_LENGTH,
    UTM_EMAIL_CAMPAIGN_MAX_LENGTH,
    UTM_MEDIUMS,
    UTM_SOURCES,
    UTM_TOKEN_REGEX,
    UtmParamsSchema
} from './vocabulary.js';
export type { WithUtmInput } from './with-utm.js';
export { InvalidUtmParamsError, withUtm } from './with-utm.js';
