/**
 * @file SubscriptionRevocationScreen.tsx
 * The panel confirmation of administrative action 8 with reason revocation
 * (ACC:8, S36; HOS-1678): revoke a subscription under the right of withdrawal.
 *
 * The screen reads the preview and shows one of these:
 *  - an id that is not a uuid: not found, without asking the API;
 *  - loading;
 *  - a refused or failed preview: unavailable or blocked, with no confirm
 *    button and no note (`RevocationPreviewRefusal`);
 *  - a confirmable preview: what the act does (the three things, AC:B5:20),
 *    an optional note and the confirm button;
 *  - after a successful act: the result, with nothing left to confirm.
 *
 * The screen never decides whether the row can be revoked: the act re-reads
 * everything under its own locks. It always sends the `payment.id` of the
 * CURRENT preview. A 409 `REVOCATION_PAYMENT_CHANGED`/`REVOCATION_STATE_CHANGED`
 * leaves a notice and reads the preview again, without retrying; any other
 * known refusal of the act also reads the preview again, which then shows the
 * block. Gated by `BILLING_CANCEL_SUBSCRIPTION` (a permission, never a role).
 */

import { AlertCircleIcon, LoaderIcon } from '@repo/icons';
import {
    PermissionEnum,
    SubscriptionRevocationParamsSchema,
    type SubscriptionRevocationResponse
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
import {
    useRevokeSubscriptionMutation,
    useSubscriptionRevocationPreview
} from '../hooks/useSubscriptionRevocation';
import {
    isKnownRevocationReason,
    isRevocationNoticeReason,
    REVOCATION_NOTICE_KEYS,
    type RevocationNoticeReason,
    readRevocationReason
} from '../revocation-reasons';
import { RevocationPreviewDetails } from './RevocationPreviewDetails';
import { RevocationPreviewRefusal, RevocationUnavailable } from './RevocationPreviewRefusal';
import { RevocationResultDetails } from './RevocationResultDetails';

/** HTTP status of a changed payment or row between the preview and the act. */
const CONFLICT_STATUS = 409;
/** HTTP status for an actor who may not revoke this subscription. */
const FORBIDDEN_STATUS = 403;
/** Longest note the act accepts. */
const NOTE_MAX_LENGTH = 2000;

/** A successful act and the currency of the payment it refunded. */
interface RevocationOutcome {
    readonly result: SubscriptionRevocationResponse;
    readonly currency: string | null;
}

/** Props for {@link SubscriptionRevocationScreen}. RO-RO pattern. */
export interface SubscriptionRevocationScreenProps {
    /** The subscription id from the URL; not trusted to be a uuid. */
    readonly subscriptionId: string;
}

/**
 * Renders the revocation confirmation for one subscription, behind the
 * `BILLING_CANCEL_SUBSCRIPTION` permission.
 *
 * @param props - The subscription id.
 */
export function SubscriptionRevocationScreen({
    subscriptionId
}: SubscriptionRevocationScreenProps) {
    return (
        <PermissionGate permissions={[PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]}>
            <Card data-testid="subscription-revocation-screen">
                <CardContent className="space-y-4 pt-6">
                    <RevocationBody subscriptionId={subscriptionId} />
                </CardContent>
            </Card>
        </PermissionGate>
    );
}

/** The state machine of the screen. */
function RevocationBody({ subscriptionId }: SubscriptionRevocationScreenProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const validId = SubscriptionRevocationParamsSchema.safeParse({ subscriptionId }).success;
    const preview = useSubscriptionRevocationPreview({ subscriptionId, enabled: validId });
    const mutation = useRevokeSubscriptionMutation();
    const [note, setNote] = useState('');
    const [notice, setNotice] = useState<RevocationNoticeReason | null>(null);
    const [forbidden, setForbidden] = useState(false);
    const [outcome, setOutcome] = useState<RevocationOutcome | null>(null);
    const noteId = useId();
    const noteHelpId = useId();

    if (!validId) {
        return <RevocationUnavailable messageKey="admin-billing.subscriptionRevocation.notFound" />;
    }

    if (outcome) {
        return (
            <RevocationResultDetails
                result={outcome.result}
                currency={outcome.currency}
            />
        );
    }

    if (forbidden) {
        return (
            <RevocationUnavailable messageKey="admin-billing.subscriptionRevocation.forbidden" />
        );
    }

    const handleConfirm = async () => {
        const current = preview.data;
        if (!current || mutation.isPending) return;
        setNotice(null);
        const trimmedNote = note.trim();
        try {
            const result = await mutation.mutateAsync(
                trimmedNote.length > 0
                    ? { subscriptionId, expectedPaymentId: current.payment.id, note: trimmedNote }
                    : { subscriptionId, expectedPaymentId: current.payment.id }
            );
            setOutcome({ result, currency: current.payment.currency });
            addToast({
                title: t('admin-billing.subscriptionRevocation.successTitle'),
                message: t('admin-billing.subscriptionRevocation.result.title'),
                variant: 'success'
            });
        } catch (error) {
            adminLogger.error('[SubscriptionRevocationScreen] Failed to revoke the subscription', {
                subscriptionId,
                error
            });
            const status = isApiError(error) ? error.status : undefined;
            const reason = readRevocationReason({ error });
            if (status === CONFLICT_STATUS && isRevocationNoticeReason(reason)) {
                // The payment or the row changed since the preview: nothing was
                // revoked. Read the preview again; never retry on our own.
                setNotice(reason);
                await preview.refetch();
                return;
            }
            if (status === FORBIDDEN_STATUS) {
                setForbidden(true);
                return;
            }
            if (reason !== null && isKnownRevocationReason(reason)) {
                // A refusal of the act the preview did not see yet (a refund
                // opened meanwhile, the window closed): the fresh preview shows it.
                await preview.refetch();
                return;
            }
            addToast({
                title: t('admin-billing.subscriptionRevocation.errorTitle'),
                message:
                    error instanceof Error
                        ? error.message
                        : t('admin-billing.subscriptionRevocation.errorTitle'),
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
                    data-testid="subscription-revocation-notice"
                >
                    <AlertCircleIcon
                        size={16}
                        className="mt-0.5 shrink-0"
                    />
                    <span>{t(REVOCATION_NOTICE_KEYS[notice])}</span>
                </p>
            ) : null}
            {preview.isLoading || preview.isFetching ? (
                <p
                    className="flex items-center gap-2"
                    data-testid="subscription-revocation-loading"
                >
                    <LoaderIcon className="size-4 animate-spin" />
                    <span>{t('admin-billing.subscriptionRevocation.loading')}</span>
                </p>
            ) : preview.error ? (
                <RevocationPreviewRefusal error={preview.error} />
            ) : preview.data ? (
                <div
                    className="space-y-4"
                    data-testid="subscription-revocation-ready"
                >
                    <RevocationPreviewDetails
                        preview={preview.data}
                        subscriptionId={subscriptionId}
                    />
                    <div className="space-y-2">
                        <Label htmlFor={noteId}>
                            {t('admin-billing.subscriptionRevocation.noteLabel')}
                        </Label>
                        <Textarea
                            id={noteId}
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            aria-describedby={noteHelpId}
                            maxLength={NOTE_MAX_LENGTH}
                            data-testid="subscription-revocation-note"
                        />
                        <p
                            id={noteHelpId}
                            className="text-muted-foreground text-xs"
                        >
                            {t('admin-billing.subscriptionRevocation.noteHelp')}
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="destructive"
                        disabled={mutation.isPending}
                        onClick={handleConfirm}
                        data-testid="subscription-revocation-confirm"
                    >
                        {t('admin-billing.subscriptionRevocation.confirm')}
                    </Button>
                </div>
            ) : null}
        </>
    );
}
