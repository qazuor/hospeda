/**
 * @file RejectUsageDialog.client.tsx
 * @description The "are you sure?" dialog for rejecting a benefit usage.
 *
 * ONE DIALOG FOR BOTH SIDES of the flow. The host rejects what a provider
 * declared and the provider rejects what a host declared; the wording, the
 * optional note, the reversibility promise and the focus handling are identical,
 * so a second copy would be a second place for them to drift. It was extracted
 * when the provider's half of the flow was finally built (H-06/H-65/H-159) —
 * before that, only the host could reject at all.
 *
 * THE NOTE STAYS OPTIONAL, deliberately. Rejecting is the only control keeping
 * the public counters honest, and demanding a written explanation to say "that
 * never happened" taxes the one action the system most needs people to take.
 *
 * Styles come from `BenefitUsagesPanel.module.css` because that is where this
 * dialog was born and where its rules still sit, entangled with the shared
 * button rules. Sharing the stylesheet is the point: two copies of the CSS is
 * exactly the drift this extraction exists to prevent.
 */

import { useEffect, useId, useRef, useState } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './BenefitUsagesPanel.module.css';

/** Maximum length of the optional rejection note, mirroring the API's cap. */
const REJECTION_NOTE_MAX = 300;

interface RejectUsageDialogProps {
    readonly locale: SupportedLocale;
    /** Who will be told the usage did not happen — the OTHER party, never the reader. */
    readonly counterpartName: string;
    readonly onCancel: () => void;
    /** Receives the trimmed note, or `undefined` when none was written. */
    readonly onConfirm: (note?: string) => void;
}

/**
 * Renders the rejection confirmation dialog.
 *
 * @param props - Locale, the counterpart's name, and the two outcomes.
 * @returns The dialog element.
 */
export function RejectUsageDialog({
    locale,
    counterpartName,
    onCancel,
    onConfirm
}: RejectUsageDialogProps) {
    const { t } = createTranslations(locale);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const noteFieldId = useId();
    const [note, setNote] = useState('');

    // Opened imperatively so the browser supplies the focus trap and Escape
    // handling. `showModal` is guarded because jsdom does not implement it, and
    // an unguarded call takes every test in the file down.
    //
    // The cleanup returns focus to the button that opened it. The browser does
    // not do it here: the dialog closes because the parent drops its state, and
    // the row underneath re-renders in the same pass, so whatever
    // focus-restoration the platform had queued is lost — measured, focus landed
    // on <body>, leaving a keyboard user at the top of the document (WCAG 2.4.3).
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const previouslyFocused = document.activeElement as HTMLElement | null;

        if (typeof dialog.showModal === 'function') {
            dialog.showModal();
        } else {
            dialog.setAttribute('open', '');
        }

        return () => {
            // `isConnected` guards the row having been re-rendered away while the
            // dialog was open: focusing a detached node does nothing, and asking
            // first says why the call is conditional.
            if (previouslyFocused?.isConnected) {
                previouslyFocused.focus?.();
            }
        };
    }, []);

    return (
        <dialog
            aria-labelledby={`${noteFieldId}-title`}
            className={styles.dialog}
            onCancel={onCancel}
            onClose={onCancel}
            ref={dialogRef}
        >
            <h2
                className={styles.dialogTitle}
                id={`${noteFieldId}-title`}
            >
                {t('host-trades.usages.reject.title', '¿Rechazar este uso?')}
            </h2>
            <p className={styles.dialogBody}>
                {t(
                    'host-trades.usages.reject.body',
                    'Le vamos a avisar a {{name}} que este uso no ocurrió. Podés deshacerlo después: el rechazo es reversible.',
                    { name: counterpartName }
                )}
            </p>

            <label
                className={styles.dialogLabel}
                htmlFor={noteFieldId}
            >
                {t('host-trades.usages.reject.noteLabel', 'Contale por qué (opcional)')}
            </label>
            <textarea
                className={styles.dialogTextarea}
                id={noteFieldId}
                maxLength={REJECTION_NOTE_MAX}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                value={note}
            />

            <div className={styles.dialogActions}>
                <button
                    className={styles.secondaryAction}
                    onClick={onCancel}
                    type="button"
                >
                    {t('host-trades.usages.reject.cancel', 'Volver')}
                </button>
                <button
                    className={styles.dangerAction}
                    onClick={() => {
                        const trimmed = note.trim();
                        onConfirm(trimmed.length > 0 ? trimmed : undefined);
                    }}
                    type="button"
                >
                    {t('host-trades.usages.reject.confirm', 'Sí, rechazar')}
                </button>
            </div>
        </dialog>
    );
}
