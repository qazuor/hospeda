import { AdminSubscriptionPauseParamsSchema, PermissionEnum } from '@repo/schemas';
import { useState } from 'react';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { formatCancellationDate } from '@/features/billing-cancellation/cancellation-format';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors';
import { useBillingPauseAction, useBillingPausePreview } from '../hooks/useBillingPause';

/** Props for the administrative pause and resume page. */
export interface BillingPauseScreenProps {
    readonly subscriptionId: string;
}

function errorReason(error: unknown): string {
    if (!isApiError(error)) return 'UNKNOWN';
    const body = error.body as
        | { readonly error?: { readonly details?: { readonly reason?: string } } }
        | undefined;
    return body?.error?.details?.reason ?? 'UNKNOWN';
}

/** Shows the action 9 preview, explicit effects and result. */
export function BillingPauseScreen({ subscriptionId }: BillingPauseScreenProps) {
    const { t, locale } = useTranslations();
    const validId = AdminSubscriptionPauseParamsSchema.safeParse({ subscriptionId }).success;
    const preview = useBillingPausePreview({ subscriptionId, enabled: validId });
    const action = useBillingPauseAction();
    const [months, setMonths] = useState(1);
    const [confirming, setConfirming] = useState(false);
    const [result, setResult] = useState<Awaited<ReturnType<typeof action.mutateAsync>> | null>(
        null
    );
    const [failure, setFailure] = useState<string | null>(null);
    const data = preview.data;
    const customer =
        data?.subject?.displayName || data?.subject?.email || data?.subject?.id || subscriptionId;
    const plan = data?.currentPlan?.planName ?? '—';
    const resuming = data?.status === 'PAUSED' && data.openPause?.reason === 'CUSTOMER_REQUEST';
    const date = (iso: string) => formatCancellationDate({ iso, locale });
    const expectedEnd = data?.expectedEndAtByMonths?.[String(months)];
    const submit = async () => {
        if (!data || action.isPending) return;
        try {
            setFailure(null);
            setResult(
                await action.mutateAsync({
                    subscriptionId,
                    act: resuming ? 'resume' : 'pause',
                    expectedStatus: resuming ? 'PAUSED' : 'ACTIVE',
                    ...(resuming ? {} : { months })
                })
            );
        } catch (error) {
            setFailure(errorReason(error));
            setConfirming(false);
            await preview.refetch();
        }
    };
    return (
        <PermissionGate permissions={[PermissionEnum.BILLING_PAUSE_SUBSCRIPTION]}>
            <Card data-testid="billing-pause-screen">
                <CardContent className="space-y-4 pt-6">
                    {result ? (
                        <p
                            role="status"
                            data-testid="billing-pause-result"
                        >
                            {result.outcome === 'RESUMED'
                                ? t('admin-billing.subscriptionPause.resumed', {
                                      date: result.nextCharge
                                          ? date(result.nextCharge.at)
                                          : t('admin-billing.subscriptionPause.chargePending')
                                  })
                                : t('admin-billing.subscriptionPause.paused', {
                                      date: result.expectedEndAt ? date(result.expectedEndAt) : ''
                                  })}
                        </p>
                    ) : validId ? (
                        preview.isLoading ? (
                            <p>{t('admin-billing.subscriptionPause.loading')}</p>
                        ) : preview.error ? (
                            <p role="alert">
                                {t('admin-billing.subscriptionPause.error', {
                                    reason: errorReason(preview.error)
                                })}
                            </p>
                        ) : data ? (
                            <>
                                <p>
                                    {t('admin-billing.subscriptionPause.customer', {
                                        customer
                                    })}
                                </p>
                                {resuming ? (
                                    <>
                                        <p>
                                            {t('admin-billing.subscriptionPause.resumePreview', {
                                                date: data.openPause?.expectedEndAt
                                                    ? date(data.openPause.expectedEndAt)
                                                    : ''
                                            })}
                                        </p>
                                        {confirming ? (
                                            <p data-testid="billing-pause-confirmation">
                                                {t(
                                                    'admin-billing.subscriptionPause.resumeConfirm',
                                                    { customer, plan }
                                                )}
                                            </p>
                                        ) : null}
                                    </>
                                ) : data.offered ? (
                                    <>
                                        <Label htmlFor="pause-months">
                                            {t('admin-billing.subscriptionPause.months')}
                                        </Label>
                                        <select
                                            id="pause-months"
                                            className="rounded border p-2"
                                            value={months}
                                            onChange={(event) => {
                                                setMonths(Number(event.target.value));
                                                setConfirming(false);
                                            }}
                                        >
                                            {Array.from(
                                                { length: data.months?.max ?? 0 },
                                                (_, index) => index + 1
                                            )
                                                .filter((value) => value >= (data.months?.min ?? 1))
                                                .map((value) => (
                                                    <option
                                                        key={value}
                                                        value={value}
                                                    >
                                                        {value}
                                                    </option>
                                                ))}
                                        </select>
                                        {confirming ? (
                                            <div
                                                data-testid="billing-pause-confirmation"
                                                className="space-y-2"
                                            >
                                                <p>
                                                    {t(
                                                        'admin-billing.subscriptionPause.pauseConfirm',
                                                        {
                                                            customer,
                                                            plan,
                                                            date: expectedEnd
                                                                ? date(expectedEnd)
                                                                : ''
                                                        }
                                                    )}
                                                </p>
                                                <p>
                                                    {t(
                                                        'admin-billing.subscriptionPause.listingEffect'
                                                    )}
                                                </p>
                                                <p>
                                                    {t(
                                                        'admin-billing.subscriptionPause.retentionEffect'
                                                    )}
                                                </p>
                                                <p>
                                                    {t(
                                                        'admin-billing.subscriptionPause.addonEffect'
                                                    )}
                                                </p>
                                                {data.addons?.vertical.map((name) => (
                                                    <p key={name}>{name}</p>
                                                ))}
                                                {data.addons?.account.map((addon) => (
                                                    <p key={addon.name}>
                                                        {addon.name}:{' '}
                                                        {addon.pauses
                                                            ? t(
                                                                  'admin-billing.subscriptionPause.addonPaused'
                                                              )
                                                            : t(
                                                                  'admin-billing.subscriptionPause.addonContinues'
                                                              )}
                                                    </p>
                                                ))}
                                            </div>
                                        ) : null}
                                    </>
                                ) : (
                                    <p data-testid="billing-pause-refusal">
                                        {t('admin-billing.subscriptionPause.refusal', {
                                            reason: data.reason ?? 'UNKNOWN',
                                            date: data.courtesyEndsAt
                                                ? date(data.courtesyEndsAt)
                                                : ''
                                        })}
                                    </p>
                                )}
                                {failure ? (
                                    <p role="alert">
                                        {t('admin-billing.subscriptionPause.error', {
                                            reason: failure
                                        })}
                                    </p>
                                ) : null}
                                {resuming || data.offered ? (
                                    <Button
                                        type="button"
                                        disabled={action.isPending}
                                        onClick={
                                            confirming
                                                ? () => void submit()
                                                : () => setConfirming(true)
                                        }
                                    >
                                        {confirming
                                            ? t('admin-billing.subscriptionPause.confirm')
                                            : t('admin-billing.subscriptionPause.review')}
                                    </Button>
                                ) : null}
                            </>
                        ) : null
                    ) : (
                        <p>{t('admin-billing.subscriptionPause.invalidId')}</p>
                    )}
                </CardContent>
            </Card>
        </PermissionGate>
    );
}
