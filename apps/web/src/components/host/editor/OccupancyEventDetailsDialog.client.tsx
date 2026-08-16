/**
 * @file OccupancyEventDetailsDialog.client.tsx
 * @description Read-only detail dialog for a SYNC-sourced occupancy block.
 *
 * The manual counterpart is `OccupancyEventEditDialog`, which edits and deletes.
 * This one deliberately does neither: a block that came from a connected
 * calendar is not the host's to change here — the next sync run would simply
 * write it back. It answers one question instead: **why is this day blocked?**
 *
 * ## Why it exists
 *
 * H-131 imported five contact birthdays as occupancy, so hosts had days blocked
 * they did not recognise. The obvious response — "surely the calendar shows what
 * it is" — turned out to be only half true, and the half that was missing is the
 * half a confused host actually needs:
 *
 * - The bar DOES render the event title, but a one-day block occupies a seventh
 *   of the calendar width, so the text is truncated to a few characters.
 * - The full text was reachable only through the native `title` tooltip, i.e.
 *   only on hover — which does not exist on a phone.
 * - The bar was a `<div aria-hidden="true">`, so a screen-reader user was told
 *   the day is occupied and never told by what.
 * - Which provider it came from was conveyed by the bar's colour alone.
 *
 * So the information existed and was, in practice, unreachable. This dialog
 * makes it reachable: name, provider, dates, and what the host can actually do
 * about it.
 *
 * @module components/host/editor/OccupancyEventDetailsDialog
 */

import { useId } from 'react';
import {
    Dialog,
    DialogBody,
    DialogFooter,
    DialogHeader
} from '@/components/shared/ui/Dialog.client';
import type { TranslationFn } from '@/lib/i18n';
import styles from './CalendarSection.module.css';

/** The sync-sourced block being inspected. */
export interface ViewableOccupancyEvent {
    /** First occupied day, `YYYY-MM-DD`. */
    readonly startKey: string;
    /** Last occupied day (inclusive), `YYYY-MM-DD`. */
    readonly endKey: string;
    /** The event's title as the provider named it, or `null`. */
    readonly title: string | null;
    /** Human-readable provider name, already localised by the caller. */
    readonly sourceLabel: string;
}

/** Props for OccupancyEventDetailsDialog. */
export interface OccupancyEventDetailsDialogProps {
    readonly isOpen: boolean;
    readonly t: TranslationFn;
    /** The block to describe. `null` renders nothing (dialog closed). */
    readonly event: ViewableOccupancyEvent | null;
    /** Formats a `YYYY-MM-DD` key for display in the active locale. */
    readonly formatDateKey: (dateKey: string) => string;
    readonly onClose: () => void;
}

/**
 * Read-only "why is this blocked?" dialog for an imported occupancy block.
 */
export function OccupancyEventDetailsDialog({
    isOpen,
    t,
    event,
    formatDateKey,
    onClose
}: OccupancyEventDetailsDialogProps) {
    const titleId = useId();

    if (!event) return null;

    const closeLabel = t('host.properties.editor.calendarSync.close', 'Cerrar');
    const isSingleDay = event.startKey === event.endKey;

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
                {t('host.properties.editor.calendar.eventDetails.title', 'Día bloqueado')}
            </DialogHeader>
            <DialogBody>
                <dl className={styles.detailsList}>
                    <dt>
                        {t('host.properties.editor.calendar.eventDetails.eventLabel', 'Evento')}
                    </dt>
                    <dd>
                        {/*
                         * A provider can hand us an event with no summary (an
                         * Airbnb/Booking feed often does), so this is the one
                         * field that may genuinely have nothing behind it. Say
                         * so plainly rather than render an empty line.
                         */}
                        {event.title?.trim() ? (
                            event.title
                        ) : (
                            <span className={styles.detailsMuted}>
                                {t(
                                    'host.properties.editor.calendar.eventDetails.untitled',
                                    'Sin título en el calendario de origen'
                                )}
                            </span>
                        )}
                    </dd>

                    <dt>
                        {t('host.properties.editor.calendar.eventDetails.sourceLabel', 'Origen')}
                    </dt>
                    <dd>{event.sourceLabel}</dd>

                    <dt>
                        {t('host.properties.editor.calendar.eventDetails.datesLabel', 'Fechas')}
                    </dt>
                    <dd>
                        {isSingleDay
                            ? formatDateKey(event.startKey)
                            : t(
                                  'host.properties.editor.calendar.eventDetails.dateRange',
                                  '{{from}} al {{to}}',
                                  {
                                      from: formatDateKey(event.startKey),
                                      to: formatDateKey(event.endKey)
                                  }
                              )}
                    </dd>
                </dl>

                <p className={styles.detailsHelp}>
                    {t(
                        'host.properties.editor.calendar.eventDetails.help',
                        'Este bloqueo llegó desde un calendario que conectaste, así que no se edita desde acá: la próxima sincronización volvería a crearlo. Para liberar estos días, borrá o cambiá el evento en el calendario de origen, o desconectá ese calendario.'
                    )}
                </p>
            </DialogBody>
            <DialogFooter>
                <div className={styles.editFooterActions}>
                    <button
                        type="button"
                        className={styles.cancelButton}
                        onClick={onClose}
                    >
                        {closeLabel}
                    </button>
                </div>
            </DialogFooter>
        </Dialog>
    );
}
