/**
 * AI social routes barrel — SPEC-254 T-026, T-029.
 * Registers the GPT-authenticated social catalog and draft submission endpoints.
 *
 * Routes returned by `createApiKeyRoute` are OpenAPIHono sub-routers;
 * the main router mounts them at their respective paths.
 */
export { socialCatalogRoute as aiSocialCatalogRoute } from './catalog';
export { socialDraftsRoute as aiSocialDraftsRoute } from './drafts';
