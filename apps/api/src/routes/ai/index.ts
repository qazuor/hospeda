/**
 * AI admin route barrel (SPEC-173 T-026/T-027/T-028).
 *
 * Re-exports all admin AI route groups for registration in the main router.
 * Each group is mounted under `/api/v1/admin/ai/*` by the orchestrator
 * (apps/api/src/routes/index.ts — NOT modified here).
 *
 * @module routes/ai
 */

export { adminAiCredentialsRoutes } from './credentials/index.js';
export { adminAiSettingsRoutes } from './settings/index.js';
export { adminAiPromptsRoutes } from './prompts/index.js';
