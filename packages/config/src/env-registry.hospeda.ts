/**
 * HOSPEDA_* environment variable definitions for the Hospeda monorepo.
 *
 * This module contains only the server-side `HOSPEDA_*` prefixed variables.
 * It is re-exported from `env-registry.ts` as part of the full `ENV_REGISTRY`.
 *
 * @module env-registry.hospeda
 */
import type { EnvVarDefinition } from './env-registry-types.js';

/**
 * All `HOSPEDA_*` environment variable definitions grouped by logical category.
 *
 * @example
 * ```ts
 * import { HOSPEDA_ENV_VARS } from './env-registry.hospeda.js';
 * const secretVars = HOSPEDA_ENV_VARS.filter(v => v.secret);
 * ```
 */
export const HOSPEDA_ENV_VARS = [
    // -------------------------------------------------------------------------
    // Core
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_API_URL',
        description: 'API base URL',
        descriptionEs: 'URL base de la API',
        type: 'url',
        required: true,
        secret: false,
        exampleValue: 'http://localhost:3001',
        apps: ['api', 'web', 'admin'],
        category: 'core',
        howToObtain:
            'Where the Hono API lives. Local: http://localhost:3001. Production: https://api.hospeda.com.ar (Coolify-managed deployment on the VPS).',
        howToObtainEs:
            'Donde corre la API de Hono. Local: http://localhost:3001. Producción: https://api.hospeda.com.ar (deploy gestionado por Coolify en el VPS).'
    },
    {
        name: 'HOSPEDA_SITE_URL',
        description: 'Web app base URL',
        descriptionEs: 'URL base del sitio web',
        type: 'url',
        required: true,
        secret: false,
        exampleValue: 'http://localhost:4321',
        apps: ['api', 'web'],
        category: 'core',
        howToObtain:
            'Where the public Astro website lives. Local: http://localhost:4321. Production: https://hospeda.com.ar (or your real domain). The API uses this for CORS allowlist and outbound links.',
        howToObtainEs:
            'Donde corre el sitio público de Astro. Local: http://localhost:4321. Producción: https://hospeda.com.ar (o tu dominio real). La API la usa para el allowlist de CORS y para armar links de salida.'
    },
    {
        name: 'HOSPEDA_ADMIN_URL',
        description: 'Admin app URL (CORS, server-side links from web)',
        descriptionEs: 'URL del admin (para CORS y para links del lado servidor desde la web)',
        type: 'url',
        required: true,
        requiredScope: 'always',
        secret: false,
        exampleValue: 'http://localhost:3000',
        apps: ['api', 'web'],
        category: 'core',
        howToObtain:
            'Where the TanStack Start admin dashboard lives. Local: http://localhost:3000. Production: https://admin.hospeda.com.ar (or your real subdomain). Used by API for CORS.',
        howToObtainEs:
            'Donde corre el dashboard de admin (TanStack Start). Local: http://localhost:3000. Producción: https://admin.hospeda.com.ar (o tu subdominio real). La API la usa para CORS.'
    },
    {
        name: 'HOSPEDA_EXTRA_TRUSTED_ORIGINS',
        description:
            'Comma-separated extra trusted origins. Applied to BOTH the Hono CORS allow-list and the Better Auth trustedOrigins (single source of truth). Used for hostname aliases beyond HOSPEDA_SITE_URL / HOSPEDA_ADMIN_URL — e.g. staging.hospeda.com.ar during pre-launch. Without this, sign-up and OAuth flows from those aliases get rejected with a CORS / origin-not-trusted error.',
        descriptionEs:
            'Lista CSV de orígenes trusted adicionales. Se aplica TANTO al allow-list de CORS de Hono COMO a Better Auth trustedOrigins (única fuente de verdad). Se usa para alias de hostname más allá de HOSPEDA_SITE_URL / HOSPEDA_ADMIN_URL — ej: staging.hospeda.com.ar durante pre-launch. Sin esto, signup y OAuth desde esos alias se rechazan con CORS / origin-not-trusted.',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'https://staging.hospeda.com.ar,https://staging-admin.hospeda.com.ar',
        apps: ['api'],
        category: 'core',
        howToObtain:
            'Comma-separated list of full URLs (with https:// prefix, no trailing slash). Include any hostname aliased to the same prod containers that initiates auth requests. Example for pre-launch: https://staging.hospeda.com.ar,https://staging-admin.hospeda.com.ar',
        howToObtainEs:
            'Lista CSV de URLs completas (con https://, sin trailing slash). Incluí cualquier hostname aliased a los containers prod que inicie requests de auth. Ejemplo pre-launch: https://staging.hospeda.com.ar,https://staging-admin.hospeda.com.ar'
    },

    // -------------------------------------------------------------------------
    // Database
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_DATABASE_URL',
        description: 'PostgreSQL connection string',
        descriptionEs: 'Connection string de PostgreSQL',
        type: 'url',
        required: true,
        secret: true,
        exampleValue: 'postgresql://user:password@host:5432/dbname',
        apps: ['api', 'seed'],
        category: 'database',
        howToObtain:
            'Format: postgresql://USER:PASSWORD@HOST:PORT/DBNAME. For local dev use the Docker compose values (default: postgresql://hospeda_user:hospeda_pass@localhost:5436/hospeda_dev). In production read the connection string from the Coolify-managed Postgres service on the VPS.',
        howToObtainEs:
            'Formato: postgresql://USUARIO:PASSWORD@HOST:PUERTO/BASE. Para dev local usá los valores del Docker compose (default: postgresql://hospeda_user:hospeda_pass@localhost:5436/hospeda_dev). En producción tomá la connection string del servicio Postgres gestionado por Coolify en el VPS.'
    },
    {
        name: 'HOSPEDA_DB_POOL_MAX_CONNECTIONS',
        description: 'DB pool max connections',
        descriptionEs: 'Máximo de conexiones del pool de la DB',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '10',
        exampleValue: '10',
        apps: ['api'],
        category: 'database',
        howToObtain:
            'Max simultaneous Postgres connections per app instance. Default 10. Lower it if your Postgres instance has a hard cap or if you run multiple replicas of the API.',
        howToObtainEs:
            'Conexiones simultáneas máximas a Postgres por instancia de la app. Por defecto 10. Bajalo si tu Postgres tiene un tope o si corrés varias réplicas de la API.'
    },
    {
        name: 'HOSPEDA_DB_POOL_IDLE_TIMEOUT_MS',
        description: 'DB pool idle timeout',
        descriptionEs: 'Timeout de inactividad del pool de la DB',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '30000',
        exampleValue: '30000',
        apps: ['api'],
        category: 'database',
        howToObtain:
            'How long an idle connection stays alive before being closed (ms). Default 30000 (30s).',
        howToObtainEs:
            'Cuánto tiempo se mantiene viva una conexión inactiva antes de cerrarse (ms). Por defecto 30000 (30s).'
    },
    {
        name: 'HOSPEDA_DB_POOL_CONNECTION_TIMEOUT_MS',
        description: 'DB pool connection timeout',
        descriptionEs: 'Timeout para conseguir una conexión del pool',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '5000',
        exampleValue: '5000',
        apps: ['api'],
        category: 'database',
        howToObtain:
            'How long to wait for a free connection before failing the request (ms). Default 5000 (5s) — fine for the long-running Node server on the VPS. Lower it if you want faster fail-fast under load.',
        howToObtainEs:
            'Cuánto tiempo esperar una conexión libre antes de fallar el request (ms). Por defecto 5000 (5s) — adecuado para el server Node long-running en el VPS. Bajalo si querés fail-fast más rápido bajo carga.'
    },
    {
        name: 'HOSPEDA_SEED_SUPER_ADMIN_PASSWORD',
        description: 'Super admin password for seeding',
        descriptionEs: 'Contraseña del super admin para el seed inicial',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 'your-super-admin-password',
        apps: ['seed'],
        category: 'database',
        howToObtain:
            'Pick a strong password — it becomes the password of the bootstrapped super-admin user during db:seed. Used only at seed time; you can change it later via the admin UI.',
        howToObtainEs:
            'Elegí una contraseña fuerte; se convierte en la contraseña del usuario super-admin que crea db:seed. Solo se usa al sembrar la DB; después la podés cambiar desde la UI del admin.'
    },

    // -------------------------------------------------------------------------
    // Auth
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_BETTER_AUTH_SECRET',
        description:
            'Better Auth session signing secret. Min 32 chars enforced by Zod (apps/api/src/utils/env.ts).',
        descriptionEs:
            'Secreto de firma de sesiones de Better Auth. Mínimo 32 caracteres (validado por Zod en apps/api/src/utils/env.ts).',
        type: 'string',
        required: true,
        secret: true,
        exampleValue: 'X9k2n8Q4f7H3p1L6m0R5s2T8v4W7y3Z6a9B2c5D8e1F4=',
        apps: ['api'],
        category: 'auth',
        howToObtain:
            'Generate a random 32+ char base64 secret with:  openssl rand -base64 32  — keep it stable across deploys (rotating invalidates all sessions). Each environment (dev/preview/prod) MUST have its own value.',
        howToObtainEs:
            'Generá un secreto aleatorio de 32+ chars en base64 con:  openssl rand -base64 32  — dejalo estable entre deploys (si lo rotás, invalidás todas las sesiones). Cada entorno (dev/preview/prod) DEBE tener el suyo propio.'
    },
    {
        name: 'HOSPEDA_LOCATION_SALT',
        description:
            'Server-only salt for deterministic accommodation location obfuscation (privacy-aware approximate coordinates). Min 32 chars enforced by Zod. Rotating changes all approximate locations shown to public visitors.',
        descriptionEs:
            'Salt server-only para ofuscar de forma determinística la ubicación de alojamientos (coordenadas aproximadas con criterio de privacidad). Mínimo 32 caracteres validado por Zod. Si lo rotás, cambian todas las ubicaciones aproximadas que ven los visitantes.',
        type: 'string',
        required: true,
        secret: true,
        exampleValue: 'L8m3p6Q9r2S5t8U1v4W7x0Y3z6A9b2C5d8E1f4G7h0J=',
        apps: ['api'],
        category: 'auth',
        howToObtain:
            'Generate with:  openssl rand -base64 32  — NEVER rotate in prod (would shift every public approximate location). Service-core consumes it transitively (location-obfuscation.ts, accommodation.projections.ts).',
        howToObtainEs:
            'Generalo con:  openssl rand -base64 32  — NUNCA lo rotes en prod (movería todas las ubicaciones aproximadas que se muestran al público). Lo consume service-core de forma transitiva (location-obfuscation.ts, accommodation.projections.ts).'
    },
    {
        name: 'HOSPEDA_VIEWS_HASH_SECRET',
        description:
            'Server-only HMAC secret used as a pepper when computing privacy-safe, day-scoped visitor deduplication hashes for cross-entity view tracking (SPEC-159). The hash is SHA-256(HMAC-SHA256(secret, date) + truncatedIp + userAgent) — the raw IP is never stored or logged. Min 32 chars enforced by Zod. Rotating this value invalidates all outstanding day-hashes (visitors will be counted as new for that day).',
        descriptionEs:
            'Secreto HMAC server-only que actúa como pepper al computar hashes de visita con privacidad por día para el seguimiento de vistas entre entidades (SPEC-159). El hash es SHA-256(HMAC-SHA256(secret, fecha) + ipTruncada + userAgent); la IP cruda nunca se almacena ni se loguea. Mínimo 32 caracteres validado por Zod. Rotarlo invalida todos los hashes del día actual (los visitantes se cuentan como nuevos).',
        type: 'string',
        required: true,
        secret: true,
        exampleValue: 'V7k4n1Q8f2H5p9L3m6R0s4T7v1W4y8Z2a5B8c1D4e7F0=',
        apps: ['api'],
        category: 'auth',
        howToObtain:
            'Generate with:  openssl rand -base64 48  — keep stable across deploys (rotating changes the day-hash for all current visitors). Each environment (dev/staging/prod) MUST have its own distinct value. The secret is consumed exclusively by apps/api/src/utils/visitor-hash.ts.',
        howToObtainEs:
            'Generalo con:  openssl rand -base64 48  — dejalo estable entre deploys (rotarlo cambia el hash del día para todos los visitantes activos). Cada entorno (dev/staging/prod) DEBE tener su propio valor. Lo consume exclusivamente apps/api/src/utils/visitor-hash.ts.'
    },
    {
        name: 'HOSPEDA_GEOCODING_USER_AGENT',
        description:
            'User-Agent header sent to Photon (Komoot) and Nominatim (OSM) when the admin location picker queries them. Required by Nominatim usage policy; missing or generic values may cause throttling.',
        descriptionEs:
            'Header User-Agent que se manda a Photon (Komoot) y Nominatim (OSM) cuando el location picker del admin los consulta. Lo exige la policy de Nominatim; si lo dejás vacío o genérico te van a tirar throttling.',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'Hospeda/1.0 (https://hospeda.com.ar)',
        exampleValue: 'Hospeda/1.0 (https://hospeda.com.ar)',
        apps: ['api'],
        category: 'integrations',
        howToObtain:
            'Free text identifying your app to OSM Nominatim, e.g. "Hospeda/1.0 (https://hospeda.com.ar)". Nominatim policy requires this — generic UAs get rate-limited or banned.',
        howToObtainEs:
            'Texto libre que identifica tu app a Nominatim de OSM, ej: "Hospeda/1.0 (https://hospeda.com.ar)". La policy de Nominatim lo exige; los UAs genéricos sufren rate-limit o ban.'
    },
    {
        name: 'HOSPEDA_BETTER_AUTH_URL',
        description: 'Better Auth endpoint URL',
        descriptionEs: 'URL del endpoint de Better Auth',
        type: 'url',
        required: true,
        secret: false,
        exampleValue: 'http://localhost:3001/api/auth',
        apps: ['api', 'web'],
        category: 'auth',
        howToObtain:
            'Always HOSPEDA_API_URL + "/api/auth". Local: http://localhost:3001/api/auth. Production: https://api.hospeda.com.ar/api/auth. Better Auth handles sign-in/sign-out/sessions at this path.',
        howToObtainEs:
            'Siempre es HOSPEDA_API_URL + "/api/auth". Local: http://localhost:3001/api/auth. Producción: https://api.hospeda.com.ar/api/auth. Better Auth maneja sign-in/sign-out/sesiones en esa ruta.'
    },
    {
        name: 'HOSPEDA_DEV_COOKIE_DOMAIN',
        description:
            'DEV-ONLY session-cookie domain override for the *.hospeda.local cross-subdomain recipe (SPEC-182). Ignored in production (cookie domain is pinned to hospeda.com.ar). See docs/guides/auth-local-dev.md.',
        descriptionEs:
            'Override DEV-ONLY del dominio de la cookie de sesión para la receta cross-subdomain *.hospeda.local (SPEC-182). Se ignora en producción (el dominio queda fijo en hospeda.com.ar). Ver docs/guides/auth-local-dev.md.',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: '.hospeda.local',
        apps: ['api'],
        category: 'auth',
        howToObtain:
            'Set to `.hospeda.local` in apps/api/.env.local AFTER adding the /etc/hosts entries (web/admin/api.hospeda.local -> 127.0.0.1). Leave unset for plain localhost development (per-host cookies). Never set in Coolify.',
        howToObtainEs:
            'Poné `.hospeda.local` en apps/api/.env.local DESPUÉS de agregar las entradas de /etc/hosts (web/admin/api.hospeda.local -> 127.0.0.1). Dejala sin setear para desarrollo en localhost plano (cookies por host). Nunca la setees en Coolify.'
    },
    {
        name: 'HOSPEDA_GOOGLE_CLIENT_ID',
        description: 'Google OAuth client ID',
        descriptionEs: 'Client ID de OAuth de Google',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 'your-google-client-id',
        apps: ['api'],
        category: 'auth',
        helpUrl: 'https://console.cloud.google.com/apis/credentials',
        howToObtain:
            'Google Cloud Console → APIs & Services → Credentials → Create credentials → OAuth Client ID (Web application). Add HOSPEDA_BETTER_AUTH_URL/callback as the authorized redirect URI.',
        howToObtainEs:
            'Google Cloud Console → APIs & Services → Credentials → Create credentials → OAuth Client ID (Web application). Agregá HOSPEDA_BETTER_AUTH_URL/callback como redirect URI autorizada.'
    },
    {
        name: 'HOSPEDA_GOOGLE_CLIENT_SECRET',
        description: 'Google OAuth secret',
        descriptionEs: 'Secret de OAuth de Google',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 'your-google-client-secret',
        apps: ['api'],
        category: 'auth',
        helpUrl: 'https://console.cloud.google.com/apis/credentials',
        howToObtain: 'Same OAuth Client created above — copy the Client Secret.',
        howToObtainEs: 'El mismo OAuth Client que creaste arriba; copiá el Client Secret.'
    },
    {
        name: 'HOSPEDA_FACEBOOK_CLIENT_ID',
        description: 'Facebook OAuth client ID',
        descriptionEs: 'Client ID de OAuth de Facebook',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 'your-facebook-client-id',
        apps: ['api'],
        category: 'auth',
        helpUrl: 'https://developers.facebook.com/apps',
        howToObtain:
            'Meta for Developers → your app → Settings → Basic → App ID. Configure Facebook Login product and add the OAuth redirect URI.',
        howToObtainEs:
            'Meta for Developers → tu app → Settings → Basic → App ID. Configurá el producto Facebook Login y agregá la redirect URI de OAuth.'
    },
    {
        name: 'HOSPEDA_FACEBOOK_CLIENT_SECRET',
        description: 'Facebook OAuth secret',
        descriptionEs: 'Secret de OAuth de Facebook',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 'your-facebook-client-secret',
        apps: ['api'],
        category: 'auth',
        helpUrl: 'https://developers.facebook.com/apps',
        howToObtain: 'Same Meta app → Settings → Basic → App Secret (click "Show").',
        howToObtainEs: 'La misma app de Meta → Settings → Basic → App Secret (clickeá "Show").'
    },

    // -------------------------------------------------------------------------
    // Cache
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_REDIS_URL',
        description:
            'Redis URL for rate limiting. REQUIRED in production (a superRefine in apps/api/src/utils/env.ts rejects startup if empty when NODE_ENV=production). Optional in development/test.',
        descriptionEs:
            'URL de Redis para rate limiting. OBLIGATORIA en producción (un superRefine en apps/api/src/utils/env.ts rechaza el startup si queda vacía con NODE_ENV=production). Opcional en development/test.',
        type: 'url',
        required: false,
        secret: true,
        exampleValue: 'redis://localhost:6381',
        apps: ['api'],
        category: 'cache',
        howToObtain:
            'Format: redis://[user:pass@]host:port. Local: redis://localhost:6381 (Docker compose — port offset from default 6379 to avoid clashing with system Redis). Production: use the Coolify-managed Redis service on the VPS (internal docker network URL). NOTE: hard-required in production — startup will fail if missing.',
        howToObtainEs:
            'Formato: redis://[usuario:pass@]host:puerto. Local: redis://localhost:6381 (Docker compose — puerto desplazado del default 6379 para no chocar con un Redis del sistema). Producción: usá el servicio Redis gestionado por Coolify en el VPS (URL de la red docker interna). OJO: en producción es obligatoria — el startup falla si queda vacía.'
    },
    {
        name: 'HOSPEDA_RATE_LIMIT_BACKEND',
        description:
            'Storage backend for the sliding-window per-user rate limiter. "memory" uses an in-process Map (single-instance dev/staging). "redis" uses Redis sorted sets for distributed multi-instance deployments. Falls back to in-memory when Redis is unavailable.',
        descriptionEs:
            'Backend de almacenamiento del rate limiter por-usuario (sliding window). "memory" usa un Map en memoria (single-instance, dev/staging). "redis" usa sorted sets de Redis para deploys distribuidos multi-instancia. Cae a in-memory si Redis no está disponible.',
        type: 'enum',
        required: false,
        secret: false,
        defaultValue: 'memory',
        exampleValue: 'redis',
        enumValues: ['memory', 'redis'] as const,
        apps: ['api'],
        category: 'cache'
    },

    // -------------------------------------------------------------------------
    // Billing
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN',
        description: 'MercadoPago API token',
        descriptionEs: 'Token de API de MercadoPago',
        type: 'string',
        required: false,
        requiredScope: 'production',
        secret: true,
        exampleValue: 'APP_USR-1234567890123456-010100-abcdef0123456789abcdef0123456789-123456789',
        apps: ['api'],
        category: 'billing',
        helpUrl: 'https://www.mercadopago.com.ar/developers/panel/app',
        howToObtain:
            'Create an application in the Mercado Pago developer panel → Credentials. The access token starts with "APP_USR-" for BOTH test and production — there is NO "TEST-" prefix on application credentials. Sandbox testing works by using the test credentials section + test users + test cards (https://www.mercadopago.com.ar/developers/en/docs/your-integrations/test/cards), not by a different token prefix. Copy from "Test credentials" panel section for development/preview, "Production credentials" for production. Each environment must use its own pair.',
        howToObtainEs:
            'Creá una aplicación en el panel de developers de Mercado Pago → Credenciales. El access token empieza con "APP_USR-" tanto para test como para producción — NO existe prefijo "TEST-" en credenciales de aplicación. El sandbox funciona usando la sección "Credenciales de prueba" + test users + tarjetas de prueba (https://www.mercadopago.com.ar/developers/en/docs/your-integrations/test/cards), no con un prefijo distinto. Copiá desde "Credenciales de prueba" para development/preview, "Credenciales de producción" para producción. Cada entorno usa su propio par.'
    },
    {
        name: 'HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET',
        description: 'MercadoPago webhook signature secret',
        descriptionEs: 'Secreto para firmar webhooks de MercadoPago',
        type: 'string',
        required: false,
        requiredScope: 'production',
        secret: true,
        exampleValue: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
        apps: ['api'],
        category: 'billing',
        helpUrl: 'https://www.mercadopago.com.ar/developers/panel/app',
        howToObtain:
            'Same Mercado Pago app → Webhooks section → "Configure notifications" → copy the "Secret signature" string. MP shows it once on creation — it is an opaque random string (no fixed prefix like "whsec_"). Used with HMAC-SHA256 to verify incoming webhook payloads via the x-signature header.',
        howToObtainEs:
            'La misma app de Mercado Pago → sección Webhooks → "Configurar notificaciones" → copiá la "Clave secreta". MP la muestra una sola vez al crearla — es un string random opaco (no tiene prefijo fijo tipo "whsec_"). Se usa con HMAC-SHA256 para validar el header x-signature de los webhooks entrantes.'
    },
    {
        name: 'HOSPEDA_MERCADO_PAGO_SANDBOX',
        description: 'Enable MercadoPago sandbox mode',
        descriptionEs: 'Activa el modo sandbox de MercadoPago',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'billing',
        howToObtain:
            'true = use Mercado Pago sandbox (test cards, no real charges). false = real production charges. Keep true for development and preview, false only for production.',
        howToObtainEs:
            'true = usar el sandbox de Mercado Pago (tarjetas de prueba, sin cobros reales). false = cobros reales de producción. Dejá true en development y preview; false solo en producción.'
    },
    {
        name: 'HOSPEDA_MERCADO_PAGO_TIMEOUT',
        description: 'MercadoPago API request timeout in ms',
        descriptionEs: 'Timeout en ms para los requests a la API de MercadoPago',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '5000',
        exampleValue: '5000',
        apps: ['api'],
        category: 'billing'
    },
    {
        name: 'HOSPEDA_MERCADO_PAGO_PLATFORM_ID',
        description: 'MercadoPago platform ID for marketplace tracking',
        descriptionEs: 'Platform ID de MercadoPago para tracking de marketplace',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: '',
        exampleValue: 'leave-empty-unless-mp-assigned',
        apps: ['api'],
        category: 'billing',
        howToObtain:
            'Optional marketplace identifier issued by Mercado Pago to platform partners. Leave EMPTY (default) unless MP support assigned one to your account — there is no public format and you cannot generate it yourself. When given, MP delivers it via email or in the partner portal.',
        howToObtainEs:
            'Identificador opcional de marketplace que Mercado Pago entrega a partners. Dejalo VACÍO (default) salvo que el soporte de MP te haya asignado uno — no tiene formato público y no se genera solo. Cuando te lo dan, MP lo manda por mail o lo ves en el portal de partners.'
    },
    {
        name: 'HOSPEDA_MERCADO_PAGO_INTEGRATOR_ID',
        description: 'MercadoPago integrator ID for tracking',
        descriptionEs: 'Integrator ID de MercadoPago para tracking',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: '',
        exampleValue: 'leave-empty-unless-mp-certified',
        apps: ['api'],
        category: 'billing',
        howToObtain:
            'Optional integrator tracking ID issued by Mercado Pago to certified integration partners (developers/agencies who completed MP certification). Leave EMPTY (default) unless you have completed MP certification and were issued one.',
        howToObtainEs:
            'Tracking ID opcional que Mercado Pago da a partners de integración certificados (developers/agencias que completaron la certificación de MP). Dejalo VACÍO (default) salvo que hayas completado la certificación y te hayan asignado uno.'
    },
    {
        name: 'HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR',
        description: "Statement descriptor shown on the cardholder's bank statement",
        descriptionEs: 'Descriptor que aparece en el resumen de la tarjeta del cliente',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'HOSPEDA',
        exampleValue: 'HOSPEDA',
        apps: ['api'],
        category: 'billing',
        howToObtain:
            'Free-text label, 1-11 ASCII uppercase chars (letters, digits, spaces). MP rejects anything longer or with lowercase / non-ASCII. Defaults to "HOSPEDA"; override only if MP homologation feedback requests it.',
        howToObtainEs:
            'Texto libre, 1-11 caracteres ASCII en mayúsculas (letras, dígitos, espacios). MP rechaza valores más largos o con minúsculas / no-ASCII. Por defecto "HOSPEDA"; sobrescribilo solo si el feedback de homologación de MP lo pide.'
    },
    {
        name: 'HOSPEDA_COMMERCE_PLAN_ID',
        description:
            'Slug of the billing plan used to provision a commerce-listing subscription (SPEC-239 T-049). Resolved by slug against billing_plans.name via the same machinery as the accommodation start-paid flow.',
        descriptionEs:
            'Slug del plan de facturación usado para provisionar una suscripción de listing de comercio (SPEC-239 T-049). Se resuelve por slug contra billing_plans.name con la misma maquinaria que el flujo accommodation start-paid.',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: '',
        exampleValue: 'commerce-listing',
        apps: ['api'],
        category: 'billing',
        howToObtain:
            'The slug (billing_plans.name) of the commerce plan seeded by the billing-plans seed. Defaults to the seeded commerce slug. The commerce admin start-subscription route 404s when unset or unknown.',
        howToObtainEs:
            'El slug (billing_plans.name) del plan de comercio sembrado por el seed de billing-plans. Por defecto el slug de comercio sembrado. La ruta admin commerce start-subscription devuelve 404 cuando está vacío o es desconocido.'
    },

    // -------------------------------------------------------------------------
    // AI / Credential Vault
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_AI_VAULT_MASTER_KEY',
        description:
            'AES-256-GCM master key for the AI credential vault (apps/api only). Encrypts/decrypts provider API keys at rest. Min 32 chars (Zod). Optional until AI features are wired everywhere.',
        descriptionEs:
            'Clave maestra AES-256-GCM para el vault de credenciales de IA (solo apps/api). Cifra/descifra las API keys de proveedores en reposo. Mínimo 32 caracteres (Zod). Opcional hasta que las features de IA estén cableadas en todos los entornos.',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 'your-aes-256-gcm-master-key-min-32-chars-xxxxxxxx',
        apps: ['api'],
        category: 'ai',
        howToObtain:
            'Generate a random 32+ char base64 key with:  openssl rand -base64 32  — keep it STABLE across deploys (rotating it invalidates all vault-encrypted credentials). Each environment (dev/staging/prod) MUST have its own value, set in Coolify.',
        howToObtainEs:
            'Generá una clave aleatoria de 32+ chars en base64 con:  openssl rand -base64 32  — mantenela ESTABLE entre deploys (si la rotás, invalidás todas las credenciales cifradas del vault). Cada entorno (dev/staging/prod) DEBE tener la suya, seteada en Coolify.'
    },

    // -------------------------------------------------------------------------
    // Email
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_EMAIL_API_KEY',
        description: 'Transactional email provider API key (currently Brevo)',
        descriptionEs: 'API key del proveedor de email transaccional (actualmente Brevo)',
        type: 'string',
        required: false,
        requiredScope: 'production',
        secret: true,
        exampleValue: 'xkeysib-xxxx',
        apps: ['api'],
        category: 'email',
        helpUrl: 'https://app.brevo.com/settings/keys/api',
        howToObtain:
            'Brevo dashboard → SMTP & API → API Keys → Generate a new API key → copy the value starting with "xkeysib-". Authenticate your sending domain first under Senders, Domains & Dedicated IPs.',
        howToObtainEs:
            'Brevo dashboard → SMTP & API → API Keys → Generate a new API key → copiá el valor que empieza con "xkeysib-". Antes autenticá tu dominio de envío en Senders, Domains & Dedicated IPs.'
    },
    {
        name: 'HOSPEDA_BREVO_PRELAUNCH_NEWSLETTER_LIST_ID',
        description:
            'Numeric Brevo Contacts list ID for PRE-LAUNCH newsletter signups (the coming-soon landing form at hospeda.com.ar, POST /api/v1/public/newsletter). Distinct from any post-launch newsletter list so cohorts stay separated. Reuses HOSPEDA_EMAIL_API_KEY for auth.',
        descriptionEs:
            'ID numérico de la lista de Contactos Brevo para los signups del newsletter PRE-LAUNCH (form de coming-soon en hospeda.com.ar, POST /api/v1/public/newsletter). Distinta de cualquier lista post-launch para mantener cohortes separadas. Reusa HOSPEDA_EMAIL_API_KEY para autenticarse.',
        type: 'number',
        required: false,
        secret: false,
        exampleValue: '7',
        apps: ['api'],
        category: 'email',
        helpUrl: 'https://app.brevo.com/contact/list-listing',
        howToObtain:
            'Brevo dashboard → Contacts → Lists → create or open the target list → the numeric ID is shown in the URL (.../list/<ID>) and in the list header. Copy that integer. The same HOSPEDA_EMAIL_API_KEY is used to authenticate the request.',
        howToObtainEs:
            'Dashboard de Brevo → Contacts → Lists → crear o abrir la lista destino → el ID numérico aparece en la URL (.../list/<ID>) y en el header de la lista. Copiá ese entero. Se usa la misma HOSPEDA_EMAIL_API_KEY para autenticar el request.'
    },
    {
        name: 'HOSPEDA_EMAIL_FROM_EMAIL',
        description: 'Sender email address',
        descriptionEs: 'Dirección de email del remitente',
        type: 'string',
        required: false,
        requiredScope: 'production',
        secret: false,
        exampleValue: 'noreply@hospeda.com.ar',
        apps: ['api'],
        category: 'email',
        howToObtain:
            'A "From" address using a domain authenticated in your email provider (e.g. noreply@yourdomain.com). Cannot use a free-mail address (Gmail/Yahoo); must be on a domain you control.',
        howToObtainEs:
            'Dirección "From" usando un dominio autenticado en tu proveedor de email (ej: noreply@tudominio.com). NO podés usar Gmail/Yahoo; tiene que ser un dominio tuyo.'
    },
    {
        name: 'HOSPEDA_EMAIL_FROM_NAME',
        description: 'Sender display name',
        descriptionEs: 'Nombre visible del remitente',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'Hospeda',
        apps: ['api'],
        category: 'email',
        howToObtain:
            'Friendly name shown next to the email address (e.g. "Hospeda", "Hospeda Notifications"). Free text — pick what you want recipients to see.',
        howToObtainEs:
            'Nombre amigable que aparece al lado del email (ej: "Hospeda", "Hospeda Notificaciones"). Texto libre; elegí lo que quieras que vean los destinatarios.'
    },
    {
        name: 'HOSPEDA_ADMIN_NOTIFICATION_EMAILS',
        description:
            'Comma-separated admin emails for operational alerts: MercadoPago disputes/webhooks AND newsletter campaigns that close with failed deliveries (SPEC-108).',
        descriptionEs:
            'Emails de admin separados por comas para alertas operativas: disputas/webhooks de MercadoPago Y campañas de newsletter que cierran con entregas fallidas (SPEC-108).',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'admin@hospeda.com.ar',
        apps: ['api'],
        category: 'email',
        howToObtain:
            'List of email addresses (comma-separated, no spaces) that receive ops alerts: payment disputes, webhook failures, newsletter campaigns that close with failed > 0. Example: alice@hospeda.ar,bob@hospeda.ar. Unset = those alerts are silently skipped (the features that depend on the value gracefully no-op).',
        howToObtainEs:
            'Lista de emails (separados por comas, sin espacios) que reciben alertas operativas: disputas de pagos, fallos de webhooks, campañas de newsletter que cierran con failed > 0. Ejemplo: alice@hospeda.ar,bob@hospeda.ar. Si queda sin setear, esas alertas se omiten silenciosamente (las features que dependen del valor caen a no-op).'
    },

    // -------------------------------------------------------------------------
    // Newsletter (SPEC-101)
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_NEWSLETTER_HMAC_SECRET',
        description:
            'HMAC-SHA256 secret used to sign newsletter verification and unsubscribe tokens. Must be at least 32 bytes of entropy.',
        descriptionEs:
            'Secreto HMAC-SHA256 que firma los tokens de verificación y de baja del newsletter. Mínimo 32 bytes de entropía.',
        type: 'string',
        required: true,
        requiredScope: 'always',
        secret: true,
        exampleValue: 'change-me-to-a-32-byte-random-secret-xxxxxxxx',
        apps: ['api'],
        category: 'newsletter',
        howToObtain:
            'Generate a random 32-byte string: `openssl rand -base64 48`. Treat as a long-lived secret — rotating it invalidates every outstanding verification email and unsubscribe link. Use HOSPEDA_NEWSLETTER_HMAC_SECRET_PREV for graceful rotation.',
        howToObtainEs:
            'Generá un string random de 32 bytes: `openssl rand -base64 48`. Tratalo como secreto de larga vida — rotarlo invalida todos los emails de verificación pendientes y links de baja. Usá HOSPEDA_NEWSLETTER_HMAC_SECRET_PREV para una rotación con ventana de gracia.'
    },
    {
        name: 'HOSPEDA_NEWSLETTER_HMAC_SECRET_PREV',
        description:
            'Previous newsletter HMAC secret, accepted during the rotation window. Verification falls back to this when the current secret rejects a token.',
        descriptionEs:
            'Secreto HMAC anterior del newsletter, aceptado durante la ventana de rotación. La verificación cae a este si el secreto actual rechaza el token.',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 'old-32-byte-random-secret-from-previous-rotation',
        apps: ['api'],
        category: 'newsletter',
        howToObtain:
            'Set only during a key rotation. Workflow: (1) keep current value, copy it to HOSPEDA_NEWSLETTER_HMAC_SECRET_PREV; (2) generate a new HOSPEDA_NEWSLETTER_HMAC_SECRET; (3) after 72h (verification token TTL), unset HOSPEDA_NEWSLETTER_HMAC_SECRET_PREV. Leave blank in steady state.',
        howToObtainEs:
            'Solo se setea durante una rotación de clave. Pasos: (1) guardás el valor actual en HOSPEDA_NEWSLETTER_HMAC_SECRET_PREV; (2) generás un nuevo HOSPEDA_NEWSLETTER_HMAC_SECRET; (3) pasadas 72h (TTL del token de verificación), borrás HOSPEDA_NEWSLETTER_HMAC_SECRET_PREV. En estado normal, dejala vacía.'
    },
    {
        name: 'HOSPEDA_BREVO_WEBHOOK_SECRET',
        description:
            'Static secret Brevo sends in the `X-Sib-Webhook-Token` header so the API can verify webhook authenticity. Min 10 bytes.',
        descriptionEs:
            'Secreto estático que Brevo envía en el header `X-Sib-Webhook-Token` para que la API valide la autenticidad de los webhooks. Mínimo 10 bytes.',
        type: 'string',
        required: true,
        secret: true,
        exampleValue: 'replace-with-brevo-webhook-token',
        apps: ['api'],
        category: 'newsletter',
        howToObtain:
            'Brevo dashboard → Transactional → Email → Settings → Webhook → create a webhook and set a custom "token". Brevo will then send that exact value in every X-Sib-Webhook-Token header. Compare with timingSafeEqual on the receiving end.',
        howToObtainEs:
            'Dashboard de Brevo → Transactional → Email → Settings → Webhook → creá un webhook y poné un "token" custom. Brevo va a enviar ese valor exacto en cada header X-Sib-Webhook-Token. Comparalo con timingSafeEqual del lado del receptor.'
    },
    {
        name: 'HOSPEDA_NEWSLETTER_SOFTCAP_DAYS',
        description:
            'Rolling window (in days) for the per-subscriber send-frequency soft cap. A subscriber that received a campaign within this many days is excluded from the next dispatch unless the admin opts to bypass.',
        descriptionEs:
            'Ventana móvil (en días) para el soft cap de frecuencia por suscriptor. Un suscriptor que recibió una campaña dentro de esa ventana queda fuera del próximo dispatch salvo que el admin lo bypasee.',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '7',
        exampleValue: '7',
        apps: ['api'],
        category: 'newsletter',
        howToObtain:
            'Number of days (1-365). Default 7 means "do not email the same subscriber more than once per week". Increase to be more conservative; decrease for higher-cadence campaigns.',
        howToObtainEs:
            'Número de días (1-365). Default 7 = "no mandar más de un email por semana al mismo suscriptor". Subilo si querés ser más conservador, bajalo para campañas con cadencia más alta.'
    },
    {
        name: 'HOSPEDA_NEWSLETTER_BATCH_SIZE',
        description:
            'Number of recipients per Brevo `messageVersions` batch call (1-100). Brevo enforces a hard ceiling of 100 per batch.',
        descriptionEs:
            'Cantidad de destinatarios por llamada batch a Brevo (`messageVersions`, 1-100). Brevo impone un tope duro de 100 por batch.',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '100',
        exampleValue: '100',
        apps: ['api'],
        category: 'newsletter',
        howToObtain:
            'Integer 1-100. Lower values fan out more BullMQ jobs (better parallelism but more API calls); higher values send more recipients per call (fewer requests but larger blast radius on a single failure). Default 100 = Brevo limit.',
        howToObtainEs:
            'Entero 1-100. Valores más bajos abren más jobs en BullMQ (más paralelismo pero más calls a la API); valores más altos mandan más destinatarios por call (menos requests pero más impacto si uno falla). Default 100 = límite de Brevo.'
    },
    {
        name: 'HOSPEDA_NEWSLETTER_WORKER_CONCURRENCY',
        description:
            'BullMQ worker concurrency for the newsletter dispatch queue — number of batch jobs the worker processes in parallel.',
        descriptionEs:
            'Concurrencia del worker BullMQ del newsletter — cantidad de jobs batch que el worker procesa en paralelo.',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '5',
        exampleValue: '5',
        apps: ['api'],
        category: 'newsletter',
        howToObtain:
            'Integer 1-20. Bound by Brevo throughput limits and DB connection budget. Default 5 is conservative; raise carefully and watch for Brevo 429s.',
        howToObtainEs:
            'Entero 1-20. Acotado por los limits de throughput de Brevo y el budget de conexiones a la DB. Default 5 es conservador; subilo con cuidado y monitoreá los 429 de Brevo.'
    },
    {
        name: 'HOSPEDA_NEWSLETTER_WA_CHANNEL_URL',
        description:
            'WhatsApp broadcast channel invite URL. When set, the post-verification welcome email shows a CTA to join the channel; otherwise the block is hidden.',
        descriptionEs:
            'URL de invitación al canal de difusión de WhatsApp. Si está seteada, el email de bienvenida muestra un CTA para sumarse; si no, se oculta.',
        type: 'url',
        required: false,
        secret: false,
        exampleValue: 'https://whatsapp.com/channel/0029Va6S3oPxxxxxxxxxxxx',
        apps: ['api'],
        category: 'newsletter',
        howToObtain:
            'WhatsApp → Channels → your channel → Channel link → copy the public invite URL. Leave unset to hide the CTA entirely. Mirrors the client-side value of PUBLIC_HOSPEDA_WHATSAPP_CHANNEL_URL (web).',
        howToObtainEs:
            'WhatsApp → Channels → tu canal → Channel link → copiá la URL pública. Dejala vacía para ocultar el CTA. Mirror del valor cliente PUBLIC_HOSPEDA_WHATSAPP_CHANNEL_URL (web).'
    },

    // -------------------------------------------------------------------------
    // Cron
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_CRON_ADAPTER',
        description:
            'Cron scheduler type. Use "node-cron" in production (in-process scheduling on the VPS) and "manual" in dev/tests/CI when a human or test harness triggers jobs.',
        descriptionEs:
            'Tipo de scheduler de cron. Usá "node-cron" en producción (scheduling in-process en el VPS) y "manual" en dev/tests/CI cuando los jobs los dispara una persona o el test harness.',
        type: 'enum',
        required: false,
        secret: false,
        exampleValue: 'manual',
        enumValues: ['manual', 'node-cron'] as const,
        apps: ['api'],
        category: 'cron',
        howToObtain:
            'Pick "node-cron" for production VPS deploys (the API process schedules and runs all jobs itself). Pick "manual" for dev/tests/CI where jobs are triggered through the admin panel or test fixtures.',
        howToObtainEs:
            'Elegí "node-cron" para deploys productivos en el VPS (el proceso de la API agenda y ejecuta los jobs). Elegí "manual" para dev/tests/CI donde los jobs los dispara el panel admin o los fixtures de tests.'
    },
    {
        name: 'HOSPEDA_REVALIDATION_SECRET',
        description:
            'Shared secret for authenticating ISR revalidation requests from the API. Min 32 characters.',
        descriptionEs:
            'Secreto compartido para autenticar requests de revalidación ISR que vienen de la API. Mínimo 32 caracteres.',
        type: 'string',
        required: true,
        requiredScope: 'always',
        secret: true,
        exampleValue: 'a-secret-string-of-at-least-32-characters',
        apps: ['api', 'web'],
        category: 'cron',
        howToObtain:
            'Generate with:  openssl rand -base64 32  — MUST be identical in apps/api AND apps/web for the same environment, otherwise revalidation hits will be rejected with 401.',
        howToObtainEs:
            'Generalo con:  openssl rand -base64 32  — TIENE que ser idéntico en apps/api Y apps/web para el mismo entorno; sino los hits de revalidación se rechazan con 401.'
    },
    {
        name: 'HOSPEDA_REVALIDATION_CRON_SCHEDULE',
        description: 'Cron schedule for automatic page revalidation',
        descriptionEs: 'Schedule cron para la revalidación automática de páginas',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: '0 * * * *',
        exampleValue: '0 * * * *',
        apps: ['api'],
        category: 'cron',
        howToObtain:
            'Standard 5-field cron expression. Default "0 * * * *" = top of every hour. Hospeda runs cron in-process via node-cron on the VPS, so there is no per-day quota — the hourly default is fine. Use crontab.guru to compose other schedules. Examples: "*/15 * * * *" (every 15 min), "0 3 * * *" (3 AM daily).',
        howToObtainEs:
            'Expresión cron estándar de 5 campos. Por defecto "0 * * * *" = inicio de cada hora. Hospeda corre cron in-process con node-cron en el VPS, así que no hay quota por día — el default por hora va bien. Usá crontab.guru para otros schedules. Ejemplos: "*/15 * * * *" (cada 15 min), "0 3 * * *" (3 AM diario).'
    },

    // -------------------------------------------------------------------------
    // Addon lifecycle
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_ADDON_LIFECYCLE_ENABLED',
        description:
            'Feature flag for addon lifecycle processing (cancellations, plan changes, expiry). Set to "false" to disable side-effects without deploying code.',
        descriptionEs:
            'Feature flag del procesamiento de ciclo de vida de addons (cancelaciones, cambios de plan, expiración). Poné "false" para desactivar los efectos secundarios sin tener que deployar.',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'billing',
        howToObtain:
            'Set "true" to keep addon billing side-effects active (default). Set "false" as a kill-switch when something is wrong with the lifecycle pipeline — pauses all addon cancellations/plan changes without redeploying.',
        howToObtainEs:
            'Poné "true" para mantener activos los efectos de facturación de addons (default). Poné "false" como kill-switch si algo anda mal en el pipeline; pausa todas las cancelaciones/cambios de addons sin redeploy.'
    },

    // -------------------------------------------------------------------------
    // User self-service subscription cancellation (SPEC-147)
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_USER_CANCEL_ENABLED',
        description:
            'Feature flag for the user self-service subscription cancellation route (SPEC-147). Ships dark by default (false) until the SPEC-203 UI lands. Set to "true" to enable.',
        descriptionEs:
            'Feature flag de la ruta de auto-cancelación de suscripción por el usuario (SPEC-147). Por defecto desactivado (false) hasta que llegue la UI de SPEC-203. Poné "true" para habilitar.',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'false',
        apps: ['api'],
        category: 'billing',
        howToObtain:
            'Set "true" to enable the user self-service cancel endpoint. Leave unset or set "false" to keep it dark (ships disabled until SPEC-203 UI). Internally Zod transforms via `(v) => v === "true"` — only the literal string "true" enables it.',
        howToObtainEs:
            'Poné "true" para habilitar el endpoint de auto-cancelación del usuario. Dejalo sin setear o en "false" para mantenerlo dark (se entrega desactivado hasta la UI de SPEC-203). Zod usa `(v) => v === "true"` internamente — solo el string literal "true" lo activa.'
    },

    // -------------------------------------------------------------------------
    // MercadoPago subscription polling fallback (SPEC-143)
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_BILLING_POLLING_ENABLED',
        description:
            'Feature flag for the MercadoPago subscription_preapproval polling fallback. When enabled, start-paid schedules a polling job that queries MP /preapproval/{id} until the preapproval is authorized, then flips the local subscription to active. Provides resilience against unreliable MP webhook delivery (Finding #17).',
        descriptionEs:
            'Feature flag del fallback de polling para subscription_preapproval de MercadoPago. Cuando está activo, start-paid agenda un job que consulta /preapproval/{id} hasta que el preapproval esté authorized y luego flipea la subscripción local a active. Da resiliencia ante entregas no confiables de webhooks de MP (Finding #17).',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'billing',
        howToObtain:
            'Leave "true" (default) so the polling cron job runs and start-paid enqueues fallback jobs. Set "false" as a kill-switch if the polling layer is misbehaving in prod and you need to disable it without a redeploy. The webhook handler still works either way.',
        howToObtainEs:
            'Dejá en "true" (default) para que el cron de polling corra y start-paid encole jobs de fallback. Poné "false" como kill-switch si el polling se rompe en prod y hay que desactivarlo sin redeploy. El webhook handler sigue funcionando igual.'
    },

    // -------------------------------------------------------------------------
    // Auth lockout (brute-force protection)
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS',
        description: 'Max failed login attempts before temporary lockout',
        descriptionEs: 'Intentos fallidos máximos de login antes del lockout temporal',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '5',
        exampleValue: '5',
        apps: ['api'],
        category: 'auth',
        howToObtain:
            'Number of failed sign-in attempts allowed within the lockout window before the account is temporarily locked. Default 5. Lower for stricter brute-force protection.',
        howToObtainEs:
            'Cantidad de intentos fallidos de sign-in permitidos dentro de la ventana antes de que se bloquee temporalmente la cuenta. Por defecto 5. Bajalo para protección anti-brute-force más estricta.'
    },
    {
        name: 'HOSPEDA_AUTH_LOCKOUT_WINDOW_MS',
        description: 'Lockout window in milliseconds (default 900000 = 15 min)',
        descriptionEs: 'Ventana de lockout en milisegundos (por defecto 900000 = 15 min)',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '900000',
        exampleValue: '900000',
        apps: ['api'],
        category: 'auth',
        howToObtain:
            'How long the lockout lasts after exceeding max attempts (in ms). Default 900000 = 15 min. Use 1800000 = 30 min for stricter, 300000 = 5 min for friendlier.',
        howToObtainEs:
            'Cuánto dura el lockout después de pasar el máximo de intentos (en ms). Por defecto 900000 = 15 min. Usá 1800000 = 30 min para más estricto, 300000 = 5 min para más amable.'
    },

    // -------------------------------------------------------------------------
    // Integrations
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_LINEAR_API_KEY',
        description: 'Linear bug report API key',
        descriptionEs: 'API key de Linear para reportes de bugs',
        type: 'string',
        required: false,
        requiredScope: 'production',
        secret: true,
        exampleValue: 'lin_api_xxxx',
        apps: ['api'],
        category: 'integrations',
        helpUrl: 'https://linear.app/settings/api',
        howToObtain:
            'Linear → Settings → API → Personal API Keys → "Create new key" → copy the value starting with "lin_api_". Used to create issues automatically from feedback widget.',
        howToObtainEs:
            'Linear → Settings → API → Personal API Keys → "Create new key" → copiá el valor que empieza con "lin_api_". Se usa para crear issues automáticamente desde el widget de feedback.'
    },
    {
        name: 'PUBLIC_FEEDBACK_ENABLED',
        description:
            'Enables the Hospeda feedback FAB widget in the web app. Gate visibility per environment (dev/preview/production).',
        descriptionEs:
            'Habilita el widget FAB de feedback de Hospeda en la app web. Controlá la visibilidad por entorno (dev/preview/producción).',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'true',
        apps: ['web'],
        category: 'integrations',
        howToObtain:
            'Set to "true" in preview and production environments to show the feedback FAB. Leave unset locally (defaults to false so dev/local stays quiet).',
        howToObtainEs:
            'Poné "true" en los entornos de preview y producción para mostrar el FAB de feedback. Dejalo sin setear en local (por defecto es false así no molesta en dev).'
    },
    {
        name: 'HOSPEDA_FEEDBACK_ENABLED',
        description: 'Kill switch to disable feedback endpoint (set to "false" to disable)',
        descriptionEs:
            'Kill switch para desactivar el endpoint de feedback (poné "false" para desactivar)',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'integrations',
        howToObtain:
            'Set "true" to enable the in-app feedback widget, "false" to hide it and reject submissions. Internally Zod transforms via `(v) => v !== "false"` — any value other than the literal string "false" is truthy. Useful as kill switch if Linear integration is down.',
        howToObtainEs:
            'Poné "true" para habilitar el widget de feedback in-app, "false" para esconderlo y rechazar envíos. Internamente Zod usa `(v) => v !== "false"` — cualquier valor distinto del string literal "false" se interpreta como true. Sirve como kill switch si la integración con Linear se rompe.'
    },
    {
        name: 'HOSPEDA_FEEDBACK_FALLBACK_EMAIL',
        description: 'Email address for feedback fallback notifications when Linear is unavailable',
        descriptionEs: 'Email para recibir feedback cuando Linear no está disponible (fallback)',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'feedback@hospeda.com',
        apps: ['api'],
        category: 'integrations',
        howToObtain:
            'Single email that receives feedback submissions when Linear API fails (so feedback is never lost). Use a real monitored inbox.',
        howToObtainEs:
            'Email único que recibe los envíos de feedback cuando falla la API de Linear (para no perder feedback). Usá una casilla real que estés monitoreando.'
    },
    {
        name: 'HOSPEDA_EXCHANGE_RATE_API_KEY',
        description: 'ExchangeRate-API key',
        descriptionEs: 'API key de ExchangeRate-API',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 'your-api-key',
        apps: ['api'],
        category: 'integrations',
        helpUrl: 'https://app.exchangerate-api.com/dashboard',
        howToObtain:
            'Sign up at exchangerate-api.com → Dashboard → copy the API key. Free tier: 1,500 requests/month. Used for converting prices between USD/ARS/etc.',
        howToObtainEs:
            'Registrate en exchangerate-api.com → Dashboard → copiá la API key. Free tier: 1.500 requests/mes. Se usa para convertir precios entre USD/ARS/etc.'
    },
    {
        name: 'HOSPEDA_DOLAR_API_BASE_URL',
        description: 'DolarAPI base URL',
        descriptionEs: 'URL base de DolarAPI',
        type: 'url',
        required: false,
        secret: false,
        exampleValue: 'https://dolarapi.com/v1',
        apps: ['api'],
        category: 'integrations',
        howToObtain:
            'Public free Argentine USD/ARS rate API — keep the default unless you need a fork or proxy. No key required.',
        howToObtainEs:
            'API pública y gratuita de cotización USD/ARS argentina; dejá el default salvo que necesites un fork o proxy. No requiere key.'
    },
    {
        name: 'HOSPEDA_EXCHANGE_RATE_API_BASE_URL',
        description: 'ExchangeRate-API base URL',
        descriptionEs: 'URL base de ExchangeRate-API',
        type: 'url',
        required: false,
        secret: false,
        exampleValue: 'https://v6.exchangerate-api.com/v6',
        apps: ['api'],
        category: 'integrations',
        howToObtain:
            'Default endpoint for exchangerate-api.com v6 — keep it unless their docs ask you to switch. The API key is appended automatically by the client.',
        howToObtainEs:
            'Endpoint default de exchangerate-api.com v6; dejalo salvo que su doc te pida cambiarlo. La API key la agrega automáticamente el cliente.'
    },

    // -------------------------------------------------------------------------
    // Cloudinary (Image Management)
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_CLOUDINARY_CLOUD_NAME',
        description: 'Cloudinary account cloud name for image storage and CDN delivery',
        descriptionEs:
            'Cloud name de la cuenta de Cloudinary para almacenamiento y entrega CDN de imágenes',
        type: 'string',
        required: false,
        requiredScope: 'production',
        secret: false,
        exampleValue: 'hospeda',
        apps: ['api', 'seed'],
        category: 'integrations',
        helpUrl: 'https://console.cloudinary.com/settings/api-keys',
        howToObtain:
            'Cloudinary Console → top-right account info, or Settings → API Keys → "Cloud name". This is the unique slug of your account, NOT a secret.',
        howToObtainEs:
            'Consola de Cloudinary → info de cuenta arriba a la derecha, o Settings → API Keys → "Cloud name". Es el slug único de tu cuenta; NO es un secreto.'
    },
    {
        name: 'HOSPEDA_CLOUDINARY_API_KEY',
        description: 'Cloudinary API key for server-side image upload and management',
        descriptionEs: 'API key de Cloudinary para upload y manejo de imágenes del lado servidor',
        type: 'string',
        required: false,
        requiredScope: 'production',
        secret: true,
        exampleValue: '123456789012345',
        apps: ['api', 'seed'],
        category: 'integrations',
        helpUrl: 'https://console.cloudinary.com/settings/api-keys',
        howToObtain:
            'Cloudinary Console → Settings → API Keys → copy the "API Key" (typically a 15-digit number). Used together with API secret for server-side uploads.',
        howToObtainEs:
            'Consola de Cloudinary → Settings → API Keys → copiá la "API Key" (típicamente un número de 15 dígitos). Se usa junto con el API secret para uploads del lado servidor.'
    },
    {
        name: 'HOSPEDA_CLOUDINARY_API_SECRET',
        description: 'Cloudinary API secret for server-side authentication',
        descriptionEs: 'API secret de Cloudinary para autenticación del lado servidor',
        type: 'string',
        required: false,
        requiredScope: 'production',
        secret: true,
        exampleValue: 'your-cloudinary-api-secret',
        apps: ['api', 'seed'],
        category: 'integrations',
        helpUrl: 'https://console.cloudinary.com/settings/api-keys',
        howToObtain:
            'Cloudinary Console → Settings → API Keys → click "Reveal" next to the API Secret → copy. Server-only — never expose to the browser.',
        howToObtainEs:
            'Consola de Cloudinary → Settings → API Keys → clickeá "Reveal" al lado del API Secret → copiá. Solo del lado servidor; nunca lo expongas al navegador.'
    },
    {
        name: 'HOSPEDA_ALLOW_PROD_CLEANUP',
        description:
            'Safety flag required to allow destructive cleanup operations (e.g. seed --clean-images) in production environments. Must be exactly "true".',
        descriptionEs:
            'Flag de seguridad requerido para permitir operaciones destructivas de cleanup (ej: seed --clean-images) en entornos de producción. Debe ser exactamente "true".',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'false',
        apps: ['seed'],
        category: 'integrations',
        howToObtain:
            'Hard guard. Keep "false". Set to "true" ONLY for the duration of an authorized one-shot cleanup script run in production, then revert to false immediately.',
        howToObtainEs:
            'Guarda dura. Dejalo en "false". Ponelo en "true" SOLO durante una corrida autorizada y puntual de un script de cleanup en producción; después volvelo a false inmediatamente.'
    },
    {
        name: 'HOSPEDA_MEDIA_MAX_FILE_SIZE_MB',
        description: 'Maximum upload file size in megabytes',
        descriptionEs: 'Tamaño máximo de archivo a subir en megabytes',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '10',
        exampleValue: '10',
        apps: ['api', 'seed'],
        category: 'integrations',
        howToObtain:
            'Cap on a single uploaded file size in MB. Default 10. Must stay at or below the global API_BODY_LIMIT bodyLimit (currently 10MB). Lower it if a tighter cap suits your storage plan.',
        howToObtainEs:
            'Tope al tamaño de un archivo subido en MB. Por defecto 10. Tiene que ser igual o menor al bodyLimit global de la API (actualmente 10MB). Bajalo si conviene un tope más ajustado por tu plan de almacenamiento.'
    },

    // -------------------------------------------------------------------------
    // Features / User limits
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_MAX_COLLECTIONS_PER_USER',
        /**
         * Maximum number of active collections (wishlists) a user may have.
         * Soft-deleted collections are excluded from this count. Default 10.
         */
        description:
            'Maximum number of active collections (wishlists) a user may have. Soft-deleted collections are excluded from this count. Default 10.',
        descriptionEs:
            'Cantidad máxima de colecciones activas (wishlists) que un usuario puede tener. Las soft-deleted no cuentan. Por defecto 10.',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '10',
        exampleValue: '10',
        apps: ['api'],
        category: 'features',
        howToObtain:
            'Per-user wishlist quota. Default 10. Bump up if you want power users to organize favorites in many lists.',
        howToObtainEs:
            'Cuota de wishlists por usuario. Por defecto 10. Subilo si querés que los power users puedan organizar favoritos en muchas listas.'
    },

    // -------------------------------------------------------------------------
    // Messaging
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_MESSAGING_BLOCKED_WORDS',
        description: 'Comma-separated list of blocked words for conversation content moderation',
        descriptionEs:
            'Lista de palabras bloqueadas (separadas por comas) para moderación de contenido en conversaciones',
        type: 'string',
        required: false,
        secret: false,
        deprecated: true,
        exampleValue: 'spam,scam,phishing',
        apps: ['api'],
        category: 'messaging',
        howToObtain:
            'Comma-separated list (no spaces) of words that trigger soft moderation on guest↔host messages. Case-insensitive. Example: "spam,scam,phishing,viagra".',
        howToObtainEs:
            'Lista separada por comas (sin espacios) de palabras que disparan moderación blanda en mensajes huésped↔host. No distingue mayúsculas. Ejemplo: "spam,scam,phishing,viagra".'
    },
    {
        name: 'HOSPEDA_MESSAGING_BLOCKED_DOMAINS',
        description: 'Comma-separated list of email domains blocked from initiating conversations',
        descriptionEs:
            'Lista de dominios de email (separados por comas) bloqueados para iniciar conversaciones',
        type: 'string',
        required: false,
        secret: false,
        deprecated: true,
        exampleValue: 'mailinator.com,guerrillamail.com',
        apps: ['api'],
        category: 'messaging',
        howToObtain:
            'Comma-separated list (no spaces) of email-domain blacklist used to reject signup/inquiry from disposable email providers. Example: "mailinator.com,guerrillamail.com,tempmail.com".',
        howToObtainEs:
            'Lista separada por comas (sin espacios) de dominios bloqueados para rechazar signups/consultas desde proveedores de email descartables. Ejemplo: "mailinator.com,guerrillamail.com,tempmail.com".'
    },

    // -------------------------------------------------------------------------
    // Content auto-moderation (SPEC-195)
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_MODERATION_PROVIDER',
        description:
            'Content moderation engine provider. "openai" uses OpenAI Moderation API, "local" uses DB word-list, "stub" uses the v1 binary blocklist (kill-switch).',
        descriptionEs:
            'Proveedor del motor de moderación de contenido. "openai" usa la API de Moderación de OpenAI, "local" usa la lista de palabras de la DB, "stub" usa la blocklist binaria v1 (kill-switch).',
        type: 'enum',
        required: false,
        secret: false,
        defaultValue: 'stub',
        exampleValue: 'stub',
        enumValues: ['openai', 'local', 'stub'] as const,
        apps: ['api'],
        category: 'moderation'
    },
    {
        name: 'HOSPEDA_MODERATION_OPENAI_API_KEY',
        description:
            'OpenAI API key for the content-moderation engine. Required when HOSPEDA_MODERATION_PROVIDER=openai.',
        descriptionEs:
            'API key de OpenAI para el motor de moderación de contenido. Obligatoria cuando HOSPEDA_MODERATION_PROVIDER=openai.',
        type: 'string',
        required: false,
        requiredScope: 'conditional',
        requiredWhen: 'HOSPEDA_MODERATION_PROVIDER=openai',
        secret: true,
        exampleValue: 'sk-...',
        apps: ['api'],
        category: 'moderation',
        helpUrl: 'https://platform.openai.com/api-keys',
        howToObtain:
            'OpenAI Platform → API keys → Create new secret key. Copy the value starting with "sk-". The Moderation API is free-tier; no billing setup required.',
        howToObtainEs:
            'OpenAI Platform → API keys → Create new secret key. Copiá el valor que empieza con "sk-". La API de Moderación es free-tier; no requiere setup de billing.'
    },
    {
        name: 'HOSPEDA_MODERATION_CACHE_TTL_SECONDS',
        description:
            'TTL in seconds for the in-memory LRU moderation cache. Identical text within this window returns the cached result without calling the provider.',
        descriptionEs:
            'TTL en segundos para la cache LRU en memoria de moderación. Texto idéntico dentro de esta ventana devuelve el resultado cacheado sin llamar al proveedor.',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '300',
        exampleValue: '300',
        apps: ['api'],
        category: 'moderation'
    },
    {
        name: 'HOSPEDA_MODERATION_TIMEOUT_MS',
        description:
            'Timeout in milliseconds for the OpenAI Moderation API call. If the provider does not respond within this window, the engine falls back to the local word-list path.',
        descriptionEs:
            'Timeout en milisegundos para la llamada a la API de Moderación de OpenAI. Si el proveedor no responde dentro de esta ventana, el motor cae al path de lista de palabras local.',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '1500',
        exampleValue: '1500',
        apps: ['api'],
        category: 'moderation'
    },
    {
        name: 'HOSPEDA_AI_MODERATION_REQUIRED',
        description:
            'Gates the startup moderation-credential healthcheck (SPEC-198). When "true", the API refuses to start if no resolvable OpenAI credential exists in the AI vault (HOSPEDA_AI_VAULT_MASTER_KEY + a stored credential). Default "false" so envs without AI moderation boot normally. Set to "true" in production once the vault credential is provisioned.',
        descriptionEs:
            'Controla el healthcheck de credencial de moderación al arranque (SPEC-198). Cuando es "true", la API se niega a arrancar si no hay credencial de OpenAI resoluble en el vault de IA (HOSPEDA_AI_VAULT_MASTER_KEY + una credencial almacenada). Por defecto "false" para que los entornos sin moderación por IA arranquen normalmente. Poné "true" en producción una vez aprovisionada la credencial del vault.',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'false',
        apps: ['api'],
        category: 'moderation'
    },

    // -------------------------------------------------------------------------
    // Monitoring
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_SENTRY_DSN',
        description: 'Sentry DSN for API error tracking',
        descriptionEs: 'DSN de Sentry para tracking de errores de la API',
        type: 'url',
        required: false,
        requiredScope: 'production',
        secret: false,
        exampleValue: 'https://xxxx@sentry.io/xxxx',
        apps: ['api'],
        category: 'monitoring',
        helpUrl: 'https://sentry.io/settings/projects/',
        howToObtain:
            'Sentry → your project → Settings → Client Keys (DSN) → copy the DSN URL. NOTE: Sentry DSNs are write-only ingestion keys, intentionally public per Sentry design (https://docs.sentry.io/concepts/key-terms/dsn-explainer/) — they are not secrets. Each environment should still use a project-specific DSN. Leave blank to disable error tracking.',
        howToObtainEs:
            'Sentry → tu proyecto → Settings → Client Keys (DSN) → copiá la URL del DSN. OJO: los DSN de Sentry son keys write-only de ingestión, intencionalmente públicas por diseño (https://docs.sentry.io/concepts/key-terms/dsn-explainer/) — no son secretos. Igual conviene que cada entorno use un DSN distinto. Dejala vacía para desactivar el tracking.'
    },
    {
        name: 'HOSPEDA_SENTRY_RELEASE',
        description: 'Sentry release identifier',
        descriptionEs: 'Identificador de release de Sentry',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'abc123def456',
        apps: ['api'],
        category: 'monitoring',
        howToObtain:
            'Free-text version label that groups errors per deploy. Recommended: wire it to HOSPEDA_COMMIT_SHA in CI/CD so each deploy gets a unique release identifier ("abc123def456"). Avoid semver "1.0.0" — every preview/staging deploy would collide on the same release.',
        howToObtainEs:
            'Etiqueta de versión en texto libre que agrupa errores por deploy. Recomendado: conectala a HOSPEDA_COMMIT_SHA en CI/CD así cada deploy es un release único ("abc123def456"). Evitá semver "1.0.0" — cada preview/staging tendría colisión en el mismo release.'
    },
    {
        name: 'HOSPEDA_SENTRY_PROJECT',
        description: 'Sentry project name',
        descriptionEs: 'Nombre del proyecto de Sentry',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'hospeda-api',
        apps: ['api'],
        category: 'monitoring',
        howToObtain:
            'The project slug shown in your Sentry URL: sentry.io/organizations/<org>/projects/<this-value>/. Used by source map upload tooling.',
        howToObtainEs:
            'El slug del proyecto que aparece en la URL de Sentry: sentry.io/organizations/<org>/projects/<este-valor>/. Lo usa la herramienta de upload de source maps.'
    },
    {
        name: 'HOSPEDA_SENTRY_ENVIRONMENT',
        description: 'Sentry environment tag (production | staging | development)',
        descriptionEs:
            'Tag de entorno en Sentry (production | staging | development) — separa eventos prod y staging cuando ambos corren con NODE_ENV=production.',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'staging',
        apps: ['api'],
        category: 'monitoring',
        howToObtain:
            'Free-text label applied to all Sentry events. Set to `production` on the prod container and `staging` on the staging container. Takes precedence over NODE_ENV in the Sentry init — lets both deployments run with NODE_ENV=production (preserving prod-like trace/profile sampling) while remaining separable in the Sentry dashboard.',
        howToObtainEs:
            'Etiqueta libre que se aplica a todos los eventos de Sentry. Poné `production` en el contenedor prod y `staging` en el de staging. Tiene precedencia sobre NODE_ENV en el init de Sentry — permite que ambos deploys corran con NODE_ENV=production (preservando el sampling de traces/profiles tipo prod) pero queden separables en el dashboard de Sentry.'
    },
    {
        name: 'HOSPEDA_POSTHOG_KEY',
        description: 'PostHog project API key for server-side AI event analytics',
        descriptionEs: 'API key del proyecto PostHog para analíticas server-side de eventos de IA',
        type: 'string',
        required: false,
        requiredScope: 'production',
        secret: true,
        exampleValue: 'phc_xxx',
        apps: ['api'],
        category: 'monitoring',
        helpUrl: 'https://posthog.com/docs/libraries/node',
        howToObtain:
            'PostHog → your project → Settings → Project API Keys → copy the project API key (starts with phc_). Leave blank to disable AI event analytics without breaking anything.',
        howToObtainEs:
            'PostHog → tu proyecto → Settings → Project API Keys → copiá el project API key (empieza con phc_). Dejala vacía para deshabilitar las analíticas de eventos de IA sin romper nada.'
    },
    {
        name: 'HOSPEDA_POSTHOG_HOST',
        description: 'PostHog API host (defaults to https://us.i.posthog.com)',
        descriptionEs: 'Host de la API de PostHog (por defecto https://us.i.posthog.com)',
        type: 'url',
        required: false,
        secret: false,
        exampleValue: 'https://us.i.posthog.com',
        apps: ['api'],
        category: 'monitoring',
        helpUrl: 'https://posthog.com/docs/libraries/node',
        howToObtain:
            'Only needed when using a self-hosted PostHog instance or the EU cloud (https://eu.i.posthog.com). Leave unset to use the default US cloud endpoint.',
        howToObtainEs:
            'Solo necesitás configurarlo si usás una instancia self-hosted de PostHog o el cloud EU (https://eu.i.posthog.com). Si no lo configurás, se usa el endpoint por defecto del cloud US.'
    },
    {
        name: 'SENTRY_AUTH_TOKEN',
        description: 'Sentry auth token used at build time to upload source maps (web, admin, api)',
        descriptionEs:
            'Token de autenticación de Sentry usado en build-time para subir source maps (web, admin, api)',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 'sntrys_xxxxxxxxxxxxxxxxxxxx',
        apps: ['web', 'admin', 'api'],
        category: 'monitoring',
        helpUrl: 'https://docs.sentry.io/account/auth-tokens/',
        howToObtain:
            'Sentry → Settings → Account → User Auth Tokens → Create New Token. Required scopes: `project:releases`, `org:read`, `project:read`. Used by @sentry/astro (web), @sentry/vite-plugin (admin), and @sentry/esbuild-plugin (api) at build time to upload source maps so production stack traces are symbolicated. Build skips upload silently if missing. Org slug `qazuor` and per-app project slugs (`hospeda-web`, `hospeda-admin`, `hospeda-api`) are hardcoded in each app build config — the same org-scoped token works for all three.',
        howToObtainEs:
            'Sentry → Settings → Account → User Auth Tokens → Create New Token. Scopes mínimos: `project:releases`, `org:read`, `project:read`. Lo usan @sentry/astro (web), @sentry/vite-plugin (admin) y @sentry/esbuild-plugin (api) en build-time para subir los source maps y así los stack traces en producción salgan simbolicados. Si falta, el upload se saltea en silencio. El org slug `qazuor` y los project slugs por app (`hospeda-web`, `hospeda-admin`, `hospeda-api`) están hardcoded en cada config de build — el mismo token (org-scoped) sirve para los tres.'
    },

    // -------------------------------------------------------------------------
    // Testing
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_DISABLE_AUTH',
        description: 'Bypass auth in tests',
        descriptionEs: 'Saltea la autenticación en tests',
        type: 'boolean',
        required: false,
        secret: false,
        exampleValue: 'false',
        apps: ['api'],
        category: 'testing',
        howToObtain:
            'Set "true" ONLY in test environments to skip authentication checks. NEVER true in dev/preview/prod (would expose admin endpoints). Default: false.',
        howToObtainEs:
            'Poné "true" SOLO en entornos de testing para saltear los checks de autenticación. NUNCA true en dev/preview/prod (expondría endpoints de admin). Por defecto: false.'
    },
    {
        name: 'HOSPEDA_ALLOW_MOCK_ACTOR',
        description: 'Allow mock actors in tests',
        descriptionEs: 'Permite actores mock en tests',
        type: 'boolean',
        required: false,
        secret: false,
        exampleValue: 'false',
        apps: ['api'],
        category: 'testing',
        howToObtain:
            'Set "true" in CI/test env to let tests inject fake "actor" users via x-actor-id header. NEVER true in prod.',
        howToObtainEs:
            'Poné "true" en CI/tests para permitir que los tests inyecten usuarios "actor" falsos vía header x-actor-id. NUNCA true en prod.'
    },
    {
        name: 'HOSPEDA_TESTING_RATE_LIMIT',
        description: 'Enable rate limit in tests',
        descriptionEs: 'Activa el rate limit en tests',
        type: 'boolean',
        required: false,
        secret: false,
        exampleValue: 'false',
        apps: ['api'],
        category: 'testing',
        howToObtain:
            'Default false (rate limit disabled in tests for speed). Set true only when explicitly testing rate-limit behavior.',
        howToObtainEs:
            'Por defecto false (rate limit desactivado en tests para ir más rápido). Ponelo en true solo cuando estés testeando explícitamente el comportamiento de rate limit.'
    },
    {
        name: 'HOSPEDA_TESTING_ORIGIN_VERIFICATION',
        description: 'Enable origin check in tests',
        descriptionEs: 'Activa el check de origin en tests',
        type: 'boolean',
        required: false,
        secret: false,
        exampleValue: 'false',
        apps: ['api'],
        category: 'testing',
        howToObtain:
            'Default false (CSRF origin verification skipped in tests). Set true only when testing CSRF protections specifically.',
        howToObtainEs:
            'Por defecto false (verificación de origin de CSRF salteada en tests). Ponelo en true solo cuando estés testeando específicamente las protecciones CSRF.'
    },
    {
        name: 'HOSPEDA_DEBUG_TESTS',
        description: 'Verbose test logging',
        descriptionEs: 'Logging verboso en tests',
        type: 'boolean',
        required: false,
        secret: false,
        exampleValue: 'false',
        apps: ['api'],
        category: 'testing',
        howToObtain: 'Set true to print verbose logs while running the test suite. Default: false.',
        howToObtainEs:
            'Poné true para imprimir logs verbosos mientras corre la suite de tests. Por defecto: false.'
    },

    // -------------------------------------------------------------------------
    // Debugging
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_API_DEBUG_ERRORS',
        description: 'Show error details in responses',
        descriptionEs: 'Muestra detalles de error en las respuestas',
        type: 'boolean',
        required: false,
        secret: false,
        exampleValue: 'false',
        apps: ['api'],
        category: 'debugging',
        howToObtain:
            'Set true in dev/staging to leak full error stack traces in API responses (handy when debugging). NEVER true in prod (info disclosure).',
        howToObtainEs:
            'Poné true en dev/staging para filtrar los stack traces completos en las respuestas de la API (útil cuando debuggeás). NUNCA true en prod (info disclosure).'
    },

    // -------------------------------------------------------------------------
    // Build
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_COMMIT_SHA',
        description: 'Build commit SHA',
        descriptionEs: 'SHA del commit del build',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'abc123',
        apps: ['api'],
        category: 'build',
        howToObtain:
            'In CI/CD set this to the deployed git SHA (Coolify on the VPS does this automatically when wired up). Local: leave blank. Used to tie API responses to a specific commit so "which version was running?" is answerable from any error report.',
        howToObtainEs:
            'En CI/CD seteala al SHA del commit deployado (Coolify lo hace solo en el VPS si está conectado). En local: dejala vacía. Sirve para atar las respuestas de la API a un commit específico, así "qué versión estaba corriendo" se puede responder desde cualquier reporte de error.'
    },
    {
        name: 'HOSPEDA_SUPPORTED_LOCALES',
        description: 'Supported locales (mapped to VITE_SUPPORTED_LOCALES at build)',
        descriptionEs: 'Locales soportados (se mapea a VITE_SUPPORTED_LOCALES en build)',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'es,en,pt',
        exampleValue: 'es,en,pt',
        apps: ['admin'],
        category: 'i18n',
        howToObtain:
            'Comma-separated list of locale codes the admin UI offers (e.g. "es,en,pt"). Must be a subset of what @repo/i18n actually has translations for. Order does not matter for routing but tooling may use the first as a tie-breaker.',
        howToObtainEs:
            'Lista separada por comas con los códigos de locale que ofrece la UI del admin (ej: "es,en,pt"). Tiene que ser un subconjunto de lo que @repo/i18n realmente tiene traducido. El orden no afecta el routing pero algunas herramientas usan el primero como desempate.'
    },
    {
        name: 'HOSPEDA_DEFAULT_LOCALE',
        description: 'Default locale (mapped to VITE_DEFAULT_LOCALE at build)',
        descriptionEs: 'Locale por defecto (se mapea a VITE_DEFAULT_LOCALE en build)',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'es',
        exampleValue: 'es',
        apps: ['admin'],
        category: 'i18n',
        howToObtain:
            'Locale used when no preference is set (e.g. "es" for Argentina). Must be one of HOSPEDA_SUPPORTED_LOCALES.',
        howToObtainEs:
            'Locale que se usa cuando no hay preferencia (ej: "es" para Argentina). Tiene que ser uno de HOSPEDA_SUPPORTED_LOCALES.'
    },
    // -------------------------------------------------------------------------
    // Accommodation import (SPEC-222)
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_APIFY_TOKEN',
        description:
            'Apify API token used by the Airbnb scraper actor (and the Booking.com fallback adapter). Required to call any Apify actor run via the Apify REST API.',
        descriptionEs:
            'Token de la API de Apify que usan el actor scraper de Airbnb (y el adaptador de Booking.com como fallback). Necesario para ejecutar cualquier actor de Apify vía la REST API.',
        type: 'string',
        required: false,
        requiredScope: 'production',
        secret: true,
        exampleValue: 'your-apify-api-token',
        apps: ['api'],
        category: 'integrations',
        helpUrl: 'https://console.apify.com/settings/integrations',
        howToObtain:
            'Apify Console → Settings → Integrations → Personal API tokens → "Create new token". Copy the generated value (starts with "apify_api_"). Never commit this value.',
        howToObtainEs:
            'Consola de Apify → Settings → Integrations → Personal API tokens → "Create new token". Copiá el valor generado (empieza con "apify_api_"). Nunca lo commitees.'
    },
    {
        name: 'HOSPEDA_APIFY_AIRBNB_ACTOR',
        description:
            'Apify actor ID or slug for the Airbnb scraper. Allows swapping the scraper provider without a code deploy (e.g. "tri_angle/airbnb-scraper").',
        descriptionEs:
            'ID o slug del actor de Apify para el scraper de Airbnb. Permite cambiar el proveedor del scraper sin redesplegar código (ej: "tri_angle/airbnb-scraper").',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'tri_angle/airbnb-scraper',
        exampleValue: 'tri_angle/airbnb-scraper',
        apps: ['api'],
        category: 'integrations',
        helpUrl: 'https://console.apify.com/actors',
        howToObtain:
            'Find the actor on the Apify Store (https://apify.com/store) and copy its slug shown as "username/actor-name". The default "tri_angle/airbnb-scraper" works for Airbnb listings.',
        howToObtainEs:
            'Buscá el actor en el Apify Store (https://apify.com/store) y copiá su slug que aparece como "usuario/nombre-actor". El default "tri_angle/airbnb-scraper" funciona para listings de Airbnb.'
    },
    {
        name: 'HOSPEDA_APIFY_BOOKING_ACTOR',
        description:
            'Apify actor ID or slug for the Booking.com scraper. Used as a fallback when the direct JSON-LD fetch is blocked or yields too few fields. Allows swapping the scraper provider without a code deploy (e.g. "voyager/booking-scraper").',
        descriptionEs:
            'ID o slug del actor de Apify para el scraper de Booking.com. Se usa como fallback cuando el fetch directo JSON-LD es bloqueado o produce pocos campos. Permite cambiar el proveedor del scraper sin redesplegar código (ej: "voyager/booking-scraper").',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'voyager/booking-scraper',
        exampleValue: 'voyager/booking-scraper',
        apps: ['api'],
        category: 'integrations',
        helpUrl: 'https://console.apify.com/actors',
        howToObtain:
            'Find the actor on the Apify Store (https://apify.com/store) and copy its slug shown as "username/actor-name". The default "voyager/booking-scraper" works for Booking.com listings.',
        howToObtainEs:
            'Buscá el actor en el Apify Store (https://apify.com/store) y copiá su slug que aparece como "usuario/nombre-actor". El default "voyager/booking-scraper" funciona para listings de Booking.com.'
    },
    {
        name: 'HOSPEDA_GOOGLE_PLACES_API_KEY',
        description:
            'Google Places API (New) key for the Google Maps import tier. Used to look up place details and extract accommodation metadata from Google Maps listings.',
        descriptionEs:
            'API key de la Google Places API (New) para el tier de importación desde Google Maps. Se usa para buscar detalles de lugares y extraer metadatos de alojamiento de listings en Google Maps.',
        type: 'string',
        required: false,
        requiredScope: 'production',
        secret: true,
        exampleValue: 'your-google-places-api-key',
        apps: ['api'],
        category: 'integrations',
        helpUrl: 'https://console.cloud.google.com/apis/credentials',
        howToObtain:
            'Google Cloud Console → APIs & Services → Credentials → "Create Credentials" → "API key". Then restrict the key to the "Places API (New)" under "API restrictions". Billing must be enabled on the project.',
        howToObtainEs:
            'Google Cloud Console → APIs & Services → Credentials → "Create Credentials" → "API key". Luego restringí la key a la "Places API (New)" en "API restrictions". El proyecto debe tener billing habilitado.'
    },
    {
        name: 'HOSPEDA_MERCADOLIBRE_TOKEN',
        description:
            'MercadoLibre OAuth app access token for reading /items listings. Required because the ML /items endpoint no longer allows anonymous access.',
        descriptionEs:
            'Token de acceso OAuth de la app de MercadoLibre para leer listings de /items. Necesario porque el endpoint ML /items ya no permite acceso anónimo.',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 'your-mercadolibre-access-token',
        apps: ['api'],
        category: 'integrations',
        helpUrl: 'https://developers.mercadolibre.com.ar/devcenter',
        howToObtain:
            'MercadoLibre Developers → "Crear aplicación" → complete the form → copy the "Access Token" from the app credentials panel. Tokens expire; use the refresh-token flow to keep them valid.',
        howToObtainEs:
            'MercadoLibre Developers → "Crear aplicación" → completá el formulario → copiá el "Access Token" del panel de credenciales de la app. Los tokens expiran; usá el flujo de refresh-token para mantenerlos válidos.'
    },
    {
        name: 'HOSPEDA_IMPORT_FETCH_TIMEOUT_MS',
        description:
            'Timeout in milliseconds for the safeExternalFetch utility used in accommodation import adapters. Requests that exceed this limit are aborted.',
        descriptionEs:
            'Timeout en milisegundos para el utilitario safeExternalFetch usado en los adaptadores de importación de alojamientos. Las solicitudes que superen este límite se abortan.',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '8000',
        exampleValue: '8000',
        apps: ['api'],
        category: 'integrations'
    },
    {
        name: 'HOSPEDA_IMPORT_FETCH_MAX_BYTES',
        description:
            'Maximum response body size in bytes for the safeExternalFetch utility used in accommodation import adapters. Responses exceeding this limit are rejected.',
        descriptionEs:
            'Tamaño máximo del cuerpo de respuesta en bytes para el utilitario safeExternalFetch usado en los adaptadores de importación de alojamientos. Las respuestas que superen este límite son rechazadas.',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '3000000',
        exampleValue: '3000000',
        apps: ['api'],
        category: 'integrations'
    },
    {
        name: 'HOSPEDA_IMPORT_RATE_LIMIT_RPH',
        description:
            'Per-user rate limit (requests per hour) for the accommodation import endpoint. Prevents abuse and excessive external API consumption.',
        descriptionEs:
            'Límite de tasa por usuario (solicitudes por hora) para el endpoint de importación de alojamientos. Previene abuso y consumo excesivo de APIs externas.',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '10',
        exampleValue: '10',
        apps: ['api'],
        category: 'integrations'
    },
    {
        name: 'HOSPEDA_IMPORT_AI_MAX_CHARS',
        description:
            'Maximum number of characters of scraped page text sent to the AI Strategy B enrichment step. Limits token consumption and cost.',
        descriptionEs:
            'Número máximo de caracteres del texto de la página scrapeada que se envían al paso de enriquecimiento por IA (Estrategia B). Limita el consumo de tokens y el costo.',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '12000',
        exampleValue: '12000',
        apps: ['api'],
        category: 'integrations'
    },

    {
        name: 'HOSPEDA_NOINDEX_HOSTS',
        description:
            'Comma-separated hostnames that must receive a restrictive robots policy (Disallow: /) and X-Robots-Tag: noindex, nofollow header. Used to keep staging hostnames out of search engines.',
        descriptionEs:
            'Lista de hostnames separados por coma que deben recibir una policy restrictiva de robots (Disallow: /) y el header X-Robots-Tag: noindex, nofollow. Sirve para mantener los hostnames de staging fuera de los buscadores.',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'staging.hospeda.com.ar',
        exampleValue: 'staging.hospeda.com.ar,beta.hospeda.com.ar',
        apps: ['web'],
        category: 'features',
        howToObtain:
            'Set in Coolify for hospeda-web-staging to keep search engines from indexing the staging mirror. Production (hospeda.com.ar) should leave it unset (which falls back to the staging default — also acceptable since the prod host is not in that list).',
        howToObtainEs:
            'Configurar en Coolify para hospeda-web-staging así los buscadores no indexan el mirror de staging. En producción (hospeda.com.ar) dejarla sin setear (cae al default de staging, lo cual también está OK porque el host de prod no está en esa lista).'
    }
] as const satisfies readonly EnvVarDefinition[];
