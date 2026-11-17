/**
 * @file umami-identity-gate.ts
 * @description One-shot "visitor identity settled" signal that holds the
 * document's first Umami pageview (HOS-2119, OQ-5 revised 2026-11-17, AC-12).
 *
 * The identify must be a document's FIRST request: once the tracker holds an
 * `x-umami-cache` token, `umami-client.ts` skips the identify so it never
 * claims the anonymous fingerprint session. The first pageview fires on
 * `astro:page-load`, which often comes before the UserMenu island hydrates and
 * resolves the session, so an unheld pageview won the race and every
 * logged-in visitor stayed anonymous in the browser while their server events
 * went to the per-user session (no AC-12 join).
 *
 * So `umami-pageview.ts` holds the first pageview until this gate settles:
 * - the visitor is known to be anonymous (`markVisitorAnonymous` in
 *   `umami-client.ts`, called by UserMenu once `/auth/me` resolved);
 * - or the identify was sent, skipped or abandoned (`umami-client.ts`);
 * - or {@link FIRST_PAGEVIEW_IDENTITY_TIMEOUT_MS} elapsed, and the pageview
 *   goes out anonymously (the token guard then still applies to a late
 *   identify).
 *
 * The state is module-level and shared by the bundled pageview script and the
 * UserMenu island through the same Vite chunk (the same way
 * `getCurrentPageReferrer` already is). It settles once per document; a soft
 * navigation never re-arms it.
 */

/** How long the first pageview waits for the identity before going out anonymously. */
export const FIRST_PAGEVIEW_IDENTITY_TIMEOUT_MS = 3000;

let settled = false;
const listeners = new Set<() => void>();

/**
 * Marks the visitor identity as settled for this document and releases every
 * waiter. Idempotent.
 */
export function settleVisitorIdentity(): void {
    if (settled) return;
    settled = true;
    const pending = [...listeners];
    listeners.clear();
    for (const listener of pending) listener();
}

/**
 * Whether the visitor identity of this document is settled.
 *
 * @returns `true` once {@link settleVisitorIdentity} ran.
 */
export function isVisitorIdentitySettled(): boolean {
    return settled;
}

/** Input of {@link waitForVisitorIdentity}. */
export interface WaitForVisitorIdentityInput {
    /** Called exactly once: when the identity settles or the wait times out. */
    readonly onSettled: () => void;
    /** Maximum wait in ms. Defaults to {@link FIRST_PAGEVIEW_IDENTITY_TIMEOUT_MS}. */
    readonly timeoutMs?: number;
}

/** Result of {@link waitForVisitorIdentity}. */
export interface WaitForVisitorIdentityResult {
    /** Drops the wait without calling `onSettled`. A no-op once it ran. */
    readonly cancel: () => void;
}

/**
 * Runs `onSettled` once the visitor identity is settled: synchronously when it
 * already is, otherwise on settlement or after `timeoutMs`, whichever comes
 * first. Never leaves a timer behind.
 *
 * @param input - Callback and optional timeout.
 * @returns A handle to cancel the pending wait.
 */
export function waitForVisitorIdentity({
    onSettled,
    timeoutMs = FIRST_PAGEVIEW_IDENTITY_TIMEOUT_MS
}: WaitForVisitorIdentityInput): WaitForVisitorIdentityResult {
    if (settled) {
        onSettled();
        return { cancel: () => undefined };
    }

    let done = false;
    const finish = (): void => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        listeners.delete(finish);
        onSettled();
    };
    const timer = setTimeout(finish, timeoutMs);
    listeners.add(finish);

    return {
        cancel: () => {
            done = true;
            clearTimeout(timer);
            listeners.delete(finish);
        }
    };
}

/**
 * TEST-ONLY: re-arms the gate so each test starts as a fresh document. Never
 * called in production (a document settles once).
 */
export function resetVisitorIdentityGate(): void {
    settled = false;
    listeners.clear();
}
