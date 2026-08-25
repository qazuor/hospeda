/**
 * @file show-confirmation-dialog.tsx
 * @description Imperative, product-styled replacement for `window.confirm()`
 * (HOS-783 B8). Mounts a throwaway React root, renders the shared `Dialog`, and
 * resolves with the user's choice.
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
 *    confirm keeps the user asked.
 *
 * @module lib/forms/show-confirmation-dialog
 */

import {
    Dialog,
    DialogBody,
    DialogFooter,
    DialogHeader
} from '@/components/shared/ui/Dialog.client';
import styles from './show-confirmation-dialog.module.css';

const TITLE_ID = 'confirmation-dialog-title';

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
    cancelLabel
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

            root.render(
                <Dialog
                    isOpen={true}
                    onClose={() => finish(false)}
                    ariaLabelledBy={TITLE_ID}
                    size="sm"
                    claimHistoryEntry={false}
                >
                    <DialogHeader titleId={TITLE_ID}>{title}</DialogHeader>
                    <DialogBody>
                        <p className={styles.body}>{message}</p>
                    </DialogBody>
                    <DialogFooter>
                        <button
                            type="button"
                            className={styles.cancelButton}
                            onClick={() => finish(false)}
                        >
                            {cancelLabel}
                        </button>
                        <button
                            type="button"
                            className={styles.confirmButton}
                            onClick={() => finish(true)}
                        >
                            {confirmLabel}
                        </button>
                    </DialogFooter>
                </Dialog>
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
