// Core schemas (new structure: separate .schema.ts and .type.ts files)
// Foundation schemas (Phase 1) - explicit exports to avoid conflicts
export {
    BaseAuditSchema,
    SortingParamsSchema,
    UuidSchema,
    type BaseAudit,
    type SortingParams
} from './base.schema.js';

// New pagination and search from base.schema.ts (preferred over legacy pagination)
export {
    BaseSearchSchema,
    PaginationParamsSchema,
    type BaseSearch,
    type PaginationParams
} from './base.schema.js';

// Schemas
export * from './admin.schema.js';
export * from './audit.schema.js';
export * from './contact.schema.js';
export * from './faq.schema.js';
export * from './helpers.schema.js';
export * from './ia.schema.js';
export * from './id.schema.js';
export * from './lifecycle.schema.js';
export * from './location.schema.js';
export * from './media.schema.js';
export * from './moderation.schema.js';
// Skip pagination.schema.js to avoid conflicts with base.schema.js
export * from './price.schema.js';
export * from './review.schema.js';
export * from './seo.schema.js';
export * from './social.schema.js';
export * from './tags.schema.js';
export * from './visibility.schema.js';

// Migration completed ✅
