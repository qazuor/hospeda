import { Button } from '@/components/ui/button';
import { useCampaignResolution } from '@/hooks/newsletter/use-campaign-resolution';
import { useTranslations } from '@/hooks/use-translations';
import { ResolutionReport } from './ResolutionReport';

/** Server-rendered email isolated from admin scripts and origin privileges. */
export function ResolvedCampaignPreview({
    campaignId,
    revision
}: {
    readonly campaignId?: string;
    readonly revision?: unknown;
}) {
    const { t } = useTranslations();
    const query = useCampaignResolution({ id: campaignId ?? '', revision });
    if (!campaignId) return <p>{t('admin-newsletter.dynamicBlock.saveFirst')}</p>;
    if (query.isError)
        return (
            <div role="alert">
                {t('admin-newsletter.dynamicBlock.previewError')}
                <Button
                    type="button"
                    onClick={() => void query.refetch()}
                >
                    {t('admin-newsletter.dynamicBlock.retry')}
                </Button>
            </div>
        );
    if (!query.data) return <p role="status">{t('admin-newsletter.dynamicBlock.loading')}</p>;
    return (
        <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
                {t('admin-newsletter.dynamicBlock.savedPreview')}
            </p>
            <iframe
                title={t('admin-newsletter.dynamicBlock.previewTitle')}
                sandbox=""
                srcDoc={query.data.html}
                className="h-[600px] w-full rounded-md border bg-white"
            />
            <ResolutionReport report={query.data.report} />
        </div>
    );
}
