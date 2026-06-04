/**
 * WhatsNewModal — shadcn Dialog for rendering What's New entries.
 *
 * Two modes:
 *  (a) Default (no `entryId` prop): shows ALL unseen highlight entries from
 *      `useWhatsNew().items` in a single scrollable list.
 *  (b) Single-entry mode (`entryId` prop): shows only the entry matching that id,
 *      regardless of `seen` or `highlight` status — used by the panel and card
 *      to display a specific entry on demand.
 *
 * On close (button OR ESC) the ids of displayed entries are sent to `markSeen`.
 *
 * ## Markdown rendering (AC-13)
 *
 * Delegated to `lib/whats-new/render-markdown.ts` which uses a headless TipTap
 * `Editor` + `getHTML()` + DOMPurify. Isolated in its own module so tests can
 * mock it without requiring `@tiptap/core` (a transitive dep that vitest cannot
 * resolve in this worktree without an explicit alias in vitest.config.ts).
 *
 * PostHog events:
 *  - `admin.whats_new.modal.shown` on open ({ entryIds, role })
 *  - `admin.whats_new.modal.closed` on close ({ entryIds })
 *
 * Accessibility: Radix Dialog provides focus trap + ESC handling.
 * `aria-labelledby` is wired to `DialogTitle`.
 *
 * @module WhatsNewModal
 * @see apps/admin/src/lib/whats-new/render-markdown.ts — markdown renderer
 * @see apps/admin/src/hooks/use-whats-new.ts — data source
 * @see SPEC-175 §7.2, §12.4, AC-13
 */

import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useTranslations } from '@/hooks/use-translations';
import { useWhatsNew } from '@/hooks/use-whats-new';
import { trackEvent } from '@/lib/analytics/posthog-client';
import { renderMarkdownToHtml } from '@/lib/whats-new/render-markdown';
import type { TranslationKey } from '@repo/i18n';
import type { WhatsNewItem } from '@repo/schemas';
import { useCallback, useEffect, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Props for {@link WhatsNewModal}. */
export interface WhatsNewModalProps {
    /** Whether the dialog is open. Controlled by the parent. */
    readonly open: boolean;
    /** Called when the open state should change (close or open requests from Radix). */
    readonly onOpenChange: (open: boolean) => void;
    /**
     * When provided, the modal shows only the entry with this id (single-entry
     * mode). Used by the panel and card to display a specific entry on demand.
     * When absent, the modal shows all unseen highlight entries.
     */
    readonly entryId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Modal dialog for displaying What's New entries.
 *
 * In default mode it shows all unseen highlight entries (auto-trigger use case).
 * In `entryId` mode it shows a single specific entry (panel/card click use case).
 *
 * Calls `markSeen(displayedIds)` on close in both modes.
 *
 * @param props - {@link WhatsNewModalProps}
 */
export function WhatsNewModal({ open, onOpenChange, entryId }: WhatsNewModalProps) {
    const { t } = useTranslations();
    const { user } = useAuthContext();
    const { items, markSeen } = useWhatsNew();

    // Derive the list of entries to display based on mode.
    const displayedEntries = useMemo<readonly WhatsNewItem[]>(() => {
        if (entryId) {
            // Single-entry mode: find by id regardless of seen/highlight.
            const found = items.find((item) => item.id === entryId);
            return found ? [found] : [];
        }
        // Default mode: all unseen highlight entries.
        return items.filter((item) => item.highlight && !item.seen);
    }, [items, entryId]);

    const displayedIds = useMemo(() => displayedEntries.map((e) => e.id), [displayedEntries]);

    // Track modal shown event when it opens with entries.
    useEffect(() => {
        if (open && displayedIds.length > 0) {
            trackEvent('admin.whats_new.modal.shown', {
                entryIds: displayedIds,
                role: user?.role
            });
        }
    }, [open, displayedIds, user?.role]);

    // Handle close: mark shown entries as seen + fire analytics.
    const handleClose = useCallback(() => {
        if (displayedIds.length > 0) {
            markSeen(displayedIds);
            trackEvent('admin.whats_new.modal.closed', { entryIds: displayedIds });
        }
        onOpenChange(false);
    }, [displayedIds, markSeen, onOpenChange]);

    // Wire Radix onOpenChange so ESC also triggers markSeen.
    const handleOpenChange = useCallback(
        (nextOpen: boolean) => {
            if (nextOpen) {
                onOpenChange(true);
            } else {
                handleClose();
            }
        },
        [handleClose, onOpenChange]
    );

    return (
        <Dialog
            open={open}
            onOpenChange={handleOpenChange}
        >
            <DialogContent
                className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg"
                showCloseButton={false}
                aria-labelledby="whats-new-modal-title"
            >
                {/* Header */}
                <DialogHeader className="border-border border-b px-6 py-4">
                    <DialogTitle
                        id="whats-new-modal-title"
                        className="font-semibold text-lg"
                    >
                        {t('admin-whats-new.modal.title' as TranslationKey)}
                    </DialogTitle>
                </DialogHeader>

                {/* Scrollable entry list */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {displayedEntries.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                            {t('admin-whats-new.panel.empty' as TranslationKey)}
                        </p>
                    ) : (
                        <ul
                            className="space-y-6"
                            aria-label={t('admin-whats-new.modal.title' as TranslationKey)}
                        >
                            {displayedEntries.map((entry) => (
                                <WhatsNewEntryItem
                                    key={entry.id}
                                    entry={entry}
                                />
                            ))}
                        </ul>
                    )}
                </div>

                {/* Footer — "Entendido" primary button */}
                <DialogFooter className="border-border border-t px-6 py-4">
                    <button
                        type="button"
                        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={handleClose}
                    >
                        {t('admin-whats-new.modal.close' as TranslationKey)}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Entry item sub-component
// ---------------------------------------------------------------------------

/** Props for {@link WhatsNewEntryItem}. */
interface WhatsNewEntryItemProps {
    readonly entry: WhatsNewItem;
}

/**
 * Renders a single What's New entry: optional image, title, and sanitised
 * markdown body (AC-13).
 */
function WhatsNewEntryItem({ entry }: WhatsNewEntryItemProps) {
    const bodyHtml = useMemo(() => renderMarkdownToHtml(entry.body), [entry.body]);

    return (
        <li className="flex flex-col gap-3">
            {/* Optional image */}
            {entry.image && (
                <img
                    src={entry.image}
                    alt=""
                    aria-hidden="true"
                    className="h-40 w-full rounded-md object-cover"
                    loading="lazy"
                />
            )}

            {/* Entry title */}
            <h3 className="font-semibold text-base">{entry.title}</h3>

            {/* Markdown body rendered via TipTap + DOMPurify (AC-13) */}
            {/*
             * Security: content was produced by `renderMarkdownToHtml` above,
             * which applies two sanitisation layers:
             *   1. TipTap StarterKit schema allowlist (no script/iframe in output).
             *   2. DOMPurify with an explicit ALLOWED_TAGS allowlist.
             * The markdown source itself is curator-authored and stored in the
             * repo (not user-supplied), but we sanitise defensively regardless.
             */}
            <div
                className="prose prose-sm max-w-none text-muted-foreground [&_a]:text-primary [&_a]:underline"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised by TipTap StarterKit allowlist + DOMPurify (see renderMarkdownToHtml above and AC-13)
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
        </li>
    );
}
