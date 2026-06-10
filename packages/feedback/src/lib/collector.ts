import type {
    AppSourceId,
    ColorSchemeId,
    DeviceTypeId,
    FeedbackEnvironment,
    FeedbackInteraction
} from '@repo/schemas';
/**
 * @repo/feedback - Environment data collector utility.
 *
 * Collects browser environment data (URL, browser/OS info, viewport, locale,
 * timezone, device class, network, color scheme, feature flags, navigation
 * history, last interactions) for inclusion in feedback reports. Safe to call
 * in SSR contexts: every collector is wrapped in try/catch and returns
 * `undefined` on failure.
 */
import { UAParser } from 'ua-parser-js';

/** Default localStorage key prefixes scanned for feature flags. */
export const DEFAULT_FEATURE_FLAG_PREFIXES = ['feature_', 'ff_'] as const;

/** Maximum length of a feature flag value (truncated past this). */
const MAX_FEATURE_FLAG_VALUE_LENGTH = 200;

/** Tablet threshold (inclusive) — viewport width >= mobile breakpoint */
const TABLET_MIN_WIDTH = 640;

/** Desktop threshold — viewport width > tablet upper bound */
const DESKTOP_MIN_WIDTH = 1024;

/**
 * Input for collecting environment data.
 */
export interface CollectEnvironmentInput {
    /** Application source identifier */
    appSource: AppSourceId;
    /** Deploy version (git hash or release tag) */
    deployVersion?: string;
    /** Authenticated user ID (if available) */
    userId?: string;
    /** Authenticated user email (if available) */
    userEmail?: string;
    /** Authenticated user name (if available) */
    userName?: string;
    /** Console errors from capture buffer */
    consoleErrors?: string[];
    /** Error info from error boundary */
    errorInfo?: { message: string; stack?: string };
    /**
     * localStorage key prefixes used to extract feature flags.
     * Defaults to `['feature_', 'ff_']`.
     */
    featureFlagPrefixes?: ReadonlyArray<string>;
    /** Snapshot of the navigation history ring buffer */
    navigationHistory?: string[];
    /** Snapshot of the last user interactions ring buffer */
    lastInteractions?: FeedbackInteraction[];
    /** Most recent Sentry event ID at collection time */
    sentryEventId?: string;
}

// ---------------------------------------------------------------------------
// Defensive collectors (each returns undefined on any failure)
// ---------------------------------------------------------------------------

function collectLocale(): string | undefined {
    try {
        if (typeof navigator === 'undefined') return undefined;
        return navigator.language || undefined;
    } catch {
        return undefined;
    }
}

function collectTimezone(): string | undefined {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
    } catch {
        return undefined;
    }
}

function collectDeviceType(): DeviceTypeId | undefined {
    try {
        if (typeof window === 'undefined') return undefined;
        const width = window.innerWidth;

        // Use UA hint as a tiebreaker when the viewport sits near a breakpoint
        const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } })
            .userAgentData;
        const uaSaysMobile = uaData?.mobile === true;

        if (width < TABLET_MIN_WIDTH) return 'mobile';
        if (width < DESKTOP_MIN_WIDTH) {
            return uaSaysMobile ? 'mobile' : 'tablet';
        }
        return uaSaysMobile ? 'mobile' : 'desktop';
    } catch {
        return undefined;
    }
}

function collectConnectionType(): string | undefined {
    try {
        if (typeof navigator === 'undefined') return undefined;
        const conn = (
            navigator as Navigator & {
                connection?: { effectiveType?: string };
            }
        ).connection;
        return conn?.effectiveType || undefined;
    } catch {
        return undefined;
    }
}

/**
 * localStorage keys consumer apps may use to persist a theme preference.
 * Checked in order; the first one that resolves to 'light' or 'dark' wins.
 * This lets the collector reflect the app's actual theme even when the
 * `<html data-theme>` attribute is not used (e.g. when the web app stores
 * the preference but never mirrors it to the DOM).
 */
const THEME_STORAGE_KEYS = ['hospeda-theme', 'theme', 'color-scheme'] as const;

function collectColorScheme(): ColorSchemeId | undefined {
    try {
        // 1. <html data-theme="..."> — explicit DOM hint, highest priority.
        if (typeof document !== 'undefined') {
            const themeAttr = document.documentElement.dataset.theme;
            if (themeAttr === 'dark' || themeAttr === 'light') {
                return themeAttr;
            }
        }
        // 2. localStorage — reflect the app's stored preference even when
        // the consumer app does not mirror it to <html data-theme>.
        if (typeof window !== 'undefined' && window.localStorage) {
            for (const key of THEME_STORAGE_KEYS) {
                const stored = window.localStorage.getItem(key);
                if (stored === 'dark' || stored === 'light') {
                    return stored;
                }
            }
        }
        // 3. OS preference via matchMedia. Last resort because the user may
        // have overridden the OS default in the app itself.
        if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return undefined;
    } catch {
        return undefined;
    }
}

function collectFeatureFlags(prefixes: ReadonlyArray<string>): Record<string, string> | undefined {
    try {
        if (typeof window === 'undefined' || !window.localStorage) return undefined;
        const storage = window.localStorage;
        const flags: Record<string, string> = {};

        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (!key) continue;
            const matchesPrefix = prefixes.some((prefix) => key.startsWith(prefix));
            if (!matchesPrefix) continue;
            const value = storage.getItem(key);
            if (value === null) continue;
            flags[key] = value.slice(0, MAX_FEATURE_FLAG_VALUE_LENGTH);
        }

        return Object.keys(flags).length > 0 ? flags : undefined;
    } catch {
        return undefined;
    }
}

// ---------------------------------------------------------------------------
// Main collector
// ---------------------------------------------------------------------------

/**
 * Collects browser environment data for feedback reports.
 *
 * Reads window, navigator, Intl, localStorage, and the runtime ring buffers
 * to build a `FeedbackEnvironment` object. Returns partial data (only
 * timestamp + appSource) when called in a non-browser (SSR) context where
 * `window` or `navigator` are not available.
 *
 * Every individual collector is defensive: it returns `undefined` on any
 * failure so the entire collection step never throws.
 *
 * @param input - Required app source and optional user/error/runtime context
 * @returns Populated FeedbackEnvironment object
 *
 * @example
 * ```ts
 * const env = collectEnvironmentData({
 *   appSource: 'web',
 *   deployVersion: 'abc1234',
 *   userId: 'usr_123',
 * });
 * ```
 */
export function collectEnvironmentData(input: CollectEnvironmentInput): FeedbackEnvironment {
    const isBrowser = typeof window !== 'undefined';

    let browser: string | undefined;
    let os: string | undefined;

    if (isBrowser && typeof navigator !== 'undefined') {
        try {
            const parser = new UAParser(navigator.userAgent);
            const browserInfo = parser.getBrowser();
            const osInfo = parser.getOS();
            browser = browserInfo.name
                ? `${browserInfo.name} ${browserInfo.version ?? ''}`.trim()
                : undefined;
            os = osInfo.name ? `${osInfo.name} ${osInfo.version ?? ''}`.trim() : undefined;
        } catch {
            browser = undefined;
            os = undefined;
        }
    }

    // Strip query string and hash to avoid leaking OAuth tokens or session
    // fragments that may appear in the URL (e.g., ?code=xxx&state=yyy)
    let safeUrl: string | undefined;
    try {
        safeUrl = isBrowser ? `${window.location.origin}${window.location.pathname}` : undefined;
    } catch {
        safeUrl = undefined;
    }

    let viewport: string | undefined;
    try {
        viewport = isBrowser ? `${window.innerWidth}x${window.innerHeight}` : undefined;
    } catch {
        viewport = undefined;
    }

    const prefixes = input.featureFlagPrefixes ?? DEFAULT_FEATURE_FLAG_PREFIXES;

    return {
        currentUrl: safeUrl,
        browser,
        os,
        viewport,
        timestamp: new Date().toISOString(),
        appSource: input.appSource,
        deployVersion: input.deployVersion,
        userId: input.userId,
        consoleErrors: input.consoleErrors,
        errorInfo: input.errorInfo,
        locale: collectLocale(),
        timezone: collectTimezone(),
        deviceType: collectDeviceType(),
        connectionType: collectConnectionType(),
        colorScheme: collectColorScheme(),
        featureFlags: collectFeatureFlags(prefixes),
        navigationHistory: input.navigationHistory,
        lastInteractions: input.lastInteractions,
        sentryEventId: input.sentryEventId
    };
}
