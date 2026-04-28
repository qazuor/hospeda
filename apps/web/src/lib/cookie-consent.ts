/**
 * @file cookie-consent.ts
 * @description Cookie consent state management helpers.
 *
 * Consent is persisted as a JSON cookie named `cookie-consent` with:
 * - Max-Age: 1 year (31536000 seconds)
 * - Path=/
 * - SameSite=Lax
 * - No HttpOnly (must be readable by client JS)
 *
 * The cookie is chosen over localStorage so that future SSR personalization
 * can read consent state without JavaScript (e.g., skip Sentry script tag).
 */

/** Cookie name used to persist consent state. */
export const CONSENT_COOKIE_NAME = 'cookie-consent' as const;

/** Schema version — bump when adding new categories. */
export const CONSENT_VERSION = 1 as const;

/** Max-Age in seconds (1 year). */
export const CONSENT_MAX_AGE = 31_536_000 as const;

/** Consent state for each category. */
export interface ConsentState {
    /** Always true — necessary cookies cannot be opted out. */
    readonly necessary: true;
    /** Opt-in for analytics (Sentry, etc.). */
    readonly analytics: boolean;
    /** Opt-in for marketing (future use). */
    readonly marketing: boolean;
    /** Schema version for forward compatibility. */
    readonly version: number;
    /** ISO date string when the decision was made. */
    readonly decidedAt: string;
}

/**
 * Parses the `cookie-consent` cookie value from `document.cookie`.
 * Returns null if the cookie is absent or malformed.
 */
export function getConsent(): ConsentState | null {
    if (typeof document === 'undefined') return null;

    const match = document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${CONSENT_COOKIE_NAME}=`));

    if (!match) return null;

    const raw = match.slice(CONSENT_COOKIE_NAME.length + 1);
    try {
        const decoded = decodeURIComponent(raw);
        const parsed = JSON.parse(decoded) as Partial<ConsentState>;
        // Validate required shape
        if (
            typeof parsed.analytics === 'boolean' &&
            typeof parsed.marketing === 'boolean' &&
            typeof parsed.version === 'number'
        ) {
            return {
                necessary: true,
                analytics: parsed.analytics,
                marketing: parsed.marketing,
                version: parsed.version,
                decidedAt: parsed.decidedAt ?? new Date().toISOString().split('T')[0] ?? ''
            };
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Persists the consent decision as a cookie readable by client JS.
 *
 * @param analytics - Whether analytics tracking is allowed.
 * @param marketing - Whether marketing tracking is allowed.
 */
export function saveConsent({
    analytics,
    marketing
}: {
    readonly analytics: boolean;
    readonly marketing: boolean;
}): ConsentState {
    const state: ConsentState = {
        necessary: true,
        analytics,
        marketing,
        version: CONSENT_VERSION,
        decidedAt: new Date().toISOString().split('T')[0] ?? ''
    };

    const value = encodeURIComponent(JSON.stringify(state));
    document.cookie = [
        `${CONSENT_COOKIE_NAME}=${value}`,
        `Max-Age=${CONSENT_MAX_AGE}`,
        'Path=/',
        'SameSite=Lax'
    ].join('; ');

    return state;
}
