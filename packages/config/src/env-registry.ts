/**
 * Registry of all environment variables used across the Hospeda monorepo.
 *
 * This module is the single source of truth for documenting every environment
 * variable: its type, which apps consume it, whether it is secret, and what a
 * valid example value looks like. It is used to generate `.env.example` files,
 * validate env audits, and produce developer documentation.
 *
 * The registry is split into category-specific modules to keep each file under
 * the 500-line limit, then re-assembled here into a single `ENV_REGISTRY` array.
 *
 * @module env-registry
 */

export type { AppId, EnvVarDefinition, EnvVarType } from './env-registry-types.js';

export { API_CONFIG_ENV_VARS } from './env-registry.api-config.js';
export { CLIENT_ADMIN_ENV_VARS, CLIENT_WEB_ENV_VARS } from './env-registry.client.js';
export { DOCKER_ENV_VARS, SYSTEM_ENV_VARS } from './env-registry.docker-system.js';
export { HOSPEDA_ENV_VARS } from './env-registry.hospeda.js';

import type { EnvVarDefinition } from './env-registry-types.js';
import { API_CONFIG_ENV_VARS } from './env-registry.api-config.js';
import { CLIENT_ADMIN_ENV_VARS, CLIENT_WEB_ENV_VARS } from './env-registry.client.js';
import { DOCKER_ENV_VARS, SYSTEM_ENV_VARS } from './env-registry.docker-system.js';
import { HOSPEDA_ENV_VARS } from './env-registry.hospeda.js';

/**
 * Canonical registry of every environment variable used across the
 * Hospeda monorepo, assembled from category-specific modules.
 *
 * Groups included:
 * - `HOSPEDA_*` — server-side platform variables (auth, database, billing, etc.)
 * - `API_*`     — Hono API server middleware configuration
 * - `PUBLIC_*`  — browser-exposed variables for `apps/web` (Astro)
 * - `VITE_*`    — browser-exposed variables for `apps/admin` (TanStack / Vite)
 * - Docker      — `docker-compose.yml` service configuration
 * - System      — runtime variables set by Node.js, CI, or Vercel
 *
 * Use this registry as the single source of truth when:
 * - Generating `.env.example` files
 * - Auditing which apps need which variables
 * - Producing developer documentation
 * - Validating that no variable is used without being registered
 *
 * @example
 * ```ts
 * import { ENV_REGISTRY } from '@repo/config';
 *
 * const secretVars = ENV_REGISTRY.filter(v => v.secret);
 * const apiVars    = ENV_REGISTRY.filter(v => v.apps.includes('api'));
 * const hospedaVars = ENV_REGISTRY.filter(v => v.name.startsWith('HOSPEDA_'));
 * ```
 */
export const ENV_REGISTRY: readonly EnvVarDefinition[] = [
    ...HOSPEDA_ENV_VARS,
    ...API_CONFIG_ENV_VARS,
    ...CLIENT_WEB_ENV_VARS,
    ...CLIENT_ADMIN_ENV_VARS,
    ...DOCKER_ENV_VARS,
    ...SYSTEM_ENV_VARS
];
