/**
 * @file umami-client.ts
 * @description Typed web wrapper over the Umami browser tracker (HOS-2119, T-027).
 * Exposes the call-site surface used across the web app:
 * `trackEvent`, `identifyUser`, `setPersonProperties`, `resetUser`
 * (plus the no-op `associateGroup` / `resetGroups`).
 *
 * Built on `createBrowserAnalytics` so catalog validation, `prepareAnalyticsEvent`
 * and the anti-PII guards stay in force.
 *
 * Consent model (AC-5):
 * - Anonymous `trackEvent` is cookieless and works BEFORE consent.
 * - `identifyUser` attaches a distinct id to the Umami session, so it only runs
 *   once analytics consent is granted, and at most once per user per browser
 *   session. Before consent the identity is stashed and flushed on
 *   `CONSENT_CHANGED_EVENT`.
 * - The distinct id is the internal user id, never an email (OQ-5).
 */

import type {
    AnalyticsEventName,
    AnalyticsEventProperties,
    AnalyticsPersonProperties,
    BrowserAnalyticsDiagnostics
} from '@repo/analytics';
import {
    createBrowserAnalytics,
    createUmamiBrowserClient,
    prepareAnalyticsEvent
} from '@repo/analytics';
import { CONSENT_CHANGED_EVENT, getConsent } from '@/lib/cookie-consent';
import { webLogger } from '@/lib/logger';

/** sessionStorage key holding the user id already identified in this session. */
const IDENTIFIED_SESSION_KEY = 'umami-identified-user';

function resolveBrowserEnvironment():
    | 'development'
    | 'test'
    | 'preview'
    | 'staging'
    | 'production' {
    if (typeof window === 'undefined') {
        return import.meta.env.DEV ? 'development' : 'production';
    }

    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
        return 'development';
    }
    if (hostname.includes('staging')) return 'staging';
    if (hostname.includes('preview')) return 'preview';
    if (hostname.includes('test')) return 'test';
    return 'production';
}

function getGlobalProperties() {
    return {
        app: 'web' as const,
        app_version: import.meta.env.PUBLIC_VERSION ?? 'unknown',
        environment: resolveBrowserEnvironment()
    };
}

const analytics = createBrowserAnalytics({
    debug: import.meta.env.DEV,
    enabled: true,
    getClient: () => (typeof window === 'undefined' ? undefined : createUmamiBrowserClient()),
    getGlobalProperties,
    onDiagnostic: ({ message, payload }: BrowserAnalyticsDiagnostics) => {
        webLogger.debug(`[analytics] ${message}`, payload);
    }
});

/**
 * Capture a catalog event. Cookieless and safe before consent. No-op on the
 * server and when the Umami tracker is absent (ad blocker, not yet loaded).
 * Invalid events (unknown name, bad props, forbidden keys) are dropped, never
 * thrown.
 *
 * @param name - Event name (use values from `./events`).
 * @param props - Event properties validated against the catalog.
 */
export function trackEvent<TName extends AnalyticsEventName>(
    name: TName,
    props: AnalyticsEventProperties<TName>
): void {
    analytics.capture(name, props);
}

/** Input of {@link trackTaggedEvent}. */
export interface TrackTaggedEventInput<TName extends AnalyticsEventName> {
    /** Catalog event name. */
    readonly name: TName;
    /** Event properties validated against the catalog. */
    readonly properties: AnalyticsEventProperties<TName>;
    /** Umami tag (per-entity breakdowns), typically the entity id. */
    readonly tag: string;
}

/**
 * Capture a catalog event carrying an Umami `tag`. Runs the same validation
 * as {@link trackEvent} (`prepareAnalyticsEvent`: catalog schema, anti-PII
 * keys, global properties) and then forwards through `captureTagged`, which
 * uses the function form of `umami.track` so the tag never depends on the
 * script attribute. Invalid input or an empty tag is dropped silently.
 *
 * `createBrowserAnalytics` has no validated tagged path, so this validates
 * here with the same shared `prepareAnalyticsEvent`.
 *
 * @param input - Event name, properties and tag.
 */
export function trackTaggedEvent<TName extends AnalyticsEventName>(
    input: TrackTaggedEventInput<TName>
): void {
    if (typeof window === 'undefined') return;
    try {
        const tag = input.tag.trim();
        if (tag.length === 0) throw new Error('Umami tag must not be empty');
        const data = prepareAnalyticsEvent({
            name: input.name,
            properties: input.properties,
            globalProperties: getGlobalProperties()
        });
        createUmamiBrowserClient().captureTagged({ name: input.name, data, tag });
    } catch (error) {
        webLogger.debug('[analytics] tagged capture rejected', {
            name: input.name,
            error: error instanceof Error ? error.message : String(error)
        });
    }
}

function hasAnalyticsConsent(): boolean {
    return getConsent()?.analytics === true;
}

function readIdentified(): string | null {
    try {
        return window.sessionStorage.getItem(IDENTIFIED_SESSION_KEY);
    } catch {
        return null;
    }
}

function writeIdentified(userId: string | null): void {
    try {
        if (userId === null) window.sessionStorage.removeItem(IDENTIFIED_SESSION_KEY);
        else window.sessionStorage.setItem(IDENTIFIED_SESSION_KEY, userId);
    } catch {
        // Storage unavailable: fall back to in-memory state only.
    }
}

/** Identity requested before consent, flushed on `CONSENT_CHANGED_EVENT`. */
let pendingUserId: string | null = null;
/** Person properties accumulated across calls; sent as Umami session data. */
let personProperties: AnalyticsPersonProperties = {};
/** User id identified in memory this page (mirrors sessionStorage). */
let identifiedUserId: string | null = null;
let consentListenerAttached = false;

function hasPersonProperties(): boolean {
    return Object.keys(personProperties).length > 0;
}

function sendIdentify(userId: string): void {
    const alreadyIdentified = (identifiedUserId ?? readIdentified()) === userId;
    if (alreadyIdentified) return;
    identifiedUserId = userId;
    writeIdentified(userId);
    analytics.identify(userId, hasPersonProperties() ? personProperties : undefined);
}

function attachConsentListenerOnce(): void {
    if (consentListenerAttached || typeof window === 'undefined') return;
    consentListenerAttached = true;
    window.addEventListener(CONSENT_CHANGED_EVENT, (event) => {
        const detail = (event as CustomEvent<{ analytics?: boolean }>).detail;
        if (detail?.analytics !== true) return;
        if (pendingUserId === null) return;
        const userId = pendingUserId;
        pendingUserId = null;
        sendIdentify(userId);
    });
}

/**
 * Identify the visitor to Umami under the internal user id.
 *
 * CONSENT-GATED and once per session: fires immediately when analytics consent
 * is already granted, otherwise the identity is stashed and sent when
 * `CONSENT_CHANGED_EVENT` reports consent. Calling again with the same id in
 * the same browser session is a no-op. Emails are rejected as distinct ids.
 * No-op on the server and when the tracker is absent.
 *
 * @param userId - Internal user id (Better Auth `user.id`). Never an email.
 * @param props - Optional non-sensitive person properties, folded into the
 *   identify session data.
 */
export function identifyUser(userId: string, props?: AnalyticsPersonProperties): void {
    if (typeof window === 'undefined') return;
    if (userId.includes('@')) {
        webLogger.debug('[analytics] identify rejected: distinct id looks like an email');
        return;
    }
    if (props) personProperties = { ...personProperties, ...props };
    if (hasAnalyticsConsent()) {
        sendIdentify(userId);
        return;
    }
    pendingUserId = userId;
    attachConsentListenerOnce();
}

/**
 * Set person properties. Umami has no person profiles, so they fold into the
 * data of the next identify (session data): buffered until consent and the
 * identify, and re-sent for the current identified user when one exists.
 *
 * @param props - Non-sensitive person properties. Never pass PII.
 */
export function setPersonProperties(props: AnalyticsPersonProperties): void {
    if (typeof window === 'undefined') return;
    personProperties = { ...personProperties, ...props };
    const current = identifiedUserId ?? readIdentified();
    if (current && hasAnalyticsConsent()) {
        analytics.identify(current, personProperties);
    }
}

/**
 * No-op kept so existing islands compile. Umami has no group concept; per-entity
 * breakdowns use `entity_id` event data and tags instead (HOS-2119).
 *
 * @param _groupType - Ignored.
 * @param _groupKey - Ignored.
 */
export function associateGroup(_groupType: string, _groupKey: string): void {
    // Intentionally empty: groups are dropped in the Umami migration.
}

/**
 * No-op kept so existing islands compile. Umami has no group concept
 * (see {@link associateGroup}).
 */
export function resetGroups(): void {
    // Intentionally empty: groups are dropped in the Umami migration.
}

/**
 * Forget the identified visitor (call on sign-out). Drops any identity pending
 * consent and the once-per-session marker so a later login identifies again.
 * Umami has no client reset: the session is derived server-side.
 */
export function resetUser(): void {
    if (typeof window === 'undefined') return;
    pendingUserId = null;
    personProperties = {};
    identifiedUserId = null;
    writeIdentified(null);
    analytics.reset();
}
