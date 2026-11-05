/**
 * @file BusinessLineRemovalNotice.client.tsx
 * @description Notice shown BEFORE the owner saves a business-line removal
 * (HOS-1787 leaf 5.7, DEC-FAC-025 / AC:5:4).
 *
 * Removing a business line does not delete anything: the sections that line
 * owns become `absent`, their stored data stays, and re-adding the line brings
 * it back. The owner still has to know what disappears from the public page, so
 * this notice names the sections that would go away and how much each holds.
 *
 * ## The web never decides which section a line owns (G-FAC-03)
 *
 * It asks the API for two section-state maps — the STORED selection and the
 * HYPOTHETICAL one — and compares STATES. It never compares business-line
 * values and never imports the resolver; only
 * `packages/verticals/src/listing-sections/` decides that mapping.
 *
 * Every count read degrades to "no number" rather than zero, and the QR line
 * only appears when the metric is readable (`menu_qr_scan_metrics` on the
 * owner's plan). The component never calls `getMenuQr`, which would mint a code
 * as a side effect of showing a notice.
 *
 * @module components/listing/editor/BusinessLineRemovalNotice
 */

import { LISTING_SECTIONS } from '@repo/schemas';
import { type JSX, useEffect, useState } from 'react';
import { listingAnalyticsApi } from '@/lib/api/endpoints-protected';
import { LISTING_SECTION_PRESENTATION } from '@/lib/editor/listing-section-presentation';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import {
    readAbsentSectionCounts,
    readRecentMenuQrScanCount
} from '@/lib/listing/locked-section-counts';
import styles from './BusinessLineRemovalNotice.module.css';

/** Props for {@link BusinessLineRemovalNotice}. */
export interface BusinessLineRemovalNoticeProps {
    /** Active locale. */
    readonly locale: SupportedLocale;
    /** UUID of the listing whose selection is being changed. */
    readonly listingId: string;
    /** Business-line values the owner just unchecked. */
    readonly removedValues: readonly string[];
    /** The selection the notice should resolve, i.e. the next state. */
    readonly nextSelection: readonly string[];
}

interface HiddenSection {
    readonly id: string;
    readonly count: number | null;
}

/**
 * Renders the notice for one pending removal, or nothing when no section
 * changes state.
 */
export function BusinessLineRemovalNotice({
    locale,
    listingId,
    removedValues,
    nextSelection
}: BusinessLineRemovalNoticeProps): JSX.Element | null {
    const { t, tPlural } = createTranslations(locale);
    const [hidden, setHidden] = useState<readonly HiddenSection[] | null>(null);
    const [qrScans, setQrScans] = useState<number | null>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        setDismissed(false);
        setHidden(null);
        setQrScans(null);
        let cancelled = false;

        void (async () => {
            const [current, hypothetical] = await Promise.all([
                listingAnalyticsApi.getListingSectionStates({
                    vertical: 'venue',
                    listingId
                }),
                listingAnalyticsApi.getListingSectionStates({
                    vertical: 'venue',
                    listingId,
                    businessLines: nextSelection
                })
            ]);
            if (cancelled || !current.ok || !hypothetical.ok) {
                if (!cancelled) setHidden([]);
                return;
            }

            const changed = Object.entries(hypothetical.data.sections)
                .filter(
                    ([sectionId, section]) =>
                        section.state === 'absent' &&
                        current.data.sections[sectionId]?.state !== 'absent'
                )
                .map(([sectionId]) => sectionId);
            if (changed.length === 0) {
                if (!cancelled) setHidden([]);
                return;
            }

            const order: readonly string[] = LISTING_SECTIONS.venue.map((section) => section.id);
            const sorted = [...changed].sort(
                (left, right) => order.indexOf(left) - order.indexOf(right)
            );
            const absentMap = Object.fromEntries(
                sorted.map((sectionId) => [sectionId, { state: 'absent' as const }])
            );
            const counts = await readAbsentSectionCounts({
                vertical: 'venue',
                listingId,
                sectionStates: absentMap
            });
            if (cancelled) return;

            setHidden(
                sorted.map((sectionId) => ({
                    id: sectionId,
                    count: counts[sectionId] ?? null
                }))
            );

            if (sorted.includes('menu')) {
                const scans = await readRecentMenuQrScanCount({ venueId: listingId });
                if (!cancelled) setQrScans(scans);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [listingId, nextSelection]);

    if (dismissed || hidden === null || hidden.length === 0) return null;

    const lineLabels = removedValues
        .map((value) => t(`venue.owner.businessLines.${value}.label`, value))
        .join(', ');
    const sectionLabels = hidden
        .map(({ id, count }) => {
            const labelKey = LISTING_SECTION_PRESENTATION.venue[id]?.labelKey;
            const label = labelKey ? t(labelKey, id) : id;
            return typeof count === 'number' && count > 0
                ? tPlural('venue.owner.businessLines.notice.sectionWithCount', count, {
                      section: label,
                      count
                  })
                : label;
        })
        .join(', ');

    return (
        <div
            className={styles.notice}
            role="status"
            data-testid="business-line-removal-notice"
        >
            <p className={styles.text}>
                {t(
                    'venue.owner.businessLines.notice.title',
                    'Al quitar {{lines}} se ocultan: {{sections}}.',
                    { lines: lineLabels, sections: sectionLabels }
                )}
            </p>
            <p className={styles.text}>
                {t(
                    'venue.owner.businessLines.notice.keep',
                    'No se borra nada: si lo volvés a agregar, vuelve todo.'
                )}
            </p>
            {typeof qrScans === 'number' && qrScans > 0 ? (
                <p className={styles.text}>
                    {t(
                        'venue.owner.businessLines.notice.qr',
                        'Tu QR de mesa tuvo {{count}} escaneos en los últimos 90 días.',
                        { count: qrScans }
                    )}
                </p>
            ) : null}
            <button
                type="button"
                className={styles.dismiss}
                onClick={() => setDismissed(true)}
            >
                {t('venue.owner.businessLines.notice.dismiss', 'Entendido')}
            </button>
        </div>
    );
}
