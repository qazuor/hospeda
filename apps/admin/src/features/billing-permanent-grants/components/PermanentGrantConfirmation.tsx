import type { PermanentGrantPreviewResponse } from '@repo/schemas';
import { Button } from '@/components/ui/button';
import { formatRevocationDay } from '@/features/billing-revocation/revocation-format';
import { useTranslations } from '@/hooks/use-translations';

interface Props {
    preview: PermanentGrantPreviewResponse;
    action: 'grant' | 'anchor';
    pending: boolean;
    onConfirm: () => void;
    onBack: () => void;
}

export function PermanentGrantConfirmation({ preview, action, pending, onConfirm, onBack }: Props) {
    const { t, locale } = useTranslations();
    const vertical = (value: string) =>
        t(
            `admin-billing.permanentGrants.verticals.${value}` as 'admin-billing.permanentGrants.verticals.accommodation'
        );
    return (
        <div
            className="space-y-5"
            data-testid="permanent-grant-confirmation"
        >
            <section data-testid="permanent-grant-stopped-charges">
                <h3 className="font-semibold">
                    {t('admin-billing.permanentGrants.stoppedCharges')}
                </h3>
                {preview.stoppedCharges.length === 0 ? (
                    <p>{t('admin-billing.permanentGrants.noneStopped')}</p>
                ) : (
                    preview.stoppedCharges.map((row) => (
                        <p key={row.subscriptionId}>
                            {t('admin-billing.permanentGrants.stoppedCharge', {
                                id: row.subscriptionId,
                                vertical: vertical(row.vertical)
                            })}
                            {row.providerEmail
                                ? ` ${t('admin-billing.permanentGrants.providerEmail')}`
                                : null}
                        </p>
                    ))
                )}
            </section>
            <section data-testid="permanent-grant-ending-courtesies">
                <h3 className="font-semibold">
                    {t('admin-billing.permanentGrants.endingCourtesies')}
                </h3>
                {preview.endingCourtesies.length === 0 ? (
                    <p>{t('admin-billing.permanentGrants.noneCourtesy')}</p>
                ) : (
                    preview.endingCourtesies.map((row) => (
                        <p key={row.subscriptionId}>
                            {t(
                                action === 'anchor'
                                    ? 'admin-billing.permanentGrants.endingCourtesyAnchor'
                                    : 'admin-billing.permanentGrants.endingCourtesy',
                                {
                                    vertical: vertical(row.vertical),
                                    date: formatRevocationDay({ iso: row.endsAt, locale })
                                }
                            )}
                            {row.providerEmail
                                ? ` ${t('admin-billing.permanentGrants.providerEmail')}`
                                : null}
                        </p>
                    ))
                )}
            </section>
            <section data-testid="permanent-grant-closed-balances">
                <h3 className="font-semibold">
                    {t('admin-billing.permanentGrants.closedBalances')}
                </h3>
                {preview.closedDeferredBalances.length === 0 ? (
                    <p>{t('admin-billing.permanentGrants.noneBalances')}</p>
                ) : (
                    preview.closedDeferredBalances.map((row) => (
                        <p key={row.courtesyGrantId}>
                            {t(
                                row.balanceMonths === 1
                                    ? 'admin-billing.permanentGrants.closedBalance_one'
                                    : 'admin-billing.permanentGrants.closedBalance_other',
                                {
                                    count: row.balanceMonths,
                                    vertical: vertical(row.vertical)
                                }
                            )}
                        </p>
                    ))
                )}
            </section>
            <section data-testid="permanent-grant-converted-addons">
                <h3 className="font-semibold">
                    {t('admin-billing.permanentGrants.convertedAddons')}
                </h3>
                {preview.convertedAddons.length === 0 ? (
                    <p>{t('admin-billing.permanentGrants.noneAddons')}</p>
                ) : (
                    preview.convertedAddons.map((row) => (
                        <p key={row.addonInstanceId}>
                            {t('admin-billing.permanentGrants.convertedAddon', {
                                name: row.addonName
                            })}
                            {row.providerEmail
                                ? ` ${t('admin-billing.permanentGrants.providerEmailPerPreapproval')}`
                                : null}
                        </p>
                    ))
                )}
            </section>
            <div className="flex gap-2">
                <Button
                    type="button"
                    onClick={onConfirm}
                    disabled={pending}
                    data-testid="permanent-grant-confirm-submit"
                >
                    {t(
                        action === 'grant'
                            ? 'admin-billing.permanentGrants.confirmGrant'
                            : 'admin-billing.permanentGrants.confirmAnchor'
                    )}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onBack}
                >
                    {t('admin-billing.permanentGrants.cancel')}
                </Button>
            </div>
        </div>
    );
}
