/**
 * WhatsNewPanel — shadcn Sheet (right, modal) listing all applicable What's New entries.
 *
 * Features (SPEC-175 §7.4):
 * - Header: panel title + "Marcar todo como leído" button (disabled when unseenCount===0).
 * - Entry list: newest-first (server already sorts — trust the order, never re-sort).
 *   Unseen entries: bold title + accent dot. Seen entries: muted styling.
 * - Row click: opens WhatsNewModal for that specific entry (entryId mode).
 * - Empty state: i18n key `admin-whats-new.panel.empty`.
 * - PostHog: `admin.whats_new.panel.opened` on open ({ unseenCount, role }).
 *
 * Open state decision: WhatsNewPanel owns the modal state for the entry it opens.
 * The panel itself is controlled via `open` / `onOpenChange` props supplied by
 * `WhatsNewBadge` (which also owns the panel open state). This keeps state local
 * to the badge-panel-modal composition and avoids global state. See WhatsNewBadge.
 *
 * @module WhatsNewPanel
 * @see apps/admin/src/components/whats-new/WhatsNewModal.tsx — entry detail modal
 * @see apps/admin/src/hooks/use-whats-new.ts — data source
 * @see SPEC-175 §7.4, §12.4
 */

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useTranslations } from '@/hooks/use-translations';
import { useWhatsNew } from '@/hooks/use-whats-new';
import { trackEvent } from '@/lib/analytics/posthog-client';
import type { TranslationKey } from '@repo/i18n';
import type { WhatsNewItem } from '@repo/schemas';
import { useCallback, useEffect, useState } from 'react';
import { WhatsNewModal } from './WhatsNewModal';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Props for {@link WhatsNewPanel}. */
export interface WhatsNewPanelProps {
    /** Whether the Sheet panel is open. Controlled by the parent (WhatsNewBadge). */
    readonly open: boolean;
    /** Called when the open state should change. */
    readonly onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Side panel (Sheet, right, modal) listing all What's New entries.
 *
 * Opens a WhatsNewModal in single-entry mode when a row is clicked.
 * "Marcar todo como leído" calls `markAllSeen()` from `useWhatsNew`.
 *
 * @param props - {@link WhatsNewPanelProps}
 */
export function WhatsNewPanel({ open, onOpenChange }: WhatsNewPanelProps) {
    const { t } = useTranslations();
    const { user } = useAuthContext();
    const { items, unseenCount, markAllSeen } = useWhatsNew();

    // Track which entry is open in the inner modal (null = modal closed).
    const [modalEntryId, setModalEntryId] = useState<string | null>(null);

    // Fire PostHog event when panel opens.
    useEffect(() => {
        if (open) {
            trackEvent('admin.whats_new.panel.opened', {
                unseenCount,
                role: user?.role
            });
        }
    }, [open, unseenCount, user?.role]);

    const handleMarkAllRead = useCallback(() => {
        markAllSeen();
    }, [markAllSeen]);

    const handleRowClick = useCallback((entryId: string) => {
        setModalEntryId(entryId);
    }, []);

    const handleModalOpenChange = useCallback((nextOpen: boolean) => {
        if (!nextOpen) {
            setModalEntryId(null);
        }
    }, []);

    return (
        <>
            <Sheet
                open={open}
                onOpenChange={onOpenChange}
            >
                <SheetContent
                    side="right"
                    showCloseButton
                    className="flex flex-col gap-0 p-0"
                    aria-labelledby="whats-new-panel-title"
                >
                    {/* Header */}
                    <SheetHeader className="border-border border-b px-6 py-4">
                        <div className="flex items-center justify-between gap-2">
                            <SheetTitle
                                id="whats-new-panel-title"
                                className="font-semibold text-lg"
                            >
                                {t('admin-whats-new.panel.title' as TranslationKey)}
                            </SheetTitle>

                            {/* Mark all as read */}
                            <button
                                type="button"
                                disabled={unseenCount === 0}
                                className="shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
                                onClick={handleMarkAllRead}
                            >
                                {t('admin-whats-new.panel.markAllRead' as TranslationKey)}
                            </button>
                        </div>
                    </SheetHeader>

                    {/* Entry list or empty state */}
                    <div className="flex-1 overflow-y-auto">
                        {items.length === 0 ? (
                            <p className="px-6 py-8 text-center text-muted-foreground text-sm">
                                {t('admin-whats-new.panel.empty' as TranslationKey)}
                            </p>
                        ) : (
                            <ul
                                className="divide-y divide-border"
                                aria-label={t('admin-whats-new.panel.title' as TranslationKey)}
                            >
                                {items.map((item) => (
                                    <WhatsNewPanelRow
                                        key={item.id}
                                        item={item}
                                        onRowClick={handleRowClick}
                                    />
                                ))}
                            </ul>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Inner modal for single-entry view */}
            {modalEntryId !== null && (
                <WhatsNewModal
                    open={modalEntryId !== null}
                    onOpenChange={handleModalOpenChange}
                    entryId={modalEntryId}
                />
            )}
        </>
    );
}

// ---------------------------------------------------------------------------
// Panel row sub-component
// ---------------------------------------------------------------------------

/** Props for {@link WhatsNewPanelRow}. */
interface WhatsNewPanelRowProps {
    readonly item: WhatsNewItem;
    readonly onRowClick: (entryId: string) => void;
}

/**
 * A single row in the panel entry list.
 *
 * Unseen: bold title + accent dot indicator.
 * Seen: muted styling.
 * Clicking opens the detail modal.
 */
function WhatsNewPanelRow({ item, onRowClick }: WhatsNewPanelRowProps) {
    const { t } = useTranslations();

    const publishedDate = new Date(item.publishedAt).toLocaleDateString('es-AR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    return (
        <li>
            <button
                type="button"
                className="group flex w-full items-start gap-3 px-6 py-4 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                onClick={() => onRowClick(item.id)}
                aria-label={`${item.title} — ${t('admin-whats-new.panel.seeEntry' as TranslationKey)}`}
            >
                {/* Unseen accent dot */}
                <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full transition-colors ${
                        item.seen ? 'bg-transparent' : 'bg-primary'
                    }`}
                />

                <div className="min-w-0 flex-1">
                    {/* Title: bold when unseen, muted when seen */}
                    <p
                        className={`truncate text-sm ${
                            item.seen
                                ? 'font-normal text-muted-foreground'
                                : 'font-semibold text-foreground'
                        }`}
                    >
                        {item.title}
                    </p>

                    {/* Published date */}
                    <p className="mt-0.5 text-muted-foreground text-xs">{publishedDate}</p>

                    {/* "Ver" label */}
                    <p className="mt-1 font-medium text-primary text-xs opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                        {t('admin-whats-new.panel.seeEntry' as TranslationKey)}
                    </p>
                </div>

                {/* Unseen / seen status badge */}
                {!item.seen && (
                    <span className="mt-0.5 shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
                        {t('admin-whats-new.status.new' as TranslationKey)}
                    </span>
                )}
            </button>
        </li>
    );
}
