/**
 * AI social routes barrel — SPEC-254 T-026.
 * Registers the GPT-authenticated social catalog endpoint.
 *
 * The `socialCatalogRoute` returned by `createApiKeyRoute` is already an
 * OpenAPIHono sub-router; we re-export it so the main router can mount it
 * at `/api/v1/ai/social/catalog`.
 */
export { socialCatalogRoute as aiSocialCatalogRoute } from './catalog';
