/**
 * Admin social routes — SPEC-254.
 * Re-exports all catalog entity route groups and the config route groups
 * (platform-formats, settings) for registration in the main router.
 */
export { adminSocialAudienceRoutes } from './audiences/index';
export { adminSocialBatchRoutes } from './batches/index';
export { adminSocialCampaignRoutes } from './campaigns/index';
export { adminSocialFooterRoutes } from './footers/index';
export { adminSocialHashtagRoutes } from './hashtags/index';
export { adminSocialHashtagSetRoutes } from './hashtag-sets/index';
// Config route groups (T-019)
export { adminSocialPlatformFormatRoutes } from './platform-formats/index';
export { adminSocialSettingRoutes } from './settings/index';
