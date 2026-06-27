/**
 * Commerce Lead entity schemas.
 *
 * A pre-onboarding lead submitted by a prospective commerce owner
 * via the "Sumar mi negocio" public form.
 */

// Core schema + enums
export * from './commerce-lead.schema.js';

// CRUD input schemas (create, admin-update, delete)
export * from './commerce-lead.crud.schema.js';

// Access level schemas (public response shapes)
export * from './commerce-lead.access.schema.js';
