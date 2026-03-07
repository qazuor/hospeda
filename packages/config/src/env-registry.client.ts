/**
 * Client-side environment variable definitions for the Hospeda monorepo.
 *
 * Contains `PUBLIC_*` variables (Astro web app, browser-exposed) and
 * `VITE_*` variables (TanStack Start admin dashboard, Vite-exposed).
 * None of these variables may contain secrets unless explicitly noted.
 *
 * @module env-registry.client
 */
import type { EnvVarDefinition } from './env-registry-types.js';

/**
 * `PUBLIC_*` environment variable definitions consumed by `apps/web`.
 *
 * @example
 * ```ts
 * import { CLIENT_WEB_ENV_VARS } from './env-registry.client.js';
 * ```
 */
export const CLIENT_WEB_ENV_VARS = [
    {
        name: 'PUBLIC_API_URL',
        description: 'API base URL exposed to the browser (Astro PUBLIC_ prefix)',
        type: 'url',
        required: true,
        secret: false,
        exampleValue: 'http://localhost:3001',
        apps: ['web'],
        category: 'client-web'
    },
    {
        name: 'PUBLIC_SITE_URL',
        description: 'Web app base URL exposed to the browser (Astro PUBLIC_ prefix)',
        type: 'url',
        required: true,
        secret: false,
        exampleValue: 'http://localhost:4321',
        apps: ['web'],
        category: 'client-web'
    },
    {
        name: 'PUBLIC_SENTRY_DSN',
        description: 'Sentry DSN for client-side error tracking in the web app',
        type: 'url',
        required: false,
        secret: true,
        exampleValue: 'https://xxxx@sentry.io/xxxx',
        apps: ['web'],
        category: 'client-web'
    },
    {
        name: 'PUBLIC_SENTRY_RELEASE',
        description: 'Sentry release identifier for the web app',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: '1.0.0',
        apps: ['web'],
        category: 'client-web'
    },
    {
        name: 'PUBLIC_VERSION',
        description:
            'Application version string exposed to the browser for feedback auto-collection',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: '1.0.0',
        apps: ['web'],
        category: 'client-web'
    }
] as const satisfies readonly EnvVarDefinition[];

/**
 * `VITE_*` environment variable definitions consumed by `apps/admin`.
 *
 * @example
 * ```ts
 * import { CLIENT_ADMIN_ENV_VARS } from './env-registry.client.js';
 * ```
 */
export const CLIENT_ADMIN_ENV_VARS = [
    {
        name: 'VITE_API_URL',
        description: 'API endpoint for the admin dashboard (Vite VITE_ prefix)',
        type: 'url',
        required: true,
        secret: false,
        exampleValue: 'http://localhost:3001',
        apps: ['admin'],
        category: 'client-admin'
    },
    {
        name: 'VITE_BETTER_AUTH_URL',
        description: 'Better Auth endpoint URL for the admin dashboard',
        type: 'url',
        required: true,
        secret: false,
        exampleValue: 'http://localhost:3001/api/auth',
        apps: ['admin'],
        category: 'client-admin'
    },
    {
        name: 'VITE_APP_NAME',
        description: 'Display name of the admin application',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'Hospeda Admin',
        exampleValue: 'Hospeda Admin',
        apps: ['admin'],
        category: 'client-admin'
    },
    {
        name: 'VITE_APP_VERSION',
        description: 'Application version string shown in the admin UI',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: '1.0.0',
        apps: ['admin'],
        category: 'client-admin'
    },
    {
        name: 'VITE_APP_DESCRIPTION',
        description: 'Short description of the admin application',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'Panel de administracion de Hospeda',
        exampleValue: 'Panel de administracion de Hospeda',
        apps: ['admin'],
        category: 'client-admin'
    },
    {
        name: 'VITE_ENABLE_DEVTOOLS',
        description: 'Enable React DevTools integration in the admin app',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'false',
        apps: ['admin'],
        category: 'client-admin'
    },
    {
        name: 'VITE_ENABLE_QUERY_DEVTOOLS',
        description: 'Enable TanStack Query DevTools panel in the admin app',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'false',
        apps: ['admin'],
        category: 'client-admin'
    },
    {
        name: 'VITE_ENABLE_ROUTER_DEVTOOLS',
        description: 'Enable TanStack Router DevTools panel in the admin app',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'false',
        apps: ['admin'],
        category: 'client-admin'
    },
    {
        name: 'VITE_DEFAULT_PAGE_SIZE',
        description: 'Default number of rows per page in admin data tables',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '10',
        exampleValue: '10',
        apps: ['admin'],
        category: 'client-admin'
    },
    {
        name: 'VITE_MAX_PAGE_SIZE',
        description: 'Maximum number of rows per page allowed in admin data tables',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '100',
        exampleValue: '100',
        apps: ['admin'],
        category: 'client-admin'
    },
    {
        name: 'VITE_SENTRY_DSN',
        description: 'Sentry DSN for error tracking in the admin dashboard',
        type: 'url',
        required: false,
        secret: true,
        exampleValue: 'https://xxxx@sentry.io/xxxx',
        apps: ['admin'],
        category: 'client-admin'
    },
    {
        name: 'VITE_SENTRY_RELEASE',
        description: 'Sentry release identifier for the admin dashboard',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: '1.0.0',
        apps: ['admin'],
        category: 'client-admin'
    },
    {
        name: 'VITE_SENTRY_PROJECT',
        description: 'Sentry project name for the admin dashboard',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'hospeda-admin',
        apps: ['admin'],
        category: 'client-admin'
    },
    {
        name: 'VITE_DEBUG_LAZY_SECTIONS',
        description: 'Enable verbose logging for lazy-loaded section components',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'false',
        apps: ['admin'],
        category: 'client-admin'
    },
    {
        name: 'VITE_DEBUG_ACTOR_ID',
        description: 'Hard-coded actor ID injected for local development and testing',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'dev-actor-uuid',
        apps: ['admin'],
        category: 'client-admin'
    },
    {
        name: 'VITE_ENABLE_LOGGING',
        description: 'Enable client-side console logging in the admin app',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'false',
        apps: ['admin'],
        category: 'client-admin'
    },
    {
        name: 'VITE_SUPPORTED_LOCALES',
        description: 'Comma-separated list of locale codes supported by the admin app',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'es,en',
        exampleValue: 'es,en',
        apps: ['admin'],
        category: 'client-admin'
    },
    {
        name: 'VITE_DEFAULT_LOCALE',
        description: 'Default locale code used by the admin app',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'es',
        exampleValue: 'es',
        apps: ['admin'],
        category: 'client-admin'
    }
] as const satisfies readonly EnvVarDefinition[];
