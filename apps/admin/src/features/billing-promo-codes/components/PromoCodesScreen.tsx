import type { TranslationKey } from '@repo/i18n';
import type { AdminPromoCode } from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import { useState } from 'react';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { formatDateWithTime } from '@/lib/format-helpers';
import { usePromoCodes } from '../hooks/usePromoCodes';
import {
    describePromoCodeDraft,
    fromMinorUnits,
    PROMO_CODE_AVAILABILITY_KEY
} from '../promo-code-draft';
import { PromoCodeCloseDialog } from './PromoCodeCloseDialog';
import { PromoCodeCreateDialog } from './PromoCodeCreateDialog';

const PAGE_SIZE = 25;

/** Lists promo codes and gates all management controls by action 21 permission. */
export function PromoCodesScreen() {
    return (
        <PermissionGate permissions={[PermissionEnum.BILLING_MANAGE_PROMO_CODES]}>
            <PromoCodesBody />
        </PermissionGate>
    );
}

function PromoCodesBody() {
    const { t, locale } = useTranslations();
    const [page, setPage] = useState(1);
    const [creating, setCreating] = useState(false);
    const [closing, setClosing] = useState<AdminPromoCode | null>(null);
    const query = usePromoCodes({ page, pageSize: PAGE_SIZE });
    const key = (value: string) => t(value as TranslationKey);

    return (
        <Card data-testid="promo-codes-screen">
            <CardContent className="space-y-4 pt-6">
                <div className="flex justify-end">
                    <Button
                        data-testid="promo-code-new"
                        onClick={() => setCreating(true)}
                    >
                        {key('admin-billing.promoCodes.editor.newCode')}
                    </Button>
                </div>
                <PromoCodeCreateDialog
                    open={creating}
                    onOpenChange={setCreating}
                />
                {query.isLoading ? <p>{key('admin-billing.promoCodes.editor.loading')}</p> : null}
                {query.isError ? (
                    <div
                        role="alert"
                        className="space-y-2"
                    >
                        <p>{key('admin-billing.promoCodes.editor.loadError')}</p>
                        <Button
                            variant="outline"
                            onClick={() => void query.refetch()}
                        >
                            {key('admin-billing.promoCodes.editor.retry')}
                        </Button>
                    </div>
                ) : null}
                {query.data && query.data.items.length === 0 ? (
                    <p>{key('admin-billing.promoCodes.editor.empty')}</p>
                ) : null}
                {query.data && query.data.items.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b">
                                    {[
                                        'code',
                                        'effect',
                                        'reach',
                                        'uses',
                                        'validity',
                                        'status',
                                        'actions'
                                    ].map((column) => (
                                        <th
                                            className="p-2"
                                            key={column}
                                            scope="col"
                                        >
                                            {key(
                                                `admin-billing.promoCodes.editor.columns.${column}`
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {query.data.items.map((promoCode) => (
                                    <PromoCodeRow
                                        key={promoCode.id}
                                        promoCode={promoCode}
                                        locale={locale}
                                        t={key}
                                        onClose={() => setClosing(promoCode)}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : null}
                {query.data ? (
                    <nav
                        aria-label={key('admin-billing.promoCodes.editor.pagination')}
                        className="flex items-center justify-between"
                    >
                        <span>{query.data.pagination.total}</span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                disabled={page <= 1}
                                onClick={() => setPage((current) => current - 1)}
                            >
                                {key('admin-billing.promoCodes.editor.previous')}
                            </Button>
                            <Button
                                variant="outline"
                                disabled={page >= query.data.pagination.totalPages}
                                onClick={() => setPage((current) => current + 1)}
                            >
                                {key('admin-billing.promoCodes.editor.next')}
                            </Button>
                        </div>
                    </nav>
                ) : null}
                <PromoCodeCloseDialog
                    promoCode={closing}
                    onOpenChange={(open) => {
                        if (!open) setClosing(null);
                    }}
                />
            </CardContent>
        </Card>
    );
}

function PromoCodeRow({
    promoCode,
    locale,
    t,
    onClose
}: {
    readonly promoCode: AdminPromoCode;
    readonly locale: string;
    readonly t: (key: string) => string;
    readonly onClose: () => void;
}) {
    const draft = {
        code: promoCode.code,
        effect:
            promoCode.effect.kind === 'DISCOUNT' && promoCode.effect.discountKind === 'FIXED'
                ? { ...promoCode.effect, pesos: fromMinorUnits({ minor: promoCode.effect.value }) }
                : promoCode.effect,
        allVerticals: promoCode.allVerticals,
        verticals: promoCode.verticals,
        totalQuota: promoCode.totalQuota,
        validFrom: promoCode.validFrom,
        validUntil: promoCode.validUntil,
        stackable: promoCode.stackable,
        usableWithAnotherActive: promoCode.usableWithAnotherActive
    };
    const summary = describePromoCodeDraft({
        draft,
        locale,
        t: t as (key: TranslationKey) => string
    });
    const availabilityKey = PROMO_CODE_AVAILABILITY_KEY[promoCode.availability];
    return (
        <tr
            data-testid="promo-code-row"
            data-promo-code-id={promoCode.id}
            data-promo-code={promoCode.code}
            className="border-b align-top"
        >
            <td className="p-2 font-medium">{promoCode.code}</td>
            <td className="p-2">{summary.effect}</td>
            <td className="p-2">{summary.reach}</td>
            <td className="p-2">
                {promoCode.redemptionCount} /{' '}
                {promoCode.totalQuota ?? t('admin-billing.promoCodes.editor.unlimited')}
            </td>
            <td className="p-2">
                {formatDateWithTime({ date: promoCode.validFrom, locale })} –{' '}
                {promoCode.validUntil
                    ? formatDateWithTime({ date: promoCode.validUntil, locale })
                    : t('admin-billing.promoCodes.editor.noEndDate')}
            </td>
            <td className="p-2">{t(availabilityKey)}</td>
            <td className="p-2">
                {promoCode.closedAt === null ? (
                    <Button
                        data-testid="promo-code-close"
                        variant="outline"
                        onClick={onClose}
                    >
                        {t('admin-billing.promoCodes.editor.close')}
                    </Button>
                ) : null}
            </td>
        </tr>
    );
}
