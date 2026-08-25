/**
 * @file ConfirmDeleteDialog.client.tsx
 * @description Product-styled confirmation dialog for a destructive action
 * that runs in place (HOS-794).
 *
 * Two confirmation mechanisms already existed and neither fit a delete that
 * keeps the user on the page:
 *
 * - `window.confirm()` — shows the site's domain, cannot be styled and renders
 *   differently per browser. That is the bug HOS-794 reports.
 * - `showConfirmationDialog()` (`lib/forms`, HOS-783 B8) — imperative and
 *   perfect for its consumers, which all NAVIGATE the instant it resolves. It
 *   deliberately passes `claimHistoryEntry={false}` to avoid racing the router,
 *   and it resolves a plain boolean, so it cannot reflect the in-flight state
 *   of the request the confirmation kicks off.
 *
 * This one is the declarative counterpart: it stays mounted while the DELETE
 * runs (`isBusy` disables every close path and swaps the CTA's label), and it
 * keeps the `Dialog`'s default history claim so the phone's back button closes
 * it like every other dialog in the app.
 *
 * Copy arrives already translated — the component is locale-agnostic on
 * purpose so any surface can reuse it without importing a section's namespace.
 *
 * @module components/shared/ui/ConfirmDeleteDialog
 */

import { type JSX, useId } from 'react';
import styles from './ConfirmDeleteDialog.module.css';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from './Dialog.client';

/** Props for {@link ConfirmDeleteDialog}. */
export interface ConfirmDeleteDialogProps {
    /** Whether the dialog is visible. */
    readonly isOpen: boolean;
    /** Dialog title (already localized). */
    readonly title: string;
    /** Body copy asking for confirmation (already localized). */
    readonly message: string;
    /**
     * Optional emphasized line naming the concrete record about to be deleted
     * (a FAQ's question, a platform's name), so the user can see exactly what
     * goes away without dismissing the dialog.
     */
    readonly detail?: string;
    /** Label of the destructive CTA. */
    readonly confirmLabel: string;
    /** Label the destructive CTA shows while `isBusy` (defaults to `confirmLabel`). */
    readonly busyLabel?: string;
    /** Label of the dismissing CTA. */
    readonly cancelLabel: string;
    /** Accessible label of the header's close button. */
    readonly closeLabel: string;
    /** Whether the delete request is in flight — disables every close path. */
    readonly isBusy?: boolean;
    /** Confirms the deletion. */
    readonly onConfirm: () => void;
    /** Dismisses the dialog without deleting. */
    readonly onCancel: () => void;
}

/**
 * Confirmation dialog for an in-place destructive action.
 *
 * @example
 * ```tsx
 * <ConfirmDeleteDialog
 *     isOpen={pending !== null}
 *     title={t('faq.deleteDialogTitle')}
 *     message={t('faq.deleteConfirm')}
 *     detail={pending?.question}
 *     confirmLabel={t('faq.deleteConfirmButton')}
 *     busyLabel={t('faq.deleting')}
 *     cancelLabel={t('faq.cancelButton')}
 *     closeLabel={t('common.close')}
 *     isBusy={isDeleting}
 *     onConfirm={handleDelete}
 *     onCancel={() => setPending(null)}
 * />
 * ```
 */
export function ConfirmDeleteDialog({
    isOpen,
    title,
    message,
    detail,
    confirmLabel,
    busyLabel,
    cancelLabel,
    closeLabel,
    isBusy = false,
    onConfirm,
    onCancel
}: ConfirmDeleteDialogProps): JSX.Element {
    // A page can host more than one of these (the accommodation editor already
    // does), so the title's id has to be unique per instance.
    const titleId = useId();

    const close = () => {
        if (!isBusy) {
            onCancel();
        }
    };

    return (
        <Dialog
            isOpen={isOpen}
            onClose={close}
            size="sm"
            ariaLabelledBy={titleId}
            closeOnEscape={!isBusy}
            closeOnOverlayClick={!isBusy}
        >
            <DialogHeader
                onClose={close}
                closeLabel={closeLabel}
                titleId={titleId}
            >
                {title}
            </DialogHeader>
            <DialogBody>
                <p className={styles.dialogText}>{message}</p>
                {detail && <p className={styles.dialogDetail}>{detail}</p>}
            </DialogBody>
            <DialogFooter>
                <div className={styles.dialogActions}>
                    <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={close}
                        disabled={isBusy}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={onConfirm}
                        disabled={isBusy}
                    >
                        {isBusy ? (busyLabel ?? confirmLabel) : confirmLabel}
                    </button>
                </div>
            </DialogFooter>
        </Dialog>
    );
}
