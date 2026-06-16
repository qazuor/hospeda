/**
 * @file auth-errors.ts
 * @description Maps Better Auth client error objects to param-free i18n keys.
 *
 * Better Auth client methods (`signIn.email`, `signUp.email`) RESOLVE with
 * `{ data, error }` — they do NOT throw on an API-level failure. The `error`
 * carries a typed `code` (from `$ERROR_CODES`, e.g. `INVALID_EMAIL_OR_PASSWORD`,
 * `USER_ALREADY_EXISTS`) plus an HTTP `status`. These helpers map that error to
 * a key under the `auth-ui.{signIn,signUp}.errors.*` namespace, which the screen
 * resolves with `getTranslation(key, locale)` for display.
 *
 * Mapping is `code`-driven (stable) with a `status` fallback — NOT message
 * string-matching, which is locale/version-fragile.
 *
 * @module auth-errors
 */

/**
 * Minimal shape of a Better Auth client error. The real object is wider
 * (`statusText`, `message`, …); only `code` + `status` drive the mapping.
 */
type AuthClientError = {
    readonly code?: string;
    readonly status?: number;
};

/** Normalizes an unknown error value to its uppercased `code` + `status`. */
function readError(error: unknown): { code: string; status: number } {
    const e = (error ?? {}) as AuthClientError;
    return { code: (e.code ?? '').toUpperCase(), status: e.status ?? 0 };
}

/**
 * Maps a Better Auth sign-in error to a param-free `auth-ui.signIn.errors.*` key.
 *
 * @param error - The `error` value from `signIn.email`'s `{ data, error }` result.
 * @returns An i18n key string (always defined; falls back to `unknownError`).
 */
export function mapSignInError(error: unknown): string {
    const { code, status } = readError(error);
    if (code === 'INVALID_EMAIL') return 'auth-ui.signIn.errors.invalidEmail';
    if (code === 'INVALID_EMAIL_OR_PASSWORD' || status === 401) {
        return 'auth-ui.signIn.errors.invalidCredentials';
    }
    return 'auth-ui.signIn.errors.unknownError';
}

/**
 * Maps a Better Auth sign-up error to a param-free `auth-ui.signUp.errors.*` key.
 *
 * @param error - The `error` value from `signUp.email`'s `{ data, error }` result.
 * @returns An i18n key string (always defined; falls back to `unknownError`).
 */
export function mapSignUpError(error: unknown): string {
    const { code } = readError(error);
    if (code === 'USER_ALREADY_EXISTS') return 'auth-ui.signUp.errors.emailAlreadyExists';
    if (code.includes('PASSWORD')) return 'auth-ui.signUp.errors.weakPassword';
    if (code === 'INVALID_EMAIL') return 'auth-ui.signUp.errors.invalidEmail';
    return 'auth-ui.signUp.errors.unknownError';
}
