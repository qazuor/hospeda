// Social entity schemas — SPEC-254

// AI catalog HTTP response schema (T-026, reused by T-030)
export * from './social-catalog.http.schema.js';

// AI draft ingestion HTTP schema (T-028, T-029)
export * from './social-draft.http.schema.js';

// FULL entities (schema + crud + admin-search)
export * from './social-campaign.index.js';
export * from './social-content-batch.index.js';
export * from './social-audience.index.js';
export * from './social-hashtag.index.js';
export * from './social-hashtag-set.index.js';
export * from './social-post-footer.index.js';
export * from './social-platform.index.js';
export * from './social-platform-format.index.js';
export * from './social-asset.index.js';
export * from './social-setting.index.js';
export * from './social-post.index.js';
export * from './social-post-target.index.js';

// MINIMAL entities (schema only — join tables and append-only logs)
export * from './social-post-media.index.js';
export * from './social-post-hashtag.index.js';
export * from './social-ai-request.index.js';
export * from './social-publish-log.index.js';
export * from './social-audit-log.index.js';

// Dashboard response schema (T-037)
export * from './social-dashboard.schema.js';

// Make.com dispatch payload schema (T-044)
export * from './social-make-payload.schema.js';
