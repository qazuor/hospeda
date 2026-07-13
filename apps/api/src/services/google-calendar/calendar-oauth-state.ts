/**
 * Google Calendar OAuth CSRF state store (HOS-157 Phase 2 — Layer 4).
 *
 * Short-lived, in-memory, one-time-use `state` tokens for the per-accommodation
 * Google Calendar connect flow. Mirrors the MercadoLibre OAuth state store
 * (`routes/integrations/mercadolibre-oauth/authorize.ts`) with one difference:
 * each entry also carries the `accommodationId` being connected and the
 * `userId` that initiated the flow, so the callback (a fixed redirect URI with
 * no `:id` path segment) can recover which accommodation to attach the tokens
 * to and re-verify the returning session is the same user.
 *
 * The `accommodationId`/`userId` live SERVER-SIDE in the entry (keyed by an
 * unguessable random token), never encoded into the `state` string that
 * travels through Google — so a tampered `state` cannot redirect the
 * connection at a different accommodation.
 *
 * **Scope**: process-local, single-instance. Matching the ML precedent, this
 * is acceptable for a browser-redirect flow completed within
 * {@link STATE_TTL_MS}; a multi-replica deployment would drop a state whose
 * connect and callback legs land on different instances (the host simply
 * retries connect). A distributed store is explicitly out of scope for Phase 2.
 *
 * @module services/google-calendar/calendar-oauth-state
 */

import { randomBytes } from 'node:crypto';

/** How long a generated `state` token stays valid before it expires. */
const STATE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** A pending (not-yet-consumed) calendar OAuth state entry. */
interface PendingCalendarOAuthState {
    /** The accommodation the connect flow is attaching a calendar to. */
    readonly accommodationId: string;
    /** The user id that initiated the connect flow (re-verified on callback). */
    readonly userId: string;
    /** Epoch ms the state was generated at. */
    readonly createdAt: number;
}

/** The data recovered from a validated `state` on the OAuth callback. */
export interface ConsumedCalendarOAuthState {
    readonly accommodationId: string;
    readonly userId: string;
}

/**
 * Module-level store for short-lived calendar OAuth CSRF state tokens. Entries
 * live at most {@link STATE_TTL_MS} and are swept on every access.
 */
const pendingStates = new Map<string, PendingCalendarOAuthState>();

/**
 * Removes expired entries. Called on every read/write so the map never grows
 * unbounded and never returns stale state.
 */
const sweepExpiredStates = (): void => {
    const now = Date.now();
    for (const [token, entry] of pendingStates) {
        if (now - entry.createdAt > STATE_TTL_MS) {
            pendingStates.delete(token);
        }
    }
};

/**
 * Generates an unguessable one-time `state` token bound to the accommodation +
 * user starting the connect flow.
 *
 * @param params.accommodationId - The accommodation being connected.
 * @param params.userId - The user initiating the flow.
 * @returns A 64-character hex `state` value to pass to Google.
 */
export const generateCalendarOAuthState = (params: {
    accommodationId: string;
    userId: string;
}): string => {
    sweepExpiredStates();
    const token = randomBytes(32).toString('hex');
    pendingStates.set(token, {
        accommodationId: params.accommodationId,
        userId: params.userId,
        createdAt: Date.now()
    });
    return token;
};

/**
 * Validates a `state` echoed back by Google and consumes it (one-time use — a
 * state can never be replayed). Also sweeps expired entries as a side effect.
 *
 * @param token - The `state` query param received on the callback.
 * @returns The bound `{ accommodationId, userId }` when the state is known and
 * not expired (consuming it), or `null` otherwise.
 */
export const validateAndConsumeCalendarOAuthState = (
    token: string
): ConsumedCalendarOAuthState | null => {
    sweepExpiredStates();
    const entry = pendingStates.get(token);
    if (!entry) {
        return null;
    }
    pendingStates.delete(token);
    return { accommodationId: entry.accommodationId, userId: entry.userId };
};
