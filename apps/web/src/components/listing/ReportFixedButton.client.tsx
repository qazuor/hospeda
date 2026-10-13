/**
 * @file ReportFixedButton.client.tsx
 * @description Row 30 of `V/19` §4 (HOS-1492): the button under a fix request
 * that tells the admin the owner fixed what was asked.
 *
 * It calls `POST …/{id}/fix-request/report-fixed` and then says when the owner
 * reported it. When the read already carries `ownerReportedFixedAt`, it starts
 * by saying so. It does not close the request, publish, or decide anything: the
 * instant it shows is the one the server answered (idempotent: a second report
 * answers the first instant).
 */

import { type JSX, useState } from 'react';
import { type PublishVerticalSlug, publishApi } from '@/lib/api/endpoints-protected';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { formatNoticeInstant } from '@/lib/listing/listing-notices';
import styles from './ReportFixedButton.module.css';

/** Props for {@link ReportFixedButton}. */
export interface ReportFixedButtonProps {
    /** The listing's vertical. */
    readonly vertical: PublishVerticalSlug;
    /** The listing id. */
    readonly listingId: string;
    /** Page locale. */
    readonly locale: SupportedLocale;
    /** The ISO instant the owner already reported the fix, or `null`. */
    readonly reportedAt: string | null;
}

/**
 * The "I fixed it" button of a fix request.
 *
 * @param props - See {@link ReportFixedButtonProps}.
 */
export function ReportFixedButton({
    vertical,
    listingId,
    locale,
    reportedAt
}: ReportFixedButtonProps): JSX.Element {
    const { t } = createTranslations(locale);
    const [reported, setReported] = useState<string | null>(reportedAt);
    const [pending, setPending] = useState(false);
    const [failed, setFailed] = useState(false);

    async function handleReport(): Promise<void> {
        setPending(true);
        setFailed(false);
        const result = await publishApi.reportFixed({ vertical, id: listingId });
        setPending(false);
        if (!result.ok) {
            setFailed(true);
            return;
        }
        setReported(result.data.ownerReportedFixedAt);
    }

    const reportedLabel = reported === null ? null : formatNoticeInstant({ iso: reported, locale });

    if (reportedLabel !== null) {
        return (
            <p
                className={styles.reported}
                role="status"
                data-testid="report-fixed-done"
            >
                {t('listing.notices.fixRequest.reported', undefined, { date: reportedLabel })}
            </p>
        );
    }

    return (
        <span className={styles.wrapper}>
            <button
                type="button"
                className={styles.button}
                onClick={handleReport}
                disabled={pending}
                aria-busy={pending}
                data-testid="report-fixed-button"
            >
                {t('listing.notices.fixRequest.button')}
            </button>
            {failed && (
                <span
                    className={styles.error}
                    role="alert"
                >
                    {t('listing.notices.fixRequest.error')}
                </span>
            )}
        </span>
    );
}
