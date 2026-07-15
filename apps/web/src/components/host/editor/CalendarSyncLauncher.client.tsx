/**
 * @file CalendarSyncLauncher.client.tsx
 * @description Collapses the external-calendar connect UI behind a single
 * button. Clicking it opens the full {@link CalendarSyncPanel} inside a modal
 * {@link Dialog}, so the occupancy calendar section stays uncluttered by
 * default and the import flow is opt-in.
 *
 * The dialog auto-opens on mount in two cases so no flow is lost by hiding the
 * panel behind a button:
 *  - Returning from the Google OAuth round-trip (`?calendarSync=connected|error`
 *    on the URL) — the panel must mount to read that flag and show its banner.
 *  - Arriving via the broken-feed notification email link (`#calendar-sync`
 *    hash) — the panel is the scroll/anchor target.
 *
 * @module components/host/editor/CalendarSyncLauncher
 */

import { CalendarIcon } from '@repo/icons';
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogBody, DialogHeader } from '@/components/shared/ui/Dialog.client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './CalendarSyncLauncher.module.css';
import { CalendarSyncPanel } from './CalendarSyncPanel.client';

/** Props for CalendarSyncLauncher. */
export interface CalendarSyncLauncherProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
}

const DIALOG_TITLE_ID = 'calendar-sync-dialog-title';

/**
 * Button that opens the external-calendar sync panel in a modal dialog.
 */
export function CalendarSyncLauncher({ locale, accommodationId }: CalendarSyncLauncherProps) {
    // Memoize so `t` keeps a stable identity across renders (mirrors the panel).
    const { t } = useMemo(() => createTranslations(locale), [locale]);
    const [isOpen, setIsOpen] = useState(false);

    // Auto-open when returning from Google OAuth (?calendarSync=...) or arriving
    // via the broken-feed email link (#calendar-sync), so the panel mounts to
    // handle those flows even though it is hidden behind the button by default.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        if (params.get('calendarSync') || window.location.hash === '#calendar-sync') {
            setIsOpen(true);
        }
    }, []);

    const closeLabel = t('host.properties.editor.calendarSync.close', 'Cerrar');

    return (
        <div className={styles.launcher}>
            <button
                type="button"
                className={styles.openButton}
                onClick={() => setIsOpen(true)}
            >
                <CalendarIcon
                    size={18}
                    weight="regular"
                    aria-hidden="true"
                />
                {t(
                    'host.properties.editor.calendarSync.openButton',
                    'Conectar calendarios externos'
                )}
            </button>

            <Dialog
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                size="lg"
                ariaLabelledBy={DIALOG_TITLE_ID}
            >
                <DialogHeader
                    onClose={() => setIsOpen(false)}
                    closeLabel={closeLabel}
                    titleId={DIALOG_TITLE_ID}
                >
                    {t(
                        'host.properties.editor.calendarSync.title',
                        'Sincronización de calendarios externos'
                    )}
                </DialogHeader>
                <DialogBody>
                    <CalendarSyncPanel
                        locale={locale}
                        accommodationId={accommodationId}
                    />
                </DialogBody>
            </Dialog>
        </div>
    );
}
