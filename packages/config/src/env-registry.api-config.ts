/**
 * API-specific (`API_*`) environment variable definitions.
 *
 * These variables configure the Hono API server behaviour: server binding,
 * CORS, caching, compression, rate limiting, security headers, response
 * formatting, request validation, and metrics. All are optional with
 * production-safe defaults baked into `apps/api/src/utils/env.ts`.
 *
 * @module env-registry.api-config
 */
import type { EnvVarDefinition } from './env-registry-types.js';

/**
 * All `API_*` environment variable definitions grouped by middleware concern.
 *
 * @example
 * ```ts
 * import { API_CONFIG_ENV_VARS } from './env-registry.api-config.js';
 * const corsVars = API_CONFIG_ENV_VARS.filter(v => v.name.startsWith('API_CORS_'));
 * ```
 */
export const API_CONFIG_ENV_VARS = [
    // -------------------------------------------------------------------------
    // Server
    // -------------------------------------------------------------------------
    {
        name: 'API_PORT',
        description: 'Port the API server listens on',
        descriptionEs: 'Puerto en el que escucha el servidor de la API',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '3001',
        exampleValue: '3001',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'TCP port the API binds to. Default 3001. On Coolify the container exposes this port internally and Traefik proxies external traffic to it; pick a free port locally if 3001 is taken.',
        howToObtainEs:
            'Puerto TCP al que se bindea la API. Por defecto 3001. En Coolify el container expone este puerto internamente y Traefik proxea el tráfico externo a él; en local elegí un puerto libre si el 3001 está ocupado.'
    },
    {
        name: 'API_HOST',
        description: 'Hostname/interface the API server binds to',
        descriptionEs: 'Hostname/interfaz a la que se bindea el servidor de la API',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'localhost',
        exampleValue: '0.0.0.0',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default "localhost" for local dev. Use "0.0.0.0" inside Docker / Coolify so the container listens on every interface and the orchestrator can reach it.',
        howToObtainEs:
            'Por defecto "localhost" en dev local. Usá "0.0.0.0" dentro de Docker / Coolify así el container escucha en todas las interfaces y el orquestador lo puede alcanzar.'
    },
    // -------------------------------------------------------------------------
    // Logging
    // -------------------------------------------------------------------------
    {
        name: 'API_LOG_LEVEL',
        description: 'Minimum log level emitted by the API logger',
        descriptionEs: 'Nivel mínimo de log que emite el logger de la API',
        type: 'enum',
        required: false,
        secret: false,
        defaultValue: 'info',
        exampleValue: 'info',
        enumValues: ['debug', 'info', 'warn', 'error'] as const,
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Pick: debug (everything, very noisy), info (default), warn (only warnings + errors), error (only errors). Use debug locally, info/warn in prod.',
        howToObtainEs:
            'Elegí: debug (todo, muy ruidoso), info (default), warn (solo warnings + errores), error (solo errores). Usá debug en local, info/warn en prod.'
    },
    {
        name: 'API_ENABLE_REQUEST_LOGGING',
        description: 'Enable per-request access log entries',
        descriptionEs: 'Activa los logs de acceso por request',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'true = log every HTTP request (method, path, status, duration). false = silence access logs (errors still log). Default true.',
        howToObtainEs:
            'true = loguea cada request HTTP (method, path, status, duración). false = silencia los logs de acceso (los errores se siguen logueando). Por defecto true.'
    },
    {
        name: 'API_LOG_INCLUDE_TIMESTAMPS',
        description: 'Prepend ISO-8601 timestamp to each log line',
        descriptionEs: 'Prefija cada línea de log con un timestamp ISO-8601',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default true — adds an ISO-8601 timestamp prefix. Set false in environments that already prepend their own timestamp (some log aggregators) to avoid duplication.',
        howToObtainEs:
            'Por defecto true; agrega un prefijo ISO-8601 a cada línea. Ponelo en false en entornos que ya agregan su propio timestamp (algunos agregadores de logs) para evitar duplicar.'
    },
    {
        name: 'API_LOG_INCLUDE_LEVEL',
        description: 'Include severity level label in log output',
        descriptionEs: 'Incluye la etiqueta del nivel de severidad en los logs',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain: 'Default true — prefixes each line with [INFO]/[WARN]/[ERROR].',
        howToObtainEs: 'Por defecto true; prefija cada línea con [INFO]/[WARN]/[ERROR].'
    },
    {
        name: 'API_LOG_USE_COLORS',
        description: 'Colorise log output (disable in CI/production)',
        descriptionEs: 'Colorea los logs (desactivá en CI/producción)',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'false',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default true (colored, friendly for local dev terminals). Set false in CI / production log aggregators that capture stdout to files, otherwise the ANSI escape sequences end up rendered as literal noise.',
        howToObtainEs:
            'Por defecto true (con colores, cómodo para terminales de dev). Ponelo en false en CI / agregadores que capturan stdout a archivos, si no las secuencias ANSI quedan como ruido literal.'
    },
    {
        name: 'API_LOG_SAVE',
        description: 'Persist log output to a file on disk',
        descriptionEs: 'Persiste los logs a un archivo en disco',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'false',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default false (stdout only — Docker / Coolify will capture stdout and ship it to whatever log aggregator you wire up). Set true if you specifically need a local log file inside the container; remember the file goes away when the container is recreated.',
        howToObtainEs:
            'Por defecto false (solo stdout — Docker / Coolify capturan stdout y lo mandan al agregador que conectes). En true escribe los logs a un archivo local dentro del container; recordá que el archivo se pierde si recreás el container.'
    },
    {
        name: 'API_LOG_EXPAND_OBJECTS',
        description: 'Pretty-print nested objects in log output',
        descriptionEs: 'Imprime objetos anidados de forma legible en los logs',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'false',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default false (compact). Set true locally if you want logged objects shown across multiple readable lines instead of single-line JSON.',
        howToObtainEs:
            'Por defecto false (compacto). Ponelo en true en local si querés ver los objetos logueados en varias líneas legibles en vez de un JSON en una sola línea.'
    },
    {
        name: 'API_LOG_TRUNCATE_TEXT',
        description: 'Truncate long string values in log entries',
        descriptionEs: 'Trunca los strings largos en las entradas de log',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default true. Caps any individual string in a log line at API_LOG_TRUNCATE_AT chars to keep logs readable. Disable only when debugging full payloads.',
        howToObtainEs:
            'Por defecto true. Limita cualquier string en una línea de log a API_LOG_TRUNCATE_AT caracteres para que los logs queden legibles. Desactivalo solo cuando debugueás payloads completos.'
    },
    {
        name: 'API_LOG_TRUNCATE_AT',
        description: 'Character limit at which log strings are truncated',
        descriptionEs: 'Límite de caracteres a partir del cual se truncan los strings de log',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '1000',
        exampleValue: '1000',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Char limit per logged string. Default 1000. Lower (e.g. 200) for tight log budgets, higher (e.g. 5000) when debugging deep payloads.',
        howToObtainEs:
            'Límite de caracteres por string logueado. Por defecto 1000. Bajalo (ej: 200) si tu presupuesto de logs es ajustado, subilo (ej: 5000) cuando debugueás payloads profundos.'
    },
    {
        name: 'API_LOG_STRINGIFY',
        description: 'JSON-stringify objects in log output instead of pretty-printing',
        descriptionEs: 'Serializa los objetos como JSON en los logs en vez de imprimirlos legible',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'false',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default false. Set true if you ship logs to a JSON-aware aggregator (Datadog, Logtail) that parses each line as a JSON document.',
        howToObtainEs:
            'Por defecto false. Ponelo en true si mandás los logs a un agregador que parsea JSON (Datadog, Logtail) y espera cada línea como un documento JSON.'
    },
    {
        name: 'API_LOG_FORMAT',
        description: 'Logger output format: pretty (chalk-colored) or json (NDJSON)',
        descriptionEs: 'Formato de salida del logger: pretty (con colores) o json (NDJSON)',
        type: 'enum',
        required: false,
        secret: false,
        defaultValue: 'pretty',
        exampleValue: 'json',
        enumValues: ['pretty', 'json'] as const,
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default "pretty" (chalk-colored, emoji, human-readable terminal output). Set "json" to emit newline-delimited JSON (one structured object per line, no colors) for log aggregators or Coolify log search. Pretty is fine for local dev; json is recommended when shipping stdout to an aggregator that parses each line.',
        howToObtainEs:
            'Por defecto "pretty" (con colores, emoji, legible en terminal). Poné "json" para emitir JSON delimitado por saltos de línea (un objeto estructurado por línea, sin colores) para agregadores de logs o la búsqueda de logs de Coolify. Pretty va bien para dev local; json se recomienda cuando mandás stdout a un agregador que parsea cada línea.'
    },

    // -------------------------------------------------------------------------
    // CORS
    // -------------------------------------------------------------------------
    {
        name: 'API_CORS_ORIGINS',
        description: 'Comma-separated list of allowed CORS origins',
        descriptionEs: 'Lista de orígenes permitidos por CORS, separados por comas',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'http://localhost:3000,http://localhost:4321',
        exampleValue: 'http://localhost:3000,http://localhost:4321',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Comma-separated allowlist of origins (with protocol, no trailing slash). Local: include both admin (3000) and web (4321). Production: include your real https domains. Wrong origin = browser CORS error.',
        howToObtainEs:
            'Allowlist de orígenes separados por comas (con protocolo, sin slash final). Local: incluí admin (3000) y web (4321). Producción: poné tus dominios https reales. Si un origen está mal = error CORS en el navegador.'
    },
    {
        name: 'API_CORS_ALLOW_CREDENTIALS',
        description: 'Whether the CORS preflight includes credentials',
        descriptionEs: 'Si el preflight de CORS incluye credenciales',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default true (cookies/auth headers cross domains). Required for Better Auth session cookies. Almost never change.',
        howToObtainEs:
            'Por defecto true (las cookies/headers de auth pueden cruzar dominios). Necesario para las cookies de sesión de Better Auth. Casi nunca lo cambies.'
    },
    {
        name: 'API_CORS_MAX_AGE',
        description: 'CORS preflight cache duration in seconds',
        descriptionEs: 'Duración del cache de preflight de CORS en segundos',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '86400',
        exampleValue: '86400',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'How long browsers cache CORS preflight responses (sec). Default 86400 (24h). Higher = fewer OPTIONS calls.',
        howToObtainEs:
            'Cuánto tiempo los navegadores cachean las respuestas de preflight CORS (en seg). Por defecto 86400 (24h). Más alto = menos llamadas OPTIONS.'
    },
    {
        name: 'API_CORS_ALLOW_METHODS',
        description: 'Comma-separated list of allowed HTTP methods for CORS',
        descriptionEs: 'Lista de métodos HTTP permitidos por CORS, separados por comas',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
        exampleValue: 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'HTTP verbs the browser is allowed to use. Default covers all REST. Rarely change.',
        howToObtainEs:
            'Verbos HTTP que el navegador puede usar. El default cubre todo REST. Rara vez se cambia.'
    },
    {
        name: 'API_CORS_ALLOW_HEADERS',
        description: 'Comma-separated list of allowed request headers for CORS',
        descriptionEs: 'Lista de headers de request permitidos por CORS, separados por comas',
        type: 'string',
        required: false,
        secret: false,
        defaultValue:
            'Content-Type,Authorization,X-Requested-With,X-Forwarded-For,X-Real-IP,X-Request-ID',
        exampleValue:
            'Content-Type,Authorization,X-Requested-With,X-Forwarded-For,X-Real-IP,X-Request-ID',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Headers the browser may send. Default covers Content-Type/Authorization/X-Requested-With + the IP/request-id headers the API actually reads. Add more if you introduce new x-* request headers (e.g. x-actor-id for impersonation).',
        howToObtainEs:
            'Headers que el navegador puede mandar. El default cubre Content-Type/Authorization/X-Requested-With + los headers de IP/request-id que la API realmente lee. Agregá más si incorporás nuevos headers x-* en el request (ej: x-actor-id para impersonar).'
    },
    {
        name: 'API_CORS_EXPOSE_HEADERS',
        description: 'Comma-separated list of response headers exposed to browser CORS clients',
        descriptionEs:
            'Lista de headers de respuesta expuestos a los clientes CORS del navegador, separados por comas',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'Content-Length,X-Request-ID',
        exampleValue: 'Content-Length,X-Request-ID',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Response headers the browser JS is allowed to read. Add anything you set in responses that the front needs to inspect.',
        howToObtainEs:
            'Headers de respuesta que el JS del navegador puede leer. Agregá cualquier header que setees en respuestas y el front necesite inspeccionar.'
    },

    // -------------------------------------------------------------------------
    // Cache
    // -------------------------------------------------------------------------
    {
        name: 'API_CACHE_ENABLED',
        description: 'Enable HTTP cache-control header middleware',
        descriptionEs: 'Activa el middleware de headers de cache-control HTTP',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default true. Set false to bypass all Cache-Control headers (debugging cache issues). Almost always leave on in prod for performance.',
        howToObtainEs:
            'Por defecto true. Poné false para saltear todos los headers Cache-Control (para debuggear problemas de cache). Casi siempre dejalo en true en prod por performance.'
    },
    {
        name: 'API_CACHE_DEFAULT_MAX_AGE',
        description: 'Default Cache-Control max-age in seconds',
        descriptionEs: 'max-age default de Cache-Control en segundos',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '300',
        exampleValue: '300',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'How long browsers/CDN cache a response (sec). Default 300 (5 min). Lower for fresh data, higher for static-ish endpoints.',
        howToObtainEs:
            'Cuánto tiempo los navegadores/CDN cachean una respuesta (seg). Por defecto 300 (5 min). Bajalo para datos frescos, subilo para endpoints más estáticos.'
    },
    {
        name: 'API_CACHE_DEFAULT_STALE_WHILE_REVALIDATE',
        description: 'Default stale-while-revalidate window in seconds',
        descriptionEs: 'Ventana stale-while-revalidate por defecto en segundos',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '60',
        exampleValue: '60',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Window after max-age where stale responses can be served while a fresh one is fetched in the background (sec). Default 60.',
        howToObtainEs:
            'Ventana después del max-age donde se pueden servir respuestas stale mientras se busca una fresca en segundo plano (seg). Por defecto 60.'
    },
    {
        name: 'API_CACHE_DEFAULT_STALE_IF_ERROR',
        description: 'Default stale-if-error window in seconds',
        descriptionEs: 'Ventana stale-if-error por defecto en segundos',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '86400',
        exampleValue: '86400',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Window where browsers/CDN may serve stale cache if origin returns an error (sec). Default 86400 (24h) — keeps the site up during partial outages.',
        howToObtainEs:
            'Ventana donde los navegadores/CDN pueden servir cache stale si el origin devuelve error (seg). Por defecto 86400 (24h); mantiene el sitio arriba durante caídas parciales.'
    },
    {
        name: 'API_CACHE_ETAG_ENABLED',
        description: 'Enable ETag response headers',
        descriptionEs: 'Activa los headers ETag en las respuestas',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            "Default true. ETags let browsers do conditional GETs (304 Not Modified) when content hasn't changed. Saves bandwidth.",
        howToObtainEs:
            'Por defecto true. Los ETags permiten que los navegadores hagan GETs condicionales (304 Not Modified) cuando el contenido no cambió. Ahorra ancho de banda.'
    },
    {
        name: 'API_CACHE_LAST_MODIFIED_ENABLED',
        description: 'Enable Last-Modified response headers',
        descriptionEs: 'Activa los headers Last-Modified en las respuestas',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default true. Adds "Last-Modified" header so browsers can do If-Modified-Since conditional GETs. Complementary to ETag.',
        howToObtainEs:
            'Por defecto true. Agrega el header "Last-Modified" para que los navegadores puedan hacer GETs condicionales con If-Modified-Since. Complementario a ETag.'
    },

    // -------------------------------------------------------------------------
    // Compression
    // -------------------------------------------------------------------------
    {
        name: 'API_COMPRESSION_ENABLED',
        description: 'Enable response compression middleware',
        descriptionEs: 'Activa el middleware de compresión de respuestas',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default true. Compresses responses with gzip/deflate. Cloudflare and most reverse proxies will gzip again at the edge — leaving this true is fine (the edge usually short-circuits when the body is already compressed); set false only if you have proof of double-compression overhead.',
        howToObtainEs:
            'Por defecto true. Comprime respuestas con gzip/deflate. Cloudflare y la mayoría de los reverse proxies vuelven a hacer gzip en el edge — dejarlo true es seguro (el edge habitualmente saltea cuando el body ya viene comprimido); ponelo en false solo si tenés evidencia de overhead por doble compresión.'
    },
    {
        name: 'API_COMPRESSION_LEVEL',
        description: 'zlib compression level (1-9)',
        descriptionEs: 'Nivel de compresión zlib (1-9)',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '6',
        exampleValue: '6',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'gzip level 1 (fast, large) → 9 (slow, small). Default 6 = balanced. Rarely change.',
        howToObtainEs:
            'Nivel gzip 1 (rápido, grande) → 9 (lento, chico). Por defecto 6 = balanceado. Rara vez se cambia.'
    },
    {
        name: 'API_COMPRESSION_THRESHOLD',
        description: 'Minimum response size in bytes before compression is applied',
        descriptionEs: 'Tamaño mínimo de respuesta en bytes a partir del cual se comprime',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '1024',
        exampleValue: '1024',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Skip compression for responses smaller than this many bytes (gzip has overhead). Default 1024 (1KB). Rarely change.',
        howToObtainEs:
            'No comprime respuestas más chicas que esta cantidad de bytes (gzip tiene overhead). Por defecto 1024 (1KB). Rara vez se cambia.'
    },
    {
        name: 'API_COMPRESSION_ALGORITHMS',
        description: 'Comma-separated compression algorithms to offer (gzip, deflate)',
        descriptionEs: 'Algoritmos de compresión a ofrecer, separados por comas (gzip, deflate)',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'gzip,deflate',
        exampleValue: 'gzip,deflate',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Compression algorithms negotiated with the client. Default "gzip,deflate" covers ~100% of browsers. brotli not supported here yet.',
        howToObtainEs:
            'Algoritmos de compresión negociados con el cliente. El default "gzip,deflate" cubre ~100% de los navegadores. brotli todavía no está soportado acá.'
    },

    // -------------------------------------------------------------------------
    // Rate Limiting
    // -------------------------------------------------------------------------
    {
        name: 'API_RATE_LIMIT_ENABLED',
        description: 'Enable global rate limiting middleware',
        descriptionEs: 'Activa el middleware global de rate limiting',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default true. Global request throttle to protect against floods. Set false only in test environments.',
        howToObtainEs:
            'Por defecto true. Throttle global de requests para proteger contra floods. Poné false solo en entornos de testing.'
    },
    {
        name: 'API_RATE_LIMIT_WINDOW_MS',
        description: 'Global rate-limit sliding window duration in milliseconds',
        descriptionEs: 'Duración de la ventana sliding del rate-limit global, en milisegundos',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '900000',
        exampleValue: '900000',
        apps: ['api'],
        category: 'api-config',
        howToObtain: 'Window in ms over which requests are counted. Default 900000 (15 min).',
        howToObtainEs:
            'Ventana en ms sobre la que se cuentan los requests. Por defecto 900000 (15 min).'
    },
    {
        name: 'API_RATE_LIMIT_MAX_REQUESTS',
        description: 'Maximum requests allowed per window for the global limiter',
        descriptionEs: 'Máximo de requests permitidos por ventana en el limiter global',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '100',
        exampleValue: '100',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Max requests per window per IP/user. Default 100 over 15 min. Tune to your traffic profile.',
        howToObtainEs:
            'Máximo de requests por ventana por IP/usuario. Por defecto 100 cada 15 min. Ajustalo a tu perfil de tráfico.'
    },
    {
        name: 'API_RATE_LIMIT_KEY_GENERATOR',
        description: 'Strategy for generating the rate-limit key (ip, user)',
        descriptionEs: 'Estrategia para generar la key del rate-limit (ip, user)',
        type: 'enum',
        required: false,
        secret: false,
        defaultValue: 'ip',
        exampleValue: 'ip',
        enumValues: ['ip', 'user'] as const,
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'How requests are grouped: "ip" (per source IP) or "user" (per authenticated user). Default "ip".',
        howToObtainEs:
            'Cómo se agrupan los requests: "ip" (por IP de origen) o "user" (por usuario autenticado). Por defecto "ip".'
    },
    {
        name: 'API_RATE_LIMIT_SKIP',
        description:
            'Which response classes to exclude from rate-limit counting (none, successful, failed)',
        descriptionEs:
            'Qué clases de respuesta excluir del conteo del rate-limit (none, successful, failed)',
        type: 'enum',
        required: false,
        secret: false,
        defaultValue: 'none',
        exampleValue: 'none',
        enumValues: ['none', 'successful', 'failed'] as const,
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default "none" (everything counts). Use "successful" to skip 2xx responses (throttle only on errors), or "failed" to skip 4xx/5xx (lenient with buggy clients; rarely a good idea).',
        howToObtainEs:
            'Por defecto "none" (todo cuenta). Usá "successful" para no contar respuestas 2xx (throttle sólo sobre errores), o "failed" para no contar 4xx/5xx (benévolo con clientes buggy; rara vez es buena idea).'
    },
    {
        name: 'API_RATE_LIMIT_HEADERS',
        description:
            'Rate-limit response header style: standard (IETF), legacy (X-*), both, or none',
        descriptionEs:
            'Estilo de headers de rate-limit: standard (IETF), legacy (X-*), both o none',
        type: 'enum',
        required: false,
        secret: false,
        defaultValue: 'standard',
        exampleValue: 'standard',
        enumValues: ['standard', 'legacy', 'both', 'none'] as const,
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default "standard" (IETF RateLimit-Limit/Remaining/Reset). Use "legacy" for X-RateLimit-* (pre-IETF), "both" if a mixed client base needs them, or "none" to suppress rate-limit headers entirely.',
        howToObtainEs:
            'Por defecto "standard" (IETF RateLimit-Limit/Remaining/Reset). Usá "legacy" para X-RateLimit-* (pre-IETF), "both" si tenés clientes mezclados, o "none" para suprimir los headers de rate-limit.'
    },
    {
        name: 'API_RATE_LIMIT_MESSAGE',
        description: 'Error message returned when the global rate limit is exceeded',
        descriptionEs: 'Mensaje de error devuelto cuando se excede el rate limit global',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'Too many requests, please try again later.',
        exampleValue: 'Too many requests, please try again later.',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Free text returned in the 429 response body. Customise to match your tone or include a support contact.',
        howToObtainEs:
            'Texto libre devuelto en el body de la respuesta 429. Personalizalo para que matchee tu tono o incluí un contacto de soporte.'
    },
    {
        name: 'API_RATE_LIMIT_TRUST_PROXY',
        description: 'Trust X-Forwarded-For and similar headers for real-IP extraction',
        descriptionEs: 'Confía en X-Forwarded-For y headers similares para extraer la IP real',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default true (matches the deploy target — Cloudflare/Nginx/Coolify Traefik all set X-Forwarded-For). With true the rate-limiter sees the real client IP. Set to false ONLY for direct-exposed local dev runs without a proxy in front.',
        howToObtainEs:
            'Por defecto true (matchea el target de deploy — Cloudflare/Nginx/Coolify Traefik todos setean X-Forwarded-For). Con true el rate-limiter ve la IP real del cliente. Ponelo en false SOLO para runs de dev local expuestos directamente sin proxy adelante.'
    },
    {
        name: 'API_RATE_LIMIT_TRUSTED_PROXIES',
        description: 'Comma-separated list of trusted proxy IPs or CIDRs',
        descriptionEs: 'Lista de IPs o CIDRs de proxies confiables, separadas por comas',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: '',
        exampleValue: '10.0.0.0/8,172.16.0.0/12',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Comma-separated list of proxy IPs/CIDRs whose X-Forwarded-For headers are trusted. Empty means "trust the immediate proxy". Leave blank when running behind Cloudflare + Coolify Traefik (the default deploy stack); only fill it in if you have a custom multi-hop proxy chain you specifically need to allowlist.',
        howToObtainEs:
            'Lista separada por comas de IPs/CIDRs de proxies cuyos X-Forwarded-For son confiables. Vacío = "confiá en el proxy inmediato". Dejalo vacío si corrés detrás de Cloudflare + Coolify Traefik (el stack default del deploy); completalo solo si tenés una cadena de proxies custom multi-hop que necesitás allowlistear.'
    },
    {
        name: 'API_RATE_LIMIT_AUTH_ENABLED',
        description: 'Enable dedicated rate limiter for auth endpoints',
        descriptionEs: 'Activa el rate limiter dedicado para endpoints de auth',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default true. Tighter limits on /auth/* to slow brute-force attacks. Almost never disable in prod.',
        howToObtainEs:
            'Por defecto true. Límites más estrictos en /auth/* para frenar ataques de brute-force. Casi nunca lo desactives en prod.'
    },
    {
        name: 'API_RATE_LIMIT_AUTH_WINDOW_MS',
        description: 'Auth rate-limit window duration in milliseconds',
        descriptionEs: 'Duración de la ventana de rate-limit de auth, en milisegundos',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '300000',
        exampleValue: '300000',
        apps: ['api'],
        category: 'api-config',
        howToObtain: 'Window in ms for auth endpoint counter. Default 300000 (5 min).',
        howToObtainEs:
            'Ventana en ms para el contador del endpoint de auth. Por defecto 300000 (5 min).'
    },
    {
        name: 'API_RATE_LIMIT_AUTH_MAX_REQUESTS',
        description: 'Maximum requests allowed per window for the auth limiter',
        descriptionEs: 'Máximo de requests por ventana en el limiter de auth',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '50',
        exampleValue: '50',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Max auth requests per IP per window. Default 50 over 5 min — tuned to allow legit users while blocking brute force.',
        howToObtainEs:
            'Máximo de requests de auth por IP por ventana. Por defecto 50 cada 5 min; ajustado para dejar pasar usuarios legítimos pero frenar brute force.'
    },
    {
        name: 'API_RATE_LIMIT_AUTH_MESSAGE',
        description: 'Error message returned when the auth rate limit is exceeded',
        descriptionEs: 'Mensaje de error devuelto cuando se excede el rate limit de auth',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'Too many authentication requests, please try again later.',
        exampleValue: 'Too many authentication requests, please try again later.',
        apps: ['api'],
        category: 'api-config',
        howToObtain: 'Free text returned when auth limiter trips. Customise to your tone.',
        howToObtainEs:
            'Texto libre que se devuelve cuando salta el limiter de auth. Personalizalo a tu tono.'
    },
    {
        name: 'API_RATE_LIMIT_PUBLIC_ENABLED',
        description: 'Enable dedicated rate limiter for public API endpoints',
        descriptionEs: 'Activa el rate limiter dedicado para endpoints de API pública',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default true. Per-IP throttle for /api/v1/public/* — protects against scrapers.',
        howToObtainEs:
            'Por defecto true. Throttle por-IP para /api/v1/public/*; protege contra scrapers.'
    },
    {
        name: 'API_RATE_LIMIT_PUBLIC_WINDOW_MS',
        description: 'Public API rate-limit window duration in milliseconds',
        descriptionEs: 'Duración de la ventana de rate-limit de la API pública, en ms',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '3600000',
        exampleValue: '3600000',
        apps: ['api'],
        category: 'api-config',
        howToObtain: 'Window for the public-API counter (ms). Default 3600000 (1 hour).',
        howToObtainEs: 'Ventana del contador de la API pública (ms). Por defecto 3600000 (1 hora).'
    },
    {
        name: 'API_RATE_LIMIT_PUBLIC_MAX_REQUESTS',
        description: 'Maximum requests allowed per window for the public API limiter',
        descriptionEs: 'Máximo de requests por ventana en el limiter de la API pública',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '1000',
        exampleValue: '1000',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Max public-API requests per IP per hour. Default 1000 — generous for SSR but stops aggressive scrapers.',
        howToObtainEs:
            'Máximo de requests de API pública por IP por hora. Por defecto 1000; generoso para SSR pero corta scrapers agresivos.'
    },
    {
        name: 'API_RATE_LIMIT_PUBLIC_MESSAGE',
        description: 'Error message returned when the public API rate limit is exceeded',
        descriptionEs: 'Mensaje de error cuando se excede el rate limit de la API pública',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'Too many API requests, please try again later.',
        exampleValue: 'Too many API requests, please try again later.',
        apps: ['api'],
        category: 'api-config',
        howToObtain: 'Free text returned when public-API limiter trips.',
        howToObtainEs: 'Texto libre que se devuelve cuando salta el limiter de la API pública.'
    },
    {
        name: 'API_RATE_LIMIT_ADMIN_ENABLED',
        description: 'Enable dedicated rate limiter for admin endpoints',
        descriptionEs: 'Activa el rate limiter dedicado para endpoints de admin',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default true. Per-user throttle on /api/v1/admin/* — protects against compromised admin credentials.',
        howToObtainEs:
            'Por defecto true. Throttle por-usuario en /api/v1/admin/*; protege contra credenciales de admin comprometidas.'
    },
    {
        name: 'API_RATE_LIMIT_ADMIN_WINDOW_MS',
        description: 'Admin rate-limit window duration in milliseconds',
        descriptionEs: 'Duración de la ventana de rate-limit de admin, en ms',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '600000',
        exampleValue: '600000',
        apps: ['api'],
        category: 'api-config',
        howToObtain: 'Window for the admin counter (ms). Default 600000 (10 min).',
        howToObtainEs: 'Ventana del contador de admin (ms). Por defecto 600000 (10 min).'
    },
    {
        name: 'API_RATE_LIMIT_ADMIN_MAX_REQUESTS',
        description: 'Maximum requests allowed per window for the admin limiter',
        descriptionEs: 'Máximo de requests por ventana en el limiter de admin',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '200',
        exampleValue: '200',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Max admin requests per user per window. Default 200/10min. Bump up if heavy admins hit limits.',
        howToObtainEs:
            'Máximo de requests de admin por usuario por ventana. Por defecto 200/10min. Subilo si los admins heavy chocan con el límite.'
    },
    {
        name: 'API_RATE_LIMIT_ADMIN_MESSAGE',
        description: 'Error message returned when the admin rate limit is exceeded',
        descriptionEs: 'Mensaje de error cuando se excede el rate limit de admin',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'Too many admin requests, please try again later.',
        exampleValue: 'Too many admin requests, please try again later.',
        apps: ['api'],
        category: 'api-config',
        howToObtain: 'Free text returned when the admin limiter trips.',
        howToObtainEs: 'Texto libre que se devuelve cuando salta el limiter de admin.'
    },

    // -------------------------------------------------------------------------
    // Security Headers
    // -------------------------------------------------------------------------
    {
        name: 'API_SECURITY_ENABLED',
        description: 'Enable the security-headers middleware',
        descriptionEs: 'Activa el middleware de security-headers',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default true. Master kill-switch for ALL security middleware (CSRF, security headers). NEVER disable in prod.',
        howToObtainEs:
            'Por defecto true. Kill-switch master para TODO el middleware de seguridad (CSRF, security headers). NUNCA lo desactives en prod.'
    },
    {
        name: 'API_SECURITY_CSRF_ENABLED',
        description: 'Enable CSRF origin verification',
        descriptionEs: 'Activa la verificación de origin para CSRF',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            "Default true. Rejects POST/PUT/DELETE requests whose Origin header isn't in the allowlist. Critical for cookie-based auth.",
        howToObtainEs:
            'Por defecto true. Rechaza requests POST/PUT/DELETE cuyo header Origin no esté en la allowlist. Crítico para auth basada en cookies.'
    },
    {
        name: 'API_SECURITY_HEADERS_ENABLED',
        description: 'Inject OWASP-recommended security response headers',
        descriptionEs: 'Inyecta los headers de seguridad recomendados por OWASP',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default true. Adds CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc. NEVER disable in prod.',
        howToObtainEs:
            'Por defecto true. Agrega CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc. NUNCA lo desactives en prod.'
    },
    {
        name: 'API_SECURITY_CONTENT_SECURITY_POLICY',
        description: 'Value of the Content-Security-Policy response header',
        descriptionEs: 'Valor del header de respuesta Content-Security-Policy',
        type: 'string',
        required: false,
        secret: false,
        defaultValue:
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
        exampleValue: "default-src 'self';",
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Full CSP directive string. Defaults are sane for the API. Tighten or loosen at your own risk — wrong CSP breaks your site silently.',
        howToObtainEs:
            'String completo de directivas CSP. Los defaults son sanos para la API. Apretalo o aflojalo bajo tu responsabilidad; un CSP mal armado rompe tu sitio en silencio.'
    },
    {
        name: 'API_SECURITY_STRICT_TRANSPORT_SECURITY',
        description: 'Value of the Strict-Transport-Security response header',
        descriptionEs: 'Valor del header de respuesta Strict-Transport-Security',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'max-age=31536000; includeSubDomains',
        exampleValue: 'max-age=31536000; includeSubDomains',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'HSTS directive forcing HTTPS. Default 1 year. Add "; preload" only after submitting your domain to hstspreload.org.',
        howToObtainEs:
            'Directiva HSTS que fuerza HTTPS. Por defecto 1 año. Agregá "; preload" SOLO después de mandar tu dominio a hstspreload.org.'
    },
    {
        name: 'API_SECURITY_X_FRAME_OPTIONS',
        description: 'Value of the X-Frame-Options response header',
        descriptionEs: 'Valor del header de respuesta X-Frame-Options',
        type: 'enum',
        required: false,
        secret: false,
        defaultValue: 'SAMEORIGIN',
        exampleValue: 'SAMEORIGIN',
        enumValues: ['DENY', 'SAMEORIGIN'] as const,
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Anti-clickjacking. Use "DENY" (block all framing), "SAMEORIGIN" (default — allow only your own pages to frame the API).',
        howToObtainEs:
            'Anti-clickjacking. Usá "DENY" (bloquea todo framing), "SAMEORIGIN" (default; solo tus páginas pueden enmarcar la API).'
    },
    {
        name: 'API_SECURITY_REFERRER_POLICY',
        description: 'Value of the Referrer-Policy response header',
        descriptionEs: 'Valor del header de respuesta Referrer-Policy',
        type: 'enum',
        required: false,
        secret: false,
        defaultValue: 'strict-origin-when-cross-origin',
        exampleValue: 'strict-origin-when-cross-origin',
        enumValues: [
            'no-referrer',
            'no-referrer-when-downgrade',
            'origin',
            'origin-when-cross-origin',
            'same-origin',
            'strict-origin',
            'strict-origin-when-cross-origin',
            'unsafe-url'
        ] as const,
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'How much referrer info to leak. Default "strict-origin-when-cross-origin" — sane balance. Tighter: "no-referrer".',
        howToObtainEs:
            'Cuánta info de referrer filtrar. Por defecto "strict-origin-when-cross-origin"; balance sano. Más estricto: "no-referrer".'
    },
    {
        name: 'API_SECURITY_PERMISSIONS_POLICY',
        description: 'Value of the Permissions-Policy response header',
        descriptionEs: 'Valor del header de respuesta Permissions-Policy',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'camera=(), microphone=(), geolocation=()',
        exampleValue: 'camera=(), microphone=(), geolocation=()',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            "Disables browser features your API doesn't use. Default disables camera/mic/geolocation. Add more (payment, usb, etc.) for paranoid setups.",
        howToObtainEs:
            'Desactiva features del navegador que tu API no usa. El default desactiva cámara/mic/geolocalización. Agregá más (payment, usb, etc.) en setups paranoides.'
    },

    // -------------------------------------------------------------------------
    // Response Formatting
    // -------------------------------------------------------------------------
    {
        name: 'API_RESPONSE_FORMAT_ENABLED',
        description: 'Wrap all responses in a standard envelope shape',
        descriptionEs: 'Envuelve todas las respuestas en una forma estándar (envelope)',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default true. Wraps every response as { success, data, message, ... }. NEVER disable — clients expect this shape.',
        howToObtainEs:
            'Por defecto true. Envuelve cada respuesta como { success, data, message, ... }. NUNCA lo desactives; los clientes esperan esta forma.'
    },
    {
        name: 'API_RESPONSE_INCLUDE_TIMESTAMP',
        description: 'Include ISO-8601 timestamp in every response envelope',
        descriptionEs: 'Incluye timestamp ISO-8601 en cada envelope de respuesta',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default true. Adds "timestamp" field to every response. Useful for client-side debugging.',
        howToObtainEs:
            'Por defecto true. Agrega un campo "timestamp" a cada respuesta. Útil para debugging del lado cliente.'
    },
    {
        name: 'API_RESPONSE_API_VERSION',
        description:
            'API version string injected into every response envelope (empty string disables version inclusion)',
        descriptionEs:
            'Versión de la API que se inyecta en cada envelope de respuesta (string vacío desactiva la inclusión)',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: '1.0.0',
        exampleValue: '1.0.0',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Free-text version label. Default "1.0.0" (included in every response and as X-API-Version header). Set to empty string to omit the version field and header entirely. Bump manually for breaking changes.',
        howToObtainEs:
            'Etiqueta de versión en texto libre. Por defecto "1.0.0" (se incluye en cada respuesta y como header X-API-Version). Dejalo vacío para omitir el campo y el header. Subila a mano cuando hay breaking changes.'
    },
    {
        name: 'API_RESPONSE_INCLUDE_REQUEST_ID',
        description: 'Include X-Request-ID in every response envelope',
        descriptionEs: 'Incluye X-Request-ID en cada envelope de respuesta',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default true. Echoes the per-request UUID so users can quote it in support tickets.',
        howToObtainEs:
            'Por defecto true. Hace eco del UUID por-request así los usuarios lo pueden citar en tickets de soporte.'
    },
    {
        name: 'API_RESPONSE_INCLUDE_METADATA',
        description: 'Include extended metadata in every response envelope',
        descriptionEs: 'Incluye metadata extendida en cada envelope de respuesta',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default true. Includes a "metadata" block with extra context (pagination info, etc.). Disable for minimal payloads.',
        howToObtainEs:
            'Por defecto true. Incluye un bloque "metadata" con contexto extra (info de paginación, etc.). Desactivalo para payloads mínimos.'
    },
    {
        name: 'API_RESPONSE_SUCCESS_MESSAGE',
        description: 'Default success message used in response envelopes',
        descriptionEs: 'Mensaje de éxito por defecto usado en los envelopes de respuesta',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'Success',
        exampleValue: 'Success',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Free text used as default "message" field on 2xx responses when no specific message is provided.',
        howToObtainEs:
            'Texto libre usado como campo "message" por defecto en respuestas 2xx cuando no se provee uno específico.'
    },
    {
        name: 'API_RESPONSE_ERROR_MESSAGE',
        description: 'Default error message used in response envelopes',
        descriptionEs: 'Mensaje de error por defecto usado en los envelopes de respuesta',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'An error occurred',
        exampleValue: 'An error occurred',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Free text used as fallback when an error has no specific message. Keep generic in prod (no info leak).',
        howToObtainEs:
            'Texto libre usado como fallback cuando un error no tiene mensaje específico. Dejalo genérico en prod (no leakees info).'
    },

    // -------------------------------------------------------------------------
    // Request Validation
    // -------------------------------------------------------------------------
    {
        name: 'API_VALIDATION_MAX_BODY_SIZE',
        description: 'Maximum allowed request body size in bytes',
        descriptionEs: 'Tamaño máximo permitido del body del request, en bytes',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '10485760',
        exampleValue: '10485760',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Max request body in bytes. Default 10485760 (10MB). Lower it if your reverse proxy or upstream service has a tighter cap (e.g. Cloudflare Free tier maxes uploads around 100MB but tighten if your storage plan is smaller).',
        howToObtainEs:
            'Body máximo del request en bytes. Por defecto 10485760 (10MB). Bajalo si tu reverse proxy o un servicio upstream tienen un tope más bajo (Cloudflare Free permite uploads hasta ~100MB, pero ajustalo si tu plan de almacenamiento es menor).'
    },
    {
        name: 'API_VALIDATION_MAX_REQUEST_TIME',
        description: 'Maximum time in milliseconds allowed for a request to complete',
        descriptionEs: 'Tiempo máximo en milisegundos permitido para completar un request',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '30000',
        exampleValue: '30000',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Max request duration in ms. Default 30000 (30s). Keep this below any upstream proxy/load-balancer timeout (Cloudflare default is 100s) so the API fails fast and predictably instead of being killed mid-request.',
        howToObtainEs:
            'Duración máxima del request en ms. Por defecto 30000 (30s). Mantenelo por debajo del timeout del proxy/load balancer upstream (el default de Cloudflare es 100s) así la API falla rápido y predecible en vez de ser matada a mitad del request.'
    },
    {
        name: 'API_VALIDATION_ALLOWED_CONTENT_TYPES',
        description: 'Comma-separated list of accepted Content-Type values',
        descriptionEs: 'Lista de Content-Type aceptados, separados por comas',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'application/json,multipart/form-data',
        exampleValue: 'application/json,multipart/form-data',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Allowlist of request content-types. Default covers JSON + file uploads. Add "application/x-www-form-urlencoded" if you accept old form posts.',
        howToObtainEs:
            'Allowlist de content-types de request. El default cubre JSON + uploads de archivos. Agregá "application/x-www-form-urlencoded" si aceptás form posts viejos.'
    },
    {
        name: 'API_VALIDATION_REQUIRED_HEADERS',
        description: 'Comma-separated list of headers that must be present on every request',
        descriptionEs:
            'Lista de headers que deben estar presentes en cada request, separados por comas',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'user-agent',
        exampleValue: 'user-agent',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Headers required on every request. Default "user-agent" (rejects most basic bots). Add more for stricter validation.',
        howToObtainEs:
            'Headers requeridos en cada request. Por defecto "user-agent" (rechaza la mayoría de los bots básicos). Agregá más para validación más estricta.'
    },
    {
        name: 'API_VALIDATION_AUTH_ENABLED',
        description: 'Enable auth-header presence check in the validation middleware',
        descriptionEs:
            'Activa el check de presencia de header de auth en el middleware de validación',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default true. Verifies that protected endpoints have at least one of API_VALIDATION_AUTH_HEADERS present.',
        howToObtainEs:
            'Por defecto true. Verifica que los endpoints protegidos tengan al menos uno de los API_VALIDATION_AUTH_HEADERS presentes.'
    },
    {
        name: 'API_VALIDATION_AUTH_HEADERS',
        description: 'Comma-separated list of headers that carry auth credentials',
        descriptionEs: 'Lista de headers que llevan credenciales de auth, separados por comas',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'authorization',
        exampleValue: 'authorization',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Header(s) where auth tokens live. Default "authorization" (Bearer ...). Add custom headers if you carry tokens elsewhere.',
        howToObtainEs:
            'Header(s) donde van los tokens de auth. Por defecto "authorization" (Bearer ...). Agregá headers custom si llevás tokens en otro lado.'
    },
    {
        name: 'API_VALIDATION_SANITIZE_ENABLED',
        description: 'Enable request body string sanitisation',
        descriptionEs: 'Activa la sanitización de strings en el body del request',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default true. Strips/escapes dangerous content from string inputs. Critical XSS defense — almost never disable.',
        howToObtainEs:
            'Por defecto true. Limpia/escapa contenido peligroso de los inputs de string. Defensa crítica contra XSS; casi nunca lo desactives.'
    },
    {
        name: 'API_VALIDATION_SANITIZE_MAX_STRING_LENGTH',
        description: 'Maximum allowed length for individual string values in request bodies',
        descriptionEs: 'Largo máximo permitido para valores string individuales en el body',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '1000',
        exampleValue: '1000',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Max chars per string field in request body. Default 1000. Bump for free-text fields (descriptions can be long), keep low for short fields.',
        howToObtainEs:
            'Máximo de caracteres por campo string en el body del request. Por defecto 1000. Subilo para campos de texto libre (las descripciones pueden ser largas), bajalo para campos cortos.'
    },
    {
        name: 'API_VALIDATION_SANITIZE_REMOVE_HTML_TAGS',
        description: 'Strip HTML tags from string values during sanitisation',
        descriptionEs: 'Quita los tags HTML de los valores string durante la sanitización',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default true. Removes <tags> from string inputs. Disable only for endpoints that legitimately accept HTML (then sanitise per-field).',
        howToObtainEs:
            'Por defecto true. Saca los <tags> de los inputs string. Desactivalo solo en endpoints que legítimamente aceptan HTML (y entonces sanitizá por campo).'
    },
    {
        name: 'API_VALIDATION_SANITIZE_ALLOWED_CHARS',
        description:
            'Regex character class defining allowed characters during sanitisation. Default explicitly includes Spanish/Portuguese/common Latin diacritics so place names like "Concepción del Uruguay" or "São Paulo" are NOT stripped.',
        descriptionEs:
            'Clase de caracteres regex que define qué caracteres se permiten durante la sanitización. El default incluye explícitamente diacríticos del español/portugués/latinos comunes para que topónimos como "Concepción del Uruguay" o "São Paulo" NO se filtren.',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: '[\\w\\sáéíóúüñÁÉÍÓÚÜÑàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛçÇãõÃÕ\\-.,!?@#$%&*()+=]',
        exampleValue: '[\\w\\sáéíóúüñÁÉÍÓÚÜÑàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛçÇãõÃÕ\\-.,!?@#$%&*()+=]',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Regex character class — characters NOT matching are stripped. Default already covers letters/digits/whitespace + common punctuation + Spanish (á é í ó ú ü ñ + uppercase) + Portuguese (ã õ ç + uppercase) + common Latin diacritics (à è ì ò ù â ê î ô û + uppercase). Tighten only if you have a strict-ASCII-only field (then sanitise per-field, not globally).',
        howToObtainEs:
            'Clase de caracteres regex; los que NO matchean se filtran. El default ya cubre letras/dígitos/espacios + puntuación común + español (á é í ó ú ü ñ + mayúsculas) + portugués (ã õ ç + mayúsculas) + diacríticos latinos comunes (à è ì ò ù â ê î ô û + mayúsculas). Acotalo solo si tenés un campo estricto-ASCII (y entonces sanitizá por campo, no global).'
    },

    // -------------------------------------------------------------------------
    // Metrics
    // -------------------------------------------------------------------------
    {
        name: 'API_METRICS_ENABLED',
        description: 'Enable the metrics collection middleware',
        descriptionEs: 'Activa el middleware de recolección de métricas',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Default true. Records per-endpoint timings and slow-request warnings. Low overhead.',
        howToObtainEs:
            'Por defecto true. Registra tiempos por endpoint y warnings de requests lentos. Bajo overhead.'
    },
    {
        name: 'API_METRICS_SLOW_REQUEST_THRESHOLD_MS',
        description: 'Duration threshold in milliseconds above which a request is flagged as slow',
        descriptionEs: 'Umbral en ms a partir del cual se marca un request como lento',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '1000',
        exampleValue: '1000',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Requests slower than this (ms) get a [SLOW] log entry. Default 1000 (1s). Lower (e.g. 500) for tighter SLOs.',
        howToObtainEs:
            'Los requests más lentos que este valor (ms) reciben una entrada [SLOW] en los logs. Por defecto 1000 (1s). Bajalo (ej: 500) para SLOs más estrictos.'
    },
    {
        name: 'API_METRICS_SLOW_AUTH_THRESHOLD_MS',
        description:
            'Duration threshold in milliseconds above which an auth check is flagged as slow',
        descriptionEs: 'Umbral en ms a partir del cual se marca un check de auth como lento',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '2000',
        exampleValue: '2000',
        apps: ['api'],
        category: 'api-config',
        howToObtain:
            'Auth checks slower than this (ms) get a [SLOW AUTH] warning. Default 2000 (2s). Useful for spotting DB/Better Auth slowness.',
        howToObtainEs:
            'Los checks de auth más lentos que este valor (ms) reciben un warning [SLOW AUTH]. Por defecto 2000 (2s). Útil para detectar lentitud de DB / Better Auth.'
    }
] as const satisfies readonly EnvVarDefinition[];
