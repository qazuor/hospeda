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

/**
 * Window event dispatched after every {@link saveConsent} call so listeners
 * (e.g. the PostHog initializer) can react to consent changes without a
 * full page reload. The event's `detail` is the new {@link ConsentState}.
 *
 * Sibling to the existing `cookie-consent:reopen` event which is fired by
 * the footer "Cookie preferences" button to reopen the banner.
 */
export const CONSENT_CHANGED_EVENT = 'cookie-consent:changed' as const;

/** Schema version — bump when adding new categories. */
export const CONSENT_VERSION = 2 as const;

/** Max-Age in seconds (1 year). */
export const CONSENT_MAX_AGE = 31_536_000 as const;

/** Consent state for each category. */
export interface ConsentState {
    /** Always true — necessary cookies cannot be opted out. */
    readonly necessary: true;
    /** Opt-in for crash reporting (Sentry). Separate from analytics so users
     * who decline behavioural tracking can still opt in to error reports that
     * help us fix bugs affecting them. */
    readonly crashReporting: boolean;
    /** Opt-in for usage analytics (page views, search flows). */
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
            // v1 → v2 migration: crashReporting was bundled inside analytics,
            // so users who accepted analytics implicitly accepted crash reports.
            // Preserve their existing decision; the banner re-prompts via the
            // "Cookie preferences" link if they want to split them.
            const crashReporting =
                typeof parsed.crashReporting === 'boolean'
                    ? parsed.crashReporting
                    : parsed.analytics;
            return {
                necessary: true,
                crashReporting,
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
 * @param crashReporting - Whether crash/error reporting (Sentry) is allowed.
 * @param analytics - Whether usage analytics tracking is allowed.
 * @param marketing - Whether marketing tracking is allowed.
 */
export function saveConsent({
    crashReporting,
    analytics,
    marketing
}: {
    readonly crashReporting: boolean;
    readonly analytics: boolean;
    readonly marketing: boolean;
}): ConsentState {
    const state: ConsentState = {
        necessary: true,
        crashReporting,
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

    // Notify any listener (PostHog initializer, future analytics SDKs)
    // that consent has been updated so they can switch persistence mode
    // mid-session without a full page reload.
    if (typeof window !== 'undefined') {
        window.dispatchEvent(
            new CustomEvent<ConsentState>(CONSENT_CHANGED_EVENT, { detail: state })
        );
    }

    return state;
}
