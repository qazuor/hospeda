/**
 * @file VenueEventEntryCard.client.tsx
 * @description The fields of one agenda entry of `VenueEventsManager`
 * (HOS-1042). Since HOS-2490 it is one row of the kit `Repeater`: the row
 * chrome (label, move, remove) belongs to the Repeater, and every field here
 * carries a visible kit `Field` label.
 *
 * Purely controlled: every field reads from `entry` and reports changes
 * through `onPatch`/`onSetRecurrence`; it holds no state of its own and knows
 * nothing about persistence.
 *
 * `onSetRecurrence` (rather than the card calling `onPatch` directly for the
 * radio buttons) is what keeps the "clear the field the new shape does not
 * use" rule in ONE place — the manager's `setRecurrence` — instead of being
 * re-implemented here.
 */

import type { JSX } from 'react';
import { Checkbox } from '@/components/account/ui/Checkbox';
import { Field } from '@/components/account/ui/Field';
import { Radio, RadioGroup } from '@/components/account/ui/Radio';
import { Select } from '@/components/account/ui/Select';
import { Textarea } from '@/components/account/ui/Textarea';
import { TextInput } from '@/components/account/ui/TextInput';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';
import {
    type EventDraft,
    isTicketUrlValid,
    todayInVenueZone,
    WEEKDAY_I18N_KEYS
} from '@/lib/venue/venue-event-draft';
import styles from './VenueEventsManager.module.css';

/** Props of {@link VenueEventEntryCard}. */
export interface VenueEventEntryCardProps {
    readonly entry: EventDraft;
    /** Index of the entry in the WHOLE agenda (past entries included). */
    readonly index: number;
    readonly locale: SupportedLocale;
    readonly t: TranslationFn;
    /**
     * The seven weekday names, already localised, indexed the way
     * {@link WEEKDAY_I18N_KEYS} is (`0` = Sunday … `6` = Saturday).
     *
     * Resolved on the Astro page rather than looked up here: the names live
     * under `venue.detail.openingHours.*`, and `venue.detail` does NOT ship to
     * the browser (declaring the prefix client-side would push 1,205 B brotli
     * of never-named strings into the dictionary to deliver 303 B of useful
     * ones — measured).
     */
    readonly weekdayLabels: readonly string[];
    readonly onPatch: (index: number, patch: Partial<EventDraft>) => void;
    readonly onSetRecurrence: (index: number, recurrence: 'once' | 'weekly') => void;
}

/**
 * One agenda entry's fields.
 *
 * @param props - See {@link VenueEventEntryCardProps}.
 * @returns The fields.
 */
export function VenueEventEntryCard({
    entry,
    index,
    locale,
    t,
    weekdayLabels,
    onPatch,
    onSetRecurrence
}: VenueEventEntryCardProps): JSX.Element {
    const ticketUrlInvalid = !isTicketUrlValid(entry.ticketUrl);
    return (
        <div className={styles.fields}>
            <Field
                locale={locale}
                label={t('venue.owner.editor.venueEventsManager.entryTitle', 'Título')}
            >
                <TextInput
                    value={entry.title}
                    placeholder={t(
                        'venue.owner.editor.venueEventsManager.titlePlaceholder',
                        'Música en vivo, Happy hour…'
                    )}
                    onChange={(event) => onPatch(index, { title: event.target.value })}
                />
            </Field>

            <Field
                locale={locale}
                label={t('venue.owner.editor.venueEventsManager.entryDescription', 'Descripción')}
            >
                <Textarea
                    value={entry.description}
                    placeholder={t(
                        'venue.owner.editor.venueEventsManager.descriptionPlaceholder',
                        'Detalle opcional'
                    )}
                    onChange={(event) => onPatch(index, { description: event.target.value })}
                />
            </Field>

            <Field
                locale={locale}
                label={t(
                    'venue.owner.editor.venueEventsManager.ticketUrl',
                    'Link de entradas (opcional)'
                )}
                hint={
                    ticketUrlInvalid
                        ? undefined
                        : t(
                              'venue.owner.editor.venueEventsManager.ticketUrlHelp',
                              'Si vendés entradas por Passline, Venti u otra, pegá el link acá.'
                          )
                }
                error={
                    ticketUrlInvalid
                        ? t(
                              'venue.owner.editor.venueEventsManager.ticketUrlInvalid',
                              'El link de entradas tiene que empezar con https:// y no puede llevar usuario ni contraseña.'
                          )
                        : undefined
                }
            >
                <TextInput
                    type="url"
                    inputMode="url"
                    value={entry.ticketUrl}
                    placeholder="https://"
                    onChange={(event) => onPatch(index, { ticketUrl: event.target.value })}
                />
            </Field>

            <RadioGroup
                locale={locale}
                legend={t('venue.owner.editor.venueEventsManager.recurrence', 'Cuándo pasa')}
                name={`recurrence-${index}`}
                value={entry.recurrence}
                onValueChange={(value) =>
                    onSetRecurrence(index, value === 'once' ? 'once' : 'weekly')
                }
            >
                <Radio
                    value="weekly"
                    label={t(
                        'venue.owner.editor.venueEventsManager.recurrenceWeekly',
                        'Todas las semanas'
                    )}
                />
                <Radio
                    value="once"
                    label={t('venue.owner.editor.venueEventsManager.recurrenceOnce', 'Un solo día')}
                />
            </RadioGroup>

            <div className={styles.row}>
                {entry.recurrence === 'weekly' ? (
                    <Field
                        locale={locale}
                        label={t(
                            'venue.owner.editor.venueEventsManager.weekday',
                            'Día de la semana'
                        )}
                    >
                        <Select
                            value={entry.weekday}
                            onChange={(event) =>
                                onPatch(index, { weekday: Number(event.target.value) })
                            }
                        >
                            {WEEKDAY_I18N_KEYS.map((dayKey, dayIndex) => (
                                <option
                                    key={dayKey}
                                    value={dayIndex}
                                >
                                    {weekdayLabels[dayIndex] ?? dayKey}
                                </option>
                            ))}
                        </Select>
                    </Field>
                ) : (
                    <Field
                        locale={locale}
                        // Lets the editor focus the date of a freshly duplicated event (HOS-2254).
                        id={`venue-event-date-${index}`}
                        label={t('venue.owner.editor.venueEventsManager.date', 'Fecha')}
                    >
                        <TextInput
                            type="date"
                            // A new event cannot be dated in the past (hint; the API enforces it).
                            min={entry.id ? undefined : todayInVenueZone()}
                            value={entry.date}
                            onChange={(event) => onPatch(index, { date: event.target.value })}
                        />
                    </Field>
                )}

                <Field
                    locale={locale}
                    label={t('venue.owner.editor.venueEventsManager.startTime', 'Hora de inicio')}
                >
                    <TextInput
                        type="time"
                        value={entry.startTime}
                        onChange={(event) => onPatch(index, { startTime: event.target.value })}
                    />
                </Field>

                <Field
                    locale={locale}
                    label={t(
                        'venue.owner.editor.venueEventsManager.endTime',
                        'Hora de fin (opcional)'
                    )}
                >
                    <TextInput
                        type="time"
                        value={entry.endTime}
                        onChange={(event) => onPatch(index, { endTime: event.target.value })}
                    />
                </Field>
            </div>

            <Checkbox
                label={t('venue.owner.editor.venueEventsManager.active', 'Activo')}
                checked={entry.isActive}
                onChange={(event) => onPatch(index, { isActive: event.target.checked })}
            />
        </div>
    );
}
