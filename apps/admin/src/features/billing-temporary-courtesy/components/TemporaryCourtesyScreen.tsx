import { AdminSubscriptionPauseParamsSchema, PermissionEnum } from '@repo/schemas';
import { useState } from 'react';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { formatCancellationDate } from '@/features/billing-cancellation/cancellation-format';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors';
import {
    useCourtesyGrant,
    useCourtesyGrantPreview,
    useCourtesyRevoke,
    useCourtesyRevokePreview
} from '../hooks/useTemporaryCourtesy';
import { CourtesyGrantConfirmation } from './CourtesyGrantConfirmation';
import { CourtesyRevokeConfirmation } from './CourtesyRevokeConfirmation';

/** Props for the direct administrative courtesy page. */
export interface TemporaryCourtesyScreenProps {
    readonly subscriptionId: string;
}

function errorReason(error: unknown): string {
    if (!isApiError(error)) return 'UNKNOWN';
    const body = error.body as
        | {
              readonly error?: {
                  readonly code?: string;
                  readonly details?: { readonly reason?: string };
              };
          }
        | undefined;
    return body?.error?.details?.reason ?? body?.error?.code ?? 'UNKNOWN';
}

/** Displays S9/S34 and S10 previews, explicit confirmations and results. */
export function TemporaryCourtesyScreen({ subscriptionId }: TemporaryCourtesyScreenProps) {
    const { t, locale } = useTranslations();
    const validId = AdminSubscriptionPauseParamsSchema.safeParse({ subscriptionId }).success;
    const [months, setMonths] = useState(1);
    const [reason, setReason] = useState('');
    const [confirming, setConfirming] = useState<'grant' | 'revoke' | null>(null);
    const [failure, setFailure] = useState<string | null>(null);
    const [result, setResult] = useState<{
        readonly outcome: 'GRANTED' | 'EXTENDED' | 'RESUMED';
        readonly endsAt?: string;
        readonly nextChargeAt?: string | null;
    } | null>(null);
    const grantPreview = useCourtesyGrantPreview({ subscriptionId, months, enabled: validId });
    const revokePreview = useCourtesyRevokePreview({
        subscriptionId,
        enabled: validId && grantPreview.data?.liveCourtesy != null
    });
    const grant = useCourtesyGrant();
    const revoke = useCourtesyRevoke();
    const data = grantPreview.data;
    const customer =
        data?.subject?.displayName || data?.subject?.email || data?.subject?.id || subscriptionId;
    const date = (iso: string) => formatCancellationDate({ iso, locale });
    const handleError = async (error: unknown) => {
        setFailure(errorReason(error));
        setConfirming(null);
        await Promise.all([grantPreview.refetch(), revokePreview.refetch()]);
    };
    const submitGrant = async () => {
        if (!data?.offered || !data.status || reason.trim().length === 0 || grant.isPending) return;
        try {
            setFailure(null);
            const saved = await grant.mutateAsync({
                subscriptionId,
                expectedStatus: data.status,
                months,
                reason: reason.trim()
            });
            setResult(saved);
        } catch (error) {
            await handleError(error);
        }
    };
    const submitRevoke = async () => {
        if (!revokePreview.data?.inForce || revoke.isPending) return;
        try {
            setFailure(null);
            const saved = await revoke.mutateAsync({ subscriptionId });
            setResult({ outcome: saved.outcome, nextChargeAt: saved.nextCharge?.at ?? null });
        } catch (error) {
            await handleError(error);
        }
    };
    const errorText = (code: string) =>
        code === 'COURTESY_NOT_APPLIED'
            ? t('admin-billing.temporaryCourtesy.notApplied')
            : code === 'ADMINISTRATIVE_ACTION_STATE_CHANGED'
              ? t('admin-billing.temporaryCourtesy.stateChanged')
              : t('admin-billing.temporaryCourtesy.error', { reason: code });
    return (
        <PermissionGate permissions={[PermissionEnum.BILLING_GRANT_COMPLIMENTARY]}>
            <Card data-testid="temporary-courtesy-screen">
                <CardContent className="space-y-4 pt-6">
                    <p>{t('admin-billing.temporaryCourtesy.rule')}</p>
                    {result ? (
                        <p
                            role="status"
                            data-testid="courtesy-result"
                        >
                            {result.outcome === 'RESUMED'
                                ? t('admin-billing.temporaryCourtesy.revoked', {
                                      date: result.nextChargeAt
                                          ? date(result.nextChargeAt)
                                          : t('admin-billing.temporaryCourtesy.chargePending')
                                  })
                                : t(
                                      `admin-billing.temporaryCourtesy.${result.outcome === 'GRANTED' ? 'granted' : 'extended'}`,
                                      { date: result.endsAt ? date(result.endsAt) : '' }
                                  )}
                        </p>
                    ) : validId ? (
                        grantPreview.isLoading ? (
                            <p>{t('admin-billing.temporaryCourtesy.loading')}</p>
                        ) : grantPreview.error ? (
                            <p role="alert">{errorText(errorReason(grantPreview.error))}</p>
                        ) : data ? (
                            <>
                                {data.offered ? (
                                    <section className="space-y-3">
                                        <Label htmlFor="courtesy-months">
                                            {t('admin-billing.temporaryCourtesy.months')}
                                        </Label>
                                        <select
                                            id="courtesy-months"
                                            className="rounded border p-2"
                                            value={months}
                                            onChange={(event) => {
                                                setMonths(Number(event.target.value));
                                                setConfirming(null);
                                            }}
                                        >
                                            {Array.from(
                                                { length: 12 },
                                                (_, index) => index + 1
                                            ).map((value) => (
                                                <option
                                                    key={value}
                                                    value={value}
                                                >
                                                    {value}
                                                </option>
                                            ))}
                                        </select>
                                        <Label htmlFor="courtesy-reason">
                                            {t('admin-billing.temporaryCourtesy.reason')}
                                        </Label>
                                        <textarea
                                            id="courtesy-reason"
                                            className="block w-full rounded border p-2"
                                            value={reason}
                                            onChange={(event) => {
                                                setReason(event.target.value);
                                                setConfirming(null);
                                            }}
                                        />
                                        {confirming === 'grant' ? (
                                            <CourtesyGrantConfirmation
                                                preview={data}
                                                customer={customer}
                                                pending={grant.isPending}
                                                onConfirm={() => void submitGrant()}
                                            />
                                        ) : (
                                            <Button
                                                type="button"
                                                disabled={!reason.trim() || grantPreview.isFetching}
                                                onClick={() => setConfirming('grant')}
                                            >
                                                {t('admin-billing.temporaryCourtesy.review')}
                                            </Button>
                                        )}
                                    </section>
                                ) : (
                                    <section data-testid="courtesy-unavailable">
                                        <p>
                                            {t('admin-billing.temporaryCourtesy.unavailable', {
                                                customer,
                                                cycle: data.cycle ?? 'UNKNOWN'
                                            })}
                                        </p>
                                        <p>
                                            {t(
                                                'admin-billing.temporaryCourtesy.unavailableReason',
                                                { reason: data.reason ?? 'UNKNOWN' }
                                            )}
                                        </p>
                                        {data.reason === 'NOT_MONTHLY' &&
                                        data.alternatives?.length === 2 ? (
                                            <p>
                                                {t('admin-billing.temporaryCourtesy.alternatives')}
                                            </p>
                                        ) : null}
                                    </section>
                                )}
                                {data.liveCourtesy ? (
                                    <section className="space-y-3">
                                        <h2>{t('admin-billing.temporaryCourtesy.revokeTitle')}</h2>
                                        {revokePreview.isLoading ? (
                                            <p>{t('admin-billing.temporaryCourtesy.loading')}</p>
                                        ) : revokePreview.data?.inForce &&
                                          revokePreview.data.courtesy ? (
                                            confirming === 'revoke' ? (
                                                <CourtesyRevokeConfirmation
                                                    preview={revokePreview.data}
                                                    customer={customer}
                                                    pending={revoke.isPending}
                                                    onConfirm={() => void submitRevoke()}
                                                />
                                            ) : (
                                                <Button
                                                    type="button"
                                                    onClick={() => setConfirming('revoke')}
                                                >
                                                    {t(
                                                        'admin-billing.temporaryCourtesy.reviewRevoke'
                                                    )}
                                                </Button>
                                            )
                                        ) : (
                                            <p>{t('admin-billing.temporaryCourtesy.notInForce')}</p>
                                        )}
                                    </section>
                                ) : null}
                                {failure ? <p role="alert">{errorText(failure)}</p> : null}
                            </>
                        ) : null
                    ) : (
                        <p>{t('admin-billing.temporaryCourtesy.invalidId')}</p>
                    )}
                </CardContent>
            </Card>
        </PermissionGate>
    );
}
