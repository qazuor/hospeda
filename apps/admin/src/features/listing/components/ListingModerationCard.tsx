/**
 * @file ListingModerationCard.tsx
 * The listing's publication state and its moderation control on the three
 * listing detail routes (HOS-589/HOS-686 AC-26; actions since HOS-1684).
 *
 * HOS-1641 (Coord-424) left this card read-only, because the old inline select
 * posted `{ moderationState }`, a body the action-based endpoint answered with
 * 400. HOS-1684 gives the panel its control back: one button per moderation
 * ACTION the listing's state admits (`getAvailableModerationActions`), each
 * opening its confirmation with the reason, and posting through
 * `useModerateListingMutation` to `POST /api/v1/admin/{plural}/{id}/moderate`.
 *
 * Gated by `LISTING_MODERATE`, the single moderation permission (AC:V6:12).
 * After an action the card shows what the API returned — the new state and
 * whether a fix request is open — instead of guessing it: a `LIFT` may end in
 * `DRAFT`, `UNPUBLISHED_BY_BILLING` or `PUBLISHED`.
 */

import type { TranslationKey } from '@repo/i18n';
import {
    type ListingModerationAction,
    type ListingModerationResponse,
    PermissionEnum,
    type PublicationStatusEnum
} from '@repo/schemas';
import { useState } from 'react';
import { PermissionGate } from '@/components/auth/PermissionGate';
import type { ColumnTFunction } from '@/components/entity-list/types';
import { BadgeCell } from '@/components/table/cells/BadgeCell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/ToastProvider';
import { useTranslations } from '@/hooks/use-translations';
import { adminLogger } from '@/utils/logger';
import {
    describeModerationError,
    getAvailableModerationActions,
    type ListingModerationActionKind
} from '../config/listing-moderation-actions';
import { getPublicationStatusBadgeOptions } from '../config/publication-status-options';
import { useModerateListingMutation } from '../hooks/useModerateListingMutation';
import type { PurgeListingVertical } from '../hooks/usePurgeListingOnRequestMutation';
import { ListingModerationActionDialog } from './ListingModerationActionDialog';

/** Button label per action. */
const ACTION_LABEL: Readonly<Record<ListingModerationActionKind, TranslationKey>> = {
    REQUEST_FIX: 'admin-entities.listingModeration.actions.requestFix',
    TAKE_DOWN: 'admin-entities.listingModeration.actions.takeDown',
    LIFT: 'admin-entities.listingModeration.actions.lift',
    CLOSE_FIX_REQUEST: 'admin-entities.listingModeration.actions.closeFixRequest'
};

/** Props for {@link ListingModerationCard}. RO-RO pattern. */
export interface ListingModerationCardProps {
    /** Vertical of the listing. */
    readonly vertical: PurgeListingVertical;
    /** UUID of the listing. */
    readonly entityId: string;
    /** Listing name shown in the confirmation; falls back to the id upstream. */
    readonly entityName: string;
    /** The listing's `publicationStatus`; `undefined` while loading. */
    readonly publicationStatus: PublicationStatusEnum | null | undefined;
}

/**
 * Renders the listing's publication state and, for an admin with
 * `LISTING_MODERATE`, one button per moderation action the state admits.
 *
 * @param props - The listing's vertical, id, name and publication state.
 */
export function ListingModerationCard({
    vertical,
    entityId,
    entityName,
    publicationStatus
}: ListingModerationCardProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const mutation = useModerateListingMutation();
    const [dialogAction, setDialogAction] = useState<ListingModerationActionKind | null>(null);
    const [open, setOpen] = useState(false);
    const [result, setResult] = useState<ListingModerationResponse | null>(null);

    const badgeOptions = getPublicationStatusBadgeOptions({ t: t as ColumnTFunction });
    const statusLabel = (status: PublicationStatusEnum): string =>
        badgeOptions.find((option) => option.value === status)?.label ?? status;
    const actions = getAvailableModerationActions({ publicationStatus });

    const openDialog = (action: ListingModerationActionKind) => {
        setDialogAction(action);
        setOpen(true);
    };

    const handleConfirm = async (body: ListingModerationAction) => {
        try {
            const response = await mutation.mutateAsync({ vertical, id: entityId, body });
            setOpen(false);
            setResult(response);
            addToast({
                title: t('admin-entities.listingModeration.successTitle'),
                message: t('admin-entities.listingModeration.successMessage', {
                    status: statusLabel(response.publicationStatus)
                }),
                variant: 'success'
            });
        } catch (error) {
            adminLogger.error('[ListingModerationCard] Failed to moderate', {
                vertical,
                entityId,
                action: body.action,
                error
            });
            setOpen(false);
            const { messageKey, variant } = describeModerationError({
                action: body.action,
                error
            });
            const useServerMessage =
                messageKey === 'admin-entities.listingModeration.errors.generic' &&
                error instanceof Error &&
                error.message.length > 0;
            addToast({
                title: t('admin-entities.listingModeration.errors.title'),
                message: useServerMessage ? error.message : t(messageKey),
                variant
            });
        }
    };

    return (
        <Card data-testid="listing-moderation">
            <CardHeader>
                <CardTitle className="font-medium text-sm">
                    {t('admin-entities.listingModeration.title')}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {publicationStatus ? (
                    <BadgeCell
                        value={publicationStatus}
                        options={badgeOptions}
                    />
                ) : null}

                {result ? (
                    <p
                        className="text-muted-foreground text-sm"
                        data-testid="listing-moderation-result"
                    >
                        {t('admin-entities.listingModeration.resultLabel')}:{' '}
                        {statusLabel(result.publicationStatus)} ·{' '}
                        {result.fixRequestOpen
                            ? t('admin-entities.listingModeration.fixRequestOpen')
                            : t('admin-entities.listingModeration.fixRequestClosed')}
                    </p>
                ) : null}

                <PermissionGate permissions={[PermissionEnum.LISTING_MODERATE]}>
                    <div className="flex flex-wrap gap-2">
                        {actions.map((action) => (
                            <Button
                                key={action}
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={mutation.isPending}
                                onClick={() => openDialog(action)}
                                data-testid={`listing-moderation-action-${action}`}
                            >
                                {t(ACTION_LABEL[action])}
                            </Button>
                        ))}
                    </div>
                    {dialogAction ? (
                        <ListingModerationActionDialog
                            action={dialogAction}
                            entityName={entityName}
                            open={open}
                            onOpenChange={setOpen}
                            isPending={mutation.isPending}
                            onConfirm={handleConfirm}
                        />
                    ) : null}
                </PermissionGate>
            </CardContent>
        </Card>
    );
}
