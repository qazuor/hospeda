/**
 * @file umami-recorder.ts
 * @description Client-side loader of the Umami session recorder (HOS-2347 §6.4).
 *
 * The page HTML is session-blind and edge-cached, so whether to record cannot
 * be baked into it. This bundled module decides at runtime, per document, and
 * injects `recorder.js` only when ALL of these hold, checked in this order
 * (stopping at the first failure):
 *
 * 1. The Umami tracker element is present (both public env vars are set).
 * 2. The current path is not excluded ({@link isRecordingExcludedPath}).
 * 3. Analytics consent is `true`. While it is `null` or `false`, the loader
 *    listens for `CONSENT_CHANGED_EVENT` and re-evaluates on a grant.
 * 4. `GET /api/v1/public/session-recording` answers 200 with
 *    `{ enabled: true }` within 3 s. Anything else (network error, timeout,
 *    non-200, bad body, CSP block) means NO recording: it fails closed, with
 *    a `debug` log at most and nothing shown to the visitor.
 * 5. The tracker is loaded and the visitor identity is settled, so the
 *    recorder never opens the tracker session before the identify (HOS-2119
 *    OQ-5).
 * 6. Exactly one `<script id="umami-recorder">` is injected (module flag plus
 *    DOM id check).
 *
 * Once loaded, the recorder follows `pushState` across ClientRouter swaps. So
 * any soft navigation (link or back/forward) whose destination is excluded is
 * turned into a full page load: the loader cancels `astro:before-preparation`
 * (which Astro's router answers with a full load) and calls
 * `location.assign(destination)`. The unload ends the recording and the next
 * document never loads the recorder (condition 2).
 *
 * The loader NEVER reloads on consent revoke or on switch-off (owner decision
 * D-2): recording stops at the next page load, where condition 3 or 4 fails.
 * Umami's recorder exposes no in-page stop that this loader relies on.
 *
 * The router may drop the injected element from `<head>` on a swap; the
 * already-running recorder is unaffected, and the module flag keeps it single.
 */

import { PublicSessionRecordingResponseSchema } from '@repo/schemas';
import { isRecordingExcludedPath } from '@/lib/analytics/recording-exclusions';
import {
    shouldHoldForVisitorIdentity,
    waitForVisitorIdentity
} from '@/lib/analytics/umami-identity-gate';
import { waitForUmamiTracker } from '@/lib/analytics/umami-tracker';
import { CONSENT_CHANGED_EVENT, getConsent } from '@/lib/cookie-consent';
import { getApiUrl } from '@/lib/env';
import { webLogger } from '@/lib/logger';

/** `id` of the injected recorder `<script>`. */
export const RECORDER_SCRIPT_ID = 'umami-recorder';

/** Path of the public switch endpoint. */
export const SESSION_RECORDING_ENDPOINT_PATH = '/api/v1/public/session-recording';

/** Time limit for the switch request; past it, nothing records. */
export const SESSION_RECORDING_FETCH_TIMEOUT_MS = 3000;

/** The tracker tag rendered by `UmamiScript.astro` (never the recorder itself). */
const TRACKER_SCRIPT_SELECTOR = `script[data-website-id]:not(#${RECORDER_SCRIPT_ID})`;
const CLIENT_ROUTER_META_SELECTOR = 'meta[name="astro-view-transitions-enabled"]';

/**
 * The api answers the switch inside its standard `{ success, data }` envelope;
 * `data` must be exactly `{ enabled: boolean }`.
 */
function parseSwitchEnvelope(body: unknown): boolean | null {
    if (typeof body !== 'object' || body === null) return null;
    if (Reflect.get(body, 'success') !== true) return null;
    const parsed = PublicSessionRecordingResponseSchema.safeParse(Reflect.get(body, 'data'));
    return parsed.success ? parsed.data.enabled : null;
}

/** Input of {@link startUmamiRecorder}. */
export interface StartUmamiRecorderInput {
    /** Injected fetch (tests). Defaults to the global `fetch`. */
    readonly fetchImpl?: typeof fetch;
    /** Full-load navigation (tests). Defaults to `location.assign`. */
    readonly navigate?: (href: string) => void;
    /** Switch request timeout in ms. Defaults to {@link SESSION_RECORDING_FETCH_TIMEOUT_MS}. */
    readonly timeoutMs?: number;
}

/** Result of {@link startUmamiRecorder}. */
export interface StartUmamiRecorderResult {
    /** Undoes the wiring and forgets this document's state (tests). */
    readonly stop: () => void;
}

interface TrackerTarget {
    readonly origin: string;
    readonly websiteId: string;
}

let started = false;
let loaded = false;
let evaluating = false;
let consentListenerAttached = false;
let options: Required<StartUmamiRecorderInput> | null = null;

function findTrackerTarget(): TrackerTarget | null {
    const tracker = document.querySelector<HTMLScriptElement>(TRACKER_SCRIPT_SELECTOR);
    const websiteId = tracker?.getAttribute('data-website-id')?.trim();
    const src = tracker?.getAttribute('src')?.trim();
    if (!websiteId || !src) return null;
    try {
        const url = new URL(src, window.location.href);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
        return { origin: url.origin, websiteId };
    } catch {
        return null;
    }
}

function consentGranted(): boolean {
    return getConsent()?.analytics === true;
}

function currentPathExcluded(): boolean {
    return isRecordingExcludedPath({ pathname: window.location.pathname });
}

/** Condition 4. Never throws: every failure answers `false` (fail closed). */
async function isSwitchOn(): Promise<boolean> {
    if (!options) return false;
    const { fetchImpl, timeoutMs } = options;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetchImpl(`${getApiUrl()}${SESSION_RECORDING_ENDPOINT_PATH}`, {
            method: 'GET',
            credentials: 'omit',
            signal: controller.signal
        });
        if (response.status !== 200) {
            webLogger.debug('[umami-recorder] switch answered', response.status);
            return false;
        }
        const enabled = parseSwitchEnvelope(await response.json());
        if (enabled === null) {
            webLogger.debug('[umami-recorder] switch body is not { enabled: boolean }');
            return false;
        }
        return enabled;
    } catch (cause) {
        webLogger.debug('[umami-recorder] switch unavailable', cause);
        return false;
    } finally {
        clearTimeout(timer);
    }
}

/** Condition 5: resolves `true` once the tracker is there and the identity settled. */
function waitForTrackerAndIdentity(): Promise<boolean> {
    return new Promise((resolve) => {
        waitForUmamiTracker({
            onReady: () => {
                if (!shouldHoldForVisitorIdentity()) {
                    resolve(true);
                    return;
                }
                waitForVisitorIdentity({ onSettled: () => resolve(true) });
            },
            onGiveUp: () => resolve(false)
        });
    });
}

function inject(target: TrackerTarget): void {
    if (document.getElementById(RECORDER_SCRIPT_ID)) {
        loaded = true;
        return;
    }
    const script = document.createElement('script');
    script.id = RECORDER_SCRIPT_ID;
    script.src = `${target.origin}/recorder.js`;
    script.setAttribute('data-website-id', target.websiteId);
    document.head.appendChild(script);
    loaded = true;
}

/** Evaluates conditions 1 to 6 for the current document. */
function evaluate(): void {
    if (loaded || evaluating) return;
    if (document.getElementById(RECORDER_SCRIPT_ID)) {
        loaded = true;
        return;
    }
    const target = findTrackerTarget();
    if (!target) return;
    if (currentPathExcluded()) return;
    if (!consentGranted()) {
        attachConsentListener();
        return;
    }
    evaluating = true;
    void (async () => {
        try {
            if (!(await isSwitchOn())) return;
            if (!(await waitForTrackerAndIdentity())) return;
            // The visitor may have navigated or revoked meanwhile: re-check.
            if (!started || currentPathExcluded() || !consentGranted()) return;
            inject(target);
        } finally {
            evaluating = false;
        }
    })();
}

function onConsentChanged(event: Event): void {
    const detail = (event as CustomEvent<{ analytics?: boolean }>).detail;
    // A revoke never reloads (D-2): recording stops at the next page load.
    if (detail?.analytics === true) evaluate();
}

function attachConsentListener(): void {
    if (consentListenerAttached) return;
    consentListenerAttached = true;
    window.addEventListener(CONSENT_CHANGED_EVENT, onConsentChanged);
}

/** Turns a soft navigation into an excluded route into a full page load. */
function onBeforePreparation(event: Event): void {
    if (!loaded || !options) return;
    const to: unknown = Reflect.get(event, 'to');
    if (!(to instanceof URL)) return;
    if (!isRecordingExcludedPath({ pathname: to.pathname })) return;
    event.preventDefault();
    options.navigate(to.href);
}

/**
 * Wires the recorder loader. Idempotent. Called from the bundled script in
 * `UmamiScript.astro`, which the router never re-runs on a swap.
 *
 * @param input - Optional injections for tests.
 * @returns A handle whose `stop` undoes the wiring (tests).
 */
export function startUmamiRecorder(input: StartUmamiRecorderInput = {}): StartUmamiRecorderResult {
    const noop: StartUmamiRecorderResult = { stop: () => undefined };
    if (started || typeof window === 'undefined') return noop;
    started = true;
    options = {
        fetchImpl: input.fetchImpl ?? ((...args) => fetch(...args)),
        navigate: input.navigate ?? ((href) => window.location.assign(href)),
        timeoutMs: input.timeoutMs ?? SESSION_RECORDING_FETCH_TIMEOUT_MS
    };

    const stop = (): void => {
        document.removeEventListener('astro:page-load', evaluate);
        document.removeEventListener('astro:before-preparation', onBeforePreparation);
        window.removeEventListener(CONSENT_CHANGED_EVENT, onConsentChanged);
        started = false;
        loaded = false;
        evaluating = false;
        consentListenerAttached = false;
        options = null;
    };

    document.addEventListener('astro:before-preparation', onBeforePreparation);
    if (document.querySelector(CLIENT_ROUTER_META_SELECTOR)) {
        document.addEventListener('astro:page-load', evaluate);
    } else {
        evaluate();
    }
    return { stop };
}
