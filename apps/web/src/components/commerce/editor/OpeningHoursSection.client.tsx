/**
 * @file OpeningHoursSection.client.tsx
 * @description Weekly opening-hours section of the commerce owner editor
 * (SPEC-249 T-014, extracted in HOS-258).
 *
 * Renders the seven ISO day rows (mon–sun); each day can be toggled closed or
 * carry one or more open/close shifts. Fully controlled: every edit produces a
 * COMPLETE `OpeningHours` value, preserving the timezone and the other days, so
 * saving never drops existing windows.
 */

import type { OpeningHours } from '@repo/schemas';
import type { JSX } from 'react';
import { FieldError, fieldErrorId } from '@/components/ui/FieldError';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import fieldStyles from './editor-fields.module.css';
import styles from './OpeningHoursSection.module.css';

const DEFAULT_TZ = 'America/Argentina/Buenos_Aires';

const DAYS = [
    { key: 'mon', label: 'Lun' },
    { key: 'tue', label: 'Mar' },
    { key: 'wed', label: 'Mié' },
    { key: 'thu', label: 'Jue' },
    { key: 'fri', label: 'Vie' },
    { key: 'sat', label: 'Sáb' },
    { key: 'sun', label: 'Dom' }
] as const;

type DayKey = (typeof DAYS)[number]['key'];
type DaySchedule = { closed: boolean; shifts: Array<{ open: string; close: string }> };

/** Read the schedule for a day, defaulting to an open day with no shifts. */
function dayOf(value: OpeningHours | null, key: DayKey): DaySchedule {
    const days = (value?.days ?? {}) as Record<string, DaySchedule | undefined>;
    return days[key] ?? { closed: false, shifts: [] };
}

/** Rebuild the full OpeningHours with one day replaced. */
function withDay(value: OpeningHours | null, key: DayKey, schedule: DaySchedule): OpeningHours {
    const next: Record<string, DaySchedule> = {};
    for (const { key: dayKey } of DAYS) {
        next[dayKey] = dayKey === key ? schedule : dayOf(value, dayKey);
    }
    // TYPE-WORKAROUND: rebuilt OpeningHours from the day map; structurally valid but TS can't infer the schema-derived shape from the plain literal.
    return {
        timezone: value?.timezone ?? DEFAULT_TZ,
        days: next
    } as unknown as OpeningHours;
}

export interface OpeningHoursSectionProps {
    readonly locale: SupportedLocale;
    readonly value: OpeningHours | null;
    readonly error?: string;
    readonly onChange: (next: OpeningHours) => void;
}

export function OpeningHoursSection({
    locale,
    value,
    error,
    onChange
}: OpeningHoursSectionProps): JSX.Element {
    const { t } = createTranslations(locale);

    return (
        <section
            className={fieldStyles.section}
            id="editor-openingHours"
        >
            <span className={fieldStyles.label}>
                {t('commerce.owner.editor.sections.openingHours', 'Horarios de atención')}
            </span>
            <div className={styles.days}>
                {DAYS.map(({ key, label }) => {
                    const schedule = dayOf(value, key);
                    return (
                        <div
                            key={key}
                            className={styles.day}
                        >
                            <span className={styles.dayLabel}>{label}</span>

                            <label className={fieldStyles.checkbox}>
                                <input
                                    type="checkbox"
                                    checked={schedule.closed}
                                    aria-label={`${label} cerrado`}
                                    onChange={(event) =>
                                        onChange(
                                            withDay(value, key, {
                                                closed: event.target.checked,
                                                shifts: event.target.checked ? [] : schedule.shifts
                                            })
                                        )
                                    }
                                />
                                Cerrado
                            </label>

                            {!schedule.closed &&
                                schedule.shifts.map((shift, index) => (
                                    <span
                                        // biome-ignore lint/suspicious/noArrayIndexKey: shifts are positional with no stable id; edits are controlled and rebuild the full array
                                        key={`${key}-${index}`}
                                        className={styles.shift}
                                    >
                                        <input
                                            type="time"
                                            className={fieldStyles.input}
                                            aria-label={`${label} apertura ${index + 1}`}
                                            value={shift.open}
                                            onChange={(event) => {
                                                const shifts = schedule.shifts.slice();
                                                shifts[index] = {
                                                    ...shift,
                                                    open: event.target.value
                                                };
                                                onChange(
                                                    withDay(value, key, { closed: false, shifts })
                                                );
                                            }}
                                        />
                                        <input
                                            type="time"
                                            className={fieldStyles.input}
                                            aria-label={`${label} cierre ${index + 1}`}
                                            value={shift.close}
                                            onChange={(event) => {
                                                const shifts = schedule.shifts.slice();
                                                shifts[index] = {
                                                    ...shift,
                                                    close: event.target.value
                                                };
                                                onChange(
                                                    withDay(value, key, { closed: false, shifts })
                                                );
                                            }}
                                        />
                                        <button
                                            type="button"
                                            aria-label={`Quitar turno ${label} ${index + 1}`}
                                            onClick={() =>
                                                onChange(
                                                    withDay(value, key, {
                                                        closed: false,
                                                        shifts: schedule.shifts.filter(
                                                            (_, i) => i !== index
                                                        )
                                                    })
                                                )
                                            }
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}

                            {!schedule.closed && (
                                <button
                                    type="button"
                                    aria-label={`Agregar turno ${label}`}
                                    onClick={() =>
                                        onChange(
                                            withDay(value, key, {
                                                closed: false,
                                                shifts: [
                                                    ...schedule.shifts,
                                                    { open: '09:00', close: '18:00' }
                                                ]
                                            })
                                        )
                                    }
                                >
                                    +
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
            <FieldError
                id={fieldErrorId('openingHours')}
                message={error}
            />
        </section>
    );
}
