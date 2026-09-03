/**
 * @file CommerceVenueEventsManager.client.tsx
 * @description The owner's venue-agenda editor for a gastronomy listing
 * (HOS-1042) — live music night, happy hour, dinner show, the Tuesday deal.
 *
 * Structurally the twin of `CommerceMenuManager`, simplified: a FLAT list of
 * entries, not sections-with-items, because an agenda has no course grouping.
 * Same persistence shape too — this panel owns its own endpoints
 * (`GET`/`PUT .../events`) and saves by an explicit button, in ONE `PUT` of
 * the whole document (reordering three entries while deleting a fourth is one
 * thought, and as one document it is one transaction). Nothing here reaches
 * the parent editor's PATCH or its dirty tracking (HOS-811).
 *
 * ## The 403 is a real state, not an error
 *
 * Keeping an agenda is a `gastronomy-pro` capability
 * (`MANAGE_GASTRONOMY_EVENTS`), and the page this mounts on carries no
 * entitlement information — the same situation `CommerceMenuManager` is in
 * for the structured carta. So the form renders for every owner and the API
 * decides; a refusal is shown as the upsell sentence it is, never as
 * "something went wrong". `GET .../events` is NOT gated — an owner whose plan
 * lapsed can still see (and re-enable) what they already typed; only `PUT`
 * can 403.
 *
 * ## Recurrence is two shapes, never both at once
 *
 * Mirrors `GastronomyEventInputSchema`'s refinement server-side: a `once`
 * entry carries `date` and no `weekday`; a `weekly` entry carries `weekday`
 * and no `date`. The single most likely bug here is submitting both (or
 * neither) after the owner flips the recurrence radio — `setRecurrence`
 * below clears the field the new shape does not use in the SAME state
 * update, and `saveEvents` only ever spreads the field the CURRENT
 * recurrence uses into the payload.
 */

import { GASTRONOMY_EVENTS_MAX_ENTRIES } from '@repo/schemas';
import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import type { EventDraft } from '@/lib/commerce/venue-event-draft';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { CommerceVenueEventEntryCard } from './CommerceVenueEventEntryCard.client';
import styles from './CommerceVenueEventsManager.module.css';

/** One agenda entry, as the API returns it. */
interface VenueEventRow {
    readonly title: string;
    readonly description: string | null;
    readonly recurrence: 'once' | 'weekly';
    readonly date: string | null;
    readonly weekday: number | null;
    readonly startTime: string;
    readonly endTime: string | null;
    readonly isActive: boolean;
}

/** Shape of `GET`/`PUT .../events`. */
interface EventsEnvelope {
    readonly events: readonly VenueEventRow[];
}

export interface CommerceVenueEventsManagerProps {
    /** UUID of the gastronomy listing. */
    readonly listingId: string;
    /** Active UI locale. */
    readonly locale: SupportedLocale;
}

const EMPTY_DRAFT: EventDraft = {
    title: '',
    description: '',
    recurrence: 'weekly',
    date: '',
    weekday: 1,
    startTime: '',
    endTime: '',
    isActive: true
};

/** What the panel is doing right now. */
type PanelState = 'loading' | 'idle' | 'saving';

/** Moves one entry of an array, returning a new array. Out-of-range is a no-op. */
function movedBy<T>(list: readonly T[], index: number, delta: number): T[] {
    const target = index + delta;
    if (target < 0 || target >= list.length) {
        return [...list];
    }
    const next = [...list];
    const [moved] = next.splice(index, 1);
    if (moved !== undefined) {
        next.splice(target, 0, moved);
    }
    return next;
}

export function CommerceVenueEventsManager({
    listingId,
    locale
}: CommerceVenueEventsManagerProps): JSX.Element {
    const { t } = createTranslations(locale);

    const [entries, setEntries] = useState<EventDraft[]>([]);
    const [state, setState] = useState<PanelState>('loading');
    const [message, setMessage] = useState<string | null>(null);
    const [isLocked, setIsLocked] = useState(false);

    const basePath = `/api/v1/protected/gastronomies/${listingId}/events`;

    // ── Load ────────────────────────────────────────────────────────────────
    // The panel reads its own state rather than receiving it from the SSR
    // page, for the same reason `CommerceMenuManager` does: the agenda is not
    // part of the listing payload the editor is built from.
    useEffect(() => {
        let cancelled = false;

        void (async () => {
            const result = await apiClient.get<EventsEnvelope>({ path: basePath });
            if (cancelled) {
                return;
            }
            if (result.ok) {
                setEntries(
                    result.data.events.map((event) => ({
                        title: event.title,
                        description: event.description ?? '',
                        recurrence: event.recurrence,
                        date: event.date ?? '',
                        weekday: event.weekday ?? 1,
                        startTime: event.startTime,
                        endTime: event.endTime ?? '',
                        isActive: event.isActive
                    }))
                );
            }
            setState('idle');
        })();

        return () => {
            cancelled = true;
        };
    }, [basePath]);

    // ── Entries ─────────────────────────────────────────────────────────────

    const addEntry = useCallback(() => {
        setEntries((prev) =>
            prev.length >= GASTRONOMY_EVENTS_MAX_ENTRIES ? prev : [...prev, { ...EMPTY_DRAFT }]
        );
    }, []);

    const removeEntry = useCallback((index: number) => {
        setEntries((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const moveEntry = useCallback((index: number, delta: number) => {
        setEntries((prev) => movedBy(prev, index, delta));
    }, []);

    const patchEntry = useCallback((index: number, patch: Partial<EventDraft>) => {
        setEntries((prev) =>
            prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
        );
    }, []);

    /**
     * Flips `recurrence` AND clears the field the new shape does not use, in
     * the SAME update — the state transition whose absence is the bug the
     * server schema's refinement exists to catch (see the file header).
     */
    const setRecurrence = useCallback(
        (index: number, recurrence: 'once' | 'weekly') => {
            patchEntry(
                index,
                recurrence === 'once' ? { recurrence, weekday: 1 } : { recurrence, date: '' }
            );
        },
        [patchEntry]
    );

    const saveEvents = useCallback(async () => {
        setState('saving');
        setMessage(null);

        // An entry without a title, or without a start time, is DROPPED
        // rather than rejected — the same treatment `CommerceMenuManager`
        // gives a nameless dish: an abandoned "add entry" click should not
        // fail the whole save.
        //
        // A `once` entry with no date joins them, and that third clause is not
        // cosmetic: the server's refinement REFUSES such an entry, so sending
        // it would fail the WHOLE document and lose the other entries the owner
        // did finish. A weekly entry needs no equivalent clause — `weekday`
        // carries a real default (see `EMPTY_DRAFT`), so it is never absent.
        const payload = {
            events: entries
                .filter(
                    (entry) =>
                        entry.title.trim().length > 0 &&
                        entry.startTime.length > 0 &&
                        (entry.recurrence !== 'once' || entry.date.length > 0)
                )
                .map((entry) => ({
                    title: entry.title.trim(),
                    description: entry.description.trim() || null,
                    recurrence: entry.recurrence,
                    // Exactly one of date/weekday, matching the recurrence —
                    // the server schema REJECTS a payload carrying both.
                    ...(entry.recurrence === 'once'
                        ? { date: entry.date || null }
                        : { weekday: entry.weekday }),
                    startTime: entry.startTime,
                    endTime: entry.endTime || null,
                    isActive: entry.isActive
                }))
        };

        const result = await apiClient.put<EventsEnvelope>({ path: basePath, body: payload });
        setState('idle');

        if (result.ok) {
            setMessage(t('commerce.owner.editor.venueEventsManager.saved', 'Agenda guardada.'));
            return;
        }

        // A refusal here is the plan speaking, not a failure. `status` is the
        // only thing that separates "your plan does not include this" from a
        // genuine error — same rule `CommerceMenuManager`'s save follows.
        if (result.error.status === 403) {
            setIsLocked(true);
            setMessage(
                t(
                    'commerce.owner.editor.venueEventsManager.locked',
                    'Mantener una agenda de eventos está disponible desde el plan Profesional.'
                )
            );
            return;
        }

        setMessage(
            t('commerce.owner.editor.venueEventsManager.saveError', 'No se pudo guardar la agenda.')
        );
    }, [basePath, entries, t]);

    const busy = state !== 'idle';
    const atMax = entries.length >= GASTRONOMY_EVENTS_MAX_ENTRIES;

    return (
        <section
            className={styles.panel}
            id="editor-venue-events"
        >
            <h2 className={styles.heading}>
                {t('commerce.owner.editor.venueEventsManager.title', 'Agenda del local')}
            </h2>
            <p className={styles.intro}>
                {t(
                    'commerce.owner.editor.venueEventsManager.intro',
                    'Contale a tus comensales cuándo pasa algo en tu local: música en vivo, happy hour, la promo de los martes.'
                )}
            </p>

            {entries.map((entry, index) => (
                <CommerceVenueEventEntryCard
                    // Index-keyed on purpose: a draft row has no id, and the
                    // whole list is re-submitted as a document.
                    // biome-ignore lint/suspicious/noArrayIndexKey: draft rows carry no stable id by design
                    key={`event-${index}`}
                    entry={entry}
                    index={index}
                    t={t}
                    onPatch={patchEntry}
                    onMove={moveEntry}
                    onRemove={removeEntry}
                    onSetRecurrence={setRecurrence}
                />
            ))}

            <button
                type="button"
                className={styles.secondaryButton}
                disabled={atMax}
                onClick={addEntry}
            >
                {t('commerce.owner.editor.venueEventsManager.addEntry', 'Agregar evento')}
            </button>

            {atMax ? (
                <p className={styles.intro}>
                    {t(
                        'commerce.owner.editor.venueEventsManager.maxReached',
                        'Llegaste al máximo de {{max}} eventos.',
                        { max: GASTRONOMY_EVENTS_MAX_ENTRIES }
                    )}
                </p>
            ) : null}

            {/*
             * `type="button"`, like every control here: this panel lives
             * INSIDE the editor's <form>, and a submit button would save the
             * listing instead of the agenda.
             */}
            <button
                type="button"
                className={styles.primaryButton}
                disabled={busy || isLocked}
                onClick={() => {
                    void saveEvents();
                }}
            >
                {state === 'saving'
                    ? t('commerce.owner.editor.venueEventsManager.saving', 'Guardando…')
                    : t('commerce.owner.editor.venueEventsManager.save', 'Guardar agenda')}
            </button>

            {message ? (
                <p
                    className={styles.message}
                    role="status"
                >
                    {message}
                </p>
            ) : null}
        </section>
    );
}
