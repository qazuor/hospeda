/**
 * @file env.ts
 * @description Centralized environment resolution + validation for the mobile app.
 *
 * Single source of truth for reading Expo env vars. Both `auth-client.ts` and
 * `api/client.ts` import {@link API_BASE_URL} from here instead of re-deriving it,
 * so the auth client and the data client always target the same server.
 *
 * Resolution order (mirrors the previous duplicated logic):
 *   1. `Constants.expoConfig.extra.apiUrl` (injected by eas.json build env)
 *   2. `process.env.EXPO_PUBLIC_API_URL` (Expo CLI env vars)
 *   3. Fallback `http://localhost:3001` — DEV/STAGING ONLY.
 *
 * In PRODUCTION the API URL must be explicitly configured: falling back to
 * localhost would silently ship a non-functional production build. {@link validateEnv}
 * enforces this at startup (called from `app/_layout.tsx`). Validation is bypassed
 * under `NODE_ENV=test` so unit tests (which mock `expo-constants`) keep working.
 *
 * @module env
 */
import Constants from 'expo-constants';
import { z } from 'zod';

/** Supported app environments, injected via `EXPO_PUBLIC_APP_ENV` (eas.json). */
export type AppEnv = 'development' | 'staging' | 'production';

/**
 * Shape of the mobile env. Both vars are optional at the schema level; the
 * production requirement is enforced as a cross-field check in {@link validateEnv}.
 */
const EnvSchema = z.object({
    EXPO_PUBLIC_API_URL: z.string().url().optional(),
    EXPO_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']).optional()
});

/** Local dev server, used only when no explicit API URL is configured. */
const FALLBACK_API_URL = 'http://localhost:3001';

/** Resolves the configured API URL (without fallback). Returns undefined when unset. */
const resolveRawApiUrl = (): string | undefined => {
    const fromConstants = (Constants.expoConfig?.extra as Record<string, string> | undefined)
        ?.apiUrl;
    const fromEnv = process.env.EXPO_PUBLIC_API_URL;
    return fromConstants ?? fromEnv;
};

/** Active app environment. Defaults to 'development' when unset. */
export const APP_ENV: AppEnv =
    (process.env.EXPO_PUBLIC_APP_ENV as AppEnv | undefined) ?? 'development';

/** Resolved Hospeda API base URL (trailing slash stripped); falls back to the local dev server. */
export const API_BASE_URL: string = (resolveRawApiUrl() ?? FALLBACK_API_URL).replace(/\/$/, '');

/**
 * Validates the mobile environment at startup. Throws when the API URL is
 * missing in a production build (refuses the localhost fallback). No-op under
 * `NODE_ENV=test`.
 *
 * @throws {Error} when `EXPO_PUBLIC_APP_ENV=production` and no API URL is configured.
 */
export function validateEnv(): void {
    if (process.env.NODE_ENV === 'test') return;

    EnvSchema.parse({
        EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
        EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV
    });

    if (APP_ENV === 'production' && resolveRawApiUrl() === undefined) {
        throw new Error(
            'EXPO_PUBLIC_API_URL (or expoConfig.extra.apiUrl) is required in production builds; ' +
                'refusing to fall back to http://localhost:3001.'
        );
    }
}
