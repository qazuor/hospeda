/**
 * Social catalog services — SPEC-254 phase 1 data model.
 *
 * Exports catalog CRUD services for the social publishing feature set.
 */

export {
    checkCanUpdatePost,
    checkCanViewPost
} from './social.permissions';
export { SocialAudienceService } from './social-audience.service';
export {
    type ListAuditLogsFilters,
    type ListAuditLogsInput,
    SocialAuditEvent,
    type SocialAuditEventType,
    type SocialAuditLogInput,
    type SocialAuditLogListResult,
    type SocialAuditLogResult,
    SocialAuditLogService
} from './social-audit-log.service';
export { SocialCampaignService } from './social-campaign.service';
export { SocialContentBatchService } from './social-content-batch.service';
export {
    DEFAULT_DISPATCH_CRON_CADENCE,
    DISPATCH_CRON_CADENCE_KEY,
    isValidCronExpression,
    type ResolveDispatchCronCadenceInput,
    resolveDispatchCronCadence
} from './social-dispatch-cron-config.util';
export {
    type IngestDraftInput,
    type IngestionResult,
    type IngestionResultCode,
    type IngestionSuccessData,
    SocialDraftIngestionService
} from './social-draft-ingestion.service';
export { SocialHashtagService } from './social-hashtag.service';
export { SocialHashtagSetService } from './social-hashtag-set.service';
export {
    type GptImagePayload,
    type OpenAiFileIdRef,
    type ProcessImageInput,
    type ProcessImageResult,
    SocialImagePipelineService
} from './social-image-pipeline.service';
export {
    type PlatformFormatUpdateResult,
    SocialPlatformFormatService
} from './social-platform-format.service';
export {
    type ApprovePostInput,
    type ArchivePostInput,
    type GetDashboardInput,
    type GetPostDetailInput,
    type ListPostsFilters,
    type ListPostsInput,
    type MarkReadyPostInput,
    type PausePostInput,
    type PromoteHashtagData,
    type PromoteHashtagInput,
    type RejectPostInput,
    type RequestChangesInput,
    type SchedulePostInput,
    type ServiceWarning,
    type SocialDashboardData,
    type SocialDashboardFailureItem,
    type SocialDashboardKpis,
    type SocialDashboardQueueItem,
    type SocialPostArchiveData,
    type SocialPostDetail,
    type SocialPostListItem,
    type SocialPostListResult,
    type SocialPostPauseData,
    type SocialPostReadyData,
    type SocialPostScheduleData,
    SocialPostService,
    type SocialPostTransitionData,
    type UnpausePostInput,
    type UpdatePostData,
    type UpdatePostInput
} from './social-post.service';
export { SocialPostFooterService } from './social-post-footer.service';
export {
    type GetPublicDataInput,
    SocialPublicDataService
} from './social-public-data.service';
export {
    type BuildMakePayloadInput,
    type BuildMakePayloadResult,
    type EligibleTarget,
    type FindEligibleTargetsResult,
    SocialPublishDispatchService
} from './social-publish-dispatch.service';
export {
    type ListPublishLogsFilters,
    type ListPublishLogsInput,
    type SocialPublishLogListResult,
    SocialPublishLogService
} from './social-publish-log.service';
export {
    SocialSettingService,
    type SocialSettingUpdateByKeyResult
} from './social-setting.service';
