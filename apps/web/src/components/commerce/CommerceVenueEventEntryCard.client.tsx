/**
 * @file CommerceVenueEventEntryCard.client.tsx
 * @description One row of `CommerceVenueEventsManager` — a single agenda
 * entry's fields (HOS-1042).
 *
 * Split out of the manager to keep that file under the repo's 500-line cap.
 * Purely controlled: every field reads from `entry` and reports changes
 * through `onPatch`/`onMove`/`onRemove`/`onSetRecurrence`; it holds no state
 * of its own and knows nothing about persistence.
 *
 * `onSetRecurrence` (rather than the card calling `onPatch` directly for the
 * radio buttons) is what keeps the "clear the field the new shape does not
 * use" rule in ONE place — the manager's `setRecurrence` — instead of being
 * re-implemented here.
 */

import type { JSX } from 'react';
import { type EventDraft, WEEKDAY_I18N_KEYS } from '@/lib/commerce/venue-event-draft';
import type { TranslationFn } from '@/lib/i18n';
import styles from './CommerceVenueEventsManager.module.css';

export interface CommerceVenueEventEntryCardProps {
    readonly entry: EventDraft;
    readonly index: number;
    readonly t: TranslationFn;
    readonly onPatch: (index: number, patch: Partial<EventDraft>) => void;
    readonly onMove: (index: number, delta: number) => void;
    readonly onRemove: (index: number) => void;
    readonly onSetRecurrence: (index: number, recurrence: 'once' | 'weekly') => void;
}

export function CommerceVenueEventEntryCard({
    entry,
    index,
    t,
    onPatch,
    onMove,
    onRemove,
    onSetRecurrence
}: CommerceVenueEventEntryCardProps): JSX.Element {
    return (
        <fieldset className={styles.card}>
            <legend className={styles.srOnly}>
                {entry.title ||
                    t('commerce.owner.editor.venueEventsManager.newEntry', 'Nuevo evento')}
            </legend>

            <div className={styles.row}>
                <input
                    className={styles.input}
                    type="text"
                    value={entry.title}
                    placeholder={t(
                        'commerce.owner.editor.venueEventsManager.titlePlaceholder',
                        'Música en vivo, Happy hour…'
                    )}
                    aria-label={t('commerce.owner.editor.venueEventsManager.entryTitle', 'Título')}
                    onChange={(event) => {
                        onPatch(index, { title: event.target.value });
                    }}
                />
                <button
                    type="button"
                    className={styles.iconButton}
                    aria-label={t(
                        'commerce.owner.editor.venueEventsManager.moveUp',
                        'Subir el evento'
                    )}
                    onClick={() => {
                        onMove(index, -1);
                    }}
                >
                    ↑
                </button>
                <button
                    type="button"
                    className={styles.iconButton}
                    aria-label={t(
                        'commerce.owner.editor.venueEventsManager.moveDown',
                        'Bajar el evento'
                    )}
                    onClick={() => {
                        onMove(index, 1);
                    }}
                >
                    ↓
                </button>
                <button
                    type="button"
                    className={styles.dangerButton}
                    onClick={() => {
                        onRemove(index);
                    }}
                >
                    {t('commerce.owner.editor.venueEventsManager.removeEntry', 'Quitar')}
                </button>
            </div>

            <textarea
                className={styles.textarea}
                value={entry.description}
                placeholder={t(
                    'commerce.owner.editor.venueEventsManager.descriptionPlaceholder',
                    'Detalle opcional'
                )}
                aria-label={t(
                    'commerce.owner.editor.venueEventsManager.entryDescription',
                    'Descripción'
                )}
                onChange={(event) => {
                    onPatch(index, { description: event.target.value });
                }}
            />

            <div className={styles.row}>
                <label className={styles.radioLabel}>
                    <input
                        type="radio"
                        name={`recurrence-${index}`}
                        checked={entry.recurrence === 'weekly'}
                        onChange={() => {
                            onSetRecurrence(index, 'weekly');
                        }}
                    />
                    {t(
                        'commerce.owner.editor.venueEventsManager.recurrenceWeekly',
                        'Todas las semanas'
                    )}
                </label>
                <label className={styles.radioLabel}>
                    <input
                        type="radio"
                        name={`recurrence-${index}`}
                        checked={entry.recurrence === 'once'}
                        onChange={() => {
                            onSetRecurrence(index, 'once');
                        }}
                    />
                    {t('commerce.owner.editor.venueEventsManager.recurrenceOnce', 'Un solo día')}
                </label>
            </div>

            <div className={styles.row}>
                {entry.recurrence === 'weekly' ? (
                    <select
                        className={styles.input}
                        value={entry.weekday}
                        aria-label={t(
                            'commerce.owner.editor.venueEventsManager.weekday',
                            'Día de la semana'
                        )}
                        onChange={(event) => {
                            onPatch(index, { weekday: Number(event.target.value) });
                        }}
                    >
                        {WEEKDAY_I18N_KEYS.map((dayKey, dayIndex) => (
                            <option
                                key={dayKey}
                                value={dayIndex}
                            >
                                {t(`gastronomy.detail.openingHours.${dayKey}`, dayKey)}
                            </option>
                        ))}
                    </select>
                ) : (
                    <input
                        className={styles.input}
                        type="date"
                        value={entry.date}
                        aria-label={t('commerce.owner.editor.venueEventsManager.date', 'Fecha')}
                        onChange={(event) => {
                            onPatch(index, { date: event.target.value });
                        }}
                    />
                )}

                <input
                    className={styles.timeInput}
                    type="time"
                    value={entry.startTime}
                    aria-label={t(
                        'commerce.owner.editor.venueEventsManager.startTime',
                        'Hora de inicio'
                    )}
                    onChange={(event) => {
                        onPatch(index, { startTime: event.target.value });
                    }}
                />

                <input
                    className={styles.timeInput}
                    type="time"
                    value={entry.endTime}
                    aria-label={t(
                        'commerce.owner.editor.venueEventsManager.endTime',
                        'Hora de fin (opcional)'
                    )}
                    onChange={(event) => {
                        onPatch(index, { endTime: event.target.value });
                    }}
                />

                <label className={styles.activeLabel}>
                    <input
                        type="checkbox"
                        checked={entry.isActive}
                        onChange={(event) => {
                            onPatch(index, { isActive: event.target.checked });
                        }}
                    />
                    {t('commerce.owner.editor.venueEventsManager.active', 'Activo')}
                </label>
            </div>
        </fieldset>
    );
}
