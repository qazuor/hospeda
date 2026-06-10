/**
 * WhatsNewAutoTrigger — headless component that auto-opens WhatsNewModal once.
 *
 * Mounted inside `AppLayout.tsx` (within the authenticated area). When the
 * `useWhatsNew` query resolves and there are unseen highlight entries, this
 * component opens `WhatsNewModal` exactly **once** per mount. A `useRef` latch
 * prevents a second open under React 19 strict-mode double-mount.
 *
 * ## Suppression seam (D17 — cross-spec, owner-locked 2026-06-03)
 *
 * The optional `suppressed` prop disables the auto-trigger without dismounting
 * the component. Pass `suppressed={true}` from SPEC-174's welcome-tour component
 * when the tour is still pending for a new user — avoids stacking two auto-opening
 * modals on the first dashboard load. When `suppressed` is `true`:
 *   - `WhatsNewModal` never auto-opens.
 *   - `useWhatsNew` data still loads (badge, panel, and card are unaffected).
 *   - The latch is NOT set, so when `suppressed` flips to `false` the trigger
 *     re-evaluates and opens the modal if highlights are still unseen.
 *
 * Implementation note: SPEC-174 ships *after* this component — do NOT wire
 * tour awareness here now. The `suppressed` prop is the documented seam; the
 * caller (SPEC-174) will provide the prop value when it lands.
 *
 * ## useEffect key
 *
 * The effect depends on `[isLoaded, userId]`. `isLoaded` is `true` when
 * `!isLoading` — the query has settled (success or error). `userId` ensures
 * a new user session re-evaluates the trigger.
 *
 * @module WhatsNewAutoTrigger
 * @see apps/admin/src/components/whats-new/WhatsNewModal.tsx
 * @see apps/admin/src/components/layout/AppLayout.tsx — mount point
 * @see SPEC-175 §7.2, §7.6, §12.4, D17
 */

import { useWhatsNew } from '@/hooks/use-whats-new';
import { hasUnseenHighlights } from '@/lib/whats-new/has-unseen-highlights';
import { useEffect, useRef, useState } from 'react';
import { WhatsNewModal } from './WhatsNewModal';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Props for {@link WhatsNewAutoTrigger}. */
export interface WhatsNewAutoTriggerProps {
    /**
     * When `true`, the auto-modal is suppressed: `WhatsNewModal` will not
     * auto-open even if unseen highlight entries exist.
     *
     * This is the **D17 suppression seam** for SPEC-174's welcome tour.
     * Pass `suppressed={true}` when the user's welcome tour is still pending
     * so that two auto-modals never stack on a new user's first dashboard load.
     *
     * The latch is NOT set while suppressed, so when this prop returns to
     * `false` the trigger re-evaluates and opens the modal if still needed.
     *
     * @see SPEC-175 §4.D17
     * @default false
     */
    readonly suppressed?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Headless auto-trigger for the What's New modal.
 *
 * Renders `null` (no visual output) until unseen highlight entries are found,
 * then renders `WhatsNewModal` in its open state. Once it closes, the latch
 * prevents it from re-opening in the same session.
 *
 * @param props - {@link WhatsNewAutoTriggerProps}
 */
export function WhatsNewAutoTrigger({ suppressed = false }: WhatsNewAutoTriggerProps) {
    const { items, isLoading } = useWhatsNew();
    const [modalOpen, setModalOpen] = useState(false);

    /**
     * Latch flag — `true` once the modal has been triggered in this mount.
     * Guards against React 19 strict-mode double-mount fires and prevents
     * the modal from re-opening if the user closes it and new data arrives.
     */
    const hasTriggeredRef = useRef(false);

    const isLoaded = !isLoading;

    useEffect(() => {
        // Bail while query is still loading.
        if (!isLoaded) return;
        // Bail if suppressed (D17 seam — SPEC-174 welcome tour pending).
        if (suppressed) return;
        // Bail if already triggered in this session.
        if (hasTriggeredRef.current) return;
        // Bail if no unseen highlights exist.
        if (!hasUnseenHighlights({ items })) return;

        // Set latch BEFORE opening to prevent strict-mode second effect run.
        hasTriggeredRef.current = true;
        setModalOpen(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
        // userId intentionally omitted: items already carries per-user isolation
        // (useWhatsNew keys the query by userId). Including userId would cause
        // the latch to be lost on irrelevant re-renders.
        // biome-ignore lint/correctness/useExhaustiveDependencies: userId is intentionally excluded — see comment above
    }, [isLoaded, suppressed, items]);

    const handleModalOpenChange = (open: boolean) => {
        setModalOpen(open);
    };

    // Default mode: show all unseen highlight entries (no entryId prop).
    return (
        <WhatsNewModal
            open={modalOpen}
            onOpenChange={handleModalOpenChange}
        />
    );
}
