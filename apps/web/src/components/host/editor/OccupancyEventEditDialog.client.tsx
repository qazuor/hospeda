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
    const [rangeError, setRangeError] = useState(false);

    // Re-seed the form whenever a different event is opened for editing.
    useEffect(() => {
        if (!event) return;
        setStartDate(event.startKey);
        setEndDate(event.endKey);
        setNote(event.title ?? '');
        setRangeError(false);
    }, [event]);

    const handleSave = () => {
        if (endDate < startDate) {
            setRangeError(true);
            return;
        }
        setRangeError(false);
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

                    {rangeError && (
                        <div
                            className={styles.error}
                            role="alert"
                        >
                            {t(
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
