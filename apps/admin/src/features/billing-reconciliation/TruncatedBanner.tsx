import { useTranslations } from '@/hooks/use-translations';

/**
 * Props for {@link TruncatedBanner}.
 */
export interface TruncatedBannerProps {
    /** {@link DivergenceReport.truncated} — whether the MP sweep hit its page ceiling. */
    readonly truncated: boolean;
}

/**
 * Prominent "partial report" banner for the orphan-payment rescue screen (HOS-765).
 *
 * Renders NOTHING when `truncated` is `false` — an untruncated report needs no
 * warning. When `truncated` is `true`, `pagination.total` is a FLOOR rather than
 * a count, and a report that presents itself as complete tells an operator
 * "there are no other divergences" on evidence that only says "we stopped
 * looking". This is a hard requirement from the schema module doc
 * (`BillingDivergenceReportSchema.truncated` JSDoc): the screen MUST render it,
 * and prominently.
 */
export function TruncatedBanner({ truncated }: TruncatedBannerProps) {
    const { t } = useTranslations();

    if (!truncated) return null;

    return (
        <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive text-sm">
            <p className="font-semibold">
                {t('admin-billing.reconciliation.truncatedBanner.title')}
            </p>
            <p className="mt-1">{t('admin-billing.reconciliation.truncatedBanner.description')}</p>
        </div>
    );
}
