/**
 * @file VenueEventsManager.client.tsx
 * @description The owner's venue-agenda editor for a venue listing
 * (HOS-1042) — live music night, happy hour, dinner show, the Tuesday deal.
 *
 * Structurally the twin of `VenueMenuManager`, simplified: a FLAT list of
 * entries, not sections-with-items, because an agenda has no course grouping.
 * Same persistence shape too — this panel owns its own endpoints
 * (`GET`/`PUT .../events`) and saves by an explicit button, in ONE `PUT` of
 * the whole document (reordering three entries while deleting a fourth is one
 * thought, and as one document it is one transaction). Nothing here reaches
 * the parent editor's PATCH or its dirty tracking (HOS-811).
 *
 * ## The 403 is a real state, not an error
 *
 * Keeping an agenda is a `venue-pro` capability
 * (`MANAGE_VENUE_EVENTS`), and the page this mounts on carries no
 * entitlement information — the same situation `VenueMenuManager` is in
 * for the structured carta. So the form renders for every owner and the API
 * decides; a refusal is shown as the upsell sentence it is, never as
 * "something went wrong". `GET .../events` is NOT gated — an owner whose plan
 * lapsed can still see (and re-enable) what they already typed; only `PUT`
 * can 403.
 *
 * ## Recurrence is two shapes, never both at once
 *
 * Mirrors `VenueEventInputSchema`'s refinement server-side: a `once`
 * entry carries `date` and no `weekday`; a `weekly` entry carries `weekday`
 * and no `date`. The single most likely bug here is submitting both (or
 * neither) after the owner flips the recurrence radio — `setRecurrence`
 * below clears the field the new shape does not use in the SAME state
 * update, and `saveEvents` only ever spreads the field the CURRENT
 * recurrence uses into the payload.
 */

import { VENUE_EVENTS_MAX_ENTRIES } from '@repo/schemas';
import type { JSX } from 'react';
import { useCallback, useEffect, useId, useState } from 'react';
import { type ListingPlanGate, useListingPlanGate } from '@/hooks/useListingPlanGate';
import { useSectionVaciar } from '@/hooks/useSectionVaciar';
import { apiClient } from '@/lib/api/client';
import { showConfirmationDialog } from '@/lib/forms/show-confirmation-dialog';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import {
    countCurrent,
    describeAgendaSaveError,
    draftFromRow,
    EMPTY_DRAFT,
    type EventDraft,
    isTicketUrlValid,
    movedBy,
    type VenueEventRow
} from '@/lib/venue/venue-event-draft';
import { VenueEventEntryCard } from './VenueEventEntryCard.client';
import styles from './VenueEventsManager.module.css';
import { VenueEventsPastGroup, VenueEventsReadOnlyList } from './VenueEventsPastGroup.client';
import {
    translateUpsell,
    VenueSectionLockedPanel,
    type VenueSectionState
} from './VenueSectionLockedPanel.client';

/** The entitlement the venue agenda write requires. */
const VENUE_EVENTS_ENTITLEMENT = 'manage_venue_events';

/**
 * Catalog-plan wording for the venue agenda upsell. Shared by the proactive
 * panel and the runtime 403 so the two can never disagree.
 */
const VENUE_EVENTS_UPSELL_COPY = {
    key: 'venue.owner.editor.venueEventsManager.locked',
    fallback: 'Mantener una agenda de eventos está disponible desde el plan {{plan}}.',
    noPlanKey: 'venue.owner.editor.venueEventsManager.lockedNoPlan',
    noPlanFallback: 'Mantener una agenda de eventos está disponible en un plan pago.'
} as const;

/** Shape of `GET`/`PUT .../events`. */
interface EventsEnvelope {
    readonly events: readonly VenueEventRow[];
}

export interface VenueEventsManagerProps {
    /** UUID of the venue listing. */
    readonly listingId: string;
    /** Active UI locale. */
    readonly locale: SupportedLocale;
    /**
     * The seven weekday names, already localised, `0` = Sunday … `6` = Saturday.
     *
     * Threaded straight through to `VenueEventEntryCard` — see that
     * prop's doc for why these are resolved on the Astro page instead of looked
     * up inside the island.
     */
    readonly weekdayLabels: readonly string[];
    /**
     * The resolved state of this listing's `venueEvents` section (HOS-1854).
     * A locked section is read-only and shows its upsell on first render.
     */
    readonly sectionState?: VenueSectionState;
    /** Localized name of the cheapest catalog plan that unlocks this section. */
    readonly upsellPlanName?: string | null;
}

/** What the panel is doing right now. */
type PanelState = 'loading' | 'idle' | 'saving';

export function VenueEventsManager({
    listingId,
    locale,
    weekdayLabels,
    sectionState = 'available',
    upsellPlanName
}: VenueEventsManagerProps): JSX.Element {
    const { t, tPlural } = createTranslations(locale);

    const [entries, setEntries] = useState<EventDraft[]>([]);
    const [state, setState] = useState<PanelState>('loading');
    const [message, setMessage] = useState<string | null>(null);
    const [isLocked, setIsLocked] = useState(false);
    /** Index of a just-duplicated entry whose date field should take focus. */
    const [focusIndex, setFocusIndex] = useState<number | null>(null);
    /** HOS-1854. See {@link VenueDailySpecialsManager} for the same wiring. */
    const { gate: readGate } = useListingPlanGate({
        vertical: 'venue',
        entitlementKey: VENUE_EVENTS_ENTITLEMENT
    });
    const isSectionLocked = sectionState === 'locked';
    const lockedGate: Exclude<ListingPlanGate, 'open'> = readGate === 'open' ? 'plan' : readGate;
    const planNoticeId = useId();

    const basePath = `/api/v1/protected/venues/${listingId}/events`;

    // ── Load ────────────────────────────────────────────────────────────────
    // The panel reads its own state rather than receiving it from the SSR
    // page, for the same reason `VenueMenuManager` does: the agenda is not
    // part of the listing payload the editor is built from.
    //
    // Protected read, same reason as `VenueMenuManager` (HOS-1854): without the
    // session cookie the API answers 401 and a locked section renders empty.
    useEffect(() => {
        let cancelled = false;

        void (async () => {
            const result = await apiClient.getProtected<EventsEnvelope>({ path: basePath });
            if (cancelled) {
                return;
            }
            if (result.ok) {
                setEntries(result.data.events.map(draftFromRow));
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
            countCurrent(prev) >= VENUE_EVENTS_MAX_ENTRIES ? prev : [...prev, { ...EMPTY_DRAFT }]
        );
    }, []);

    /**
     * HOS-2254. Copies a past event into a new LIVE draft with the date cleared,
     * so the owner has to pick a new one, and focuses that date field. The past
     * original stays where it is until the owner removes it.
     */
    const duplicateEntry = useCallback(
        (index: number) => {
            const source = entries[index];
            if (!source || countCurrent(entries) >= VENUE_EVENTS_MAX_ENTRIES) {
                return;
            }
            const { id: _id, isPast: _isPast, ...rest } = source;
            setEntries([...entries, { ...rest, date: '', isActive: true }]);
            setFocusIndex(entries.length);
        },
        [entries]
    );

    const removeAllPast = useCallback(async () => {
        // HOS-957: the product-styled dialog, never a native browser one.
        const confirmed = await showConfirmationDialog({
            title: t(
                'venue.owner.editor.venueEventsManager.removeAllPastTitle',
                'Borrar eventos pasados'
            ),
            message: t(
                'venue.owner.editor.venueEventsManager.removeAllPastConfirm',
                '¿Borrar todos los eventos pasados? Se quitan al guardar la agenda.'
            ),
            confirmLabel: t(
                'venue.owner.editor.venueEventsManager.removeAllPastConfirmButton',
                'Borrar'
            ),
            cancelLabel: t('common.cancel', 'Cancelar')
        });
        if (!confirmed) {
            return;
        }
        setEntries((prev) => prev.filter((entry) => !entry.isPast));
    }, [t]);

    // Focus the date input of the entry `duplicateEntry` just appended.
    useEffect(() => {
        if (focusIndex === null) {
            return;
        }
        document.getElementById(`venue-event-date-${focusIndex}`)?.focus();
        setFocusIndex(null);
    }, [focusIndex]);

    const removeEntry = useCallback((index: number) => {
        setEntries((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const moveEntry = useCallback((index: number, delta: number) => {
        // Past entries live in their own group, so a move steps over them: the
        // target is the neighbouring LIVE entry, not the neighbouring array slot.
        setEntries((prev) => {
            const live = prev.flatMap((entry, i) => (entry.isPast ? [] : [i]));
            const position = live.indexOf(index);
            const target = live[position + delta];
            if (position < 0 || target === undefined) {
                return prev;
            }
            return movedBy(prev, index, target - index);
        });
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
        // A malformed ticket link blocks the save (HOS-2255); the card shows
        // the field-level message, this one says why nothing was sent.
        if (entries.some((entry) => !entry.isPast && !isTicketUrlValid(entry.ticketUrl))) {
            setMessage(
                t(
                    'venue.owner.editor.venueEventsManager.ticketUrlInvalid',
                    'El link de entradas tiene que empezar con https:// y no puede llevar usuario ni contraseña.'
                )
            );
            return;
        }
        setState('saving');
        setMessage(null);

        // An entry without a title, or without a start time, is DROPPED
        // rather than rejected — the same treatment `VenueMenuManager`
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
                    // Stored events send their id back so they keep it (HOS-2291).
                    ...(entry.id ? { id: entry.id } : {}),
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
                    ticketUrl: entry.ticketUrl.trim() || null,
                    isActive: entry.isActive
                }))
        };

        const result = await apiClient.put<EventsEnvelope>({ path: basePath, body: payload });
        setState('idle');

        if (result.ok) {
            setMessage(t('venue.owner.editor.venueEventsManager.saved', 'Agenda guardada.'));
            return;
        }

        // A refusal here is the plan speaking, not a failure. `status` is the
        // only thing that separates "your plan does not include this" from a
        // genuine error — same rule `VenueMenuManager`'s save follows.
        if (result.error.status === 403) {
            setIsLocked(true);
            setMessage(
                translateUpsell({ t, planName: upsellPlanName, ...VENUE_EVENTS_UPSELL_COPY })
            );
            return;
        }

        // A 400 carrying one of our stable keys is explained specifically
        // (which new event is dated in the past, which ceiling was hit).
        const specific =
            result.error.status === 400
                ? describeAgendaSaveError({ message: result.error.message, entries, t })
                : null;
        setMessage(
            specific ??
                t(
                    'venue.owner.editor.venueEventsManager.saveError',
                    'No se pudo guardar la agenda.'
                )
        );
    }, [basePath, entries, t, upsellPlanName]);

    /**
     * HOS-1854. Empties a locked agenda through the API's `delete` intent: an
     * empty `events` array classifies the write as a deletion (DEC-FAC-041),
     * authorized even on a locked section.
     */
    const clearEvents = useCallback(async (): Promise<boolean> => {
        setState('saving');
        setMessage(null);

        const result = await apiClient.put<EventsEnvelope>({
            path: basePath,
            body: { events: [] }
        });
        setState('idle');

        if (!result.ok) {
            setMessage(
                t('venue.owner.editor.lockedSection.vaciarError', 'No se pudo vaciar la sección.')
            );
            return false;
        }

        setEntries([]);
        setMessage(t('venue.owner.editor.lockedSection.vaciarSuccess', 'Se vació la sección.'));
        return true;
    }, [basePath, t]);

    const vaciar = useSectionVaciar({ clear: clearEvents });

    const busy = state !== 'idle';
    // The ceiling counts the entries that are not past (HOS-2254).
    const atMax = countCurrent(entries) >= VENUE_EVENTS_MAX_ENTRIES;
    const pastIndexes = entries.flatMap((entry, i) => (entry.isPast ? [i] : []));

    return (
        <section
            className={styles.panel}
            id="editor-venue-events"
        >
            <h2 className={styles.heading}>
                {t('venue.owner.editor.venueEventsManager.title', 'Agenda del local')}
            </h2>
            <p className={styles.intro}>
                {t(
                    'venue.owner.editor.venueEventsManager.intro',
                    'Contale a tus comensales cuándo pasa algo en tu local: música en vivo, happy hour, la promo de los martes.'
                )}
            </p>

            {isSectionLocked ? (
                <VenueSectionLockedPanel
                    id={planNoticeId}
                    gate={lockedGate}
                    locale={locale}
                    messageKey="venue.owner.editor.venueEventsManager.locked"
                    messageFallback="Mantener una agenda de eventos está disponible desde el plan {{plan}}."
                    noPlanMessageFallback="Mantener una agenda de eventos está disponible en un plan pago."
                    planName={upsellPlanName}
                    preTrialMessageKey="venue.owner.editor.venueEventsManager.lockedPreTrial"
                    preTrialMessageFallback="La agenda de eventos se habilita cuando publiques tu ficha."
                    sectionLabel={t(
                        'venue.owner.editor.venueEventsManager.title',
                        'Agenda del local'
                    )}
                    hasData={entries.length > 0}
                    vaciar={vaciar}
                >
                    {entries.length === 0 ? (
                        <p className={styles.intro}>
                            {t(
                                'venue.owner.editor.lockedSection.empty',
                                'No hay datos cargados en esta sección.'
                            )}
                        </p>
                    ) : (
                        <VenueEventsReadOnlyList
                            entries={entries}
                            t={t}
                            weekdayLabels={weekdayLabels}
                        />
                    )}
                </VenueSectionLockedPanel>
            ) : (
                <>
                    {entries.map((entry, index) =>
                        entry.isPast ? null : (
                            <VenueEventEntryCard
                                // Index-keyed on purpose: a draft row has no id, and the
                                // whole list is re-submitted as a document.
                                // biome-ignore lint/suspicious/noArrayIndexKey: draft rows carry no stable id by design
                                key={`event-${index}`}
                                entry={entry}
                                index={index}
                                t={t}
                                weekdayLabels={weekdayLabels}
                                onPatch={patchEntry}
                                onMove={moveEntry}
                                onRemove={removeEntry}
                                onSetRecurrence={setRecurrence}
                            />
                        )
                    )}

                    <button
                        type="button"
                        className={styles.secondaryButton}
                        disabled={atMax}
                        onClick={addEntry}
                    >
                        {t('venue.owner.editor.venueEventsManager.addEntry', 'Agregar evento')}
                    </button>

                    {atMax ? (
                        <p className={styles.intro}>
                            {/*
                             * `tPlural`, not `t`: the sentence interpolates a count next
                             * to a noun, so at `max = 1` a single form would read
                             * "máximo de 1 eventos". The ceiling is 30 today and the
                             * singular is unreachable — which is exactly why it is
                             * wired now rather than left for whoever lowers it.
                             */}
                            {tPlural(
                                'venue.owner.editor.venueEventsManager.maxReached',
                                VENUE_EVENTS_MAX_ENTRIES,
                                { max: VENUE_EVENTS_MAX_ENTRIES }
                            )}
                        </p>
                    ) : null}

                    <VenueEventsPastGroup
                        entries={entries}
                        pastIndexes={pastIndexes}
                        atMax={atMax}
                        t={t}
                        tPlural={tPlural}
                        onDuplicate={duplicateEntry}
                        onRemove={removeEntry}
                        onRemoveAll={removeAllPast}
                    />

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
                            ? t('venue.owner.editor.venueEventsManager.saving', 'Guardando…')
                            : t('venue.owner.editor.venueEventsManager.save', 'Guardar agenda')}
                    </button>
                </>
            )}

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
