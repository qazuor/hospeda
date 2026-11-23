/**
 * @file LateManualPaymentPreview.tsx
 * The MP4 confirmation text (B13a fila 10-bis, HOS-1640): what period the transfer pays and
 * when the next installment opens, what the reactivation brings back and what it does not —
 * per vertical, never assuming Partner — and the other three S7 effects. Under S19 it says the
 * payment does not reactivate and that the succession close decides the rest.
 */

import type { TranslationKey } from '@repo/i18n';
import type { LateManualPaymentPreviewResponse } from '@repo/schemas';
import { formatDateWithTime } from '@/lib/format-helpers';

type Translate = (key: TranslationKey, params?: Record<string, unknown>) => string;
type Preview = LateManualPaymentPreviewResponse;
type Presence = NonNullable<Preview['presence']>;
type Effects = NonNullable<Preview['s7Effects']>;

/** Renders the confirmation of one late manual payment. */
export function LateManualPaymentPreview({
    preview,
    locale,
    t
}: {
    readonly preview: Preview;
    readonly locale: string;
    readonly t: Translate;
}) {
    const date = (value: string) => formatDateWithTime({ date: value, locale });
    return (
        <div
            data-testid="late-manual-payment-preview"
            className="space-y-4"
        >
            <section className="space-y-1">
                <h3 className="font-medium">
                    {t('admin-billing.subscriptionAdmin.lateManualPayment.periodTitle')}
                </h3>
                <p data-testid="late-manual-payment-period">
                    {t(
                        `admin-billing.subscriptionAdmin.lateManualPayment.periodCases.${preview.periodCase}` as TranslationKey,
                        {
                            periodStart: date(preview.periodStart),
                            reimputedStart: preview.reimputedPeriodStart
                                ? date(preview.reimputedPeriodStart)
                                : '',
                            nextChargeAt: date(preview.nextChargeAt)
                        }
                    )}
                </p>
                {preview.nextChargeOverdue ? (
                    <p
                        role="note"
                        className="font-medium text-destructive"
                    >
                        {t('admin-billing.subscriptionAdmin.lateManualPayment.nextChargeOverdue')}
                    </p>
                ) : null}
            </section>
            {preview.effect === 'S19' ? (
                <section
                    data-testid="late-manual-payment-s19"
                    className="space-y-1"
                >
                    <h3 className="font-medium">
                        {t('admin-billing.subscriptionAdmin.lateManualPayment.s19Title')}
                    </h3>
                    <p>{t('admin-billing.subscriptionAdmin.lateManualPayment.s19Body')}</p>
                </section>
            ) : (
                <>
                    <section className="space-y-1">
                        <h3 className="font-medium">
                            {t('admin-billing.subscriptionAdmin.lateManualPayment.returnsTitle')}
                        </h3>
                        <p>
                            {t('admin-billing.subscriptionAdmin.lateManualPayment.serviceReturns')}
                        </p>
                        {preview.presence ? (
                            <PresenceBlock
                                presence={preview.presence}
                                t={t}
                            />
                        ) : null}
                    </section>
                    {preview.s7Effects ? (
                        <EffectsBlock
                            effects={preview.s7Effects}
                            date={date}
                            t={t}
                        />
                    ) : null}
                </>
            )}
        </div>
    );
}

function PresenceBlock({ presence, t }: { readonly presence: Presence; readonly t: Translate }) {
    if (presence.kind === 'NONE') {
        return (
            <p data-testid="late-manual-payment-presence">
                {t('admin-billing.subscriptionAdmin.lateManualPayment.noPresence')}
            </p>
        );
    }
    if (presence.kind === 'PARTNER') {
        return (
            <p data-testid="late-manual-payment-presence">
                {t(
                    `admin-billing.subscriptionAdmin.lateManualPayment.partnerOutcomes.${presence.outcome}` as TranslationKey,
                    {
                        name: presence.partner?.name ?? ''
                    }
                )}
            </p>
        );
    }
    return (
        <div
            data-testid="late-manual-payment-presence"
            className="space-y-1"
        >
            <p className="text-muted-foreground text-sm">
                {presence.limit === null
                    ? t('admin-billing.subscriptionAdmin.lateManualPayment.noLimit')
                    : t('admin-billing.subscriptionAdmin.lateManualPayment.limit', {
                          limit: presence.limit
                      })}
            </p>
            {presence.listings.length === 0 ? (
                <p>{t('admin-billing.subscriptionAdmin.lateManualPayment.noListings')}</p>
            ) : (
                <ul className="list-disc space-y-1 pl-5">
                    {presence.listings.map((listing) => (
                        <li
                            key={listing.id}
                            data-outcome={listing.outcome}
                        >
                            <span className="font-medium">{listing.name}</span>:{' '}
                            {t(
                                `admin-billing.subscriptionAdmin.lateManualPayment.listingOutcomes.${listing.outcome}` as TranslationKey
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function EffectsBlock({
    effects,
    date,
    t
}: {
    readonly effects: Effects;
    readonly date: (value: string) => string;
    readonly t: Translate;
}) {
    const { resumed, skipped } = effects.complements;
    return (
        <section
            data-testid="late-manual-payment-effects"
            className="space-y-1"
        >
            <h3 className="font-medium">
                {t('admin-billing.subscriptionAdmin.lateManualPayment.effectsTitle')}
            </h3>
            <ul className="list-disc space-y-1 pl-5">
                <li data-effect="complements">
                    {resumed.length > 0
                        ? t(
                              'admin-billing.subscriptionAdmin.lateManualPayment.effects.complementsResumed',
                              {
                                  count: resumed.length
                              }
                          )
                        : t(
                              'admin-billing.subscriptionAdmin.lateManualPayment.effects.noComplements'
                          )}
                </li>
                {skipped.length > 0 ? (
                    <li data-effect="complements-skipped">
                        {t(
                            'admin-billing.subscriptionAdmin.lateManualPayment.effects.complementsSkipped',
                            {
                                count: skipped.length
                            }
                        )}
                    </li>
                ) : null}
                <li data-effect="tourist-vip">
                    {effects.touristVip.cancels
                        ? t(
                              'admin-billing.subscriptionAdmin.lateManualPayment.effects.touristVipCancels'
                          )
                        : t(
                              'admin-billing.subscriptionAdmin.lateManualPayment.effects.noTouristVip'
                          )}
                </li>
                <li data-effect="scheduled-change">
                    {effects.scheduledChange
                        ? t(
                              'admin-billing.subscriptionAdmin.lateManualPayment.effects.scheduledChange',
                              {
                                  date: date(effects.scheduledChange.effectiveAt)
                              }
                          )
                        : t(
                              'admin-billing.subscriptionAdmin.lateManualPayment.effects.noScheduledChange'
                          )}
                </li>
            </ul>
        </section>
    );
}
