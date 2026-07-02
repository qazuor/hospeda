/**
 * @file index.ts
 *
 * Barrel for MercadoLibre OAuth integration routes (HOS-45 / SPEC-278).
 *
 * Mounted by the main router (routes/index.ts) at:
 *  - mercadoLibreAuthorizeRoute → /api/v1/admin/mercadolibre-oauth
 *  - mercadoLibreCallbackRoute  → /api/v1/admin/mercadolibre-oauth
 *
 * @module routes/integrations/mercadolibre-oauth
 * @see SPEC-278 T-011, T-012
 */

export { mercadoLibreAuthorizeRoute, validateAndConsumeState } from './authorize';
export { mercadoLibreCallbackRoute } from './callback';
