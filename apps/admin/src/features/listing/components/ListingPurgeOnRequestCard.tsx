/**
 * @file ListingPurgeOnRequestCard.tsx
 * The panel control for administrative action 23 (HOS-1493): purge a foreign
 * listing at its owner's request, with a mandatory reason.
 *
 * The confirmation says WHAT is going to happen (audit §3 rule 1) instead of
 * asking whether the admin is sure: which listing, by its name; that its
 * content is deleted and does not come back; and that a featured placement
 * pointing to it is cancelled. Confirming stays disabled until the reason has
 * something other than whitespace, because the route refuses an empty one and
 * the reason is what lands in the audit log.
 *
 * Gated by `LISTING_PURGE_ON_REQUEST` (a permission, never a role). The three
 * listing detail routes mount it; nothing else differs between verticals.
 */

import { DeleteIcon } from '@repo/icons';
import { PermissionEnum, type PublicationStatusEnum } from '@repo/schemas';
import { useId, useState } from 'react';
import { PermissionGate } from '@/components/auth/PermissionGate';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/ToastProvider';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors';
import { adminLogger } from '@/utils/logger';
import { canPurgeListingOnRequest } from '../config/listing-moderation-actions';
import {
    type PurgeListingVertical,
    usePurgeListingOnRequestMutation
} from '../hooks/usePurgeListingOnRequestMutation';

/** HTTP status the route answers when the listing's owner changed meanwhile. */
const STATE_CHANGED_STATUS = 409;

/** Props for {@link ListingPurgeOnRequestCard}. RO-RO pattern. */
export interface ListingPurgeOnRequestCardProps {
    /** Vertical of the listing. */
    readonly vertical: PurgeListingVertical;
    /** UUID of the listing. */
    readonly entityId: string;
    /** Listing name shown in the confirmation; falls back to the id upstream. */
    readonly entityName: string;
    /** Called after a successful purge. Detail pages navigate to the list. */
    readonly onPurged?: () => void;
    /** Current listing state used to decide whether purge is available. */
    readonly publicationStatus: PublicationStatusEnum | null | undefined;
}

/**
 * Renders the "delete at the owner's request" button and its confirmation
 * dialog with the mandatory reason.
 *
 * @param props - The listing's vertical, id and name, plus the success callback.
 */
export function ListingPurgeOnRequestCard({
    vertical,
    entityId,
    entityName,
    onPurged,
    publicationStatus
}: ListingPurgeOnRequestCardProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const mutation = usePurgeListingOnRequestMutation();
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const reasonId = useId();
    const reasonHelpId = useId();

    const trimmedReason = reason.trim();
    const canConfirm = trimmedReason.length > 0 && !mutation.isPending;

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (!next) setReason('');
    };

    const handleConfirm = async () => {
        if (trimmedReason.length === 0) return;
        try {
            await mutation.mutateAsync({ vertical, id: entityId, reason: trimmedReason });
            handleOpenChange(false);
            addToast({
                title: t('admin-entities.listingPurgeOnRequest.successTitle'),
                message: t('admin-entities.listingPurgeOnRequest.successMessage', {
                    name: entityName
                }),
                variant: 'success'
            });
            onPurged?.();
        } catch (error) {
            adminLogger.error('[ListingPurgeOnRequestCard] Failed to purge', {
                vertical,
                entityId,
                error
            });
            handleOpenChange(false);
            if (isApiError(error) && error.status === STATE_CHANGED_STATUS) {
                // The owner changed between the authorization and the lock: the
                // listing was NOT purged. A changed state, not a failure.
                addToast({
                    title: t('admin-entities.listingPurgeOnRequest.errorTitle'),
                    message: t('admin-entities.listingPurgeOnRequest.stateChanged'),
                    variant: 'warning'
                });
                return;
            }
            addToast({
                title: t('admin-entities.listingPurgeOnRequest.errorTitle'),
                message:
                    error instanceof Error
                        ? error.message
                        : t('admin-entities.listingPurgeOnRequest.errorTitle'),
                variant: 'error'
            });
        }
    };

    if (!canPurgeListingOnRequest({ publicationStatus })) return null;

    return (
        <PermissionGate permissions={[PermissionEnum.LISTING_PURGE_ON_REQUEST]}>
            <button
                type="button"
                onClick={() => setOpen(true)}
                disabled={mutation.isPending}
                className="inline-flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/10 disabled:opacity-50 sm:px-3"
                data-testid="listing-purge-on-request"
            >
                <DeleteIcon size={16} />
                <span>{t('admin-entities.listingPurgeOnRequest.action')}</span>
            </button>
            <AlertDialog
                open={open}
                onOpenChange={handleOpenChange}
            >
                <AlertDialogContent data-testid="listing-purge-on-request-dialog">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t('admin-entities.listingPurgeOnRequest.title')}
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2">
                                <p>
                                    {t('admin-entities.listingPurgeOnRequest.whatHappens.listing', {
                                        name: entityName
                                    })}
                                </p>
                                <p>
                                    {t('admin-entities.listingPurgeOnRequest.whatHappens.content')}
                                </p>
                                <p>
                                    {t('admin-entities.listingPurgeOnRequest.whatHappens.featured')}
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor={reasonId}>
                            {t('admin-entities.listingPurgeOnRequest.reasonLabel')}
                        </Label>
                        <Textarea
                            id={reasonId}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            aria-describedby={reasonHelpId}
                            required
                            maxLength={2000}
                            data-testid="listing-purge-on-request-reason"
                        />
                        <p
                            id={reasonHelpId}
                            className="text-muted-foreground text-xs"
                        >
                            {t('admin-entities.listingPurgeOnRequest.reasonHelp')}
                        </p>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel data-testid="listing-purge-on-request-cancel">
                            {t('admin-entities.listingPurgeOnRequest.cancel')}
                        </AlertDialogCancel>
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={!canConfirm}
                            onClick={handleConfirm}
                            data-testid="listing-purge-on-request-confirm"
                        >
                            {t('admin-entities.listingPurgeOnRequest.confirm')}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </PermissionGate>
    );
}
