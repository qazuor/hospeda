/**
 * Better Auth client for the Hospeda mobile (Expo) app.
 *
 * Transport: `@better-fetch/fetch` (bundled inside `@better-auth/expo/client`)
 * with session cookies persisted in `expo-secure-store` via the `expoClient`
 * plugin. On native (iOS / Android) the plugin:
 *  - Sends a `cookie` header built from SecureStore on every request.
 *  - Sends an `expo-origin` header (`hospeda://`) so the server's origin
 *    check passes (native apps do not send a standard `origin` header).
 *  - Reads `set-cookie` on responses and persists them back into SecureStore.
 *  - Opens `expo-web-browser` for OAuth/social sign-in redirects.
 *  - Monitors network state via `expo-network` (falls back to online=true if
 *    the dynamic import fails).
 *
 * On web (Metro/Expo web) the plugin is a no-op; standard browser cookies apply.
 *
 * @module auth-client
 * @see apps/mobile/docs/auth-spike.md — SPEC-243 T-003 spike doc
 */
import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

/**
 * Base URL of the Hospeda API, injected at build time via `EXPO_PUBLIC_API_URL`.
 * Defaults to the local dev server so the app typechecks without an env file.
 */
const apiBaseUrl: string =
    (Constants.expoConfig?.extra as Record<string, string> | undefined)?.apiUrl ??
    process.env.EXPO_PUBLIC_API_URL ??
    'http://localhost:3001';

/**
 * Better Auth client configured for Expo / React Native.
 *
 * Usage in components:
 * ```tsx
 * import { useSession, signIn, signOut } from '@/lib/auth-client';
 *
 * const { data: session } = useSession();
 * await signIn.email({ email, password });
 * await signOut();
 * ```
 *
 * NOTE: The live session flow (sign-in → persist → session refresh → sign-out)
 * is UNVERIFIED in this static spike. It requires a real device or simulator
 * with expo-secure-store available. See apps/mobile/docs/auth-spike.md.
 */
export const authClient = createAuthClient({
    baseURL: apiBaseUrl,
    basePath: '/api/auth',
    plugins: [
        expoClient({
            /**
             * Must match `expo.scheme` in `app.json` ("hospeda").
             * Used to build OAuth callback deep links: `hospeda://`.
             */
            scheme: 'hospeda',
            /**
             * Key prefix for SecureStore entries.
             * Stored as: `hospeda_cookie`, `hospeda_session_data`.
             */
            storagePrefix: 'hospeda',
            /**
             * Sync storage adapter. expo-secure-store@56 exposes synchronous
             * `getItem(key) → string | null` and `setItem(key, value) → void`
             * that the plugin calls directly (no async wrapper needed).
             */
            storage: SecureStore
        })
    ]
});

/**
 * Sign in with email and password.
 * Wraps `authClient.signIn.email`.
 */
export const signIn = authClient.signIn;

/**
 * Sign up a new account.
 * Wraps `authClient.signUp`.
 */
export const signUp = authClient.signUp;

/**
 * Sign the current user out and clear the persisted session cookie.
 * Wraps `authClient.signOut`.
 */
export const signOut = authClient.signOut;

/**
 * React hook that returns the current session state.
 * Re-renders on session changes (sign-in, sign-out, expiry).
 * Wraps `authClient.useSession`.
 */
export const useSession = authClient.useSession;

/**
 * Returns the raw cookie string stored in SecureStore.
 * Useful for passing to non-Better-Auth fetch calls that need the session
 * cookie (e.g. custom file upload endpoints).
 */
export const getCookie = authClient.getCookie;
