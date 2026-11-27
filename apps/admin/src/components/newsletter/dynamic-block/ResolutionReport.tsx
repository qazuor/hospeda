import type { CampaignResolutionReport } from '@/hooks/newsletter/use-campaign-resolution';
import { useTranslations } from '@/hooks/use-translations';

/** Per-block diagnostics for preview and the final send confirmation. */
export function ResolutionReport({ report }: { readonly report: CampaignResolutionReport }) {
    const { t } = useTranslations();
    return (
        <section
            className="space-y-2 text-sm"
            aria-label={t('admin-newsletter.dynamicBlock.report')}
        >
            <h3 className="font-semibold">{t('admin-newsletter.dynamicBlock.report')}</h3>
            {report.blocks.map((block) => (
                <div
                    key={block.blockKey}
                    className="rounded-md border p-3"
                >
                    <p className="break-all font-medium">{block.blockKey}</p>
                    <p>
                        {t('admin-newsletter.dynamicBlock.found')}: {block.candidates.length}
                    </p>
                    <p>
                        {t('admin-newsletter.dynamicBlock.dropped')}: {block.dropped.length}
                    </p>
                    <p>
                        {t('admin-newsletter.dynamicBlock.repeats')}: {block.repeatsUsed}
                    </p>
                    {block.belowMin && (
                        <p className="text-destructive">
                            {t('admin-newsletter.dynamicBlock.belowMinimum')}
                        </p>
                    )}
                    <p>
                        {t('admin-newsletter.dynamicBlock.action')}:{' '}
                        {t(`admin-newsletter.dynamicBlock.actions.${block.action}`)}
                    </p>
                </div>
            ))}
        </section>
    );
}
