import { formatDate, type TranslationKey } from '@repo/i18n';
import type {
    ListingModerationAction,
    ListingModerationResponse,
    PublicationStatusEnum
} from '@repo/schemas';
import { formatCalendarDate } from '@repo/utils';
import { useState } from 'react';
import type { ColumnTFunction } from '@/components/entity-list/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/ToastProvider';
import { useTranslations } from '@/hooks/use-translations';
import { adminLogger } from '@/utils/logger';
import {
    describeModerationError,
    getAvailableModerationActions,
    type ListingModerationActionKind
} from '../config/listing-moderation-actions';
import { getPublicationStatusBadgeOptions } from '../config/publication-status-options';
import { useListingModerationStateQuery } from '../hooks/useListingModerationStateQuery';
import { useModerateListingMutation } from '../hooks/useModerateListingMutation';
import type { PurgeListingVertical } from '../hooks/usePurgeListingOnRequestMutation';
import { ListingModerationActionDialog } from './ListingModerationActionDialog';

const LABEL: Readonly<Record<ListingModerationActionKind, TranslationKey>> = {
    REQUEST_FIX: 'admin-entities.listingModeration.actions.requestFix',
    TAKE_DOWN: 'admin-entities.listingModeration.actions.takeDown',
    LIFT: 'admin-entities.listingModeration.actions.lift',
    CLOSE_FIX_REQUEST: 'admin-entities.listingModeration.actions.closeFixRequest'
};

export function ListingModerationActions({
    vertical,
    entityId,
    entityName
}: {
    readonly vertical: PurgeListingVertical;
    readonly entityId: string;
    readonly entityName: string;
}) {
    const { t, locale } = useTranslations();
    const displayInstant = (date: string) =>
        formatDate({
            date: new Date(date),
            locale,
            options: { year: 'numeric', month: 'short', day: 'numeric' }
        });
    /** Calendar dates have no timezone; parsing them as instants shifts the displayed day. */
    const displayCalendarDate = (value: string) =>
        formatCalendarDate({
            value,
            locale,
            options: { year: 'numeric', month: 'short', day: 'numeric' }
        });
    const badgeOptions = getPublicationStatusBadgeOptions({ t: t as ColumnTFunction });
    const statusLabel = (status: PublicationStatusEnum) =>
        badgeOptions.find((option) => option.value === status)?.label ?? status;
    const { addToast } = useToast();
    const state = useListingModerationStateQuery({ vertical, id: entityId });
    const mutation = useModerateListingMutation();
    const [action, setAction] = useState<ListingModerationActionKind | null>(null);
    const [open, setOpen] = useState(false);
    const [result, setResult] = useState<ListingModerationResponse | null>(null);
    const actions = state.isError
        ? []
        : getAvailableModerationActions({
              publicationStatus: state.data?.publicationStatus,
              fixRequestOpen: state.data ? state.data.fixRequest !== null : undefined
          });
    const suggestedDate = state.data?.fixRequest?.suggestedDate
        ? displayCalendarDate(state.data.fixRequest.suggestedDate)
        : null;
    const onConfirm = async (body: ListingModerationAction) => {
        try {
            const response = await mutation.mutateAsync({ vertical, id: entityId, body });
            setResult(response);
            setOpen(false);
            addToast({
                title: t('admin-entities.listingModeration.successTitle'),
                message: t('admin-entities.listingModeration.successMessage', {
                    status: statusLabel(response.publicationStatus)
                }),
                variant: 'success'
            });
        } catch (error) {
            adminLogger.error('[ListingModerationActions] Failed to moderate', {
                vertical,
                entityId,
                error
            });
            setOpen(false);
            const result = describeModerationError({ action: body.action, error });
            const serverMessage =
                result.messageKey === 'admin-entities.listingModeration.errors.generic' &&
                error instanceof Error &&
                error.message;
            addToast({
                title: t('admin-entities.listingModeration.errors.title'),
                message: serverMessage || t(result.messageKey),
                variant: result.variant
            });
        }
    };
    return (
        <div className="space-y-3">
            {result ? (
                <p
                    data-testid="listing-moderation-result"
                    className="text-muted-foreground text-sm"
                >
                    {t('admin-entities.listingModeration.resultLabel')}:{' '}
                    {statusLabel(result.publicationStatus)} ·{' '}
                    {result.fixRequestOpen
                        ? t('admin-entities.listingModeration.fixRequestOpen')
                        : t('admin-entities.listingModeration.fixRequestClosed')}
                </p>
            ) : null}
            {state.isPending ? (
                <p className="text-muted-foreground text-sm">
                    {t('admin-entities.listingModeration.stateLoading')}
                </p>
            ) : null}
            {state.isError ? (
                <p
                    role="alert"
                    className="text-destructive text-sm"
                >
                    {t('admin-entities.listingModeration.stateError')}
                </p>
            ) : null}
            {state.data?.fixRequest ? (
                <div className="space-y-1 text-sm">
                    <p>
                        {t('admin-entities.listingModeration.fixRequest.reason', {
                            reason: state.data.fixRequest.reason
                        })}
                    </p>
                    <p>
                        {t('admin-entities.listingModeration.fixRequest.openedAt', {
                            date: displayInstant(state.data.fixRequest.openedAt)
                        })}
                    </p>
                    {suggestedDate ? (
                        <p>
                            {t('admin-entities.listingModeration.fixRequest.suggestedDate', {
                                date: suggestedDate
                            })}
                        </p>
                    ) : null}
                    {state.data.fixRequest.ownerReportedFixedAt ? (
                        <p>
                            {t('admin-entities.listingModeration.fixRequest.ownerReportedFixed', {
                                date: displayInstant(state.data.fixRequest.ownerReportedFixedAt)
                            })}
                        </p>
                    ) : null}
                </div>
            ) : state.data ? (
                <p className="text-muted-foreground text-sm">
                    {t('admin-entities.listingModeration.fixRequest.none')}
                </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
                {actions.map((item) => (
                    <Button
                        key={item}
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={mutation.isPending}
                        onClick={() => {
                            setAction(item);
                            setOpen(true);
                        }}
                        data-testid={`listing-moderation-action-${item}`}
                    >
                        {t(LABEL[item])}
                    </Button>
                ))}
            </div>
            {action ? (
                <ListingModerationActionDialog
                    action={action}
                    entityName={entityName}
                    open={open}
                    onOpenChange={setOpen}
                    isPending={mutation.isPending}
                    onConfirm={onConfirm}
                />
            ) : null}
        </div>
    );
}
