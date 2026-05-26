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
import { useCampaignMetrics } from '@/hooks/newsletter';
import { useSendCampaign } from '@/hooks/newsletter';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';
import { LoaderIcon } from '@repo/icons';
import type { NewsletterCampaign, NewsletterCampaignStatusEnum } from '@repo/schemas';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

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
    const { t } = useTranslations();
    const { addToast } = useToast();
    const navigate = useNavigate();

    const [ignoreSoftCap, setIgnoreSoftCap] = useState(false);
    const [inlineError, setInlineError] = useState<string | null>(null);

    // Fetch metrics for audience count (available once the campaign is in sending/sent state,
    // or as a pre-flight for the confirm dialog from the campaigns hook).
    const { data: metrics } = useCampaignMetrics(
        campaign.id,
        campaign.status as NewsletterCampaignStatusEnum
    );

    const sendMutation = useSendCampaign(campaign.id);

    const audienceCount = metrics?.totalRecipients ?? campaign.totalRecipients ?? null;
    const softcappedCount = metrics?.totalSoftcapped ?? campaign.totalSoftcapped ?? 0;

    const localeLabel =
        campaign.localeFilter === 'all'
            ? 'Todos'
            : campaign.localeFilter === 'es'
              ? 'Español'
              : campaign.localeFilter === 'en'
                ? 'English'
                : 'Português';

    async function handleConfirm() {
        setInlineError(null);

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
                message: `Campaña enviada. ${result.enqueued ?? 0} emails encolados.`,
                variant: 'success'
            });

            onOpenChange(false);

            await navigate({
                to: '/newsletter/campaigns/$campaignId',
                params: { campaignId: campaign.id }
            });
        } catch (err) {
            const msg =
                err instanceof Error ? err.message : 'Error desconocido al enviar la campaña.';

            // 409 conflict — campaign no longer in draft
            setInlineError(msg.includes('409') ? 'Esta campaña ya no se puede enviar.' : msg);
        }
    }

    function handleOpenChange(next: boolean) {
        if (!sendMutation.isPending) {
            setInlineError(null);
            setIgnoreSoftCap(false);
            onOpenChange(next);
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={handleOpenChange}
        >
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('admin-newsletter.campaigns.confirmSendTitle')}</DialogTitle>
                    <DialogDescription asChild>
                        <div className="space-y-3 pt-2">
                            {/* Campaign subject */}
                            <div className="rounded-md bg-muted/40 px-4 py-3">
                                <p className="font-medium text-sm">Asunto</p>
                                <p className="mt-0.5 text-foreground text-sm">{campaign.subject}</p>
                            </div>

                            {/* Audience count */}
                            <p className="text-sm">
                                {t('admin-newsletter.campaigns.confirmSendAudience')
                                    .replace(
                                        '{count}',
                                        audienceCount !== null ? String(audienceCount) : '...'
                                    )
                                    .replace('{locale}', localeLabel)}
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
                                        Enviar incluso a quienes recibieron un email recientemente.
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
                                <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
                                    Todos los suscriptores elegibles recibirán esta campaña,
                                    ignorando el límite de frecuencia de 7 días.
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

                <DialogFooter className="mt-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        disabled={sendMutation.isPending}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        variant="default"
                        onClick={handleConfirm}
                        disabled={sendMutation.isPending}
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
