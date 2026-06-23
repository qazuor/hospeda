/**
 * @file index.ts
 *
 * Barrel for Make.com social publish job callback routes.
 *
 * Each route is an OpenAPIHono sub-router returned by `createApiKeyRoute`.
 * The main router (routes/index.ts) mounts them at their full paths:
 *  - makeClaimCallbackRoute  → /api/v1/integrations/make/social/jobs
 *  - makeResultCallbackRoute → /api/v1/integrations/make/social/jobs
 *
 * @module routes/integrations/make/social/jobs
 * @see SPEC-254 T-048
 */

export { makeClaimCallbackRoute } from './claim';
export { makeResultCallbackRoute } from './result';
