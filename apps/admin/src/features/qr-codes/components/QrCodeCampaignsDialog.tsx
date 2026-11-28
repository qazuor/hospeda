import { AnalyticsIcon, ExternalLinkIcon } from '@repo/icons';
import type { QrCampaignUmamiItem } from '@repo/schemas';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import { useQrCampaignsUmami } from '@/features/qr-codes/hooks/useQrCampaignsUmami';
import { useTranslations } from '@/hooks/use-translations';

/**
 * The QR campaigns panel (HOS-2679): every `utm_campaign` on the codes, how many
 * codes carry it, and a «Ver en Umami» link.
 *
 * The panel only LINKS to Umami. It creates nothing there: Umami 3.5 has no role
 * that can create segments without also being able to reset or delete the website,
 * so there is no create button. A campaign with a comma gets no link, because
 * Umami splits filter values on commas and would count other campaigns too; the
 * panel says why.
 */

/** An external link styled as a small button; always a new tab without opener. */
function ExternalButton({ href, label }: { readonly href: string; readonly label: string }) {
    return (
        <Button
            variant="outline"
            size="sm"
            asChild
        >
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
            >
                <ExternalLinkIcon className="mr-1 h-3 w-3" />
                {label}
            </a>
        </Button>
    );
}

/** One campaign row. */
function CampaignRow({ item }: { readonly item: QrCampaignUmamiItem }) {
    const { t } = useTranslations();
    return (
        <tr className="border-b align-middle last:border-0">
            <td className="py-2 pr-3 font-medium">{item.campaign}</td>
            <td className="py-2 pr-3 tabular-nums">{item.qrCount}</td>
            <td className="py-2">
                {item.viewUrl ? (
                    <ExternalButton
                        href={item.viewUrl}
                        label={t('admin-qr-codes.campaigns.viewInUmami')}
                    />
                ) : item.unsupportedReason === 'COMMA_IN_CAMPAIGN' ? (
                    <span className="text-muted-foreground text-xs">
                        {t('admin-qr-codes.campaigns.noLinkComma')}
                    </span>
                ) : (
                    <span className="text-muted-foreground text-xs">
                        {t('admin-qr-codes.campaigns.noLinkNotConfigured')}
                    </span>
                )}
            </td>
        </tr>
    );
}

/** The panel body, mounted only while the dialog is open. */
function CampaignsPanel() {
    const { t } = useTranslations();
    const { data, isLoading, isError } = useQrCampaignsUmami();

    if (isLoading) {
        return (
            <p className="text-muted-foreground text-sm">{t('admin-qr-codes.campaigns.loading')}</p>
        );
    }
    if (isError || !data) {
        return (
            <p className="text-destructive text-sm">{t('admin-qr-codes.campaigns.loadError')}</p>
        );
    }
    if (data.items.length === 0) {
        return (
            <p className="text-muted-foreground text-sm">{t('admin-qr-codes.campaigns.empty')}</p>
        );
    }
    const anyComma = data.items.some((item) => item.unsupportedReason === 'COMMA_IN_CAMPAIGN');
    return (
        <div className="space-y-3">
            {anyComma ? (
                <p className="text-muted-foreground text-sm">
                    {t('admin-qr-codes.campaigns.commaNotice')}
                </p>
            ) : null}
            <div className="max-h-[60vh] overflow-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b text-muted-foreground text-xs">
                            <th className="py-2 pr-3 font-medium">
                                {t('admin-qr-codes.campaigns.columns.campaign')}
                            </th>
                            <th className="py-2 pr-3 font-medium">
                                {t('admin-qr-codes.campaigns.columns.qrCount')}
                            </th>
                            <th className="py-2 font-medium">
                                {t('admin-qr-codes.campaigns.columns.actions')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.items.map((item) => (
                            <CampaignRow
                                key={item.campaign}
                                item={item}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/**
 * «Ver esta campaña en Umami» next to the campaign filter. Mounted only while a
 * campaign is picked, so the Umami read happens only then; renders nothing until
 * the API answers with a view link for that campaign.
 *
 * @param props.campaign - The campaign picked in the filter.
 * @returns The link, or nothing.
 */
export function QrCampaignUmamiFilterLink({ campaign }: { readonly campaign: string }) {
    const { t } = useTranslations();
    const { data } = useQrCampaignsUmami();
    const viewUrl = data?.items.find((item) => item.campaign === campaign)?.viewUrl;
    if (!viewUrl) return null;
    return (
        <a
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1 text-primary text-sm underline-offset-4 hover:underline"
        >
            <ExternalLinkIcon className="h-3 w-3" />
            {t('admin-qr-codes.campaigns.filterLink')}
        </a>
    );
}

/**
 * The «Campañas» button and its dialog.
 *
 * @returns The trigger plus the dialog.
 */
export function QrCodeCampaignsDialog() {
    const { t } = useTranslations();
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <AnalyticsIcon className="mr-2 h-4 w-4" />
                    {t('admin-qr-codes.campaigns.open')}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{t('admin-qr-codes.campaigns.title')}</DialogTitle>
                    <DialogDescription>{t('admin-qr-codes.campaigns.help')}</DialogDescription>
                </DialogHeader>
                <CampaignsPanel />
            </DialogContent>
        </Dialog>
    );
}
