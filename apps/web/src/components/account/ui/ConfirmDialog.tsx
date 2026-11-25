/**
 * ConfirmDialog — one confirmation for destructive or irreversible actions
 * (HOS-2413 T-013).
 *
 * - `role="alertdialog"`. Initial focus goes to Cancel, NEVER to the
 *   destructive button. Escape cancels.
 * - `destructive`: the icon sits on `status-danger-bg` and the confirm button
 *   is `danger`. `neutral` uses `primary`.
 * - An async `onConfirm` puts the confirm button in `loading` and blocks
 *   dismissal. If it rejects the dialog stays open and shows a translated
 *   message. The API's own error text is never shown.
 * - The confirm label is verb + object («Eliminar carta»), supplied by the
 *   caller.
 *
 * @module components/account/ui/ConfirmDialog
 */

import { AlertCircleIcon, InfoIcon } from '@repo/icons';
import { type ReactNode, useId, useRef, useState } from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { Button } from './Button';
import styles from './ConfirmDialog.module.css';
import { cx } from './cx';
import { Dialog } from './Dialog';
import type { HelpAnchor } from './help-anchor';

/** Tone of a confirmation. */
export type ConfirmTone = 'destructive' | 'neutral';

/** Props of {@link ConfirmDialog}. */
export interface ConfirmDialogProps {
    /** Controlled open state. */
    readonly open: boolean;
    /** Title: what is about to happen. */
    readonly title: ReactNode;
    /** Body: what will be lost or changed. */
    readonly description: ReactNode;
    /** Confirm button label: verb + object. */
    readonly confirmLabel: string;
    /** Cancel button label. Defaults to the translated «Cancelar». */
    readonly cancelLabel?: string;
    /** Locale for the default copy. */
    readonly locale: SupportedLocale;
    /** `destructive` paints danger. @default 'destructive' */
    readonly tone?: ConfirmTone;
    /** Work to do on confirm. A rejection keeps the dialog open with an error. */
    readonly onConfirm: () => void | Promise<void>;
    /** Called on Cancel, Escape or scrim click. */
    readonly onCancel: () => void;
    /** Optional help anchor. */
    readonly helpId?: HelpAnchor;
}

/**
 * The kit confirmation dialog.
 *
 * @param props - See {@link ConfirmDialogProps}.
 * @returns A kit Dialog with the `alertdialog` role.
 */
export function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel,
    locale,
    tone = 'destructive',
    onConfirm,
    onCancel,
    helpId
}: ConfirmDialogProps) {
    const t = createT(locale);
    const cancelRef = useRef<HTMLButtonElement>(null);
    const descriptionId = useId();
    const [pending, setPending] = useState(false);
    const [failed, setFailed] = useState(false);
    const destructive = tone === 'destructive';
    const Icon = destructive ? AlertCircleIcon : InfoIcon;

    const handleConfirm = async () => {
        setFailed(false);
        setPending(true);
        try {
            await onConfirm();
        } catch {
            setFailed(true);
        } finally {
            setPending(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next && !pending) {
                    setFailed(false);
                    onCancel();
                }
            }}
            title={title}
            locale={locale}
            size="sm"
            role="alertdialog"
            hideCloseButton
            describedBy={descriptionId}
            dismissible={!pending}
            claimHistoryEntry={false}
            initialFocus={cancelRef}
            helpId={helpId}
            footer={
                <>
                    <Button
                        ref={cancelRef}
                        variant="secondary"
                        disabled={pending}
                        onClick={() => {
                            setFailed(false);
                            onCancel();
                        }}
                    >
                        {cancelLabel ?? t('account.ui.cancel')}
                    </Button>
                    <Button
                        variant={destructive ? 'danger' : 'primary'}
                        loading={pending}
                        onClick={handleConfirm}
                    >
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            <div className={styles.content}>
                <span
                    className={cx(
                        styles.icon,
                        destructive ? styles.iconDestructive : styles.iconNeutral
                    )}
                >
                    <Icon
                        size="md"
                        duotoneColor="currentColor"
                        aria-hidden="true"
                    />
                </span>
                <div>
                    <p
                        id={descriptionId}
                        className={styles.message}
                    >
                        {description}
                    </p>
                    {failed ? (
                        <p
                            role="alert"
                            className={styles.error}
                        >
                            {t('account.ui.confirmError')}
                        </p>
                    ) : null}
                </div>
            </div>
        </Dialog>
    );
}
