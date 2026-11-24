/**
 * @file use-occupancy-selection.ts
 * @description Range selection and manual-event editing of the occupancy
 * calendar (HOS-43 / HOS-175, split out of `CalendarSection` by HOS-2503).
 *
 * Interaction model — "click start, click end" (not click-drag):
 * 1. Click a day with no pending selection -> it becomes the pending range
 *    start (highlighted).
 * 2. Click any other day (or the same day again, for a single-day
 *    selection) -> the inclusive range between the two is selected and an
 *    action bar appears.
 * 3. Clicking a day again while a confirmed selection is showing starts a
 *    fresh selection (implicit cancel-and-restart).
 *
 * Mutations always go through the batch endpoint — a single day is simply a
 * one-element date list, so there is only one mutation code path.
 *
 * Known, accepted limitation (HOS-175): occupancy is fetched month-scoped, so
 * a manual block that spans a month boundary is edited/deleted per month.
 */

import { useCallback, useState } from 'react';
import { accommodationOccupancyApi } from '@/lib/api/endpoints-protected';
import { visibleApiMessage } from '@/lib/api-errors';
import type { OccupancyEvent } from '@/lib/calendar/occupancy-bar-layout';
import { buildDateRangeKeys, type DateKey } from '@/lib/calendar/occupancy-calendar-grid';
import { groupOccupancyRowsByDate } from '@/lib/calendar/occupancy-row-grouping';
import type { TranslationFn } from '@/lib/i18n';
import type { OccupancyEventEditSave } from './OccupancyEventEditDialog.client';
import type { UseOccupancyMonthResult } from './use-occupancy-month';

/** Input of {@link useOccupancySelection}. */
export interface UseOccupancySelectionInput {
    /** The accommodation being edited. */
    readonly accommodationId: string;
    /** Translator for the error copy. */
    readonly t: TranslationFn;
    /** Writes the grouped rows after a batch mutation. */
    readonly setOccupancyByDate: UseOccupancyMonthResult['setOccupancyByDate'];
    /** Re-fetches the viewed month after an edit or a delete. */
    readonly reload: () => void;
}

/** What {@link useOccupancySelection} returns. */
export interface UseOccupancySelectionResult {
    readonly pendingStart: DateKey | null;
    readonly selection: readonly DateKey[] | null;
    readonly note: string;
    readonly setNote: (value: string) => void;
    readonly isSubmitting: boolean;
    readonly submitError: string | null;
    readonly handleDayClick: (dateKey: DateKey) => void;
    readonly handleCancelSelection: () => void;
    readonly handleApply: (isBlocked: boolean) => Promise<void>;
    readonly editingEvent: OccupancyEvent | null;
    readonly setEditingEvent: (event: OccupancyEvent | null) => void;
    readonly editSubmitting: boolean;
    readonly editError: string | null;
    readonly handleEditSave: (save: OccupancyEventEditSave) => Promise<void>;
    readonly handleEditDelete: () => Promise<void>;
    readonly handleEditClose: () => void;
    readonly viewingEvent: OccupancyEvent | null;
    readonly setViewingEvent: (event: OccupancyEvent | null) => void;
}

/**
 * Range selection, batch apply and the manual-event edit/delete handlers.
 *
 * @param input - See {@link UseOccupancySelectionInput}.
 * @returns See {@link UseOccupancySelectionResult}.
 */
export function useOccupancySelection({
    accommodationId,
    t,
    setOccupancyByDate,
    reload
}: UseOccupancySelectionInput): UseOccupancySelectionResult {
    const [pendingStart, setPendingStart] = useState<DateKey | null>(null);
    const [selection, setSelection] = useState<readonly DateKey[] | null>(null);
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const [editingEvent, setEditingEvent] = useState<OccupancyEvent | null>(null);
    const [editSubmitting, setEditSubmitting] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);
    // Sync-event detail dialog: "why is this day blocked?". A sync bar used to
    // be hover-only (native `title`), unreachable on a phone (H-131).
    const [viewingEvent, setViewingEvent] = useState<OccupancyEvent | null>(null);

    const handleDayClick = useCallback(
        (dateKey: DateKey) => {
            setSubmitError(null);
            if (pendingStart) {
                setSelection(buildDateRangeKeys({ startKey: pendingStart, endKey: dateKey }));
                setPendingStart(null);
            } else {
                setSelection(null);
                setPendingStart(dateKey);
            }
        },
        [pendingStart]
    );

    const handleCancelSelection = useCallback(() => {
        setPendingStart(null);
        setSelection(null);
        setNote('');
        setSubmitError(null);
    }, []);

    const handleApply = useCallback(
        async (isBlocked: boolean) => {
            if (!selection || selection.length === 0) return;

            setIsSubmitting(true);
            setSubmitError(null);

            const result = await accommodationOccupancyApi.batchToggle({
                id: accommodationId,
                dates: selection,
                isBlocked,
                note: isBlocked && note.trim() ? note.trim() : undefined
            });

            if (result.ok) {
                // Response covers EVERY row (any source) for the requested
                // dates, so delete-then-repopulate per date stays accurate.
                const grouped = groupOccupancyRowsByDate({ rows: result.data.occupancy });
                setOccupancyByDate((prev) => {
                    const next = { ...prev };
                    for (const dateKey of selection) {
                        delete next[dateKey];
                    }
                    return { ...next, ...grouped };
                });
                setSelection(null);
                setPendingStart(null);
                setNote('');
            } else {
                setSubmitError(
                    visibleApiMessage({ error: result.error }) ||
                        t(
                            'host.properties.editor.calendar.applyError',
                            'No pudimos actualizar el calendario. Intentá de nuevo.'
                        )
                );
            }
            setIsSubmitting(false);
        },
        [selection, accommodationId, note, t, setOccupancyByDate]
    );

    const handleEditSave = useCallback(
        async ({ newStartDate, newEndDate, note: newNote }: OccupancyEventEditSave) => {
            if (!editingEvent) return;
            setEditSubmitting(true);
            setEditError(null);

            const result = await accommodationOccupancyApi.updateEvent({
                id: accommodationId,
                oldStartDate: editingEvent.startKey,
                oldEndDate: editingEvent.endKey,
                newStartDate,
                newEndDate,
                note: newNote
            });

            if (result.ok) {
                setEditingEvent(null);
                reload();
            } else {
                setEditError(
                    visibleApiMessage({ error: result.error }) ||
                        t(
                            'host.properties.editor.calendar.editEvent.saveError',
                            'No pudimos guardar los cambios. Intentá de nuevo.'
                        )
                );
            }
            setEditSubmitting(false);
        },
        [editingEvent, accommodationId, t, reload]
    );

    const handleEditDelete = useCallback(async () => {
        if (!editingEvent) return;
        setEditSubmitting(true);
        setEditError(null);

        // Deleting a manual event = unblocking its full date range (only the
        // MANUAL rows are removed server-side; any sync rows are left in place).
        const result = await accommodationOccupancyApi.batchToggle({
            id: accommodationId,
            dates: buildDateRangeKeys({
                startKey: editingEvent.startKey,
                endKey: editingEvent.endKey
            }),
            isBlocked: false
        });

        if (result.ok) {
            setEditingEvent(null);
            reload();
        } else {
            setEditError(
                visibleApiMessage({ error: result.error }) ||
                    t(
                        'host.properties.editor.calendar.editEvent.deleteError',
                        'No pudimos eliminar el bloqueo. Intentá de nuevo.'
                    )
            );
        }
        setEditSubmitting(false);
    }, [editingEvent, accommodationId, t, reload]);

    const handleEditClose = useCallback(() => {
        setEditingEvent(null);
        setEditError(null);
    }, []);

    return {
        pendingStart,
        selection,
        note,
        setNote,
        isSubmitting,
        submitError,
        handleDayClick,
        handleCancelSelection,
        handleApply,
        editingEvent,
        setEditingEvent,
        editSubmitting,
        editError,
        handleEditSave,
        handleEditDelete,
        handleEditClose,
        viewingEvent,
        setViewingEvent
    };
}
