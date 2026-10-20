/** @file SubscriptionCancellationScreen.tsx — action 8 without a refund. */

import { AlertCircleIcon, LoaderIcon } from '@repo/icons';
import {
    type AdminSubscriptionCancellationResponse,
    PermissionEnum,
    SubscriptionCancellationParamsSchema
} from '@repo/schemas';
import { useId, useState } from 'react';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/ToastProvider';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors';
import { adminLogger } from '@/utils/logger';
import { formatCancellationDate } from '../cancellation-format';
import {
    CANCELLATION_CONFIRM_KEYS,
    CANCELLATION_NOTICE_KEYS,
    type ConfirmableCancellationOrigin,
    isKnownCancellationReason,
    readCancellationReason
} from '../cancellation-reasons';
import {
    useCancelSubscriptionMutation,
    useSubscriptionCancellationPreview
} from '../hooks/useSubscriptionCancellation';
import { CancellationPreviewDetails } from './CancellationPreviewDetails';
import { CancellationPreviewRefusal } from './CancellationPreviewRefusal';
import { CancellationResultDetails } from './CancellationResultDetails';

const NOTE_MAX_LENGTH = 2000;
/** Props for the URL-addressable administrative cancellation screen. */
export interface SubscriptionCancellationScreenProps {
    readonly subscriptionId: string;
}

/** Renders the permission-gated preview and confirmation flow for a subscription cancellation.
 * @param props - Subscription identifier displayed and acted on by the screen.
 * @returns The permission-gated cancellation screen.
 */
export function SubscriptionCancellationScreen({
    subscriptionId
}: SubscriptionCancellationScreenProps) {
    return (
        <PermissionGate permissions={[PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]}>
            <Card data-testid="subscription-cancellation-screen">
                <CardContent className="space-y-4 pt-6">
                    <CancellationBody subscriptionId={subscriptionId} />
                </CardContent>
            </Card>
        </PermissionGate>
    );
}

function CancellationBody({ subscriptionId }: SubscriptionCancellationScreenProps) {
    const { t, locale } = useTranslations();
    const { addToast } = useToast();
    const validId = SubscriptionCancellationParamsSchema.safeParse({ subscriptionId }).success;
    const preview = useSubscriptionCancellationPreview({ subscriptionId, enabled: validId });
    const mutation = useCancelSubscriptionMutation();
    const [note, setNote] = useState('');
    const [notice, setNotice] = useState(false);
    const [actRefusal, setActRefusal] = useState<string | null>(null);
    const [result, setResult] = useState<AdminSubscriptionCancellationResponse | null>(null);
    const noteId = useId();
    const noteHelpId = useId();

    if (!validId)
        return (
            <p data-testid="subscription-cancellation-blocked">
                {t('admin-billing.subscriptionCancellation.blocked.SUBSCRIPTION_NOT_FOUND')}
            </p>
        );
    if (result) return <CancellationResultDetails result={result} />;
    const actRefusalInput = { reason: actRefusal ?? '' };
    if (actRefusal)
        return (
            <div
                className="space-y-2"
                data-testid="subscription-cancellation-blocked"
                data-reason={actRefusal}
            >
                <p className="font-medium text-destructive">
                    {t('admin-billing.subscriptionCancellation.blocked.intro')}
                </p>
                <p>
                    {isKnownCancellationReason(actRefusalInput) &&
                    actRefusalInput.reason !== 'CANCELLATION_ORIGIN_CHANGED'
                        ? t(
                              `admin-billing.subscriptionCancellation.blocked.${actRefusalInput.reason}` as const
                          )
                        : t('admin-billing.subscriptionCancellation.blocked.unknown', {
                              reason: actRefusalInput.reason
                          })}
                </p>
            </div>
        );

    const handleConfirm = async () => {
        const current = preview.data;
        if (!current || current.origin === 'CANCEL_SCHEDULED' || mutation.isPending) return;
        setNotice(false);
        const trimmedNote = note.trim();
        try {
            const response = await mutation.mutateAsync(
                trimmedNote
                    ? { subscriptionId, expectedOrigin: current.origin, note: trimmedNote }
                    : { subscriptionId, expectedOrigin: current.origin }
            );
            setResult(response);
            addToast({
                title: t('admin-billing.subscriptionCancellation.successToast'),
                message: t('admin-billing.subscriptionCancellation.successToast'),
                variant: 'success'
            });
        } catch (error) {
            adminLogger.error(
                '[SubscriptionCancellationScreen] Failed to cancel the subscription',
                { subscriptionId, error }
            );
            const reason = readCancellationReason({ error });
            if (
                isApiError(error) &&
                error.status === 409 &&
                reason === 'CANCELLATION_ORIGIN_CHANGED'
            ) {
                setNotice(true);
                await preview.refetch();
                return;
            }
            if (reason !== null) {
                setActRefusal(reason);
                return;
            }
            addToast({
                title: t('admin-billing.subscriptionCancellation.loadError'),
                message:
                    error instanceof Error
                        ? error.message
                        : t('admin-billing.subscriptionCancellation.loadError'),
                variant: 'error'
            });
        }
    };

    return (
        <>
            {notice ? (
                <p
                    role="alert"
                    className="flex items-start gap-2 font-medium text-destructive"
                    data-testid="subscription-cancellation-notice"
                >
                    <AlertCircleIcon
                        size={16}
                        className="mt-0.5 shrink-0"
                    />
                    <span>{t(CANCELLATION_NOTICE_KEYS.CANCELLATION_ORIGIN_CHANGED)}</span>
                </p>
            ) : null}
            {preview.isLoading || preview.isFetching ? (
                <p
                    className="flex items-center gap-2"
                    data-testid="subscription-cancellation-loading"
                >
                    <LoaderIcon className="size-4 animate-spin" />
                    <span>{t('admin-billing.subscriptionCancellation.loading')}</span>
                </p>
            ) : preview.error ? (
                <CancellationPreviewRefusal
                    error={preview.error}
                    onRetry={() => {
                        void preview.refetch();
                    }}
                />
            ) : preview.data ? (
                <div
                    className="space-y-4"
                    data-testid="subscription-cancellation-ready"
                >
                    <CancellationPreviewDetails preview={preview.data} />
                    {preview.data.origin === 'CANCEL_SCHEDULED' ? null : (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor={noteId}>
                                    {t('admin-billing.subscriptionCancellation.noteLabel')}
                                </Label>
                                <Textarea
                                    id={noteId}
                                    value={note}
                                    onChange={(event) => setNote(event.target.value)}
                                    aria-describedby={noteHelpId}
                                    maxLength={NOTE_MAX_LENGTH}
                                    data-testid="subscription-cancellation-note"
                                />
                                <p
                                    id={noteHelpId}
                                    className="text-muted-foreground text-xs"
                                >
                                    {t('admin-billing.subscriptionCancellation.noteHelp')}
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="destructive"
                                disabled={mutation.isPending}
                                onClick={handleConfirm}
                                data-testid="subscription-cancellation-confirm"
                            >
                                {mutation.isPending
                                    ? t('admin-billing.subscriptionCancellation.pending')
                                    : t(
                                          CANCELLATION_CONFIRM_KEYS[
                                              preview.data.origin as ConfirmableCancellationOrigin
                                          ],
                                          preview.data.origin === 'ACTIVE'
                                              ? {
                                                    date: formatCancellationDate({
                                                        iso: preview.data.serviceEndsAt,
                                                        locale
                                                    })
                                                }
                                              : undefined
                                      )}
                            </Button>
                        </>
                    )}
                </div>
            ) : null}
        </>
    );
}
