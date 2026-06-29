/**
 * Cloudflare Turnstile server-side verification utility (SPEC-301).
 *
 * Implements fail-closed policy (R-2): any verification failure, network
 * error, or missing configuration causes the caller to REJECT the submission.
 * Never silently passes a request through on error.
 */
import { env } from './env.js';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Timeout for the Cloudflare siteverify request in milliseconds. */
const VERIFY_TIMEOUT_MS = 5_000;

/**
 * Result returned by Cloudflare's siteverify endpoint.
 */
export interface TurnstileVerifyResult {
    /** true if the token is valid */
    readonly success: boolean;
    /** Cloudflare error code if success is false (e.g. 'invalid-input-response') */
    readonly errorCode?: string;
}

/**
 * Returns the configured Cloudflare Turnstile secret key.
 *
 * Extracted as a separate function so tests can mock it independently of
 * the env module (which is initialized at module-load time).
 *
 * @returns The secret key string, or undefined when not configured
 */
export function getTurnstileSecret(): string | undefined {
    return env.HOSPEDA_TURNSTILE_SECRET_KEY;
}

/**
 * Verifies a Cloudflare Turnstile challenge token against the siteverify endpoint.
 *
 * Uses native `fetch` with a 5-second timeout. On timeout or network error the
 * returned Promise rejects — callers MUST treat this as a verification failure
 * (fail-closed, R-2).
 *
 * @param params.token   - The Turnstile token from the client widget
 * @param params.secret  - The Cloudflare Turnstile secret key
 * @param params.ip      - Optional visitor IP (passed as `remoteip` to Cloudflare)
 * @returns Resolves with the verification result; rejects on network/timeout errors
 */
export async function verifyCfTurnstileToken({
    token,
    secret,
    ip
}: {
    token: string;
    secret: string;
    ip?: string;
}): Promise<TurnstileVerifyResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

    try {
        const params = new URLSearchParams({ secret, response: token });
        if (ip) {
            params.set('remoteip', ip);
        }

        const response = await fetch(SITEVERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
            signal: controller.signal
        });

        const data = (await response.json()) as {
            success: boolean;
            'error-codes'?: string[];
        };

        return {
            success: data.success === true,
            errorCode: data['error-codes']?.[0]
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Checks whether Turnstile verification is required (i.e. the secret key is configured).
 *
 * @returns true when HOSPEDA_TURNSTILE_SECRET_KEY is set; false when absent.
 */
export function isTurnstileConfigured(): boolean {
    return Boolean(env.HOSPEDA_TURNSTILE_SECRET_KEY);
}
