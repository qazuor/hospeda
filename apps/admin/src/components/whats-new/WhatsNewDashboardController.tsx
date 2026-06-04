/**
 * WhatsNewDashboardController — wires What's New modal/panel into dashboard widgets.
 *
 * This headless controller registers the `'whats-new-panel'` footer action handler
 * and the `'whats-new-entry'` per-item action handler in the
 * {@link WidgetActionHandlersContext}, allowing the "Últimas novedades" `ListWidget`
 * on any dashboard to open the panel or the modal without holding those callbacks
 * in its serializable config.
 *
 * ## Mounting
 *
 * Mount this component inside `AppLayout.tsx` (inside the authed guard area), below
 * the `WidgetActionHandlersProvider`. It must be mounted ONCE to avoid registering
 * duplicate handlers.
 *
 * ## State ownership
 *
 * The panel and modal states are local to this controller. The `WhatsNewAutoTrigger`
 * owns its own modal instance for the auto-open flow (unseen highlights). The two
 * never fight because:
 * - `WhatsNewAutoTrigger`'s modal is controlled by a separate `useState`.
 * - This controller's modal is controlled by the `selectedEntryId` state here.
 *
 * @module WhatsNewDashboardController
 * @see apps/admin/src/components/layout/AppLayout.tsx — mount point
 * @see apps/admin/src/contexts/widget-action-handlers-context.tsx — handler registry
 * @see SPEC-175 T-017
 */

import { useWidgetActionHandlers } from '@/contexts/widget-action-handlers-context';
import { useEffect, useState } from 'react';
import { WhatsNewModal } from './WhatsNewModal';
import { WhatsNewPanel } from './WhatsNewPanel';

/**
 * Headless controller that registers dashboard widget action handlers for
 * the What's New feature and mounts a dedicated panel + modal instance.
 *
 * Returns `null` — renders only the panel and modal (both return null when
 * closed) so there is no visible DOM output until the user triggers an action.
 *
 * @example
 * ```tsx
 * // AppLayout.tsx — inside WidgetActionHandlersProvider:
 * <WhatsNewDashboardController />
 * ```
 */
export function WhatsNewDashboardController() {
    const [panelOpen, setPanelOpen] = useState(false);
    const [selectedEntryId, setSelectedEntryId] = useState<string | undefined>(undefined);
    const [modalOpen, setModalOpen] = useState(false);

    const { registerHandlers } = useWidgetActionHandlers();

    // Register handlers once on mount. The handlers close over the local state
    // setters, so the panel and modal react to widget interactions correctly.
    useEffect(() => {
        registerHandlers({
            footerHandlers: {
                'whats-new-panel': () => setPanelOpen(true)
            },
            itemHandlers: {
                'whats-new-entry': (item) => {
                    setSelectedEntryId(item.id);
                    setModalOpen(true);
                }
            }
        });
        // deps: [registerHandlers] — stable useCallback, registers once on mount.
    }, [registerHandlers]);

    return (
        <>
            {/* Panel: opened by footer 'Ver todas' link. */}
            <WhatsNewPanel
                open={panelOpen}
                onOpenChange={setPanelOpen}
            />

            {/* Modal: opened by per-item 'Ver' button. */}
            <WhatsNewModal
                open={modalOpen}
                onOpenChange={(open) => {
                    setModalOpen(open);
                    if (!open) setSelectedEntryId(undefined);
                }}
                entryId={selectedEntryId}
            />
        </>
    );
}
