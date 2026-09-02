/**
 * @file OpeningHoursSection.client.tsx
 * @description Weekly opening-hours section of the commerce owner editor
 * (SPEC-249 T-014, extracted in HOS-258).
 *
 * Renders the seven ISO day rows (mon–sun); each day can be toggled closed or
 * carry one or more open/close shifts. Fully controlled: every edit produces a
 * COMPLETE `OpeningHours` value, preserving the timezone and the other days, so
 * saving never drops existing windows.
 *
 * ## Errors are shown at TWO levels (HOS-814)
 *
 * A rejected schedule used to mark nothing at all. `<FieldError>` was already
 * mounted here, but it was fed `fieldErrors.openingHours` — a key Zod never
 * produces, because it reports at the deepest path
 * (`openingHours.days.mon.shifts.0.close`). So the submit raised "Revisá los
 * campos marcados", marked no field, wrote no message and moved no focus.
 *
 * Both levels are now wired, from the one error map the rest of the editor
 * already receives:
 *
 * - **Per shift** — the exact `open`/`close` input that failed gets
 *   `aria-invalid` and an `aria-describedby` pointing at its own inline
 *   `<FieldError>`, so the reason sits next to the control that caused it.
 * - **Per section** — the aggregate `openingHours` entry (rolled up by
 *   `useZodForm`'s `aggregateFields`) is announced from the group's first
 *   control, which is also where `focusFirstInvalidField` lands.
 *
 * A shift's two bounds share ONE message slot: `ShiftSchema` reports the window
 * rule on `close`, and a malformed time is per-bound, so at most one of the pair
 * is ever wrong at a time.
 */

import type { OpeningHours } from '@repo/schemas';
import type { JSX } from 'react';
import { FieldError } from '@/components/ui/FieldError';
import { buildFieldErrorId } from '@/components/ui/TextField';
import { buildFieldId } from '@/lib/forms/build-field-id';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import fieldStyles from './editor-fields.module.css';
import { COMMERCE_FIELD_PREFIX } from './field-ids';
import styles from './OpeningHoursSection.module.css';

const DEFAULT_TZ = 'America/Argentina/Buenos_Aires';

/**
 * Identity of the aggregate `openingHours` field (HOS-385).
 *
 * Derivation only, not `<TextField>`: this is 7 days × N shifts under ONE Zod
 * key, so there is no single labelled control for the wrapper to own. The
 * derived id lands on the first day's "closed" checkbox — see the note at that
 * element for why the group's first control is the right focus target.
 */
const OPENING_HOURS_FIELD = { prefix: COMMERCE_FIELD_PREFIX, name: 'openingHours' } as const;

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

/**
 * Read the schedule for a day, defaulting to CLOSED with no shifts (HOS-906).
 *
 * The default used to be `{ closed: false, shifts: [] }` — "open" with no
 * hours — which is the exact intermediate state `DayScheduleSchema` now
 * rejects: neither open (no shifts to be open DURING) nor closed. Every day
 * the host never touches falls through this default, and `withDay()` below
 * rebuilds the full week from it on every edit, so the old default meant
 * saving after editing just ONE day silently persisted that invalid state on
 * the other six. Defaulting to closed is the honest read: better to show
 * "closed" for a day nobody configured than to claim it is open with no
 * stated hours.
 */
function dayOf(value: OpeningHours | null, key: DayKey): DaySchedule {
    const days = (value?.days ?? {}) as Record<string, DaySchedule | undefined>;
    return days[key] ?? { closed: true, shifts: [] };
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
    /**
     * The form's whole dotted-path error map, as every sibling section in this
     * editor already takes (HOS-814). It used to be a single `error` string
     * holding `fieldErrors.openingHours`, which no rejection ever populated:
     * Zod reports at the deepest path, so the message arrived under
     * `openingHours.days.mon.shifts.0.close` and the section rendered nothing.
     *
     * Reading the map lets this section do both halves — mark the exact control
     * that failed, and show the group-level message that `useZodForm`'s
     * `aggregateFields` now rolls up under the bare `openingHours` key.
     */
    readonly errors: Readonly<Record<string, string>>;
    readonly onChange: (next: OpeningHours) => void;
}

/** Dotted Zod path of one shift's `open`/`close`, as the error map keys it. */
function shiftFieldPath(day: DayKey, index: number, bound: 'open' | 'close'): string {
    return `openingHours.days.${day}.shifts.${index}.${bound}`;
}

/** The error-message element id for one shift bound. */
function shiftErrorIdFor(path: string): string {
    return buildFieldErrorId({ prefix: COMMERCE_FIELD_PREFIX, name: path });
}

/**
 * The id of the FIRST per-shift message this section will render, in document
 * order, or `undefined` when no shift is marked.
 *
 * Walking `DAYS` and each day's own shifts is what makes it document order
 * rather than Zod's issue order — the two happen to agree today, and relying on
 * that would be a silent coupling.
 *
 * It exists so the group is described by ONE message: with a shift marked, the
 * aggregate copy at the foot of the section would repeat that same sentence
 * verbatim, so the section defers to the specific one and points the group's
 * focus target at it instead.
 */
function firstShiftErrorId(
    value: OpeningHours | null,
    errors: Readonly<Record<string, string>>
): string | undefined {
    for (const { key } of DAYS) {
        const schedule = dayOf(value, key);
        if (schedule.closed) continue;
        for (let index = 0; index < schedule.shifts.length; index += 1) {
            for (const bound of ['open', 'close'] as const) {
                const path = shiftFieldPath(key, index, bound);
                if (errors[path]) return shiftErrorIdFor(path);
            }
        }
    }
    return undefined;
}

export function OpeningHoursSection({
    locale,
    value,
    errors,
    onChange
}: OpeningHoursSectionProps): JSX.Element {
    const { t } = createTranslations(locale);

    const sectionErrorId = buildFieldErrorId(OPENING_HOURS_FIELD);
    const shiftErrorId = firstShiftErrorId(value, errors);
    // The aggregate copy is the FALLBACK, not a second voice: it speaks only
    // when no individual shift is marked (a rejection of the object itself, or
    // of a day whose failing shift is not rendered because the day is closed).
    const sectionError = shiftErrorId ? undefined : errors.openingHours;
    // Whichever message exists is announced from the group's focus target.
    const groupDescribedBy = shiftErrorId ?? (sectionError ? sectionErrorId : undefined);

    return (
        <section
            className={fieldStyles.section}
            id="editor-openingHours"
        >
            <span className={fieldStyles.label}>
                {t('commerce.owner.editor.sections.openingHours', 'Horarios de atención')}
            </span>
            <div className={styles.days}>
                {DAYS.map(({ key, label }, dayIndex) => {
                    const schedule = dayOf(value, key);
                    return (
                        <div
                            key={key}
                            className={styles.day}
                        >
                            <span className={styles.dayLabel}>{label}</span>

                            <label className={fieldStyles.checkbox}>
                                <input
                                    // HOS-373 OQ-3: `openingHours` carries ONE
                                    // aggregate error over 7 days × N shifts, so
                                    // focus targets the group's first control.
                                    // Not necessarily the failing day — but it
                                    // lands the user in the right section, which
                                    // beats a toast and no hint at all.
                                    id={
                                        dayIndex === 0
                                            ? buildFieldId(OPENING_HOURS_FIELD)
                                            : undefined
                                    }
                                    type="checkbox"
                                    checked={schedule.closed}
                                    aria-label={`${label} cerrado`}
                                    // The group's aggregate error is announced
                                    // from the control that carries the derived
                                    // id, which is also where focus lands.
                                    aria-invalid={
                                        dayIndex === 0 && groupDescribedBy ? true : undefined
                                    }
                                    aria-describedby={dayIndex === 0 ? groupDescribedBy : undefined}
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
                                schedule.shifts.map((shift, index) => {
                                    // Zod reports a bad window on `close` (see
                                    // `ShiftSchema`'s `path`), but a malformed
                                    // time can be reported on either bound, so
                                    // both are read and both can be marked.
                                    const openPath = shiftFieldPath(key, index, 'open');
                                    const closePath = shiftFieldPath(key, index, 'close');
                                    const openError = errors[openPath];
                                    const closeError = errors[closePath];
                                    const shiftError = openError ?? closeError;
                                    const messageId = shiftErrorIdFor(
                                        openError ? openPath : closePath
                                    );

                                    return (
                                        <span
                                            // biome-ignore lint/suspicious/noArrayIndexKey: shifts are positional with no stable id; edits are controlled and rebuild the full array
                                            key={`${key}-${index}`}
                                            className={styles.shift}
                                        >
                                            <span className={styles.shiftRow}>
                                                <input
                                                    type="time"
                                                    className={fieldStyles.input}
                                                    aria-label={`${label} apertura ${index + 1}`}
                                                    aria-invalid={openError ? true : undefined}
                                                    aria-describedby={
                                                        openError ? messageId : undefined
                                                    }
                                                    value={shift.open}
                                                    onChange={(event) => {
                                                        const shifts = schedule.shifts.slice();
                                                        shifts[index] = {
                                                            ...shift,
                                                            open: event.target.value
                                                        };
                                                        onChange(
                                                            withDay(value, key, {
                                                                closed: false,
                                                                shifts
                                                            })
                                                        );
                                                    }}
                                                />
                                                <input
                                                    type="time"
                                                    className={fieldStyles.input}
                                                    aria-label={`${label} cierre ${index + 1}`}
                                                    aria-invalid={closeError ? true : undefined}
                                                    aria-describedby={
                                                        closeError ? messageId : undefined
                                                    }
                                                    value={shift.close}
                                                    onChange={(event) => {
                                                        const shifts = schedule.shifts.slice();
                                                        shifts[index] = {
                                                            ...shift,
                                                            close: event.target.value
                                                        };
                                                        onChange(
                                                            withDay(value, key, {
                                                                closed: false,
                                                                shifts
                                                            })
                                                        );
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    className={styles.shiftButton}
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
                                                    <span aria-hidden="true">&times;</span>
                                                </button>
                                            </span>
                                            <FieldError
                                                id={messageId}
                                                message={shiftError}
                                            />
                                        </span>
                                    );
                                })}

                            {!schedule.closed && (
                                <button
                                    type="button"
                                    className={styles.addShiftButton}
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
                                    <span aria-hidden="true">+</span>
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
            <FieldError
                id={sectionErrorId}
                message={sectionError}
            />
        </section>
    );
}
