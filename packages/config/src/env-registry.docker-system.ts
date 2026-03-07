/**
 * Docker and system environment variable definitions for the Hospeda monorepo.
 *
 * Docker variables configure the `docker-compose.yml` services (PostgreSQL,
 * Redis). System variables are injected by the runtime environment (Node.js,
 * CI, Vercel) and are not set manually in `.env` files.
 *
 * @module env-registry.docker-system
 */
import type { EnvVarDefinition } from './env-registry-types.js';

/**
 * Docker Compose service configuration variables.
 *
 * @example
 * ```ts
 * import { DOCKER_ENV_VARS } from './env-registry.docker-system.js';
 * ```
 */
export const DOCKER_ENV_VARS = [
    {
        name: 'POSTGRES_USER',
        description: 'PostgreSQL superuser name used by the Docker Compose database service',
        type: 'string',
        required: true,
        secret: false,
        exampleValue: 'hospeda',
        apps: ['docker'],
        category: 'docker'
    },
    {
        name: 'POSTGRES_PASSWORD',
        description: 'PostgreSQL superuser password for the Docker Compose database service',
        type: 'string',
        required: true,
        secret: true,
        exampleValue: 'hospeda',
        apps: ['docker'],
        category: 'docker'
    },
    {
        name: 'POSTGRES_DB',
        description: 'PostgreSQL database name created on first boot by the Docker service',
        type: 'string',
        required: true,
        secret: false,
        exampleValue: 'hospeda',
        apps: ['docker'],
        category: 'docker'
    },
    {
        name: 'POSTGRES_PORT',
        description: 'Host-side port mapped to the PostgreSQL Docker container',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '5432',
        exampleValue: '5432',
        apps: ['docker'],
        category: 'docker'
    },
    {
        name: 'REDIS_PORT',
        description: 'Host-side port mapped to the Redis Docker container',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '6379',
        exampleValue: '6379',
        apps: ['docker'],
        category: 'docker'
    }
] as const satisfies readonly EnvVarDefinition[];

/**
 * System/runtime environment variables set by Node.js, CI systems, or Vercel.
 *
 * @example
 * ```ts
 * import { SYSTEM_ENV_VARS } from './env-registry.docker-system.js';
 * ```
 */
export const SYSTEM_ENV_VARS = [
    {
        name: 'NODE_ENV',
        description: 'Node.js execution environment; controls optimisations and feature flags',
        type: 'enum',
        required: false,
        secret: false,
        defaultValue: 'development',
        exampleValue: 'development',
        enumValues: ['development', 'production', 'test'] as const,
        apps: ['api', 'web', 'admin'],
        category: 'system'
    },
    {
        name: 'CI',
        description: 'Set to true by most CI systems; disables interactive prompts',
        type: 'boolean',
        required: false,
        secret: false,
        exampleValue: 'false',
        apps: ['api'],
        category: 'system'
    },
    {
        name: 'VERCEL',
        description: 'Automatically set to 1 when running on Vercel serverless infrastructure',
        type: 'boolean',
        required: false,
        secret: false,
        exampleValue: 'false',
        apps: ['api'],
        category: 'system'
    },
    {
        name: 'VERCEL_GIT_COMMIT_SHA',
        description: 'Full Git commit SHA injected by Vercel at build time',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'abc123def456',
        apps: ['api'],
        category: 'system'
    },
    {
        name: 'SENTRY_ENVIRONMENT',
        description: 'Sentry environment tag applied to all events emitted by the API',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'production',
        apps: ['api'],
        category: 'system'
    },
    {
        name: 'TEST_DB_URL',
        description: 'PostgreSQL connection string for E2E test database setup scripts',
        type: 'url',
        required: false,
        secret: false,
        exampleValue: 'postgresql://postgres:postgres@localhost:5432/hospeda_test',
        apps: ['api'],
        category: 'system'
    },
    {
        name: 'TEST_DB_NAME',
        description: 'Database name used by E2E test setup scripts',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'hospeda_test',
        exampleValue: 'hospeda_test',
        apps: ['api'],
        category: 'system'
    }
] as const satisfies readonly EnvVarDefinition[];
