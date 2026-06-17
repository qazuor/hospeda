/**
 * @file use-push-registration.ts
 * @description React hook that triggers push token registration once per
 * authenticated session.
 *
 * ## Design
 * The hook runs `registerPushToken()` in a `useEffect` when `enabled` becomes
 * `true` (i.e. the user has an active session). A `useRef` guard ensures the
 * registration call is made AT MOST ONCE per app lifecycle — even if the
 * component re-renders multiple times with `enabled: true`, the effect fires
 * only on the first transition.
 *
 * When `enabled` is `false` (unauthenticated) the hook is a no-op. This
 * matches the session gate in `_layout.tsx`: registration only makes sense
 * for authenticated users because the API endpoint is protected.
 *
 * ## Error handling
 * `registerPushToken` is guaranteed to never throw (see its contract in
 * `push-notifications.ts`). The hook surfaces nothing to the caller —
 * registration is fire-and-forget; the app should not block on it.
 *
 * @module push/use-push-registration
 */

import { useEffect, useRef } from 'react';
import { registerPushToken } from './push-notifications';

/**
 * Triggers push token registration once when the user is authenticated.
 *
 * Call this hook in the root layout after the session is resolved. Pass
 * `enabled = true` only when a valid session is present.
 *
 * The registration runs in a background effect — it does not block navigation
 * or rendering. Failures are logged but never propagated.
 *
 * @param enabled - `true` when the user has an active session; `false` otherwise.
 *
 * @example
 * ```tsx
 * // In _layout.tsx
 * const { data, isPending } = useSession();
 * const hasSession = !isPending && data !== null && data !== undefined;
 * usePushRegistration(hasSession);
 * ```
 */
export function usePushRegistration(enabled: boolean): void {
    // Ref guard: prevents re-registration on subsequent renders after the first
    // successful trigger. Once flipped to `true`, it stays `true` for the
    // lifetime of the component (i.e. the app session).
    const hasRegistered = useRef(false);

    useEffect(() => {
        // No-op while unauthenticated or already registered this session.
        if (!enabled || hasRegistered.current) return;

        // Mark as attempted immediately so concurrent renders cannot race.
        hasRegistered.current = true;

        // Fire-and-forget — registerPushToken never throws.
        void registerPushToken();
    }, [enabled]);
}
