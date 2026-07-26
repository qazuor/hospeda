/**
 * @file useDialogHistoryBack.ts
 * @description React binding for the modal back-button integration (HOS-310).
 *
 * @module hooks/useDialogHistoryBack
 */

import { useEffect, useRef, useState } from 'react';
import { acquireDialogHistoryEntry } from '@/lib/dialog-history';

interface UseDialogHistoryBackParams {
    /** Whether the modal surface is currently open. */
    readonly isOpen: boolean;
    /** Close handler, invoked when the user presses the system back button. */
    readonly onClose: () => void;
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
export function useDialogHistoryBack({ isOpen, onClose }: UseDialogHistoryBackParams): void {
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

    // biome-ignore lint/correctness/useExhaustiveDependencies: `claimToken` is a re-run trigger, not a value the effect reads — see the comment above.
    useEffect(() => {
        if (!isOpen) return;
        const { release } = acquireDialogHistoryEntry({
            onPopped: () => {
                onCloseRef.current();
                setClaimToken((token) => token + 1);
            }
        });
        return release;
    }, [isOpen, claimToken]);
}
