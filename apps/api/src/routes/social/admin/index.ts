/**
 * Admin social routes — SPEC-254.
 * Re-exports all catalog entity route groups and the config route groups
 * (platform-formats, settings) for registration in the main router.
 */
export { adminSocialAudienceRoutes } from './audiences/index';
export { adminSocialAuditLogRoutes } from './audit-log/index';
export { adminSocialBatchRoutes } from './batches/index';
export { adminSocialCampaignRoutes } from './campaigns/index';
// Social credential vault (HOS-64 G-4, T-026)
export { adminSocialCredentialRoutes } from './credentials/index';
// Social dashboard + publish-logs + audit-log (T-037)
export { adminSocialDashboardRoutes } from './dashboard/index';
export { adminSocialFooterRoutes } from './footers/index';
// GPT Action schema export (T-030)
export { adminGetGptActionSchemaRoute } from './gpt-action-schema';
export { adminSocialHashtagSetRoutes } from './hashtag-sets/index';
export { adminSocialHashtagRoutes } from './hashtags/index';
// Make.com webhook config export (HOS-67 G-6)
export { adminGetMakeWebhookSchemaRoute } from './make-webhook-schema';
// Config route groups (T-019)
export { adminSocialPlatformFormatRoutes } from './platform-formats/index';
// Social post routes (T-036 transitions + T-037 CRUD)
export { adminSocialPostTransitionRoutes } from './posts/index';
export { adminSocialPublishLogRoutes } from './publish-logs/index';
export { adminSocialSettingRoutes } from './settings/index';
