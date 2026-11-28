import type { TranslationKey } from '@repo/i18n';
import { AnalyticsIcon, ExternalLinkIcon } from '@repo/icons';
import type { QrCampaignUmamiItem, QrCampaignUmamiStatus } from '@repo/schemas';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import {
    readQrCampaignSegmentErrorReason,
    useCreateQrCampaignSegment,
    useQrCampaignsUmami
} from '@/features/qr-codes/hooks/useQrCampaignsUmami';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';

/**
 * The QR campaigns panel (HOS-2679 PR 2): every `utm_campaign` on the codes,
 * how many codes carry it, and its state in Umami.
 *
 * - «Ver en Umami» opens the web website filtered by the campaign (no segment
 *   needed).
 * - «Abrir segmento» opens it with the `QR · <campaign>` segment applied, which
 *   filters the whole view, including the `utm_content` table.
 * - «Crear en Umami» creates that segment; the API makes a second click a no-op.
 *   Each row tracks its own in-flight create, so two rows can run at once.
 * - A campaign with a comma gets neither link nor create: Umami splits filter
 *   values on commas, so it would count other campaigns too.
 *
 * The query only runs while the dialog is open: it costs one Umami call.
 */

/** Props for {@link QrCodeCampaignsDialog}. */
export type QrCodeCampaignsDialogProps = {
    /** May create segments (QR_CODE_CREATE or QR_CODE_UPDATE). */
    readonly canCreate: boolean;
};

/** Badge variant per Umami status. */
const STATUS_VARIANT: Readonly<Record<QrCampaignUmamiStatus, 'success' | 'secondary' | 'outline'>> =
    {
        segment: 'success',
        missing: 'secondary',
        unavailable: 'outline'
    };

/** Reasons the API sends for a failed create that have their own copy. */
const KNOWN_ERROR_REASONS = [
    'UMAMI_WRITE_NOT_CONFIGURED',
    'UMAMI_KEY_REJECTED',
    'UMAMI_CAMPAIGN_HAS_COMMA'
] as const;

/**
 * Why «Crear en Umami» is disabled for a row, or `null` when it is enabled.
 *
 * @param input.item - The row.
 * @param input.canCreateSegments - Whether the API has the write key.
 * @param input.canCreate - Whether the operator may create.
 * @returns An i18n key, or `null`.
 */
export function qrCampaignCreateBlocker(input: {
    readonly item: QrCampaignUmamiItem;
    readonly canCreateSegments: boolean;
    readonly canCreate: boolean;
}): TranslationKey | null {
    if (!input.canCreate) return 'admin-qr-codes.campaigns.createDisabledPermission';
    if (input.item.umami.unsupportedReason === 'COMMA_IN_CAMPAIGN') {
        return 'admin-qr-codes.campaigns.createDisabledComma';
    }
    if (input.item.umami.unsupportedReason === 'TOO_LONG') {
        return 'admin-qr-codes.campaigns.createDisabledTooLong';
    }
    if (!input.canCreateSegments) return 'admin-qr-codes.campaigns.createDisabledNotConfigured';
    if (input.item.umami.status === 'unavailable') {
        return 'admin-qr-codes.campaigns.createDisabledUnavailable';
    }
    return null;
}

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
function CampaignRow({
    item,
    canCreateSegments,
    canCreate,
    pending,
    onCreate
}: {
    readonly item: QrCampaignUmamiItem;
    readonly canCreateSegments: boolean;
    readonly canCreate: boolean;
    readonly pending: boolean;
    readonly onCreate: () => void;
}) {
    const { t } = useTranslations();
    const blocker = qrCampaignCreateBlocker({ item, canCreateSegments, canCreate });
    return (
        <tr className="border-b align-middle last:border-0">
            <td className="py-2 pr-3 font-medium">{item.campaign}</td>
            <td className="py-2 pr-3 tabular-nums">{item.qrCount}</td>
            <td className="py-2 pr-3">
                <Badge variant={STATUS_VARIANT[item.umami.status]}>
                    {t(`admin-qr-codes.campaigns.status.${item.umami.status}`)}
                </Badge>
            </td>
            <td className="py-2">
                <div className="flex flex-wrap items-center gap-2">
                    {item.umami.viewUrl ? (
                        <ExternalButton
                            href={item.umami.viewUrl}
                            label={t('admin-qr-codes.campaigns.viewInUmami')}
                        />
                    ) : null}
                    {item.umami.status === 'segment' && item.umami.segmentUrl ? (
                        <ExternalButton
                            href={item.umami.segmentUrl}
                            label={t('admin-qr-codes.campaigns.openSegment')}
                        />
                    ) : null}
                    {item.umami.status === 'segment' ? null : (
                        // A disabled button fires no hover, so the reason lives on the wrapper.
                        <span title={blocker ? t(blocker) : undefined}>
                            <Button
                                size="sm"
                                disabled={blocker !== null || pending}
                                aria-label={`${t('admin-qr-codes.campaigns.createSegment')}: ${item.campaign}`}
                                onClick={onCreate}
                            >
                                {t('admin-qr-codes.campaigns.createSegment')}
                            </Button>
                        </span>
                    )}
                </div>
            </td>
        </tr>
    );
}

/** The panel body, mounted only while the dialog is open. */
function CampaignsPanel({ canCreate }: QrCodeCampaignsDialogProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const { data, isLoading, isError } = useQrCampaignsUmami();
    const create = useCreateQrCampaignSegment();
    const [inFlight, setInFlight] = useState<ReadonlySet<string>>(() => new Set());

    // `mutateAsync`, not `mutate` with per-call callbacks: TanStack Query fires
    // those only for the LATEST call, which would strand an earlier row as pending.
    const onCreate = async (campaign: string) => {
        setInFlight((current) => new Set(current).add(campaign));
        try {
            const result = await create.mutateAsync({ campaign });
            addToast({
                variant: 'success',
                message: t(
                    result.created
                        ? 'admin-qr-codes.campaigns.created'
                        : 'admin-qr-codes.campaigns.alreadyExisted'
                )
            });
        } catch (error) {
            const reason = readQrCampaignSegmentErrorReason({ error });
            const known = KNOWN_ERROR_REASONS.find((item) => item === reason);
            addToast({
                variant: 'error',
                message: t(
                    known
                        ? `admin-qr-codes.campaigns.createErrors.${known}`
                        : 'admin-qr-codes.campaigns.createErrors.generic'
                )
            });
        } finally {
            setInFlight((current) => {
                const next = new Set(current);
                next.delete(campaign);
                return next;
            });
        }
    };

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
    const anyUnavailable = data.items.some((item) => item.umami.status === 'unavailable');
    const anyComma = data.items.some(
        (item) => item.umami.unsupportedReason === 'COMMA_IN_CAMPAIGN'
    );
    return (
        <div className="space-y-3">
            {anyUnavailable ? (
                <p
                    role="status"
                    className="text-muted-foreground text-sm"
                >
                    {t('admin-qr-codes.campaigns.unavailableNotice')}
                </p>
            ) : null}
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
                            <th className="py-2 pr-3 font-medium">
                                {t('admin-qr-codes.campaigns.columns.umami')}
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
                                canCreateSegments={data.canCreateSegments}
                                canCreate={canCreate}
                                pending={inFlight.has(item.campaign)}
                                onCreate={() => void onCreate(item.campaign)}
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
    const viewUrl = data?.items.find((item) => item.campaign === campaign)?.umami.viewUrl;
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
 * @param props - {@link QrCodeCampaignsDialogProps}
 * @returns The trigger plus the dialog.
 */
export function QrCodeCampaignsDialog({ canCreate }: QrCodeCampaignsDialogProps) {
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
                <CampaignsPanel canCreate={canCreate} />
            </DialogContent>
        </Dialog>
    );
}
