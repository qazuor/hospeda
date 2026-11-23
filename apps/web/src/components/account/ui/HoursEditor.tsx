/**
 * HoursEditor — the weekly opening-hours editor of the Mi Cuenta kit
 * (HOS-2491, spec HOS-2415 §6.6).
 *
 * - One row per ISO weekday with a `Switch` «Abierto». Opening a closed day
 *   that has no slots creates one (HOS-2446), so an open day is never empty.
 * - Each slot is two 44px time inputs plus a labelled remove button. Removing
 *   the last slot closes the day: «open with no hours» is the one state the
 *   schedule schema rejects.
 * - «Agregar franja» adds a slot; «Copiar a todos los días» repeats the day.
 * - Day names come from `Intl.DateTimeFormat` in the page locale, and every
 *   visible text and aria-label from `@repo/i18n` (`account.ui.hoursEditor.*`).
 *   No weekday is hardcoded in any language.
 * - Layout by container query: a row never breaks on a phone, the slots drop
 *   under the day name when the column is narrow.
 *
 * Fully controlled and data-agnostic: it edits a {@link HoursWeek}; the caller
 * maps it to and from its own schema.
 *
 * @module components/account/ui/HoursEditor
 */

import { AddIcon, CopyIcon, DeleteIcon } from '@repo/icons';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { Button } from './Button';
import { cx } from './cx';
import styles from './HoursEditor.module.css';
import { type HelpAnchor, helpAttr } from './help-anchor';
import { Switch } from './Switch';
import { TextInput } from './TextInput';

/** ISO weekday keys, Monday first. */
export const HOURS_WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** One ISO weekday key. */
export type HoursWeekday = (typeof HOURS_WEEKDAYS)[number];

/** One opening window, `HH:mm` bounds. */
export interface HoursSlot {
    readonly open: string;
    readonly close: string;
}

/** One day: closed, or open during its slots. */
export interface HoursDay {
    readonly closed: boolean;
    readonly slots: readonly HoursSlot[];
}

/** The whole week. */
export type HoursWeek = Readonly<Record<HoursWeekday, HoursDay>>;

/** The slot a closed day gets when it is opened. */
export const HOURS_DEFAULT_SLOT: HoursSlot = { open: '09:00', close: '18:00' };

/** Which bound of a slot an error points at. */
export type HoursBound = 'open' | 'close';

/** Props of {@link HoursEditor}. */
export interface HoursEditorProps {
    /** Locale for day names and every text. */
    readonly locale: SupportedLocale;
    /** The week being edited. */
    readonly value: HoursWeek;
    /** Receives the whole next week on every edit. */
    readonly onChange: (next: HoursWeek) => void;
    /** Namespace for the control ids (`${idBase}-mon-open-0`). */
    readonly idBase: string;
    /** Id of the first control (Monday's switch): the group's focus target. */
    readonly firstControlId?: string;
    /** Error of one slot bound, if any. */
    readonly errorFor?: (day: HoursWeekday, index: number, bound: HoursBound) => string | undefined;
    /** Group-level error, shown under the week; marks Monday's switch `aria-invalid`. */
    readonly error?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
}

/** A Monday (UTC), the anchor `weekdayName` counts from. */
const MONDAY_UTC = Date.UTC(2024, 0, 1);

/**
 * The localized long name of a weekday, capitalized («Lunes», «Monday»,
 * «Segunda-feira»).
 *
 * @param params - `locale` and the ISO `day`.
 * @returns The name.
 */
export function weekdayName({
    locale,
    day
}: {
    readonly locale: SupportedLocale;
    readonly day: HoursWeekday;
}): string {
    const offset = HOURS_WEEKDAYS.indexOf(day);
    const name = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
        new Date(MONDAY_UTC + offset * 86_400_000)
    );
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
}

/**
 * The week with one day replaced.
 *
 * @param params - The week, the day and its new schedule.
 * @returns A new week.
 */
export function withHoursDay({
    week,
    day,
    schedule
}: {
    readonly week: HoursWeek;
    readonly day: HoursWeekday;
    readonly schedule: HoursDay;
}): HoursWeek {
    return { ...week, [day]: schedule };
}

/**
 * The week with one day toggled: opening seeds one slot when it had none,
 * closing drops the slots.
 *
 * @param params - The week, the day and whether it opens.
 * @returns A new week.
 */
export function toggleHoursDay({
    week,
    day,
    open
}: {
    readonly week: HoursWeek;
    readonly day: HoursWeekday;
    readonly open: boolean;
}): HoursWeek {
    const current = week[day];
    const slots = open
        ? current.slots.length > 0
            ? current.slots
            : [{ ...HOURS_DEFAULT_SLOT }]
        : [];
    return withHoursDay({ week, day, schedule: { closed: !open, slots } });
}

/**
 * The week with one slot removed; removing the last slot closes the day.
 *
 * @param params - The week, the day and the slot index.
 * @returns A new week.
 */
export function removeHoursSlot({
    week,
    day,
    index
}: {
    readonly week: HoursWeek;
    readonly day: HoursWeekday;
    readonly index: number;
}): HoursWeek {
    const slots = week[day].slots.filter((_, i) => i !== index);
    return withHoursDay({ week, day, schedule: { closed: slots.length === 0, slots } });
}

/**
 * The week with one day's schedule copied to all seven.
 *
 * @param params - The week and the source day.
 * @returns A new week.
 */
export function copyHoursDayToAll({
    week,
    day
}: {
    readonly week: HoursWeek;
    readonly day: HoursWeekday;
}): HoursWeek {
    const source = week[day];
    const next = {} as Record<HoursWeekday, HoursDay>;
    for (const key of HOURS_WEEKDAYS) {
        next[key] = { closed: source.closed, slots: source.slots.map((slot) => ({ ...slot })) };
    }
    return next;
}

/**
 * The kit weekly hours editor.
 *
 * @param props - See {@link HoursEditorProps}.
 * @returns A list of seven day rows.
 */
export function HoursEditor({
    locale,
    value,
    onChange,
    idBase,
    firstControlId,
    errorFor,
    error,
    helpId,
    className
}: HoursEditorProps) {
    const t = createT(locale);
    const groupErrorId = `${idBase}-error`;

    return (
        <div
            {...helpAttr({ helpId })}
            className={cx(styles.root, className)}
        >
            <ul className={styles.days}>
                {HOURS_WEEKDAYS.map((day, dayIndex) => {
                    const name = weekdayName({ locale, day });
                    const schedule = value[day];
                    const open = !schedule.closed;
                    const nameId = `${idBase}-${day}-name`;
                    return (
                        <li
                            key={day}
                            className={styles.day}
                        >
                            <div className={styles.dayHead}>
                                <span
                                    id={nameId}
                                    className={styles.dayName}
                                >
                                    {name}
                                </span>
                                <span className={styles.toggle}>
                                    <Switch
                                        id={dayIndex === 0 ? firstControlId : undefined}
                                        aria-label={t(
                                            'account.ui.hoursEditor.openAria',
                                            undefined,
                                            {
                                                day: name
                                            }
                                        )}
                                        aria-describedby={
                                            dayIndex === 0 && error ? groupErrorId : undefined
                                        }
                                        invalid={dayIndex === 0 && Boolean(error)}
                                        checked={open}
                                        onCheckedChange={(next) =>
                                            onChange(
                                                toggleHoursDay({ week: value, day, open: next })
                                            )
                                        }
                                    />
                                    <span aria-hidden="true">
                                        {open
                                            ? t('account.ui.hoursEditor.open')
                                            : t('account.ui.hoursEditor.closed')}
                                    </span>
                                </span>
                            </div>
                            {open ? (
                                <div className={styles.dayBody}>
                                    {schedule.slots.map((slot, index) => (
                                        <SlotRow
                                            // biome-ignore lint/suspicious/noArrayIndexKey: slots have no identity beyond their position
                                            key={index}
                                            locale={locale}
                                            idBase={`${idBase}-${day}-${index}`}
                                            dayName={name}
                                            index={index}
                                            slot={slot}
                                            openError={errorFor?.(day, index, 'open')}
                                            closeError={errorFor?.(day, index, 'close')}
                                            onSlotChange={(nextSlot) => {
                                                const slots = schedule.slots.slice();
                                                slots[index] = nextSlot;
                                                onChange(
                                                    withHoursDay({
                                                        week: value,
                                                        day,
                                                        schedule: { closed: false, slots }
                                                    })
                                                );
                                            }}
                                            onRemove={() =>
                                                onChange(
                                                    removeHoursSlot({ week: value, day, index })
                                                )
                                            }
                                        />
                                    ))}
                                    <div className={styles.dayActions}>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            aria-label={t(
                                                'account.ui.hoursEditor.addSlotAria',
                                                undefined,
                                                {
                                                    day: name
                                                }
                                            )}
                                            onClick={() =>
                                                onChange(
                                                    withHoursDay({
                                                        week: value,
                                                        day,
                                                        schedule: {
                                                            closed: false,
                                                            slots: [
                                                                ...schedule.slots,
                                                                { ...HOURS_DEFAULT_SLOT }
                                                            ]
                                                        }
                                                    })
                                                )
                                            }
                                        >
                                            <AddIcon
                                                size="sm"
                                                aria-hidden="true"
                                            />
                                            {t('account.ui.hoursEditor.addSlot')}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            aria-label={t(
                                                'account.ui.hoursEditor.copyToAllAria',
                                                undefined,
                                                {
                                                    day: name
                                                }
                                            )}
                                            onClick={() =>
                                                onChange(copyHoursDayToAll({ week: value, day }))
                                            }
                                        >
                                            <CopyIcon
                                                size="sm"
                                                aria-hidden="true"
                                            />
                                            {t('account.ui.hoursEditor.copyToAll')}
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                        </li>
                    );
                })}
            </ul>
            {error ? (
                <p
                    id={groupErrorId}
                    className={styles.error}
                >
                    {error}
                </p>
            ) : null}
        </div>
    );
}

/** Props of the internal {@link SlotRow}. */
interface SlotRowProps {
    readonly locale: SupportedLocale;
    readonly idBase: string;
    readonly dayName: string;
    readonly index: number;
    readonly slot: HoursSlot;
    readonly openError?: string;
    readonly closeError?: string;
    readonly onSlotChange: (slot: HoursSlot) => void;
    readonly onRemove: () => void;
}

/** One slot: opening and closing time plus its remove button. */
function SlotRow({
    locale,
    idBase,
    dayName,
    index,
    slot,
    openError,
    closeError,
    onSlotChange,
    onRemove
}: SlotRowProps) {
    const t = createT(locale);
    const params = { day: dayName, index: index + 1 };
    const message = openError ?? closeError;
    const messageId = `${idBase}-error`;

    return (
        <div className={styles.slot}>
            <div className={styles.slotRow}>
                <TextInput
                    id={`${idBase}-open`}
                    type="time"
                    className={styles.time}
                    aria-label={t('account.ui.hoursEditor.openTimeAria', undefined, params)}
                    invalid={Boolean(openError)}
                    aria-describedby={openError ? messageId : undefined}
                    value={slot.open}
                    onChange={(event) => onSlotChange({ ...slot, open: event.target.value })}
                />
                <span
                    className={styles.dash}
                    aria-hidden="true"
                >
                    –
                </span>
                <TextInput
                    id={`${idBase}-close`}
                    type="time"
                    className={styles.time}
                    aria-label={t('account.ui.hoursEditor.closeTimeAria', undefined, params)}
                    invalid={Boolean(closeError)}
                    aria-describedby={closeError ? messageId : undefined}
                    value={slot.close}
                    onChange={(event) => onSlotChange({ ...slot, close: event.target.value })}
                />
                <Button
                    variant="danger-ghost"
                    iconOnly
                    aria-label={t('account.ui.hoursEditor.removeSlotAria', undefined, params)}
                    onClick={onRemove}
                >
                    <DeleteIcon
                        size="sm"
                        aria-hidden="true"
                    />
                </Button>
            </div>
            {message ? (
                <p
                    id={messageId}
                    className={styles.error}
                >
                    {message}
                </p>
            ) : null}
        </div>
    );
}
