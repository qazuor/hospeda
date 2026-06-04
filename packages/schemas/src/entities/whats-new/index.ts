/**
 * @module entities/whats-new
 *
 * Public API for the What's New / Release Notes feature schemas (SPEC-175).
 *
 * Entry schema (SSOT for the curated data file):
 *   - {@link WhatsNewEntryI18nSchema} — i18n shape (es required, en/pt optional)
 *   - {@link WhatsNewEntrySchema} — full curated entry shape
 *   - {@link WhatsNewAudienceRoleSchema} — audience targeting enum
 *
 * HTTP schemas (request/response for the protected-tier endpoints):
 *   - {@link WhatsNewSeenBodySchema} — PATCH body for marking entries seen
 *   - {@link WhatsNewItemSchema} — single item in the GET response
 *   - {@link WhatsNewGetResponseSchema} — full GET response
 */

// Base entity schemas
export * from './whats-new.schema.js';

// HTTP request / response schemas
export * from './whats-new.http.schema.js';
