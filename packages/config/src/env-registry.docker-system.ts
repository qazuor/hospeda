/**
 * Docker and system environment variable definitions for the Hospeda monorepo.
 *
 * Docker variables configure the `docker-compose.yml` services (PostgreSQL,
 * Redis). System variables are injected by the runtime environment (Node.js,
 * CI) and are not set manually in `.env` files.
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
        descriptionEs: 'Nombre del superusuario de PostgreSQL en el servicio Docker Compose',
        type: 'string',
        required: true,
        secret: false,
        exampleValue: 'hospeda',
        apps: ['docker'],
        category: 'docker',
        howToObtain:
            'Pick any username (e.g. "hospeda"). Used only inside the local Docker container — has no relation to your production DB user.',
        howToObtainEs:
            'Elegí cualquier nombre de usuario (ej: "hospeda"). Solo se usa dentro del contenedor Docker local; no tiene relación con el usuario de producción.'
    },
    {
        name: 'POSTGRES_PASSWORD',
        description: 'PostgreSQL superuser password for the Docker Compose database service',
        descriptionEs: 'Contraseña del superusuario de PostgreSQL en el servicio Docker Compose',
        type: 'string',
        required: true,
        secret: true,
        exampleValue: 'hospeda',
        apps: ['docker'],
        category: 'docker',
        howToObtain:
            'Pick any password — local Docker only. Use something simple like "hospeda" or "password" since it never leaves your machine.',
        howToObtainEs:
            'Elegí cualquier contraseña; solo es para Docker local. Algo simple como "hospeda" o "password" alcanza porque nunca sale de tu máquina.'
    },
    {
        name: 'POSTGRES_DB',
        description: 'PostgreSQL database name created on first boot by the Docker service',
        descriptionEs: 'Nombre de la base de datos que crea el contenedor en el primer arranque',
        type: 'string',
        required: true,
        secret: false,
        exampleValue: 'hospeda',
        apps: ['docker'],
        category: 'docker',
        howToObtain:
            'Database name auto-created on first container boot. Typical: "hospeda_dev". Has to match the DB part of HOSPEDA_DATABASE_URL.',
        howToObtainEs:
            'Nombre de DB que se crea automáticamente al arrancar el contenedor. Típicamente "hospeda_dev". Tiene que coincidir con la parte de la base en HOSPEDA_DATABASE_URL.'
    },
    {
        name: 'POSTGRES_PORT',
        description: 'Host-side port mapped to the PostgreSQL Docker container',
        descriptionEs: 'Puerto del host mapeado al contenedor de PostgreSQL',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '5436',
        exampleValue: '5436',
        apps: ['docker'],
        category: 'docker',
        howToObtain:
            'Port your machine exposes Postgres on. Default 5436 (this repo offsets to avoid collision with a system Postgres on 5432). Change it if 5436 is also taken.',
        howToObtainEs:
            'Puerto donde tu máquina expone Postgres. Por defecto 5436 (este repo usa un puerto desplazado para evitar colisionar con un Postgres de sistema en 5432). Cambialo si el 5436 también está ocupado.'
    },
    {
        name: 'REDIS_PORT',
        description: 'Host-side port mapped to the Redis Docker container',
        descriptionEs: 'Puerto del host mapeado al contenedor de Redis',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '6381',
        exampleValue: '6381',
        apps: ['docker'],
        category: 'docker',
        howToObtain:
            'Port your machine exposes Redis on. Default 6381 (this repo offsets to avoid collision with a system Redis on 6379). Change if 6381 is also taken.',
        howToObtainEs:
            'Puerto donde tu máquina expone Redis. Por defecto 6381 (este repo usa un puerto desplazado para evitar colisionar con un Redis de sistema en 6379). Cambialo si el 6381 también está ocupado.'
    }
] as const satisfies readonly EnvVarDefinition[];

/**
 * System/runtime environment variables set by Node.js or CI systems.
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
        descriptionEs: 'Entorno de ejecución de Node.js; controla optimizaciones y feature flags',
        type: 'enum',
        required: false,
        secret: false,
        defaultValue: 'development',
        exampleValue: 'development',
        enumValues: ['development', 'production', 'test'] as const,
        apps: ['api', 'web', 'admin'],
        category: 'system',
        howToObtain:
            'Auto-set by the runtime. In Coolify the platform-level NODE_ENV is "production"; locally use "development" or leave it unset and pnpm scripts pick the right value.',
        howToObtainEs:
            'Lo setea el runtime automáticamente. En Coolify queda en "production" a nivel plataforma; en local usá "development" o dejala vacía y los scripts de pnpm eligen el valor correcto.'
    },
    {
        name: 'CI',
        description: 'Set to true by most CI systems; disables interactive prompts',
        descriptionEs: 'Lo ponen en true los sistemas de CI; desactiva los prompts interactivos',
        type: 'boolean',
        required: false,
        secret: false,
        platformInjected: true,
        exampleValue: 'false',
        apps: ['api'],
        category: 'system',
        howToObtain:
            'Auto-set by GitHub Actions and most CI runners. Do NOT set manually. Code uses it to disable interactive prompts in scripts.',
        howToObtainEs:
            'Lo setean automáticamente GitHub Actions y la mayoría de los runners de CI. NO lo seteés a mano. El código lo usa para apagar prompts interactivos en scripts.'
    },
    {
        name: 'VERCEL',
        description:
            'Set to "1" by the Vercel deployment platform. Present on all Vercel builds and preview/production deploys.',
        descriptionEs:
            'Lo pone en "1" la plataforma de despliegue Vercel. Presente en todos los builds y deploys de Vercel.',
        type: 'string',
        required: false,
        secret: false,
        platformInjected: true,
        exampleValue: '1',
        apps: ['api', 'web', 'admin'],
        category: 'system',
        howToObtain:
            'Injected automatically by Vercel. Do NOT set manually. Legacy — this project now deploys on Coolify (VPS). Kept in the registry because some build scripts still read it.',
        howToObtainEs:
            'Lo inyecta Vercel automáticamente. NO lo seteés a mano. Legacy — este proyecto ahora deploya en Coolify (VPS). Se mantiene en el registry porque algunos scripts de build todavía lo leen.'
    },
    {
        name: 'VERCEL_GIT_COMMIT_SHA',
        description:
            'Full git commit SHA injected by Vercel on each deployment. Used as a release identifier in Sentry and build metadata.',
        descriptionEs:
            'SHA completo del commit git que inyecta Vercel en cada deploy. Se usa como identificador de release en Sentry y metadatos de build.',
        type: 'string',
        required: false,
        secret: false,
        platformInjected: true,
        exampleValue: 'abc123def456789012345678901234567890abcd',
        apps: ['api', 'web', 'admin'],
        category: 'system',
        howToObtain:
            'Injected automatically by Vercel. Do NOT set manually. Legacy — this project now deploys on Coolify (VPS) where HOSPEDA_COMMIT_SHA is the preferred equivalent.',
        howToObtainEs:
            'Lo inyecta Vercel automáticamente. NO lo seteés a mano. Legacy — este proyecto ahora deploya en Coolify (VPS) donde HOSPEDA_COMMIT_SHA es el equivalente preferido.'
    },
    // SENTRY_ENVIRONMENT: Deferred.. use import.meta.env.MODE or NODE_ENV instead
    {
        name: 'TEST_DB_URL',
        description: 'PostgreSQL connection string for E2E test database setup scripts',
        descriptionEs:
            'Connection string de PostgreSQL para los scripts de setup de la DB de tests E2E',
        type: 'url',
        required: false,
        secret: false,
        exampleValue: 'postgresql://postgres:postgres@localhost:5432/hospeda_test',
        apps: ['api'],
        category: 'system',
        howToObtain:
            'Postgres connection string used by E2E test bootstrap to drop/recreate the test DB. Local-only — never set in prod. Format: postgresql://USER:PASS@HOST:PORT/DBNAME.',
        howToObtainEs:
            'Connection string de Postgres que usa el bootstrap de los E2E para tirar y recrear la base de tests. Solo local; nunca la pongas en prod. Formato: postgresql://USUARIO:PASS@HOST:PUERTO/BASE.'
    },
    {
        name: 'TEST_DB_NAME',
        description: 'Database name used by E2E test setup scripts',
        descriptionEs: 'Nombre de la base de datos que usan los scripts de setup de tests E2E',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'hospeda_test',
        exampleValue: 'hospeda_test',
        apps: ['api'],
        category: 'system',
        howToObtain:
            'Name of the throwaway DB the E2E suite recreates each run. Default: "hospeda_test". Should NEVER be the same name as your real dev DB.',
        howToObtainEs:
            'Nombre de la DB descartable que la suite E2E recrea en cada corrida. Por defecto "hospeda_test". NUNCA uses el mismo nombre que tu DB de desarrollo real.'
    }
] as const satisfies readonly EnvVarDefinition[];
