/**
 * @file useIsTopmostOverlay.ts
 * @description Arbitrates which of several simultaneously-open modal-like
 * surfaces is topmost (HOS-350), for Escape-to-close purposes.
 *
 * Deliberately independent of the browser-history back-button integration in
 * `@/lib/dialog-history` (`stack`, `useDialogHistoryBack`). That stack only
 * ever holds surfaces that successfully claim a history entry, and some
 * never can: the mobile filters drawer (`MobileDrawer.tsx`) opens over a
 * listing page that rewrites its own URL on every filter tap, which buries
 * any entry the drawer might claim, regardless of whether `<ClientRouter />`
 * is even present on the page. This hook reads a separate presence-only
 * registry (`registerOpenOverlay` / `getTopOpenOverlayId`) so a surface can
 * be arbitrated for Escape without ever participating in history claiming.
 *
 * `useDialogHistoryBack` itself is built on top of this hook, so every
 * surface that uses either one shares the exact same "who is on top"
 * answer — there is only one registry, never two competing sources of truth.
 *
 * @module hooks/useIsTopmostOverlay
 */

import { useEffect, useRef, useState } from 'react';
import {
    getTopOpenOverlayId,
    registerOpenOverlay,
    subscribeToOpenOverlays
} from '@/lib/dialog-history';

interface UseIsTopmostOverlayParams {
    /** Whether the modal-like surface is currently open. */
    readonly isOpen: boolean;
}

/**
 * Whether THIS surface is the topmost currently-open modal-like surface, per
 * the shared open-overlays registry (HOS-350). Consumers gate their own
 * Escape-to-close on this so that when two overlays are stacked (e.g. the
 * feedback modal opened via Ctrl+Shift+F over an already-open drawer), only
 * the outer one closes on a single Escape press instead of both firing at
 * once.
 *
 * Defaults to `true` while `isOpen` is `false` or the registration effect has
 * not run yet — a surface with no registration of its own cannot be
 * arbitrated, and silently muting Escape for it would be worse than the bug
 * this exists to fix. See `dialog-history.ts`'s own "fail-safe, not
 * fail-broken" stance.
 *
 * @example
 * ```tsx
 * const isTopmost = useIsTopmostOverlay({ isOpen });
 * // ...
 * if (event.key === 'Escape' && isTopmost) onClose();
 * ```
 */
export function useIsTopmostOverlay({ isOpen }: UseIsTopmostOverlayParams): boolean {
    // This surface's own registration id, once registered — read by the
    // isTopmost effect below. A ref, not state: it is written and read
    // entirely inside effects (never during render), so it needs no
    // re-render of its own.
    const overlayIdRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        if (!isOpen) return;
        const handle = registerOpenOverlay();
        overlayIdRef.current = handle.id;
        return () => {
            overlayIdRef.current = undefined;
            handle.unregister();
        };
    }, [isOpen]);

    const computeIsTopmost = (): boolean => {
        const id = overlayIdRef.current;
        if (id === undefined) return true;
        return id === getTopOpenOverlayId();
    };

    const [isTopmost, setIsTopmost] = useState(computeIsTopmost);

    // Runs AFTER the registration effect above (declaration order), so
    // `overlayIdRef.current` already reflects this render's registration by
    // the time this reads it. Re-subscribes whenever `isOpen` changes so a
    // stale id from a previous registration is never compared against the
    // live registry.
    // biome-ignore lint/correctness/useExhaustiveDependencies: `computeIsTopmost` closes over the ref above, not over reactive state — see the comment above.
    useEffect(() => {
        setIsTopmost(computeIsTopmost());
        return subscribeToOpenOverlays(() => setIsTopmost(computeIsTopmost()));
    }, [isOpen]);

    return isTopmost;
}
