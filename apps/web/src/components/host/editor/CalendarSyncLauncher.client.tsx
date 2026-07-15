/**
 * @file CalendarSyncLauncher.client.tsx
 * @description Collapses the external-calendar connect UI behind a single
 * button. Clicking it opens the full {@link CalendarSyncPanel} inside a modal
 * {@link Dialog}, so the occupancy calendar section stays uncluttered by
 * default and the import flow is opt-in.
 *
 * Entitlement model (HOS-175): the button is ALWAYS visible — a host whose
 * plan lacks `can_sync_external_calendar` still sees it, and clicking it opens
 * an upgrade-nudge dialog instead of the connect panel (the same "visible
 * button → upsell on click" pattern used elsewhere). Only a plan that grants
 * the entitlement opens the real connect/sync panel.
 *
 * The connect dialog auto-opens on mount in two cases so no flow is lost by
 * hiding the panel behind a button:
 *  - Returning from the Google OAuth round-trip (`?calendarSync=connected|error`
 *    on the URL) — the panel must mount to read that flag and show its banner.
 *  - Arriving via the broken-feed notification email link (`#calendar-sync`
 *    hash) — the panel is the scroll/anchor target.
 *
 * @module components/host/editor/CalendarSyncLauncher
 */

import { CalendarIcon } from '@repo/icons';
import { useEffect, useMemo, useState } from 'react';
import {
    Dialog,
    DialogBody,
    DialogFooter,
    DialogHeader
} from '@/components/shared/ui/Dialog.client';
import { useMyEntitlements } from '@/hooks/useMyEntitlements';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './CalendarSyncLauncher.module.css';
import { CalendarSyncPanel } from './CalendarSyncPanel.client';

/** Props for CalendarSyncLauncher. */
export interface CalendarSyncLauncherProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
}

/** The entitlement a host's plan must grant to connect external calendars. */
const SYNC_ENTITLEMENT = 'can_sync_external_calendar';
const DIALOG_TITLE_ID = 'calendar-sync-dialog-title';
const UPSELL_TITLE_ID = 'calendar-sync-upsell-title';

/** Which modal is open, if any. */
type DialogMode = 'none' | 'sync' | 'upsell';

/**
 * Button that opens the external-calendar sync panel in a modal dialog, or an
 * upgrade nudge when the host's plan lacks the sync entitlement.
 */
export function CalendarSyncLauncher({ locale, accommodationId }: CalendarSyncLauncherProps) {
    // Memoize so `t` keeps a stable identity across renders (mirrors the panel).
    const { t } = useMemo(() => createTranslations(locale), [locale]);
    const { has, isLoading } = useMyEntitlements();
    const [mode, setMode] = useState<DialogMode>('none');

    // Fail-open while entitlements load (matches PlanEntitlementGate): only a
    // resolved "no entitlement" locks the button into the upsell path — the API
    // still enforces the gate server-side regardless.
    const isLocked = !isLoading && !has(SYNC_ENTITLEMENT);

    // Auto-open the connect panel when returning from Google OAuth
    // (?calendarSync=...) or via the broken-feed email link (#calendar-sync),
    // so the panel mounts to handle those flows. These only ever happen for a
    // host that already has the entitlement, so always open the sync panel.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        if (params.get('calendarSync') || window.location.hash === '#calendar-sync') {
            setMode('sync');
        }
    }, []);

    const closeLabel = t('host.properties.editor.calendarSync.close', 'Cerrar');
    const plansUrl = buildUrl({ locale, path: '/suscriptores/planes' });

    return (
        <div className={styles.launcher}>
            <button
                type="button"
                className={styles.openButton}
                onClick={() => setMode(isLocked ? 'upsell' : 'sync')}
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

            {/* Connect / sync panel — only reachable with the entitlement. */}
            <Dialog
                isOpen={mode === 'sync'}
                onClose={() => setMode('none')}
                size="lg"
                ariaLabelledBy={DIALOG_TITLE_ID}
            >
                <DialogHeader
                    onClose={() => setMode('none')}
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

            {/* Upgrade nudge — shown when the plan lacks the sync entitlement. */}
            <Dialog
                isOpen={mode === 'upsell'}
                onClose={() => setMode('none')}
                size="sm"
                ariaLabelledBy={UPSELL_TITLE_ID}
            >
                <DialogHeader
                    onClose={() => setMode('none')}
                    closeLabel={closeLabel}
                    titleId={UPSELL_TITLE_ID}
                >
                    {t('host.properties.editor.calendarSync.upsellTitle', 'Función premium')}
                </DialogHeader>
                <DialogBody>
                    <p className={styles.upsellText}>
                        {t(
                            'host.properties.editor.calendarSync.upsellDescription',
                            'Mejorá tu plan para sincronizar tus calendarios externos (Google, Airbnb, Booking.com) y bloquear automáticamente las fechas ocupadas.'
                        )}
                    </p>
                </DialogBody>
                <DialogFooter>
                    <a
                        href={plansUrl}
                        className={styles.upsellCta}
                    >
                        {t('host.properties.editor.calendarSync.upsellCta', 'Mejorar plan')}
                    </a>
                </DialogFooter>
            </Dialog>
        </div>
    );
}
