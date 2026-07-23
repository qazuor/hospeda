// Core schemas (new structure: separate .schema.ts and .type.ts files)
// Foundation schemas (Phase 1) - explicit exports to avoid conflicts

// Schemas
export * from './admin.schema.js';
// Admin search
export * from './admin-search.schema.js';
export * from './audit.schema.js';
export {
    type BaseAudit,
    BaseAuditSchema,
    type BaseSearch,
    BaseSearchSchema,
    type PaginationParams,
    PaginationParamsSchema,
    type SortingParams,
    SortingParamsSchema,
    UuidSchema
} from './base.schema.js';
// Commerce listing publish-readiness ("complete") contract — single
// canonical definition shared by web, service-core, and apps/api (HOS-166 R-5)
export * from './commerce-completeness.js';
// Commerce common schemas (SPEC-239)
export * from './commerce-identity.schema.js';
export * from './commerce-owner-listing.schema.js';
export * from './commerce-rating.schema.js';
export * from './contact.schema.js';
// Relation-selector lookup options (SPEC-169 §5.5)
export * from './entity-options.schema.js';
export * from './faq.schema.js';
export * from './helpers.schema.js';
// Shared i18n text schema (I18nTextSchema, i18nText factory, I18nText type)
export * from './i18n.schema.js';
export * from './ia.schema.js';
export * from './id.schema.js';
export * from './lifecycle.schema.js';
export * from './location.schema.js';
export * from './media.schema.js';
export * from './media-upload.schema.js';
export * from './moderation.schema.js';
export * from './opening-hours.schema.js';
// Skip pagination.schema.js to avoid `BaseSearchSchema` conflict with base.schema.js,
// but re-export the non-conflicting schemas: multi-sort primitives and pagination result shapes.
export {
    CursorPaginationResultSchema,
    PaginationResultSchema,
    type SortField,
    SortFieldSchema
} from './pagination.schema.js';
export * from './params.schema.js';
export * from './password.schema.js';
export * from './price.schema.js';
// Query helpers
export { queryBooleanParam, queryDateParam, queryNumberParam } from './query-helpers.js';
export * from './relations.schema.js';
export * from './review.schema.js';
export * from './seo.schema.js';
export * from './social.schema.js';
export * from './tags.schema.js';
export * from './visibility.schema.js';

// Migration completed ✅
