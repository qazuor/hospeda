/**
 * Host-trade routes
 * Re-exports all route tiers: protected and admin.
 * No public tier — host-trade entries are a host-only perk; public access is not supported.
 */
export { adminHostTradeRoutes } from './admin/index.js';
export { protectedHostTradeRoutes } from './protected/index.js';
