/**
 * @file SendConfirmDialog.tsx
 * @description Confirmation dialog for dispatching a newsletter campaign.
 *
 * Shows campaign subject, estimated audience count, soft-cap notice, and an
 * ignoreSoftCap toggle before the admin confirms the send. Handles the 200
 * (no eligible subscribers), 202 (dispatched), and 409 (conflict) API responses.
 *
 * @module SendConfirmDialog
 */

import { LoaderIcon } from '@repo/icons';
import type { NewsletterCampaign } from '@repo/schemas';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { ResolutionReport } from '@/components/newsletter/dynamic-block/ResolutionReport';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useCampaignAudienceCount, useSendCampaign } from '@/hooks/newsletter';
import type { CampaignResolutionReport } from '@/hooks/newsletter/use-campaign-resolution';
import {
    getBelowMinimumReport,
    hasDynamicBlocks,
    useCampaignResolution
} from '@/hooks/newsletter/use-campaign-resolution';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';

// ─── Props ────────────────────────────────────────────────────────────────────

/**
 * Props for the SendConfirmDialog component.
 */
export interface SendConfirmDialogProps {
    /** Whether the dialog is open. */
    readonly open: boolean;
    /** Callback to open/close the dialog. */
    readonly onOpenChange: (open: boolean) => void;
    /** The campaign being confirmed for send. */
    readonly campaign: NewsletterCampaign;
}

// ─── SendConfirmDialog ────────────────────────────────────────────────────────

/**
 * Modal dialog that confirms a newsletter campaign dispatch.
 *
 * On confirm:
 * - 202: dispatched=true → closes dialog, shows toast, navigates to detail page.
 * - 200: dispatched=false, reason='no_eligible_subscribers' → shows inline toast.
 * - 409: shows inline error (campaign no longer dispatchable).
 *
 * @param props - SendConfirmDialogProps
 */
export function SendConfirmDialog({ open, onOpenChange, campaign }: SendConfirmDialogProps) {
    const { t, tPlural } = useTranslations();
    const { addToast } = useToast();
    const navigate = useNavigate();

    const [ignoreSoftCap, setIgnoreSoftCap] = useState(false);
    const [inlineError, setInlineError] = useState<string | null>(null);
    const [failedReport, setFailedReport] = useState<CampaignResolutionReport | null>(null);
    const dynamic = hasDynamicBlocks({ bodyJson: campaign.bodyJson });
    const resolution = useCampaignResolution({
        id: campaign.id,
        revision: campaign.bodyJson,
        enabled: open && dynamic
    });

    // Real audience estimate, computed server-side with the exact filter the send
    // uses (language + content segmentation + frequency limit). Only fetched while
    // the dialog is open; follows the ignoreSoftCap toggle so the number matches
    // what the send would enqueue.
    const { data: audience, isError: audienceError } = useCampaignAudienceCount({
        id: campaign.id,
        ignoreSoftCap,
        enabled: open
    });

    const sendMutation = useSendCampaign(campaign.id);
    const visibleReport = failedReport ?? (dynamic ? resolution.data?.report : undefined);

    const audienceCount = audience?.eligible ?? null;
    const softcappedCount = audience?.softCapped ?? 0;

    const localeLabel =
        campaign.localeFilter === 'all'
            ? t('admin-newsletter.campaigns.confirmSendLocaleAll')
            : campaign.localeFilter === 'es'
              ? 'Español'
              : campaign.localeFilter === 'en'
                ? 'English'
                : 'Português';

    async function handleConfirm() {
        setInlineError(null);
        setFailedReport(null);

        try {
            const result = await sendMutation.mutateAsync(ignoreSoftCap);

            if (!result.dispatched) {
                addToast({
                    message: t('admin-newsletter.campaigns.noEligibleSubscribers'),
                    variant: 'warning'
                });
                onOpenChange(false);
                return;
            }

            addToast({
                message: t('admin-newsletter.campaigns.sendSuccessToast', {
                    count: String(result.enqueued ?? 0)
                }),
                variant: 'success'
            });

            onOpenChange(false);

            await navigate({
                to: '/newsletter/campaigns/$campaignId',
                params: { campaignId: campaign.id }
            });
        } catch (err) {
            const report = getBelowMinimumReport({ error: err });
            if (report) {
                setFailedReport(report);
                setInlineError(
                    t('admin-newsletter.dynamicBlock.sendBlocked', {
                        blocks: report.blocks
                            .filter((block) => block.belowMin)
                            .map((block) => block.blockKey)
                            .join(', ')
                    })
                );
                return;
            }
            const msg =
                err instanceof Error
                    ? err.message
                    : t('admin-newsletter.campaigns.sendUnknownError');

            // 409 conflict — campaign no longer in draft
            setInlineError(
                msg.includes('409') ? t('admin-newsletter.campaigns.sendNoLongerSendable') : msg
            );
        }
    }

    function handleOpenChange(next: boolean) {
        if (!sendMutation.isPending) {
            setInlineError(null);
            setFailedReport(null);
            setIgnoreSoftCap(false);
            onOpenChange(next);
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={handleOpenChange}
        >
            <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t('admin-newsletter.campaigns.confirmSendTitle')}</DialogTitle>
                    <DialogDescription asChild>
                        <div className="space-y-3 pt-2">
                            {/* Campaign subject */}
                            <div className="rounded-md bg-muted/40 px-4 py-3">
                                <p className="font-medium text-sm">
                                    {t('admin-newsletter.campaigns.confirmSendSubjectLabel')}
                                </p>
                                <p className="mt-0.5 text-foreground text-sm">{campaign.subject}</p>
                            </div>

                            {/* Audience count */}
                            <p className="text-sm">
                                {audienceError ? (
                                    <span
                                        role="alert"
                                        className="text-destructive"
                                    >
                                        {t('admin-newsletter.campaigns.confirmSendAudienceError')}
                                    </span>
                                ) : audienceCount === null ? (
                                    t('admin-newsletter.campaigns.confirmSendAudience_other', {
                                        count: '…',
                                        locale: localeLabel
                                    })
                                ) : (
                                    tPlural(
                                        'admin-newsletter.campaigns.confirmSendAudience',
                                        audienceCount,
                                        { locale: localeLabel }
                                    )
                                )}
                            </p>

                            {/* Soft-cap notice */}
                            {softcappedCount > 0 && (
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-newsletter.campaigns.confirmSendSoftcapNote').replace(
                                        '{softcapped}',
                                        String(softcappedCount)
                                    )}
                                </p>
                            )}

                            {/* ignoreSoftCap toggle */}
                            <div className="flex items-center justify-between rounded-md border border-border bg-card p-3">
                                <div>
                                    <p className="font-medium text-sm">
                                        {t('admin-newsletter.campaigns.ignoreSoftCap')}
                                    </p>
                                    <p className="mt-0.5 text-muted-foreground text-xs">
                                        {t('admin-newsletter.campaigns.ignoreSoftCapHint')}
                                    </p>
                                </div>
                                <Switch
                                    id="ignore-soft-cap"
                                    checked={ignoreSoftCap}
                                    onCheckedChange={setIgnoreSoftCap}
                                    disabled={sendMutation.isPending}
                                />
                            </div>

                            {/* Warning when ignoreSoftCap is on */}
                            {ignoreSoftCap && (
                                <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-foreground text-sm">
                                    {t('admin-newsletter.campaigns.ignoreSoftCapWarning')}
                                </div>
                            )}

                            {/* Inline error (409 or other) */}
                            {inlineError && (
                                <div
                                    role="alert"
                                    className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm"
                                >
                                    {inlineError}
                                </div>
                            )}
                        </div>
                    </DialogDescription>
                </DialogHeader>

                {dynamic && resolution.isLoading && (
                    <p role="status">{t('admin-newsletter.dynamicBlock.loading')}</p>
                )}
                {dynamic && resolution.isError && (
                    <div role="alert">
                        {t('admin-newsletter.dynamicBlock.previewError')}
                        <Button
                            type="button"
                            onClick={() => void resolution.refetch()}
                        >
                            {t('admin-newsletter.dynamicBlock.retry')}
                        </Button>
                    </div>
                )}
                {visibleReport && <ResolutionReport report={visibleReport} />}
                <DialogFooter className="mt-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        disabled={sendMutation.isPending}
                    >
                        {t('admin-newsletter.campaigns.confirmSendCancel')}
                    </Button>
                    <Button
                        type="button"
                        variant="default"
                        onClick={handleConfirm}
                        disabled={
                            sendMutation.isPending ||
                            (dynamic &&
                                (!resolution.data || resolution.isFetching || resolution.isError))
                        }
                        className="bg-primary hover:bg-primary/90"
                    >
                        {sendMutation.isPending && (
                            <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {t('admin-newsletter.campaigns.confirmSendButton')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
