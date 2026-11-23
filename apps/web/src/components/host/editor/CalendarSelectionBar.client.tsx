/**
 * @file CalendarSelectionBar.client.tsx
 * @description Action bar shown once a range of days is selected in the
 * occupancy calendar: the count, an optional note, «Bloquear» and «Cancelar
 * selección» (HOS-43, split out of `CalendarSection` by HOS-2503).
 */

import type { JSX } from 'react';
import type { PluralTranslationFn, TranslationFn } from '@/lib/i18n';
import styles from './CalendarSection.module.css';

/** Props of {@link CalendarSelectionBar}. */
export interface CalendarSelectionBarProps {
    readonly t: TranslationFn;
    readonly tPlural: PluralTranslationFn;
    /** Number of selected days (at least one). */
    readonly count: number;
    readonly note: string;
    readonly onNoteChange: (value: string) => void;
    readonly isSubmitting: boolean;
    readonly submitError: string | null;
    readonly onBlock: () => void;
    readonly onCancel: () => void;
}

/**
 * The range action bar.
 *
 * @param props - See {@link CalendarSelectionBarProps}.
 * @returns A labelled `<section>`.
 */
export function CalendarSelectionBar({
    t,
    tPlural,
    count,
    note,
    onNoteChange,
    isSubmitting,
    submitError,
    onBlock,
    onCancel
}: CalendarSelectionBarProps): JSX.Element {
    const countLabel = tPlural('host.properties.editor.calendar.selectionCount', count);
    return (
        <section
            className={styles.actionBar}
            aria-label={countLabel}
        >
            <p className={styles.selectionCount}>{countLabel}</p>

            <label
                className={styles.noteField}
                htmlFor="calendar-note"
            >
                <span>{t('host.properties.editor.calendar.noteLabel', 'Nota (opcional)')}</span>
                <input
                    id="calendar-note"
                    type="text"
                    className={styles.noteInput}
                    value={note}
                    maxLength={500}
                    placeholder={t(
                        'host.properties.editor.calendar.notePlaceholder',
                        'Ej: reservado fuera de la plataforma'
                    )}
                    onChange={(e) => onNoteChange(e.target.value)}
                    disabled={isSubmitting}
                />
            </label>

            <div className={styles.actionButtons}>
                <button
                    type="button"
                    className={styles.blockButton}
                    onClick={onBlock}
                    disabled={isSubmitting}
                >
                    {isSubmitting
                        ? t('host.properties.editor.calendar.blockingAction', 'Bloqueando...')
                        : t('host.properties.editor.calendar.blockAction', 'Bloquear')}
                </button>
                <button
                    type="button"
                    className={styles.cancelButton}
                    onClick={onCancel}
                    disabled={isSubmitting}
                >
                    {t('host.properties.editor.calendar.cancelSelection', 'Cancelar selección')}
                </button>
            </div>

            {submitError && (
                <div
                    className={styles.error}
                    role="alert"
                >
                    {submitError}
                </div>
            )}
        </section>
    );
}
