/**
 * @file OpeningHoursField.tsx
 * @description Controlled editor for a commerce listing's weekly opening hours
 * (SPEC-249 T-014). Renders the seven ISO day rows (mon–sun); each day can be
 * toggled closed or carry one or more open/close shifts. Preserves the timezone
 * and supports multiple shifts per day so saving never drops existing windows.
 */
import type { OpeningHours } from '@repo/schemas';
import type { JSX } from 'react';

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

interface OpeningHoursFieldProps {
    readonly value: OpeningHours | null;
    readonly onChange: (next: OpeningHours) => void;
    readonly classes: Readonly<Record<string, string>>;
}

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
    return {
        timezone: value?.timezone ?? DEFAULT_TZ,
        days: next
    } as unknown as OpeningHours;
}

/**
 * Weekly opening-hours editor. Fully controlled: every edit produces a complete
 * OpeningHours value passed to `onChange` (the parent owns dirty tracking).
 */
export function OpeningHoursField({
    value,
    onChange,
    classes
}: OpeningHoursFieldProps): JSX.Element {
    return (
        <div className={classes.days}>
            {DAYS.map(({ key, label }) => {
                const schedule = dayOf(value, key);
                return (
                    <div
                        key={key}
                        className={classes.day}
                    >
                        <span className={classes.dayLabel}>{label}</span>

                        <label className={classes.checkbox}>
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
                                    className={classes.shift}
                                >
                                    <input
                                        type="time"
                                        className={classes.input}
                                        aria-label={`${label} apertura ${index + 1}`}
                                        value={shift.open}
                                        onChange={(event) => {
                                            const shifts = schedule.shifts.slice();
                                            shifts[index] = { ...shift, open: event.target.value };
                                            onChange(
                                                withDay(value, key, { closed: false, shifts })
                                            );
                                        }}
                                    />
                                    <input
                                        type="time"
                                        className={classes.input}
                                        aria-label={`${label} cierre ${index + 1}`}
                                        value={shift.close}
                                        onChange={(event) => {
                                            const shifts = schedule.shifts.slice();
                                            shifts[index] = { ...shift, close: event.target.value };
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
    );
}
