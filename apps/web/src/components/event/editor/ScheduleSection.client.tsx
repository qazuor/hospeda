/**
 * @file ScheduleSection.client.tsx
 * @description Start and end of an event (HOS-374 2C-3).
 *
 * ## Why a MONTH-precise event is read-only here
 *
 * HOS-280 gave `date.precision` two values: `EXACT` (a known day) and `MONTH`
 * (only the month is known — the day component of `start` is a placeholder that
 * must not be rendered). `httpToDomainEventUpdate` stamps
 * `precision: EXACT` on EVERY date it writes, with no way to say otherwise
 * from this surface.
 *
 * So a `datetime-local` input on a MONTH-precise event would show a fabricated
 * day, and confirming it would silently promote the event to EXACT — asserting
 * a day nobody knows. The fields are shown read-only instead, with the reason
 * stated. Converting the precision deliberately is a separate capability, not a
 * side effect of opening the editor.
 */

import styles from '@/components/account/editor/content-editor-fields.module.css';
import { TextField } from '@/components/ui/TextField';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { EventEditFormData } from './event-edit-data';
import { EVENT_FIELD_PREFIX } from './field-ids';

/** Props for {@link ScheduleSection}. */
export interface ScheduleSectionProps {
    readonly locale: SupportedLocale;
    readonly data: EventEditFormData;
    readonly errors: Readonly<Record<string, string>>;
    /**
     * `true` when this event's dates carry `precision: 'MONTH'` — the fields
     * render read-only (see the file doc).
     */
    readonly isMonthPrecision?: boolean;
    /** `true` when the moderation lock forbids editing (HOS-374 §7.6.3). */
    readonly disabled?: boolean;
    readonly onFieldChange: (field: 'startDate' | 'endDate', value: string) => void;
}

/**
 * Event schedule section: start and end datetime.
 *
 * @param props - See {@link ScheduleSectionProps}.
 */
export function ScheduleSection({
    locale,
    data,
    errors,
    isMonthPrecision = false,
    disabled = false,
    onFieldChange
}: ScheduleSectionProps) {
    const { t } = createTranslations(locale);

    return (
        <fieldset
            className={styles.section}
            disabled={disabled || isMonthPrecision}
        >
            <legend className={styles.sectionTitle}>
                {t('account.myContent.events.editor.section.schedule', 'Fechas')}
            </legend>

            {isMonthPrecision && (
                <p
                    className={styles.fieldHint}
                    data-testid="event-month-precision-notice"
                >
                    {t(
                        'account.myContent.events.editor.monthPrecisionNotice',
                        'Este evento tiene fecha aproximada al mes, así que no se edita desde acá. Escribinos si necesitás fijar el día.'
                    )}
                </p>
            )}

            <div className={styles.field}>
                <TextField
                    prefix={EVENT_FIELD_PREFIX}
                    name="startDate"
                    label={`${t('account.myContent.events.editor.field.startDate', 'Comienza')} *`}
                    labelClassName={styles.fieldLabel}
                    className={styles.fieldInput}
                    error={errors.startDate}
                    type="datetime-local"
                    value={data.startDate}
                    onChange={(e) => onFieldChange('startDate', e.target.value)}
                    required
                />
            </div>

            <div className={styles.field}>
                <TextField
                    prefix={EVENT_FIELD_PREFIX}
                    name="endDate"
                    label={t('account.myContent.events.editor.field.endDate', 'Termina')}
                    labelClassName={styles.fieldLabel}
                    className={styles.fieldInput}
                    error={errors.endDate}
                    type="datetime-local"
                    value={data.endDate}
                    onChange={(e) => onFieldChange('endDate', e.target.value)}
                />
                <span className={styles.fieldHint}>
                    {t(
                        'account.myContent.events.editor.hint.endDate',
                        'Opcional. Dejalo vacío si el evento dura un solo momento.'
                    )}
                </span>
            </div>
        </fieldset>
    );
}
