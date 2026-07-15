/**
 * @file OccupancyEventEditDialog.client.tsx
 * @description Modal to edit or delete a MANUAL occupancy event (HOS-175).
 *
 * Opened by clicking a manual event bar in `CalendarSection`. Lets the host
 * change the event's start/end dates and its text, or delete the block
 * entirely. Sync-sourced events (Google/Airbnb/Booking/other) are never edited
 * here — only manual blocks reach this dialog.
 *
 * The dialog is presentational + local-form only: it owns the input state and
 * range validation, and delegates the actual persistence (atomic move + text
 * change, or delete) to the parent via `onSave` / `onDelete`.
 *
 * @module components/host/editor/OccupancyEventEditDialog
 */

import { useEffect, useId, useState } from 'react';
import {
    Dialog,
    DialogBody,
    DialogFooter,
    DialogHeader
} from '@/components/shared/ui/Dialog.client';
import type { TranslationFn } from '@/lib/i18n';
import styles from './CalendarSection.module.css';

/** The manual event currently being edited. */
export interface EditableOccupancyEvent {
    /** First occupied day, `YYYY-MM-DD`. */
    readonly startKey: string;
    /** Last occupied day (inclusive), `YYYY-MM-DD`. */
    readonly endKey: string;
    /** The event's current text (manual note), or null. */
    readonly title: string | null;
}

/** Payload emitted on save — the edited range + text. */
export interface OccupancyEventEditSave {
    readonly newStartDate: string;
    readonly newEndDate: string;
    readonly note: string | null;
}

/** Props for OccupancyEventEditDialog. */
export interface OccupancyEventEditDialogProps {
    readonly isOpen: boolean;
    readonly t: TranslationFn;
    /** The event to edit. `null` renders nothing (dialog closed). */
    readonly event: EditableOccupancyEvent | null;
    /**
     * Earliest selectable date (`YYYY-MM-DD`), applied as the start input's
     * `min`. Occupancy is future-facing, so the caller passes today's key to
     * stop a block being moved into the past.
     */
    readonly minDate?: string;
    /** Whether a save/delete request is in flight. */
    readonly isSubmitting: boolean;
    /** A server-side error message to show, or null. */
    readonly error: string | null;
    readonly onSave: (input: OccupancyEventEditSave) => void;
    readonly onDelete: () => void;
    readonly onClose: () => void;
}

/**
 * Edit/delete dialog for a manual occupancy event.
 */
export function OccupancyEventEditDialog({
    isOpen,
    t,
    event,
    minDate,
    isSubmitting,
    error,
    onSave,
    onDelete,
    onClose
}: OccupancyEventEditDialogProps) {
    const titleId = useId();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [note, setNote] = useState('');
    const [validationError, setValidationError] = useState<'range' | 'past' | null>(null);

    // Re-seed the form whenever a different event is opened for editing.
    useEffect(() => {
        if (!event) return;
        setStartDate(event.startKey);
        setEndDate(event.endKey);
        setNote(event.title ?? '');
        setValidationError(null);
    }, [event]);

    const handleSave = () => {
        if (endDate < startDate) {
            setValidationError('range');
            return;
        }
        // Enforce the future-facing constraint on save, not just via the
        // picker's `min` (which a typed value can bypass). Only guard a MOVE
        // into the past — a block whose start is already before `minDate` (an
        // ongoing event) can still be saved as long as it isn't pushed earlier.
        if (minDate && startDate < minDate && startDate < (event?.startKey ?? minDate)) {
            setValidationError('past');
            return;
        }
        setValidationError(null);
        onSave({
            newStartDate: startDate,
            newEndDate: endDate,
            note: note.trim() ? note.trim() : null
        });
    };

    if (!event) return null;

    const closeLabel = t('host.properties.editor.calendarSync.close', 'Cerrar');

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            size="sm"
            ariaLabelledBy={titleId}
        >
            <DialogHeader
                onClose={onClose}
                closeLabel={closeLabel}
                titleId={titleId}
            >
                {t('host.properties.editor.calendar.editEvent.title', 'Editar bloqueo')}
            </DialogHeader>
            <DialogBody>
                <div className={styles.editForm}>
                    <label className={styles.noteField}>
                        <span>
                            {t('host.properties.editor.calendar.editEvent.startLabel', 'Desde')}
                        </span>
                        <input
                            type="date"
                            className={styles.editInput}
                            value={startDate}
                            min={minDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            disabled={isSubmitting}
                        />
                    </label>
                    <label className={styles.noteField}>
                        <span>
                            {t('host.properties.editor.calendar.editEvent.endLabel', 'Hasta')}
                        </span>
                        <input
                            type="date"
                            className={styles.editInput}
                            value={endDate}
                            min={startDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            disabled={isSubmitting}
                        />
                    </label>
                    <label className={styles.noteField}>
                        <span>
                            {t(
                                'host.properties.editor.calendar.editEvent.textLabel',
                                'Texto (opcional)'
                            )}
                        </span>
                        <input
                            type="text"
                            className={styles.editInput}
                            value={note}
                            maxLength={500}
                            placeholder={t(
                                'host.properties.editor.calendar.editEvent.textPlaceholder',
                                'Ej: reservado fuera de la plataforma'
                            )}
                            onChange={(e) => setNote(e.target.value)}
                            disabled={isSubmitting}
                        />
                    </label>

                    {validationError && (
                        <div
                            className={styles.error}
                            role="alert"
                        >
                            {validationError === 'past'
                                ? t(
                                      'host.properties.editor.calendar.editEvent.pastError',
                                      'No podés mover el bloqueo a una fecha pasada.'
                                  )
                                : t(
                                      'host.properties.editor.calendar.editEvent.rangeError',
                                      'La fecha de fin no puede ser anterior a la de inicio.'
                                  )}
                        </div>
                    )}
                    {error && (
                        <div
                            className={styles.error}
                            role="alert"
                        >
                            {error}
                        </div>
                    )}
                </div>
            </DialogBody>
            <DialogFooter>
                <div className={styles.editFooterSpread}>
                    <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={onDelete}
                        disabled={isSubmitting}
                    >
                        {isSubmitting
                            ? t(
                                  'host.properties.editor.calendar.editEvent.deleting',
                                  'Eliminando...'
                              )
                            : t(
                                  'host.properties.editor.calendar.editEvent.delete',
                                  'Eliminar bloqueo'
                              )}
                    </button>
                    <div className={styles.editFooterActions}>
                        <button
                            type="button"
                            className={styles.cancelButton}
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            {t('host.properties.editor.calendar.editEvent.cancel', 'Cancelar')}
                        </button>
                        <button
                            type="button"
                            className={styles.saveButton}
                            onClick={handleSave}
                            disabled={isSubmitting}
                        >
                            {isSubmitting
                                ? t(
                                      'host.properties.editor.calendar.editEvent.saving',
                                      'Guardando...'
                                  )
                                : t(
                                      'host.properties.editor.calendar.editEvent.save',
                                      'Guardar cambios'
                                  )}
                        </button>
                    </div>
                </div>
            </DialogFooter>
        </Dialog>
    );
}
