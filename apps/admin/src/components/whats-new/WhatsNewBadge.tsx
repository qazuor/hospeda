/**
 * WhatsNewBadge — topbar icon button with unseen-count pill for What's New.
 *
 * Renders a SparkleIcon button styled identically to the Notifications button
 * in the header (class `icon-river-header`). When `unseenCount > 0`, overlays
 * a count pill (red, `min-w-[1.25rem]`). Clicking opens WhatsNewPanel.
 *
 * ## Open-state decision
 *
 * Panel and modal open state lives here (inside `WhatsNewBadge`) rather than
 * in the Header or a global store. Rationale: the badge is the primary trigger
 * for both the panel AND the modal (panel → row click → modal). Colocating the
 * state keeps the composition self-contained and avoids prop drilling through
 * Header. This component owns both the panel Sheet and the entry modal, mounting
 * WhatsNewPanel which in turn mounts WhatsNewModal for individual entries.
 *
 * The only other modal trigger is `WhatsNewAutoTrigger` (auto-open on mount),
 * which maintains its own independent open state — the two are never in
 * conflict because auto-trigger fires once on mount and closes itself.
 *
 * @module WhatsNewBadge
 * @see apps/admin/src/components/whats-new/WhatsNewPanel.tsx
 * @see apps/admin/src/components/layout/header/Header.tsx — mount point
 * @see SPEC-175 §7.3, §12.4
 */

import { useTranslations } from '@/hooks/use-translations';
import { useWhatsNew } from '@/hooks/use-whats-new';
import type { TranslationKey } from '@repo/i18n';
import { SparkleIcon } from '@repo/icons';
import { useCallback, useState } from 'react';
import { WhatsNewPanel } from './WhatsNewPanel';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Topbar badge button for the What's New feature.
 *
 * Shows a SparkleIcon button. When there are unseen entries, a red count pill
 * is overlaid on the icon. Clicking opens the WhatsNewPanel Sheet.
 *
 * Consumes `useWhatsNew()` — the single source of truth for unseen count.
 * Does NOT accept unseen count as a prop to ensure it always reads from the
 * canonical hook (SPEC-175 §7.1 / D10).
 */
export function WhatsNewBadge() {
    const { t } = useTranslations();
    const { unseenCount } = useWhatsNew();
    const [panelOpen, setPanelOpen] = useState(false);

    const handleButtonClick = useCallback(() => {
        setPanelOpen(true);
    }, []);

    const handlePanelOpenChange = useCallback((open: boolean) => {
        setPanelOpen(open);
    }, []);

    // Aria label: interpolate count when > 0, use "none" label when 0.
    const ariaLabel =
        unseenCount > 0
            ? t('admin-whats-new.badge.label' as TranslationKey, { count: unseenCount })
            : t('admin-whats-new.badge.labelNone' as TranslationKey);

    return (
        <>
            <div className="relative inline-flex">
                <button
                    type="button"
                    aria-label={ariaLabel}
                    title={ariaLabel}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-white/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={handleButtonClick}
                >
                    <SparkleIcon className="icon-river-header h-5 w-5" />
                </button>

                {/* Count pill — only shown when there are unseen entries */}
                {unseenCount > 0 && (
                    <span
                        aria-hidden="true"
                        className="-right-1 -top-1 absolute flex min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1 py-px font-semibold text-[0.625rem] text-destructive-foreground leading-none"
                    >
                        {unseenCount > 99 ? '99+' : unseenCount}
                    </span>
                )}
            </div>

            {/* Panel — controlled by badge; mounts WhatsNewModal internally */}
            <WhatsNewPanel
                open={panelOpen}
                onOpenChange={handlePanelOpenChange}
            />
        </>
    );
}
