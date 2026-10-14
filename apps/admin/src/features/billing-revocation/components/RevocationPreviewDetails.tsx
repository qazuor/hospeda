/**
 * @file RevocationPreviewDetails.tsx
 * What a confirmable revocation is going to do (HOS-1678, AC:B5:20): the
 * motive, the current state, the three things the act does (cancel the
 * authorization, end the service now, request the refund of what is left of
 * the charge), the predecessor line when the charge belongs to the previous
 * row (AC:B5:22) and the last day of the window. It says what will happen; it
 * never asks whether the person is sure (audit §3 rule 1).
 */

import type { SubscriptionRevocationPreviewResponse } from '@repo/schemas';
import { useTranslations } from '@/hooks/use-translations';
import {
    formatRevocationAmount,
    formatRevocationDay,
    formatRevocationLastDay
} from '../revocation-format';
import { REVOCATION_ORIGIN_COPY } from '../revocation-reasons';

/** Props of {@link RevocationPreviewDetails}. RO-RO. */
export interface RevocationPreviewDetailsProps {
    /** The CURRENT preview the server answered. */
    readonly preview: SubscriptionRevocationPreviewResponse;
    /** The subscription the screen revokes (from the URL). */
    readonly subscriptionId: string;
}

/**
 * Renders what the revocation does, from the current preview.
 *
 * @param props - The preview and the subscription id.
 */
export function RevocationPreviewDetails({
    preview,
    subscriptionId
}: RevocationPreviewDetailsProps) {
    const { t, locale } = useTranslations();
    const originCopy = REVOCATION_ORIGIN_COPY[preview.origin];
    const amount = formatRevocationAmount({
        cents: preview.payment.amount,
        locale,
        currency: preview.payment.currency
    });
    const chargedAt = formatRevocationDay({ iso: preview.payment.chargedAt, locale });
    const lastDay = formatRevocationLastDay({ windowEndsAt: preview.windowEndsAt, locale });

    return (
        <div className="space-y-3">
            <p className="font-medium">{t('admin-billing.subscriptionRevocation.motive')}</p>
            <p data-testid="subscription-revocation-origin">
                {t('admin-billing.subscriptionRevocation.origin.label', {
                    state: t(originCopy.label)
                })}
            </p>
            <p>{t('admin-billing.subscriptionRevocation.ready.intro')}</p>
            <ul className="list-disc space-y-1 pl-5">
                <li data-testid="subscription-revocation-effect-authorization">
                    {preview.effects.cancelsAuthorization
                        ? t('admin-billing.subscriptionRevocation.effects.authorization')
                        : t('admin-billing.subscriptionRevocation.effects.noAuthorization')}
                </li>
                <li data-testid="subscription-revocation-effect-service">
                    {t('admin-billing.subscriptionRevocation.effects.service')}
                </li>
                <li data-testid="subscription-revocation-effect-refund">
                    <span data-testid="subscription-revocation-payment">
                        {t('admin-billing.subscriptionRevocation.effects.refund', {
                            amount,
                            chargedAt
                        })}
                    </span>
                </li>
                {originCopy.extra ? (
                    <li data-testid="subscription-revocation-origin-extra">
                        {t(originCopy.extra)}
                    </li>
                ) : null}
            </ul>
            {preview.payment.ownerSubscriptionId === subscriptionId ? null : (
                <p data-testid="subscription-revocation-predecessor">
                    {t('admin-billing.subscriptionRevocation.predecessor')}
                </p>
            )}
            <p data-testid="subscription-revocation-window">
                {t('admin-billing.subscriptionRevocation.window', { lastDay })}
            </p>
        </div>
    );
}
