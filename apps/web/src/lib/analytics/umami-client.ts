/**
 * @file umami-client.ts
 * @description Typed web wrapper over the Umami browser tracker (HOS-2119, T-027).
 * Exposes the call-site surface used across the web app:
 * `trackEvent`, `trackTaggedEvent`, `identifyUser`, `markVisitorAnonymous`,
 * `setPersonProperties`, `resetUser`. Umami has no group concept, so there is
 * no group API.
 *
 * Built on `createBrowserAnalytics` so catalog validation, `prepareAnalyticsEvent`
 * and the anti-PII guards stay in force.
 *
 * Consent model (AC-5, tightened by HOS-2681):
 * - Nothing is sent before analytics consent: the tracker is not even loaded
 *   (`umami-loader.ts`), and `trackEvent` / `trackTaggedEvent` drop events
 *   fired before consent or after a revoke (never queued, never flushed later).
 * - `identifyUser` attaches a distinct id to the Umami session, so it only runs
 *   once analytics consent is granted. Within a document it is sent again only
 *   when the person properties change. Before consent, or before the tracker
 *   script is present, the identity stays pending and is flushed on
 *   `CONSENT_CHANGED_EVENT` or when the tracker appears.
 * - Session model (OQ-5, revised 2026-11-17, owner, after staging smoke:
 *   claimed fingerprint session leaked across accounts): a logged-in visitor
 *   lives in a per-user `uuid(…, id)` session and server events carrying the
 *   same user id join it. The anonymous fingerprint session is never claimed.
 *   That only holds when the identify is the document's FIRST request, i.e. the
 *   tracker does not hold an `x-umami-cache` token yet: with the token Umami
 *   would claim the fingerprint session, and every later visitor on that
 *   device would be attributed to this user. So the identify is sent as soon as
 *   consent and the tracker are there, and is SKIPPED (never delayed) when the
 *   tracker already holds a token for another or no identity: that document
 *   stays anonymous. The document's first pageview is held until the identity
 *   settles (`umami-identity-gate.ts`): every exit of the identify path below
 *   settles it, and `markVisitorAnonymous` settles it for a guest, so a
 *   logged-in visitor's identify goes out before the first pageview instead of
 *   losing the race. Trade-off: pageviews before the login do not join the
 *   post-login session. The identity lives in the tracker's memory, so every
 *   document identifies again (nothing is persisted across reloads).
 * - Revoking analytics consent forgets the identity (reloading the page when
 *   this document's tracker already holds it, see `forgetIdentityOnRevocation`).
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
    hasUmamiCacheToken,
    prepareAnalyticsEvent,
    validateDistinctId
} from '@repo/analytics';
import {
    settleVisitorIdentity,
    shouldHoldForVisitorIdentity,
    waitForVisitorIdentity
} from '@/lib/analytics/umami-identity-gate';
import { getUmamiTracker, waitForUmamiTracker } from '@/lib/analytics/umami-tracker';
import { CONSENT_CHANGED_EVENT, getConsent } from '@/lib/cookie-consent';
import { webLogger } from '@/lib/logger';

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
 * Runs `send` now, or, while the first-pageview identity hold is pending,
 * once the identity settles (or its timeout passes). An on-mount event sent
 * before the identify would hand the tracker the `x-umami-cache` token and the
 * identify would be skipped for the whole document. Queued sends keep their
 * firing order, behind a pageview held earlier.
 */
function sendAfterIdentityHold(send: () => void): void {
    // HOS-2681: nothing is sent before analytics consent. Dropped, never queued,
    // and re-checked when a held send runs (consent may be revoked meanwhile).
    if (!hasAnalyticsConsent()) return;
    const guarded = (): void => {
        if (hasAnalyticsConsent()) send();
    };
    if (shouldHoldForVisitorIdentity()) {
        waitForVisitorIdentity({ onSettled: guarded });
        return;
    }
    guarded();
}

/**
 * Capture a catalog event. Dropped until analytics consent is granted. While the
 * document's first pageview waits for the visitor identity, the event waits
 * behind it (see `sendAfterIdentityHold`). No-op on the
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
    sendAfterIdentityHold(() => analytics.capture(name, props));
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
        sendAfterIdentityHold(() =>
            createUmamiBrowserClient().captureTagged({ name: input.name, data, tag })
        );
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

/** What was last sent to `umami.identify` by THIS document. */
interface IdentifiedMarker {
    /** Distinct id that was identified. */
    readonly userId: string;
    /** Person properties that identify carried (accumulated). */
    readonly properties: AnalyticsPersonProperties;
}

/**
 * Identity waiting to be sent: for consent, or for the tracker to appear.
 * Never dropped by a missing tracker, only by sign-out or revocation.
 */
let pendingUserId: string | null = null;
/** Person properties accumulated across calls; sent as Umami session data. */
let personProperties: AnalyticsPersonProperties = {};
/**
 * Last identify sent by this document. In memory only: the tracker keeps the
 * distinct id in memory for the life of the document, so a reload starts
 * anonymous and has to identify again.
 */
let identified: IdentifiedMarker | null = null;
/** Cancels the bounded wait for the tracker, while one is registered. */
let cancelTrackerWait: (() => void) | null = null;
let consentListenerAttached = false;

/** Whether every current person property was already sent with the same value. */
function alreadySent(marker: IdentifiedMarker, userId: string): boolean {
    if (marker.userId !== userId) return false;
    const sent = new Map<string, unknown>(Object.entries(marker.properties));
    return Object.entries(personProperties).every(
        ([key, value]) => JSON.stringify(sent.get(key)) === JSON.stringify(value)
    );
}

function hasPersonProperties(): boolean {
    return Object.keys(personProperties).length > 0;
}

/**
 * Sends the identify now. Only reached with consent and a present tracker, so
 * marking the document identified here never claims a send that did not happen.
 */
function identifyNow(userId: string): void {
    const properties = { ...personProperties };
    analytics.identify(userId, hasPersonProperties() ? properties : undefined);
    const sentBefore = identified?.userId === userId ? identified.properties : {};
    identified = { userId, properties: { ...sentBefore, ...properties } };
}

/**
 * The tracker is present: sends the identity still pending, with its latest
 * properties, unless consent is gone or the document already has it. Skips it
 * when the tracker already holds a cache token for a different (or no)
 * identity, because the identify would then claim the anonymous fingerprint
 * session (see the file header).
 */
function flushPendingIdentity(): void {
    cancelTrackerWait = null;
    deliverPendingIdentity();
    // Sent, skipped or nothing to send: the first pageview may go now.
    settleVisitorIdentity();
}

function deliverPendingIdentity(): void {
    const target = pendingUserId;
    if (target === null || !hasAnalyticsConsent()) return;
    pendingUserId = null;
    if (identified && alreadySent(identified, target)) return;
    if (identified?.userId !== target && hasUmamiCacheToken({ tracker: getUmamiTracker() })) {
        webLogger.debug('[analytics] identify skipped: tracker already holds a session token');
        return;
    }
    identifyNow(target);
}

/**
 * Sends the identify as soon as the tracker is present: at once when it
 * already is, otherwise from the one bounded wait this document keeps.
 */
function sendIdentify(userId: string): void {
    if (identified && alreadySent(identified, userId)) {
        pendingUserId = null;
        settleVisitorIdentity();
        return;
    }
    pendingUserId = userId;
    if (cancelTrackerWait) return;
    let ran = false;
    const { cancel } = waitForUmamiTracker({
        onReady: () => {
            ran = true;
            flushPendingIdentity();
        },
        onGiveUp: () => {
            cancelTrackerWait = null;
            // No tracker, no pageview either: nothing left to hold.
            settleVisitorIdentity();
        }
    });
    // A synchronous `onReady` already ran and consumed the wait.
    if (!ran) cancelTrackerWait = cancel;
}

function dropTrackerWait(): void {
    cancelTrackerWait?.();
    cancelTrackerWait = null;
}

/**
 * Consent was revoked: forget every identity of this session. The Umami 3.5
 * tracker has no API to clear its in-memory distinct id (`identify` only ever
 * sets it, and `identify({ id: '' })` would still send an identify request and
 * write an `id` key as session data), so when this document's tracker already
 * holds the id, the page reloads: the fresh tracker starts anonymous. A
 * document that never identified needs no reload.
 */
function forgetIdentityOnRevocation(): void {
    dropTrackerWait();
    pendingUserId = null;
    personProperties = {};
    const trackerHoldsIdentity = identified !== null;
    identified = null;
    if (trackerHoldsIdentity) window.location.reload();
}

function attachConsentListenerOnce(): void {
    if (consentListenerAttached || typeof window === 'undefined') return;
    consentListenerAttached = true;
    window.addEventListener(CONSENT_CHANGED_EVENT, (event) => {
        const detail = (event as CustomEvent<{ analytics?: boolean }>).detail;
        if (detail?.analytics !== true) {
            forgetIdentityOnRevocation();
            return;
        }
        if (pendingUserId === null) return;
        sendIdentify(pendingUserId);
    });
}

function isAcceptedDistinctId(userId: string): boolean {
    if (userId.includes('@')) {
        webLogger.debug('[analytics] identify rejected: distinct id looks like an email');
        return false;
    }
    try {
        validateDistinctId(userId);
        return true;
    } catch (error) {
        webLogger.debug('[analytics] identify rejected', {
            error: error instanceof Error ? error.message : String(error)
        });
        return false;
    }
}

/**
 * Identify the visitor to Umami under the internal user id.
 *
 * CONSENT-GATED: fires once analytics consent is granted, otherwise the
 * identity is stashed and sent when `CONSENT_CHANGED_EVENT` reports consent.
 * The identify is sent as soon as the tracker is present, and only while the
 * tracker holds no session token, so it opens the per-user session instead of
 * claiming the anonymous one (see the file header); the document is marked
 * identified only after `umami.identify` actually ran. Within a document an
 * identify is sent again only when the person properties changed, so the
 * enriched properties of a later call always reach Umami. Revoking consent forgets the
 * identity (see `CONSENT_CHANGED_EVENT`). Emails are rejected as distinct ids.
 * No-op on the server.
 *
 * @param userId - Internal user id (Better Auth `user.id`). Never an email.
 * @param props - Optional non-sensitive person properties, folded into the
 *   identify session data.
 */
export function identifyUser(userId: string, props?: AnalyticsPersonProperties): void {
    if (typeof window === 'undefined') return;
    if (!isAcceptedDistinctId(userId)) {
        settleVisitorIdentity();
        return;
    }
    if (props) personProperties = { ...personProperties, ...props };
    attachConsentListenerOnce();
    if (hasAnalyticsConsent()) {
        sendIdentify(userId);
        return;
    }
    pendingUserId = userId;
    // No identify before consent (AC-5): the first pageview goes out anonymous.
    settleVisitorIdentity();
}

/**
 * Declare that the auth state resolved to a guest. Releases the document's
 * first pageview, which waits for the visitor identity (see
 * `umami-identity-gate.ts`). Call it only once the session is actually known
 * (`/auth/me` or its cache answered), never from an SSR guest hint, which is
 * `null` for every visitor on SSG pages. A logged-in visitor goes through
 * {@link identifyUser} instead, which releases the pageview itself. No-op on
 * the server.
 */
export function markVisitorAnonymous(): void {
    if (typeof window === 'undefined') return;
    settleVisitorIdentity();
}

/**
 * Set person properties. Umami has no person profiles, so they fold into the
 * data of the identify (session data): buffered until consent and the
 * identify, and re-sent for the current identified user when they changed.
 *
 * @param props - Non-sensitive person properties. Never pass PII.
 */
export function setPersonProperties(props: AnalyticsPersonProperties): void {
    if (typeof window === 'undefined') return;
    personProperties = { ...personProperties, ...props };
    const current = pendingUserId ?? identified?.userId;
    if (current && hasAnalyticsConsent()) sendIdentify(current);
}

/**
 * Forget the identified visitor (call on sign-out). Drops any identity pending
 * consent or the tracker and the document marker so a later login identifies
 * again. The tracker keeps its in-memory id until the next full page load; the
 * sign-out flow always ends in one.
 */
export function resetUser(): void {
    if (typeof window === 'undefined') return;
    dropTrackerWait();
    pendingUserId = null;
    personProperties = {};
    identified = null;
    analytics.reset();
    settleVisitorIdentity();
}
