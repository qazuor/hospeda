/**
 * Alliance Lead entity schemas.
 *
 * A qualified lead submitted through one of the four "aliados" public
 * landing pages (partner, sponsor, editor, service_provider), reviewed by
 * an admin in a dedicated inbox (HOS-277).
 */

// Access level schemas (public response shapes)
export * from './alliance-lead.access.schema.js';

// Admin list query schema
export * from './alliance-lead.admin-search.schema.js';
// CRUD input schemas (create, mark-handled, admin-update, delete)
export * from './alliance-lead.crud.schema.js';
// Core schema + enums
export * from './alliance-lead.schema.js';
