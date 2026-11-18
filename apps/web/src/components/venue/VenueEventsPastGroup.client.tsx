/**
 * @file VenueEventsPastGroup.client.tsx
 * @description Presentational pieces of the venue-agenda editor that sit beside
 * the live entry cards (HOS-2254 and HOS-1854), split out of
 * `VenueEventsManager.client.tsx` to keep that file under the line ceiling:
 *
 * - {@link VenueEventsPastGroup}: the collapsed «Pasados» group. Past events are
 *   shown read-only with «Duplicar» and «Quitar», plus «Borrar todos los
 *   pasados». They carry no state of their own; every action goes up.
 * - {@link VenueEventsReadOnlyList}: the read-only agenda a locked section shows.
 */

import type { JSX } from 'react';
import type { TranslationFn } from '@/lib/i18n';
import type { EventDraft } from '@/lib/venue/venue-event-draft';
import styles from './VenueEventsManager.module.css';

/** Props of {@link VenueEventsPastGroup}. */
export interface VenueEventsPastGroupProps {
    /** The whole draft list; past entries are addressed by their position in it. */
    readonly entries: readonly EventDraft[];
    /** Positions (in `entries`) of the entries the API reported as past. */
    readonly pastIndexes: readonly number[];
    /** Whether the live ceiling is reached: duplicating would exceed it. */
    readonly atMax: boolean;
    readonly t: TranslationFn;
    readonly tPlural: (key: string, count: number, params?: Record<string, unknown>) => string;
    readonly onDuplicate: (index: number) => void;
    readonly onRemove: (index: number) => void;
    readonly onRemoveAll: () => void | Promise<void>;
}

/**
 * The collapsed «Pasados» group. Renders nothing when no entry is past.
 *
 * @param props - See {@link VenueEventsPastGroupProps}.
 * @returns The group, or `null`.
 */
export function VenueEventsPastGroup({
    entries,
    pastIndexes,
    atMax,
    t,
    tPlural,
    onDuplicate,
    onRemove,
    onRemoveAll
}: VenueEventsPastGroupProps): JSX.Element | null {
    if (pastIndexes.length === 0) {
        return null;
    }
    return (
        <details
            className={styles.pastGroup}
            data-testid="venue-events-past"
        >
            <summary className={styles.pastSummary}>
                {t('venue.owner.editor.venueEventsManager.pastTitle', 'Pasados')}
                {' ('}
                {tPlural('venue.owner.editor.venueEventsManager.pastCount', pastIndexes.length, {
                    count: pastIndexes.length
                })}
                {')'}
            </summary>
            <p className={styles.intro}>
                {t(
                    'venue.owner.editor.venueEventsManager.pastRetentionHint',
                    'Los eventos pasados se borran solos a los 60 días.'
                )}
            </p>
            {pastIndexes.map((index) => {
                const entry = entries[index];
                if (!entry) {
                    return null;
                }
                return (
                    <div
                        key={`past-event-${index}`}
                        className={styles.card}
                    >
                        <p className={styles.readOnlyName}>{entry.title}</p>
                        <p className={styles.intro}>
                            {`${entry.date} · ${entry.startTime}${
                                entry.endTime ? ` – ${entry.endTime}` : ''
                            }`}
                        </p>
                        <div className={styles.row}>
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                disabled={atMax}
                                onClick={() => {
                                    onDuplicate(index);
                                }}
                            >
                                {t('venue.owner.editor.venueEventsManager.duplicate', 'Duplicar')}
                            </button>
                            <button
                                type="button"
                                className={styles.dangerButton}
                                onClick={() => {
                                    onRemove(index);
                                }}
                            >
                                {t('venue.owner.editor.venueEventsManager.removeEntry', 'Quitar')}
                            </button>
                        </div>
                    </div>
                );
            })}
            <button
                type="button"
                className={styles.dangerButton}
                onClick={onRemoveAll}
            >
                {t(
                    'venue.owner.editor.venueEventsManager.removeAllPast',
                    'Borrar todos los pasados'
                )}
            </button>
        </details>
    );
}

/** Props of {@link VenueEventsReadOnlyList}. */
export interface VenueEventsReadOnlyListProps {
    readonly entries: readonly EventDraft[];
    readonly t: TranslationFn;
    /** The seven weekday names, `0` = Sunday. */
    readonly weekdayLabels: readonly string[];
}

/**
 * The agenda as read-only cards, for a section the plan locks (HOS-1854).
 *
 * @param props - See {@link VenueEventsReadOnlyListProps}.
 * @returns The cards.
 */
export function VenueEventsReadOnlyList({
    entries,
    t,
    weekdayLabels
}: VenueEventsReadOnlyListProps): JSX.Element {
    return (
        <>
            {entries.map((entry, index) => (
                <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: stored rows carry no id in this draft shape
                    key={`locked-event-${index}`}
                    className={styles.card}
                >
                    <p className={styles.readOnlyName}>{entry.title}</p>
                    {entry.description ? <p className={styles.intro}>{entry.description}</p> : null}
                    <p className={styles.intro}>
                        {entry.recurrence === 'weekly'
                            ? t(
                                  'venue.owner.editor.venueEventsManager.recurrenceWeekly',
                                  'Todas las semanas'
                              )
                            : t(
                                  'venue.owner.editor.venueEventsManager.recurrenceOnce',
                                  'Un solo día'
                              )}
                        {entry.recurrence === 'weekly'
                            ? ` · ${weekdayLabels[entry.weekday] ?? ''}`
                            : entry.date
                              ? ` · ${entry.date}`
                              : ''}
                        {` · ${entry.startTime}${entry.endTime ? ` – ${entry.endTime}` : ''}`}
                    </p>
                    {entry.isActive ? null : (
                        <p className={styles.readOnlyNote}>
                            {t('venue.owner.editor.lockedSection.inactive', 'No se muestra')}
                        </p>
                    )}
                </div>
            ))}
        </>
    );
}
