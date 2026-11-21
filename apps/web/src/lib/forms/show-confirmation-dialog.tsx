/**
 * @file show-confirmation-dialog.tsx
 * @description Imperative, product-styled replacement for `window.confirm()`
 * (HOS-783 B8). Mounts a throwaway React root, renders the kit `ConfirmDialog`
 * (HOS-2413: the single confirmation implementation) and resolves with the
 * user's choice.
 *
 * Three things here are load-bearing and easy to undo by accident:
 *
 * 1. **`claimHistoryEntry={false}`.** Every consumer of this helper navigates
 *    the instant it resolves `true`. A `Dialog` that claims a history entry
 *    releases it on unmount, and that release schedules a `history.go(-1)` in a
 *    microtask — which would run BEFORE the consumer's `.then()` and race the
 *    router. `apps/web/docs/dialog-history.md` names that race as a history
 *    stack corruptor. There is nothing to unwind if nothing was claimed.
 * 2. **The unmount is deferred.** `root.unmount()` called straight out of the
 *    button's `onClick` is a synchronous unmount from inside React's own work
 *    loop; React may warn and defer it past the `container.remove()` below,
 *    leaving the scroll lock on `<html>`/`<body>` in place with no dialog to
 *    remove it.
 * 3. **The mount has a fallback.** If the `react-dom/client` chunk never
 *    arrives, the promise would never settle and the caller's guard would
 *    swallow every subsequent link click in silence. Degrading to the native
 *    confirm keeps the user asked. That single `window.confirm()` below is the
 *    ONE native dialog left in `apps/web`, and it is the reason
 *    `scripts/check-no-native-dialogs.ts` (HOS-957) carries an exemption for
 *    this file: the last-resort fallback of the thing that replaces the native
 *    dialog cannot itself be replaced by it. The exemption is count-pinned at
 *    exactly one, so a second call here fails CI just like a call anywhere else.
 *
 * @module lib/forms/show-confirmation-dialog
 */

import { ConfirmDialog } from '@/components/account/ui/ConfirmDialog';
import type { SupportedLocale } from '@/lib/i18n';

/** Options accepted by {@link showConfirmationDialog}. */
export interface ConfirmationDialogOptions {
    /** Body copy explaining what is about to be lost. */
    readonly message: string;
    /** Dialog title. */
    readonly title: string;
    /** Label of the destructive CTA. */
    readonly confirmLabel: string;
    /** Label of the dismissing CTA. */
    readonly cancelLabel: string;
    /** Locale for the dialog's own fixed copy (error text). @default 'es' */
    readonly locale?: SupportedLocale;
}

/**
 * Shows a product-styled confirmation dialog and resolves with the user's
 * choice.
 *
 * @param options - Localized copy for the dialog (see {@link ConfirmationDialogOptions}).
 * @returns `true` when the user confirmed, `false` on cancel, Escape, overlay
 * click, or when there is no DOM to render into.
 *
 * @example
 * ```ts
 * const confirmed = await showConfirmationDialog({
 *     message: t('common.confirmations.unsavedChanges.message'),
 *     title: t('common.confirmations.unsavedChanges.title'),
 *     confirmLabel: t('common.confirmations.unsavedChanges.confirm'),
 *     cancelLabel: t('common.confirmations.unsavedChanges.cancel')
 * });
 * ```
 */
export function showConfirmationDialog({
    message,
    title,
    confirmLabel,
    cancelLabel,
    locale = 'es'
}: ConfirmationDialogOptions): Promise<boolean> {
    if (typeof document === 'undefined') {
        return Promise.resolve(false);
    }

    return new Promise<boolean>((resolve) => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        let settled = false;

        async function mountDialog(): Promise<void> {
            const { createRoot } = await import('react-dom/client');
            const root = createRoot(container);

            function finish(result: boolean): void {
                if (settled) return;
                settled = true;

                // Hand the answer to the caller first, then tear down out of
                // band. See note 2 in the file header.
                resolve(result);
                queueMicrotask(() => {
                    root.unmount();
                    container.remove();
                });
            }

            // HOS-2413 (owner decision): the confirmation UI is the kit's
            // `ConfirmDialog`, so there is ONE visual and behavioral
            // implementation. It never claims a history entry and focuses
            // Cancel first, which is what a leave warning needs.
            root.render(
                <ConfirmDialog
                    open
                    title={title}
                    description={message}
                    confirmLabel={confirmLabel}
                    cancelLabel={cancelLabel}
                    locale={locale}
                    onConfirm={() => finish(true)}
                    onCancel={() => finish(false)}
                />
            );
        }

        void mountDialog().catch(() => {
            if (settled) return;
            settled = true;
            container.remove();
            // Worse-looking than the styled dialog, but the alternative is a
            // promise that never settles and a guard that silently eats every
            // link click from here on.
            resolve(window.confirm(message));
        });
    });
}
