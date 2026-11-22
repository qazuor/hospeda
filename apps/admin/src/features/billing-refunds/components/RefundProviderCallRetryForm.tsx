/**
 * @file RefundProviderCallRetryForm.tsx
 * «Retry with MP» (HOS-2516): resends to Mercado Pago, with the same idempotency key, the calls of a
 * confirmed refund that went unanswered. Such a refund has a live provider call, so it is not in the
 * proposed-refund list. With a `picker` the person chooses it from the stuck-refund list (HOS-2560);
 * without one they name it by id («Operar por ID»), as the refunds runbook (§8, step 0) says.
 */

import type { TranslationKey } from '@repo/i18n';
import type {
    RefundProviderCallRetryCallOutcome,
    RefundProviderCallRetryResponse
} from '@repo/schemas';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors';
import { Action14Field } from '../../billing-reconciliation/components/action14-shared';
import { useRetryRefundProviderCalls } from '../hooks/useRetryRefundProviderCalls';
import { refundDecisionErrorKey } from '../refund-decision-reasons';
import { StuckRefundPicker, type StuckRefundPickerProps } from './StuckRefundPicker';

const BASE = 'admin-billing.proposedRefunds.providerRetry';

/** Rejections only the retry answers, or answers with its own advice; the rest reuse action 13's copy. */
const RETRY_REJECTION_KEYS: Readonly<Record<string, TranslationKey>> = {
    REFUND_NOT_CONFIRMED: `${BASE}.rejections.REFUND_NOT_CONFIRMED`,
    REFUND_HAS_NO_UNANSWERED_CALL: `${BASE}.rejections.REFUND_HAS_NO_UNANSWERED_CALL`,
    REFUND_PAST_PROVIDER_WINDOW: `${BASE}.rejections.REFUND_PAST_PROVIDER_WINDOW`,
    REFUND_RETRY_IN_PROGRESS: `${BASE}.rejections.REFUND_RETRY_IN_PROGRESS`,
    REFUND_CALL_TOO_OLD_TO_RETRY: `${BASE}.rejections.REFUND_CALL_TOO_OLD_TO_RETRY`
};

/** Copy for each resent call's outcome. */
const CALL_OUTCOME_KEYS: Readonly<Record<RefundProviderCallRetryCallOutcome, TranslationKey>> = {
    SENT: `${BASE}.calls.SENT`,
    FOUND_AT_PROVIDER: `${BASE}.calls.FOUND_AT_PROVIDER`,
    AWAITING_PROVIDER_ANSWER: `${BASE}.calls.AWAITING_PROVIDER_ANSWER`,
    PROVIDER_KEY_CONFLICT: `${BASE}.calls.PROVIDER_KEY_CONFLICT`,
    PROVIDER_REJECTED_FAILED: `${BASE}.calls.PROVIDER_REJECTED_FAILED`
};

const RefundIdSchema = z.string().uuid();

/**
 * Maps a retry error to its localized message.
 *
 * @param input - The thrown error.
 * @returns The translation key to show.
 */
export function readRetryRejection({ error }: { readonly error: unknown }): TranslationKey {
    const payload = isApiError(error) ? error.body : null;
    const reason = (payload as { error?: { reason?: string } } | null)?.error?.reason;
    return (reason ? RETRY_REJECTION_KEYS[reason] : undefined) ?? refundDecisionErrorKey({ error });
}

/**
 * The summary of a retry: the refund closed, kept waiting for accreditation, failed, or still has a
 * call without a usable answer.
 *
 * @param input - The route's response.
 * @returns The translation key of the summary.
 */
export function retrySummaryKey({
    response
}: {
    readonly response: RefundProviderCallRetryResponse;
}): TranslationKey {
    if (response.status === 'EXECUTED') return `${BASE}.summary.EXECUTED`;
    if (response.status === 'FAILED') return `${BASE}.summary.FAILED`;
    // An empty `calls` means every call was already accepted and only RF3 ran again.
    if (
        response.calls.every(
            (call) => call.outcome === 'SENT' || call.outcome === 'FOUND_AT_PROVIDER'
        )
    )
        return `${BASE}.summary.WAITING_ACCREDITATION`;
    return `${BASE}.summary.STILL_UNANSWERED`;
}

/**
 * Renders the «Retry with MP» form.
 *
 * @param props.picker - Picks the refund from the stuck-refund list; when absent the id is typed.
 */
export function RefundProviderCallRetryForm({
    picker
}: {
    readonly picker?: StuckRefundPickerProps;
} = {}) {
    const { t } = useTranslations();
    const mutation = useRetryRefundProviderCalls();
    const [refundId, setRefundId] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
    const [result, setResult] = useState<RefundProviderCallRetryResponse | null>(null);
    const pickedId = picker?.value ?? '';
    // A refund picked from the list (a row's action or the selector) starts a fresh decision; the
    // selection going empty, as when a settled refund leaves the list, keeps the last outcome shown.
    useEffect(() => {
        if (pickedId === '') return;
        setResult(null);
        setConfirming(false);
        setErrorKey(null);
    }, [pickedId]);
    const trimmedId = (picker ? picker.value : refundId).trim();
    const valid = RefundIdSchema.safeParse(trimmedId).success;
    const retry = async () => {
        setErrorKey(null);
        try {
            setResult(await mutation.mutateAsync({ refundId: trimmedId }));
        } catch (error) {
            setErrorKey(readRetryRejection({ error }));
        }
        setConfirming(false);
    };
    return (
        <Card>
            <CardContent className="space-y-3 pt-6">
                <section
                    data-testid={
                        picker ? 'refund-provider-call-retry' : 'refund-provider-call-retry-by-id'
                    }
                    className="space-y-3"
                >
                    <h2 className="font-semibold">{t(`${BASE}.title`)}</h2>
                    <p className="text-muted-foreground text-sm">{t(`${BASE}.description`)}</p>
                    {result ? (
                        <div
                            role="status"
                            className="space-y-1"
                        >
                            <p>{t(retrySummaryKey({ response: result }))}</p>
                            <ul className="list-disc pl-5 text-sm">
                                {result.calls.map((call) => (
                                    <li key={call.idempotencyKey}>
                                        <code>{call.idempotencyKey}</code>:{' '}
                                        {t(CALL_OUTCOME_KEYS[call.outcome])}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : confirming ? (
                        <div className="space-y-2">
                            <p data-testid="refund-provider-call-retry-confirmation">
                                {t(`${BASE}.confirmText`, { refundId: trimmedId })}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    disabled={mutation.isPending}
                                    onClick={() => void retry()}
                                >
                                    {t(`${BASE}.confirm`)}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setConfirming(false)}
                                >
                                    {t(`${BASE}.back`)}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                            {picker ? (
                                <StuckRefundPicker {...picker} />
                            ) : (
                                <Action14Field
                                    label={t(`${BASE}.refundId`)}
                                    value={refundId}
                                    onChange={setRefundId}
                                />
                            )}
                            <Button
                                className="self-end"
                                disabled={!valid}
                                onClick={() => {
                                    setErrorKey(null);
                                    setConfirming(true);
                                }}
                            >
                                {t(`${BASE}.review`)}
                            </Button>
                        </div>
                    )}
                    {errorKey ? <p role="alert">{t(errorKey)}</p> : null}
                </section>
            </CardContent>
        </Card>
    );
}
