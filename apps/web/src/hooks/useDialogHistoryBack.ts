/**
 * @file useDialogHistoryBack.ts
 * @description React binding for the modal back-button integration (HOS-310).
 *
 * @module hooks/useDialogHistoryBack
 */

import { useEffect, useRef, useState } from 'react';
import {
    acquireDialogHistoryEntry,
    getTopDialogEntryId,
    subscribeToDialogStack
} from '@/lib/dialog-history';

interface UseDialogHistoryBackParams {
    /** Whether the modal surface is currently open. */
    readonly isOpen: boolean;
    /** Close handler, invoked when the user presses the system back button. */
    readonly onClose: () => void;
}

/** Return value of {@link useDialogHistoryBack}. */
export interface UseDialogHistoryBackResult {
    /**
     * Whether THIS surface is the topmost currently-open modal-like surface,
     * per the shared `dialog-history` stack (HOS-350). Consumers gate their
     * own Escape-to-close on this so that when two overlays are stacked
     * (e.g. the feedback modal opened via Ctrl+Shift+F over an already-open
     * drawer), only the outer one closes on a single Escape press instead of
     * both firing at once.
     *
     * Defaults to `true` when THIS surface has no claimed history entry
     * (transitions disabled, navigation in flight, a page/test with no
     * `<ClientRouter />`) — the stack cannot arbitrate anything for a surface
     * it does not know about, and silently muting Escape for it would be
     * worse than the bug this exists to fix. See `dialog-history.ts`'s own
     * "fail-safe, not fail-broken" stance.
     */
    readonly isTopmost: boolean;
}

/**
 * Closes a modal surface when the user presses the browser/system back button,
 * instead of letting the press navigate away from the page.
 *
 * Wire it into any surface that traps the user's attention (dialogs, drawers,
 * full-screen panels). Popovers and inline disclosures should not use it: they
 * are cheap to dismiss and hijacking the back gesture for them is worse than
 * the problem it solves.
 *
 * `onClose` may decline to close — several modals refuse while a mutation is
 * in flight. The history entry is already spent by then, so this hook claims a
 * fresh one whenever the surface is still open afterwards; without that, the
 * next back press would leave the page and the guard would have bought nothing.
 *
 * See `@/lib/dialog-history` for how the claimed entries avoid triggering a
 * full-document swap from Astro's `<ClientRouter />`.
 *
 * @example
 * ```tsx
 * useDialogHistoryBack({ isOpen, onClose: () => setIsOpen(false) });
 * ```
 */
export function useDialogHistoryBack({
    isOpen,
    onClose
}: UseDialogHistoryBackParams): UseDialogHistoryBackResult {
    // `onClose` is almost always an inline arrow at the call site. Reading it
    // through a ref keeps it out of the effect below: a new identity on every
    // render would otherwise release and re-claim a history entry on every
    // render, which the back button would then need N presses to unwind.
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    });

    // Bumped when the back gesture spends this surface's entry. If the
    // consumer closed, `isOpen` flips false and the effect stays idle; if it
    // declined, the bump is what re-runs the effect to claim a replacement.
    const [claimToken, setClaimToken] = useState(0);

    // This surface's own entry id, once claimed — read by the isTopmost
    // effect below. A ref, not state: it is written and read entirely inside
    // effects (never during render), so it needs no re-render of its own.
    const entryIdRef = useRef<number | undefined>(undefined);

    // biome-ignore lint/correctness/useExhaustiveDependencies: `claimToken` is a re-run trigger, not a value the effect reads — see the comment above.
    useEffect(() => {
        if (!isOpen) return;
        const { release, id } = acquireDialogHistoryEntry({
            onPopped: () => {
                onCloseRef.current();
                setClaimToken((token) => token + 1);
            }
        });
        entryIdRef.current = id;
        return () => {
            entryIdRef.current = undefined;
            release();
        };
    }, [isOpen, claimToken]);

    /**
     * See {@link UseDialogHistoryBackResult.isTopmost} for the fail-open
     * rule when this surface has no entry of its own.
     */
    const computeIsTopmost = (): boolean => {
        const id = entryIdRef.current;
        if (id === undefined) return true;
        return id === getTopDialogEntryId();
    };

    const [isTopmost, setIsTopmost] = useState(computeIsTopmost);

    // Runs AFTER the acquire effect above (declaration order), so
    // `entryIdRef.current` already reflects this render's claim by the time
    // this reads it. Re-subscribes whenever the claim itself changes
    // (`isOpen`/`claimToken`) so a stale id from a previous claim is never
    // compared against the live stack.
    // biome-ignore lint/correctness/useExhaustiveDependencies: `computeIsTopmost` closes over the ref above, not over reactive state — see the comment above.
    useEffect(() => {
        setIsTopmost(computeIsTopmost());
        return subscribeToDialogStack(() => setIsTopmost(computeIsTopmost()));
    }, [isOpen, claimToken]);

    return { isTopmost };
}
