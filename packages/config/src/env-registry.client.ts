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
        descriptionEs: 'URL base de la API expuesta al navegador (prefijo PUBLIC_ de Astro)',
        type: 'url',
        required: true,
        secret: false,
        exampleValue: 'http://localhost:3001',
        apps: ['web'],
        category: 'client-web',
        howToObtain:
            'Same value as HOSPEDA_API_URL but exposed to the browser bundle. Local: http://localhost:3001. Production: https://api.hospeda.com.ar (or your real API domain).',
        howToObtainEs:
            'El mismo valor que HOSPEDA_API_URL pero expuesto al bundle del navegador. Local: http://localhost:3001. Producción: https://api.hospeda.com.ar (o tu dominio real de la API).'
    },
    {
        name: 'PUBLIC_SITE_URL',
        description: 'Web app base URL exposed to the browser (Astro PUBLIC_ prefix)',
        descriptionEs: 'URL base del sitio web expuesta al navegador (prefijo PUBLIC_ de Astro)',
        type: 'url',
        required: true,
        secret: false,
        exampleValue: 'http://localhost:4321',
        apps: ['web'],
        category: 'client-web',
        howToObtain:
            'Same value as HOSPEDA_SITE_URL but exposed to the browser bundle. Local: http://localhost:4321. Production: https://hospeda.com.ar (or your real domain).',
        howToObtainEs:
            'El mismo valor que HOSPEDA_SITE_URL pero expuesto al bundle del navegador. Local: http://localhost:4321. Producción: https://hospeda.com.ar (o tu dominio real).'
    },
    {
        name: 'PUBLIC_SENTRY_DSN',
        description: 'Sentry DSN for client-side error tracking in the web app',
        descriptionEs: 'DSN de Sentry para tracking de errores del lado cliente en la web',
        type: 'url',
        required: false,
        secret: false,
        exampleValue: 'https://abc123def456@o123456.ingest.sentry.io/7890123',
        apps: ['web'],
        category: 'client-web',
        helpUrl: 'https://docs.sentry.io/concepts/key-terms/dsn-explainer/',
        howToObtain:
            'Sentry → your web project → Settings → Client Keys (DSN) → copy the DSN URL. NOTE: Sentry DSNs are write-only ingestion keys, intentionally public per Sentry design — they ship in the browser bundle and that is by design. Use a separate Sentry project from HOSPEDA_SENTRY_DSN (API) so errors are scoped per surface. Leave blank to disable.',
        howToObtainEs:
            'Sentry → tu proyecto web → Settings → Client Keys (DSN) → copiá la URL. OJO: los DSN de Sentry son keys write-only de ingestión, intencionalmente públicas por diseño — viajan en el bundle del browser y eso es esperado. Usá un proyecto Sentry distinto al de HOSPEDA_SENTRY_DSN (API) así los errores quedan separados por superficie. Dejala vacía para desactivar.'
    },
    {
        name: 'PUBLIC_SENTRY_RELEASE',
        description: 'Sentry release identifier for the web app',
        descriptionEs: 'Identificador de release de Sentry para la web',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'abc123def456',
        apps: ['web'],
        category: 'client-web',
        howToObtain:
            'Free-text version label per deploy. Recommended: wire it to the deployed git commit SHA (e.g. via HOSPEDA_COMMIT_SHA in CI/CD) so each deploy gets a unique release identifier ("abc123def456"). Avoid semver strings like "1.0.0" because every preview/staging deploy would collide on the same release in Sentry.',
        howToObtainEs:
            'Etiqueta de versión libre por deploy. Recomendado: conectala al SHA del commit deployado (por ejemplo vía HOSPEDA_COMMIT_SHA en CI/CD) así cada deploy es un release único ("abc123def456"). Evitá strings semver tipo "1.0.0" porque cada preview/staging tendría colisión en el mismo release en Sentry.'
    },
    {
        name: 'PUBLIC_SENTRY_ENVIRONMENT',
        description: 'Sentry environment tag for the web app (production | staging | development)',
        descriptionEs:
            'Tag de entorno en Sentry para la web (production | staging | development) — separa eventos prod y staging cuando ambos corren con MODE=production.',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'staging',
        apps: ['web'],
        category: 'client-web',
        howToObtain:
            'Free-text label applied to all Sentry events from the web app (both SSR and browser). Set to `production` on hospeda-web-prod and `staging` on hospeda-web-staging. Takes precedence over import.meta.env.MODE in the Sentry init — without it, Astro production builds always tag events as `production` regardless of which deployment they came from, mixing staging and prod in the same Sentry environment bucket. Mirror of HOSPEDA_SENTRY_ENVIRONMENT (API).',
        howToObtainEs:
            'Etiqueta libre que se aplica a todos los eventos de Sentry del web app (SSR y browser). Poné `production` en hospeda-web-prod y `staging` en hospeda-web-staging. Tiene precedencia sobre import.meta.env.MODE en el init de Sentry — sin esto, los builds de Astro en producción siempre etiquetan los eventos como `production` sin importar de qué deploy vinieron, mezclando staging y prod en el mismo bucket en Sentry. Mirror de HOSPEDA_SENTRY_ENVIRONMENT (API).'
    },
    {
        name: 'PUBLIC_SENTRY_TUNNEL',
        description:
            'First-party tunnel path for the Sentry browser SDK (SPEC-181 follow-up). RECOMMENDED: `/api/event` so ad-blockers (uBlock `||sentry.io^$3p`) cannot intercept error reporting. When set, the SDK POSTs envelopes to this same-origin path and a Cloudflare Worker (infra/cloudflare/sentry-tunnel/) parses the DSN and forwards to Sentry. Setting this ALSO drops `https://*.sentry.io` from the web CSP connect-src (same deploy, automatic). Leave unset to report directly to Sentry. DEPLOY ORDER: the Worker must be live BEFORE this is set, or Sentry breaks silently.',
        descriptionEs:
            'Path del tunnel first-party para el SDK de Sentry del browser (follow-up de SPEC-181). RECOMENDADO: `/api/event` para que los ad-blockers (uBlock `||sentry.io^$3p`) no intercepten el reporte de errores. Cuando se setea, el SDK hace POST de los envelopes a ese path same-origin y un Cloudflare Worker (infra/cloudflare/sentry-tunnel/) parsea el DSN y reenvía a Sentry. Setearlo TAMBIÉN saca `https://*.sentry.io` del connect-src del CSP de la web (mismo deploy, automático). Dejalo sin setear para reportar directo a Sentry. ORDEN DE DEPLOY: el Worker debe estar vivo ANTES de setear esto, o Sentry se rompe silenciosamente.',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: '/api/event',
        apps: ['web'],
        category: 'client-web',
        howToObtain:
            'Set to `/api/event` once the Cloudflare Worker in infra/cloudflare/sentry-tunnel/ is deployed for this environment (staging route: `staging.hospeda.com.ar/api/event`, prod: `hospeda.com.ar/api/event`). DEPLOY ORDER MATTERS: the Worker must be live first — the same env flip drops the external *.sentry.io CSP entry, so if the tunnel path 404s, all browser error reports are lost. Sibling of PUBLIC_POSTHOG_HOST (PostHog uses a DIFFERENT path, /api/relay, and a DIFFERENT Worker — do not mix them). Leave unset for direct-to-Sentry reporting (default; *.sentry.io stays in the CSP).',
        howToObtainEs:
            'Seteá `/api/event` una vez deployado el Cloudflare Worker en infra/cloudflare/sentry-tunnel/ para este entorno (route staging: `staging.hospeda.com.ar/api/event`, prod: `hospeda.com.ar/api/event`). EL ORDEN DE DEPLOY IMPORTA: el Worker debe estar vivo primero — el mismo flip de env saca la entrada externa *.sentry.io del CSP, así que si el path del tunnel da 404, se pierden todos los reportes de error del browser. Hermano de PUBLIC_POSTHOG_HOST (PostHog usa un path DISTINTO, /api/relay, y un Worker DISTINTO — no los mezcles). Dejalo sin setear para reportar directo a Sentry (default; *.sentry.io queda en el CSP).'
    },
    {
        name: 'PUBLIC_ENABLE_LOGGING',
        description: 'Enable verbose client-side logging in the web app',
        descriptionEs: 'Activa el logging verboso del lado cliente en la web',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'true',
        apps: ['web'],
        category: 'client-web',
        howToObtain:
            'Set "true" in dev to see verbose console logs from the web client. Default false (silent in prod).',
        howToObtainEs:
            'Poné "true" en dev para ver logs verbosos del cliente en la consola. Por defecto false (silencio en prod).'
    },
    {
        name: 'PUBLIC_VERSION',
        description:
            'Application version string exposed to the browser for feedback auto-collection',
        descriptionEs:
            'Versión de la aplicación expuesta al navegador para auto-recolección en feedback',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: '1.0.0',
        apps: ['web'],
        category: 'client-web',
        howToObtain:
            'Free-text version shown in feedback submissions and bug reports. In CI/CD set it to HOSPEDA_COMMIT_SHA so it changes per deploy. Local: pick anything ("dev").',
        howToObtainEs:
            'Versión en texto libre que se muestra en envíos de feedback y reportes de bugs. En CI/CD seteala desde HOSPEDA_COMMIT_SHA así cambia por deploy. Local: poné cualquier cosa ("dev").'
    },
    {
        name: 'PUBLIC_ADMIN_URL',
        description:
            'Admin app URL exposed to the browser. Used by the web app to link to admin pages.',
        descriptionEs:
            'URL del admin expuesta al navegador. La usa la web para linkear a páginas del admin.',
        type: 'url',
        required: false,
        secret: false,
        exampleValue: 'http://localhost:3000',
        apps: ['web'],
        category: 'client-web',
        howToObtain:
            'Same value as HOSPEDA_ADMIN_URL but exposed to the browser. Local: http://localhost:3000. Production: https://admin.hospeda.com.ar.',
        howToObtainEs:
            'El mismo valor que HOSPEDA_ADMIN_URL pero expuesto al navegador. Local: http://localhost:3000. Producción: https://admin.hospeda.com.ar.'
    },
    {
        name: 'PUBLIC_HOSPEDA_WHATSAPP_CHANNEL_URL',
        description:
            'WhatsApp broadcast channel invite URL exposed to the browser. When set, the web WhatsAppCTA component renders a join CTA; when unset, the block is hidden.',
        descriptionEs:
            'URL de invitación al canal de WhatsApp expuesta al navegador. Si está seteada, el componente WhatsAppCTA de la web muestra un CTA para sumarse; si no, se oculta.',
        type: 'url',
        required: false,
        secret: false,
        exampleValue: 'https://whatsapp.com/channel/0029Va6S3oPxxxxxxxxxxxx',
        apps: ['web'],
        category: 'client-web',
        howToObtain:
            'Mirror of HOSPEDA_NEWSLETTER_WA_CHANNEL_URL (server-side, for the welcome email). WhatsApp → Channels → your channel → Channel link → copy the public invite URL. Leave unset to hide the CTA entirely.',
        howToObtainEs:
            'Mirror del valor server-side HOSPEDA_NEWSLETTER_WA_CHANNEL_URL (que usa el email de bienvenida). WhatsApp → Channels → tu canal → Channel link → copiá la URL pública. Dejala vacía para ocultar el CTA.'
    },
    {
        name: 'PUBLIC_POSTHOG_KEY',
        description:
            'PostHog Cloud project API key for the web app (`phc_...`). Client-exposed by design (ships in the browser bundle). Empty disables PostHog init.',
        descriptionEs:
            'API key del proyecto PostHog Cloud para la app web (`phc_...`). Es client-exposed por diseño (viaja en el bundle del browser). Vacía desactiva el init de PostHog.',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 'phc_xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        apps: ['web'],
        category: 'client-web',
        helpUrl: 'https://us.posthog.com',
        howToObtain:
            'PostHog Cloud (https://us.posthog.com) → org `Hospeda` → project `hospeda-web-prod` (or `hospeda-web-staging` for staging) → Settings → Project → Project API Key → copy the value starting with `phc_`. Stored in 1Password under "Hospeda / PostHog project keys". Marked secret for log hygiene even though PostHog treats project keys as public ingestion keys (they ship to every browser).',
        howToObtainEs:
            'PostHog Cloud (https://us.posthog.com) → org `Hospeda` → proyecto `hospeda-web-prod` (o `hospeda-web-staging` para staging) → Settings → Project → Project API Key → copiá el valor que empieza con `phc_`. Guardada en 1Password bajo "Hospeda / PostHog project keys". Marcada como secret por higiene de logs aunque PostHog las trata como keys públicas de ingestión (viajan a todos los browsers).'
    },
    {
        name: 'PUBLIC_POSTHOG_HOST',
        description:
            'PostHog ingestion endpoint for the web app. RECOMMENDED: the first-party reverse proxy `https://hospeda.com.ar/api/relay` (SPEC-181) so ad-blockers cannot intercept analytics. Falls back to US Cloud direct (`https://us.i.posthog.com`) when unset. Changing this REQUIRES a matching CSP update in apps/web/src/lib/middleware-helpers.ts (same deploy).',
        descriptionEs:
            'Endpoint de ingestión de PostHog para la app web. RECOMENDADO: el reverse proxy first-party `https://hospeda.com.ar/api/relay` (SPEC-181) para que los ad-blockers no intercepten analytics. Fallback a US Cloud directo (`https://us.i.posthog.com`) si no se setea. Cambiarlo REQUIERE actualizar el CSP en apps/web/src/lib/middleware-helpers.ts (mismo deploy).',
        type: 'url',
        required: false,
        secret: false,
        defaultValue: 'https://us.i.posthog.com',
        exampleValue: 'https://hospeda.com.ar/api/relay',
        apps: ['web'],
        category: 'client-web',
        howToObtain:
            'Set to the first-party proxy `https://hospeda.com.ar/api/relay` (staging: `https://staging.hospeda.com.ar/api/relay`) once the Cloudflare Worker in infra/cloudflare/posthog-proxy/ is deployed. DEPLOY ORDER MATTERS: the Worker must be live AND the CSP in middleware-helpers.ts must drop the external PostHog hosts in the SAME deploy, or PostHog breaks silently. Falls back to `https://us.i.posthog.com` (US Cloud, Hospeda org, decided 2026-05-17) if unset. For EU Cloud use `https://eu.i.posthog.com`.',
        howToObtainEs:
            'Seteá el proxy first-party `https://hospeda.com.ar/api/relay` (staging: `https://staging.hospeda.com.ar/api/relay`) una vez deployado el Cloudflare Worker en infra/cloudflare/posthog-proxy/. EL ORDEN DE DEPLOY IMPORTA: el Worker debe estar vivo Y el CSP en middleware-helpers.ts debe sacar los hosts externos de PostHog en el MISMO deploy, o PostHog se rompe silenciosamente. Fallback a `https://us.i.posthog.com` (US Cloud, org Hospeda, decidido 2026-05-17) si no se setea. Para EU Cloud usá `https://eu.i.posthog.com`.'
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
        descriptionEs: 'Endpoint de la API para el dashboard de admin (prefijo VITE_ de Vite)',
        type: 'url',
        required: true,
        secret: false,
        exampleValue: 'http://localhost:3001',
        apps: ['admin'],
        category: 'client-admin',
        howToObtain:
            'Same value as HOSPEDA_API_URL but exposed to the admin browser bundle. Local: http://localhost:3001. Production: https://api.hospeda.com.ar.',
        howToObtainEs:
            'El mismo valor que HOSPEDA_API_URL pero expuesto al bundle del admin. Local: http://localhost:3001. Producción: https://api.hospeda.com.ar.'
    },
    {
        name: 'VITE_SITE_URL',
        description: 'Public web app URL exposed to the admin dashboard (Vite VITE_ prefix)',
        descriptionEs:
            'URL del sitio público expuesta al dashboard de admin (prefijo VITE_ de Vite)',
        type: 'url',
        required: true,
        secret: false,
        exampleValue: 'http://localhost:4321',
        apps: ['admin'],
        category: 'client-admin',
        howToObtain:
            'Public website URL — admin uses it to build "View on site" links. Local: http://localhost:4321. Production: https://hospeda.com.ar.',
        howToObtainEs:
            'URL del sitio público; el admin la usa para armar links de tipo "Ver en el sitio". Local: http://localhost:4321. Producción: https://hospeda.com.ar.'
    },
    {
        name: 'VITE_BETTER_AUTH_URL',
        description: 'Better Auth endpoint URL for the admin dashboard',
        descriptionEs: 'URL del endpoint de Better Auth para el dashboard de admin',
        type: 'url',
        required: true,
        secret: false,
        exampleValue: 'http://localhost:3001/api/auth',
        apps: ['admin'],
        category: 'client-admin',
        howToObtain:
            'Always VITE_API_URL + "/api/auth". Local: http://localhost:3001/api/auth. Production: https://api.hospeda.com.ar/api/auth.',
        howToObtainEs:
            'Siempre es VITE_API_URL + "/api/auth". Local: http://localhost:3001/api/auth. Producción: https://api.hospeda.com.ar/api/auth.'
    },
    {
        name: 'VITE_APP_NAME',
        description: 'Display name of the admin application',
        descriptionEs: 'Nombre visible de la aplicación de admin',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'Hospeda Admin',
        exampleValue: 'Hospeda Admin',
        apps: ['admin'],
        category: 'client-admin',
        howToObtain:
            'Free text shown in browser tab title and admin sidebar header. Default: "Hospeda Admin".',
        howToObtainEs:
            'Texto libre que aparece en el título del tab del navegador y en el header del sidebar. Por defecto: "Hospeda Admin".'
    },
    {
        name: 'VITE_APP_VERSION',
        description: 'Application version string shown in the admin UI',
        descriptionEs: 'Versión de la aplicación que se muestra en la UI del admin',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: '1.0.0',
        apps: ['admin'],
        category: 'client-admin',
        howToObtain:
            'Free-text version shown in the admin footer. In CI/CD wire it to HOSPEDA_COMMIT_SHA so it tracks the deployed git SHA. Local: pick anything.',
        howToObtainEs:
            'Versión en texto libre que se muestra en el footer del admin. En CI/CD conectala a HOSPEDA_COMMIT_SHA así trackea el SHA del commit deployado. Local: cualquier cosa.'
    },
    {
        name: 'VITE_APP_DESCRIPTION',
        description: 'Short description of the admin application',
        descriptionEs: 'Descripción corta de la aplicación de admin',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'Admin panel for Hospeda platform',
        exampleValue: 'Admin panel for Hospeda platform',
        apps: ['admin'],
        category: 'client-admin',
        howToObtain: 'Free text used in <meta description>. Keep the default unless rebranding.',
        howToObtainEs:
            'Texto libre que va en <meta description>. Dejá el default salvo que rebrandees.'
    },
    {
        name: 'VITE_ENABLE_DEVTOOLS',
        description: 'Enable React DevTools integration in the admin app',
        descriptionEs: 'Activa la integración con React DevTools en el admin',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'false',
        apps: ['admin'],
        category: 'client-admin',
        howToObtain:
            'Set "true" only in local dev. Adds React DevTools profiling hooks. Keep false in preview/prod.',
        howToObtainEs:
            'Poné "true" solo en dev local. Agrega hooks de profiling de React DevTools. Dejalo en false en preview/prod.'
    },
    {
        name: 'VITE_ENABLE_QUERY_DEVTOOLS',
        description: 'Enable TanStack Query DevTools panel in the admin app',
        descriptionEs: 'Activa el panel de TanStack Query DevTools en el admin',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'false',
        apps: ['admin'],
        category: 'client-admin',
        howToObtain:
            'Set "true" only in local dev to see the floating Query inspector panel. Keep false everywhere else.',
        howToObtainEs:
            'Poné "true" solo en dev local para ver el panel flotante del inspector de Query. En el resto, dejalo en false.'
    },
    {
        name: 'VITE_ENABLE_ROUTER_DEVTOOLS',
        description: 'Enable TanStack Router DevTools panel in the admin app',
        descriptionEs: 'Activa el panel de TanStack Router DevTools en el admin',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'false',
        apps: ['admin'],
        category: 'client-admin',
        howToObtain:
            'Set "true" only in local dev to see the floating Router inspector. Keep false in preview/prod.',
        howToObtainEs:
            'Poné "true" solo en dev local para ver el inspector flotante del Router. Dejalo en false en preview/prod.'
    },
    {
        name: 'VITE_DEFAULT_PAGE_SIZE',
        description: 'Default number of rows per page in admin data tables',
        descriptionEs: 'Cantidad por defecto de filas por página en las tablas del admin',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '25',
        exampleValue: '25',
        apps: ['admin'],
        category: 'client-admin',
        howToObtain:
            'Initial page size for all admin tables. Default 25 — bump up for power users, down for low-bandwidth.',
        howToObtainEs:
            'Tamaño de página inicial para todas las tablas del admin. Por defecto 25; subilo para power users, bajalo para conexiones lentas.'
    },
    {
        name: 'VITE_MAX_PAGE_SIZE',
        description: 'Maximum number of rows per page allowed in admin data tables',
        descriptionEs: 'Cantidad máxima de filas por página permitida en las tablas del admin',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '100',
        exampleValue: '100',
        apps: ['admin'],
        category: 'client-admin',
        howToObtain:
            'Hard cap on user-selected page size. Default 100 — pages larger than this hit the API hard.',
        howToObtainEs:
            'Tope duro al tamaño de página que el usuario puede elegir. Por defecto 100; páginas más grandes pegan fuerte a la API.'
    },
    {
        name: 'VITE_SENTRY_DSN',
        description: 'Sentry DSN for error tracking in the admin dashboard',
        descriptionEs: 'DSN de Sentry para tracking de errores en el dashboard del admin',
        type: 'url',
        required: false,
        secret: false,
        exampleValue: 'https://abc123def456@o123456.ingest.sentry.io/7890123',
        apps: ['admin'],
        category: 'client-admin',
        helpUrl: 'https://docs.sentry.io/concepts/key-terms/dsn-explainer/',
        howToObtain:
            'Sentry → your admin project → Settings → Client Keys (DSN) → copy the DSN URL. NOTE: Sentry DSNs are write-only ingestion keys, intentionally public per Sentry design — they ship in the admin bundle and that is by design. Use a separate Sentry project from web/api so errors are scoped per surface. Leave blank to disable.',
        howToObtainEs:
            'Sentry → tu proyecto del admin → Settings → Client Keys (DSN) → copiá la URL. OJO: los DSN de Sentry son keys write-only de ingestión, intencionalmente públicas por diseño — viajan en el bundle del admin y eso es esperado. Usá un proyecto Sentry distinto al de web/api así los errores quedan separados por superficie. Dejala vacía para desactivar.'
    },
    {
        name: 'VITE_SENTRY_RELEASE',
        description: 'Sentry release identifier for the admin dashboard',
        descriptionEs: 'Identificador de release de Sentry para el dashboard del admin',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'abc123def456',
        apps: ['admin'],
        category: 'client-admin',
        howToObtain:
            'Free-text version per deploy. Recommended: wire it to HOSPEDA_COMMIT_SHA in CI/CD so each deploy is a unique release in Sentry ("abc123def456"). Avoid semver "1.0.0" — every preview/staging would collide.',
        howToObtainEs:
            'Versión en texto libre por deploy. Recomendado: conectala a HOSPEDA_COMMIT_SHA en CI/CD así cada deploy es un release único en Sentry ("abc123def456"). Evitá semver "1.0.0" — cada preview/staging tendría colisión.'
    },
    {
        name: 'VITE_SENTRY_PROJECT',
        description: 'Sentry project name for the admin dashboard',
        descriptionEs: 'Nombre del proyecto de Sentry para el dashboard del admin',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'hospeda-admin',
        apps: ['admin'],
        category: 'client-admin',
        howToObtain:
            'Project slug shown in your Sentry URL: sentry.io/organizations/<org>/projects/<this>/. Used by source-map upload tooling.',
        howToObtainEs:
            'El slug del proyecto que aparece en la URL de Sentry: sentry.io/organizations/<org>/projects/<este>/. Lo usa la herramienta de upload de source maps.'
    },
    {
        name: 'VITE_SENTRY_ENVIRONMENT',
        description:
            'Sentry environment tag for the admin dashboard (production | staging | development)',
        descriptionEs:
            'Tag de entorno en Sentry para el admin (production | staging | development) — separa eventos prod y staging cuando ambos corren con MODE=production.',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'staging',
        apps: ['admin'],
        category: 'client-admin',
        howToObtain:
            'Free-text label applied to all Sentry events from the admin. Set to `production` on hospeda-admin-prod and `staging` on hospeda-admin-staging. Takes precedence over import.meta.env.MODE in the Sentry init — without it, Vite production builds always tag events as `production` regardless of which deployment they came from, mixing staging and prod in the same Sentry environment bucket. NOTE: must be passed as a Docker build-arg too (the admin Dockerfile bakes VITE_* into the bundle at build time). Mirror of HOSPEDA_SENTRY_ENVIRONMENT (API).',
        howToObtainEs:
            'Etiqueta libre que se aplica a todos los eventos de Sentry del admin. Poné `production` en hospeda-admin-prod y `staging` en hospeda-admin-staging. Tiene precedencia sobre import.meta.env.MODE en el init de Sentry — sin esto, los builds de Vite en producción siempre etiquetan los eventos como `production` sin importar de qué deploy vinieron, mezclando staging y prod en el mismo bucket en Sentry. OJO: hay que pasarla también como build-arg de Docker (el Dockerfile del admin embebe los VITE_* en el bundle en build-time). Mirror de HOSPEDA_SENTRY_ENVIRONMENT (API).'
    },
    {
        name: 'VITE_DEBUG_LAZY_SECTIONS',
        description: 'Enable verbose logging for lazy-loaded section components',
        descriptionEs: 'Activa logs verbosos para componentes de sección con carga lazy',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'false',
        apps: ['admin'],
        category: 'client-admin',
        howToObtain:
            'Set "true" only when debugging code-split / lazy section loading. Adds noisy console logs. Keep false otherwise.',
        howToObtainEs:
            'Poné "true" solo cuando estés debuggeando code-split o carga lazy de secciones. Mete logs ruidosos en la consola. En el resto, dejalo en false.'
    },
    {
        name: 'VITE_DEBUG_ACTOR_ID',
        description: 'Hard-coded actor ID injected for local development and testing',
        descriptionEs: 'ID de actor hardcodeado que se inyecta en dev local y testing',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'dev-actor-uuid',
        apps: ['admin'],
        category: 'client-admin',
        howToObtain:
            'A real user UUID from your DB to impersonate while developing. Get it from db:studio → users table. Leave blank in preview/prod.',
        howToObtainEs:
            'Un UUID real de usuario de tu DB para impersonar mientras desarrollás. Sacalo de db:studio → tabla users. En preview/prod dejalo vacío.'
    },
    {
        name: 'VITE_ENABLE_LOGGING',
        description: 'Enable client-side console logging in the admin app',
        descriptionEs: 'Activa el logging del lado cliente en la consola en el admin',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'false',
        apps: ['admin'],
        category: 'client-admin',
        howToObtain:
            'Set "true" in dev to surface verbose admin client logs. Default false (silent in prod).',
        howToObtainEs:
            'Poné "true" en dev para ver logs verbosos del cliente del admin. Por defecto false (silencio en prod).'
    },
    {
        name: 'VITE_SUPPORTED_LOCALES',
        description: 'Comma-separated list of locale codes supported by the admin app',
        descriptionEs: 'Lista de locales soportados por el admin (separada por comas)',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'es,en',
        exampleValue: 'es,en',
        apps: ['admin'],
        category: 'client-admin',
        howToObtain:
            'Comma-separated locale codes the admin UI offers (e.g. "es,en,pt"). Must match what @repo/i18n actually has translations for.',
        howToObtainEs:
            'Códigos de locale separados por comas que ofrece la UI del admin (ej: "es,en,pt"). Tiene que coincidir con los locales que @repo/i18n realmente tiene traducidos.'
    },
    {
        name: 'VITE_DEFAULT_LOCALE',
        description: 'Default locale code used by the admin app',
        descriptionEs: 'Código de locale por defecto del admin',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'es',
        exampleValue: 'es',
        apps: ['admin'],
        category: 'client-admin',
        howToObtain:
            'Locale used when the user has no preference (e.g. "es" for Argentina). Must be one of VITE_SUPPORTED_LOCALES.',
        howToObtainEs:
            'Locale que se usa cuando el usuario no tiene preferencia (ej: "es" para Argentina). Tiene que ser uno de los de VITE_SUPPORTED_LOCALES.'
    },
    {
        name: 'VITE_LOG_LEVEL',
        description: 'Minimum log level for the admin client-side logger',
        descriptionEs: 'Nivel mínimo de log del logger del cliente del admin',
        type: 'enum',
        required: false,
        secret: false,
        defaultValue: 'INFO',
        exampleValue: 'DEBUG',
        enumValues: ['DEBUG', 'INFO', 'WARN', 'ERROR'] as const,
        apps: ['admin'],
        category: 'client-admin',
        howToObtain:
            'Pick: DEBUG (everything, very noisy), INFO (default), WARN (only warnings + errors), ERROR (only errors). Use DEBUG locally, INFO/WARN in prod.',
        howToObtainEs:
            'Elegí: DEBUG (todo, muy ruidoso), INFO (default), WARN (solo warnings + errores), ERROR (solo errores). Usá DEBUG en local, INFO/WARN en prod.'
    },
    {
        name: 'VITE_LOG_INCLUDE_TIMESTAMPS',
        description: 'Include ISO-8601 timestamps in admin client-side log output',
        descriptionEs: 'Incluye timestamps ISO-8601 en los logs del cliente del admin',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['admin'],
        category: 'client-admin',
        howToObtain: 'Default true — prefixes each log line with ISO timestamp.',
        howToObtainEs: 'Por defecto true; prefija cada línea de log con el timestamp ISO.'
    },
    {
        name: 'VITE_LOG_INCLUDE_LEVEL',
        description: 'Include severity level label in admin client-side log output',
        descriptionEs:
            'Incluye la etiqueta del nivel de severidad en los logs del cliente del admin',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['admin'],
        category: 'client-admin',
        howToObtain: 'Default true — prefixes each log line with [INFO] / [WARN] / [ERROR].',
        howToObtainEs: 'Por defecto true; prefija cada línea con [INFO] / [WARN] / [ERROR].'
    },
    {
        name: 'VITE_LOG_USE_COLORS',
        description: 'Colorise admin client-side log output (disable in CI/production)',
        descriptionEs: 'Colorea los logs del cliente del admin (desactivá en CI/producción)',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'false',
        apps: ['admin'],
        category: 'client-admin',
        howToObtain:
            'Default true — colored console output. Set false when piping logs to files/CI to avoid ANSI escape garbage.',
        howToObtainEs:
            'Por defecto true; salida coloreada en la consola. Poné false cuando mandás logs a archivos o CI para evitar caracteres de escape ANSI feos.'
    },
    {
        name: 'VITE_POSTHOG_KEY',
        description:
            'PostHog Cloud project API key for the admin app (`phc_...`). Client-exposed by design (ships in the browser bundle). Empty disables PostHog init.',
        descriptionEs:
            'API key del proyecto PostHog Cloud para la app admin (`phc_...`). Es client-exposed por diseño (viaja en el bundle del browser). Vacía desactiva el init de PostHog.',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 'phc_xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        apps: ['admin'],
        category: 'client-admin',
        helpUrl: 'https://us.posthog.com',
        howToObtain:
            'PostHog Cloud (https://us.posthog.com) → org `Hospeda` → project `hospeda-admin-prod` (or `hospeda-admin-staging` for staging) → Settings → Project → Project API Key → copy the value starting with `phc_`. Stored in 1Password under "Hospeda / PostHog project keys". Admin app uses Vite (TanStack Start) so the prefix is VITE_ instead of PUBLIC_.',
        howToObtainEs:
            'PostHog Cloud (https://us.posthog.com) → org `Hospeda` → proyecto `hospeda-admin-prod` (o `hospeda-admin-staging` para staging) → Settings → Project → Project API Key → copiá el valor que empieza con `phc_`. Guardada en 1Password bajo "Hospeda / PostHog project keys". La app admin usa Vite (TanStack Start), por eso el prefijo es VITE_ y no PUBLIC_.'
    },
    {
        name: 'VITE_POSTHOG_HOST',
        description:
            'PostHog ingestion endpoint for the admin app. Defaults to US Cloud region. Override for EU Cloud or self-hosted.',
        descriptionEs:
            'Endpoint de ingestión de PostHog para la app admin. Default región US Cloud. Override para EU Cloud o self-hosted.',
        type: 'url',
        required: false,
        secret: false,
        defaultValue: 'https://us.i.posthog.com',
        exampleValue: 'https://us.i.posthog.com',
        apps: ['admin'],
        category: 'client-admin',
        howToObtain:
            'Default `https://us.i.posthog.com` (matches Hospeda org in US Cloud, decided 2026-05-17). Change ONLY if migrating to EU Cloud (`https://eu.i.posthog.com`) or self-hosted PostHog. Admin app uses Vite (TanStack Start) so the prefix is VITE_ instead of PUBLIC_.',
        howToObtainEs:
            'Default `https://us.i.posthog.com` (matchea la org de Hospeda en US Cloud, decidido 2026-05-17). Cambialo SOLO si migrás a EU Cloud (`https://eu.i.posthog.com`) o a PostHog self-hosted. La app admin usa Vite (TanStack Start), por eso el prefijo es VITE_ y no PUBLIC_.'
    }
] as const satisfies readonly EnvVarDefinition[];
