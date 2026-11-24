/**
 * @file CalendarSelectionBar.client.tsx
 * @description Action bar shown once a range of days is selected in the
 * occupancy calendar: the count, an optional note, «Bloquear» and «Cancelar
 * selección» (HOS-43, split out of `CalendarSection` by HOS-2503).
 *
 * Built on the kit `Field` + `TextInput`, `Button` and `Alert`. It sits inside
 * the calendar `Section`, so it draws a separator, never a box of its own
 * (D5 «nunca una caja dentro de otra»).
 */

import type { JSX } from 'react';
import { Alert } from '@/components/account/ui/Alert';
import { Button } from '@/components/account/ui/Button';
import { Field } from '@/components/account/ui/Field';
import { TextInput } from '@/components/account/ui/TextInput';
import type { PluralTranslationFn, SupportedLocale, TranslationFn } from '@/lib/i18n';
import styles from './CalendarSection.module.css';

/** Props of {@link CalendarSelectionBar}. */
export interface CalendarSelectionBarProps {
    readonly locale: SupportedLocale;
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
    locale,
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

            <Field
                locale={locale}
                id="calendar-note"
                label={t('host.properties.editor.calendar.noteLabel', 'Nota (opcional)')}
            >
                <TextInput
                    value={note}
                    maxLength={500}
                    placeholder={t(
                        'host.properties.editor.calendar.notePlaceholder',
                        'Ej: reservado fuera de la plataforma'
                    )}
                    onChange={(e) => onNoteChange(e.target.value)}
                    disabled={isSubmitting}
                />
            </Field>

            <div className={styles.actionButtons}>
                <Button
                    variant="danger"
                    onClick={onBlock}
                    disabled={isSubmitting}
                >
                    {isSubmitting
                        ? t('host.properties.editor.calendar.blockingAction', 'Bloqueando...')
                        : t('host.properties.editor.calendar.blockAction', 'Bloquear')}
                </Button>
                <Button
                    variant="secondary"
                    onClick={onCancel}
                    disabled={isSubmitting}
                >
                    {t('host.properties.editor.calendar.cancelSelection', 'Cancelar selección')}
                </Button>
            </div>

            {submitError && (
                <Alert
                    tone="danger"
                    locale={locale}
                >
                    {submitError}
                </Alert>
            )}
        </section>
    );
}
