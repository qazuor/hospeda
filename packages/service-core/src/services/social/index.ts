/**
 * Social catalog services — SPEC-254 phase 1 data model.
 *
 * Exports catalog CRUD services for the social publishing feature set.
 */
export { SocialAudienceService } from './social-audience.service';
export { SocialCampaignService } from './social-campaign.service';
export { SocialContentBatchService } from './social-content-batch.service';
export { SocialHashtagService } from './social-hashtag.service';
export { SocialHashtagSetService } from './social-hashtag-set.service';
export { SocialPostFooterService } from './social-post-footer.service';
export {
    SocialPlatformFormatService,
    type PlatformFormatUpdateResult
} from './social-platform-format.service';
export {
    SocialSettingService,
    type SocialSettingUpdateByKeyResult
} from './social-setting.service';
export {
    SocialImagePipelineService,
    type GptImagePayload,
    type OpenAiFileRef,
    type ProcessImageInput,
    type ProcessImageResult
} from './social-image-pipeline.service';
export {
    SocialDraftIngestionService,
    type IngestDraftInput,
    type IngestionResult,
    type IngestionResultCode,
    type IngestionSuccessData
} from './social-draft-ingestion.service';
