/**
 * Mobile app (`apps/mobile`) environment variable definitions.
 *
 * Expo public vars (`EXPO_PUBLIC_*`) are baked into the JavaScript bundle at
 * build time by the Expo CLI and are readable in the React Native runtime via
 * `process.env.EXPO_PUBLIC_*`. None of these variables may contain secrets.
 *
 * @module env-registry.mobile
 */
import type { EnvVarDefinition } from './env-registry-types.js';

/**
 * All `EXPO_PUBLIC_*` environment variable definitions for the mobile app.
 *
 * @example
 * ```ts
 * import { MOBILE_ENV_VARS } from './env-registry.mobile.js';
 * const required = MOBILE_ENV_VARS.filter(v => v.requiredScope === 'production');
 * ```
 */
export const MOBILE_ENV_VARS = [
    // -------------------------------------------------------------------------
    // Core
    // -------------------------------------------------------------------------
    {
        name: 'EXPO_PUBLIC_API_URL',
        description:
            'Hospeda API base URL for the mobile app. Required in production builds — the app refuses to start if this is unset when EXPO_PUBLIC_APP_ENV=production, preventing a silent fallback to http://localhost:3001.',
        descriptionEs:
            'URL base de la API de Hospeda para la app móvil. Requerida en builds de producción — la app se niega a arrancar si está vacía cuando EXPO_PUBLIC_APP_ENV=production, evitando que caiga silenciosamente a http://localhost:3001.',
        type: 'url',
        required: false,
        requiredScope: 'production',
        secret: false,
        exampleValue: 'https://api.hospeda.com.ar',
        apps: ['mobile'],
        category: 'core',
        howToObtain:
            'Full URL of the Hospeda API (no trailing slash). Development: http://localhost:3001. Staging: https://staging-api.hospeda.com.ar. Production: https://api.hospeda.com.ar. Set in eas.json under env for each profile.',
        howToObtainEs:
            'URL completa de la API de Hospeda (sin trailing slash). Desarrollo: http://localhost:3001. Staging: https://staging-api.hospeda.com.ar. Producción: https://api.hospeda.com.ar. Seteala en eas.json bajo env para cada perfil.'
    },
    {
        name: 'EXPO_PUBLIC_APP_ENV',
        description:
            'Active app environment for the mobile app. Controls feature flags, API URL validation, and error reporting. Set to "production" in EAS production builds.',
        descriptionEs:
            'Entorno activo de la app móvil. Controla feature flags, validación de URL de la API y reporte de errores. Poné "production" en los builds de producción de EAS.',
        type: 'enum',
        required: false,
        secret: false,
        defaultValue: 'development',
        exampleValue: 'development',
        enumValues: ['development', 'staging', 'production'] as const,
        apps: ['mobile'],
        category: 'core',
        howToObtain:
            'Set in eas.json under env for each build profile: "development" for local dev, "staging" for the staging profile, "production" for the production profile. Defaults to "development" when absent.',
        howToObtainEs:
            'Setealo en eas.json bajo env para cada perfil de build: "development" para dev local, "staging" para el perfil de staging, "production" para el perfil de producción. Por defecto "development" si no está presente.'
    }
] as const satisfies readonly EnvVarDefinition[];
