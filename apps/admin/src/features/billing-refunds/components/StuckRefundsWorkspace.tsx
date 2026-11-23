/**
 * @file StuckRefundsWorkspace.tsx
 * HOS-2560: the stuck-refund list, the two forms that resolve those refunds («Asentar el resto» and
 * «Reintentar con MP») picking from it, and the by-id fallback for refunds the list does not show.
 */

import { PermissionEnum, type StuckRefund } from '@repo/schemas';
import { useEffect, useRef, useState } from 'react';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { useTranslations } from '@/hooks/use-translations';
import { useHasPermission } from '@/hooks/use-user-permissions';
import { useStuckRefunds } from '../hooks/useStuckRefunds';
import { RefundProviderCallRetryForm } from './RefundProviderCallRetryForm';
import { RefundRemainderSettlementForm } from './RefundRemainderSettlementForm';
import { StuckRefundsList } from './StuckRefundsList';

const PAGE_SIZE = 50;

type StuckAction = NonNullable<StuckRefund['suggestedAction']>;

/**
 * Renders the stuck-refund list and the forms it feeds. A row's action selects that refund in the
 * matching form and moves the focus to its selector. The remainder settlement, and its action
 * button, need BILLING_SETTLE_EXTERNAL on top of the screen's BILLING_REFUND.
 */
export function StuckRefundsWorkspace() {
    const { t } = useTranslations();
    const canSettle = useHasPermission(PermissionEnum.BILLING_SETTLE_EXTERNAL);
    const [page, setPage] = useState(1);
    const query = useStuckRefunds({ page, pageSize: PAGE_SIZE });
    const data = query.data;
    const items = data?.items ?? [];
    const [selected, setSelected] = useState<Readonly<Record<StuckAction, string>>>({
        RETRY: '',
        SETTLE_REMAINDER: ''
    });
    const [focusRequest, setFocusRequest] = useState<{
        readonly action: StuckAction;
        readonly at: number;
    } | null>(null);
    const retryRef = useRef<HTMLSelectElement>(null);
    const settleRef = useRef<HTMLSelectElement>(null);

    // Resolving the last row of the last page leaves that page past the end: step back.
    const lastPage = Math.max(data?.pagination.totalPages ?? 1, 1);
    const pastTheEnd = data !== undefined && page > lastPage;
    useEffect(() => {
        if (pastTheEnd) setPage(lastPage);
    }, [pastTheEnd, lastPage]);

    useEffect(() => {
        if (!focusRequest) return;
        const target = focusRequest.action === 'RETRY' ? retryRef.current : settleRef.current;
        target?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        target?.focus();
    }, [focusRequest]);

    // A selection whose refund left the list (resolved, or another page) shows as none.
    const listed = (refundId: string) => items.some((item) => item.refundId === refundId);
    const pickerFor = (action: StuckAction, selectRef: typeof retryRef) => ({
        refunds: items,
        value: listed(selected[action]) ? selected[action] : '',
        onChange: (refundId: string) =>
            setSelected((current) => ({ ...current, [action]: refundId })),
        selectRef
    });

    return (
        <>
            <StuckRefundsList
                data={data}
                isLoading={query.isLoading || pastTheEnd}
                isError={query.isError}
                onRetryLoad={() => void query.refetch()}
                page={page}
                onPageChange={setPage}
                canSettle={canSettle}
                onAction={({ refundId, action }) => {
                    setSelected((current) => ({ ...current, [action]: refundId }));
                    setFocusRequest({ action, at: Date.now() });
                }}
            />
            <PermissionGate permissions={[PermissionEnum.BILLING_SETTLE_EXTERNAL]}>
                <RefundRemainderSettlementForm picker={pickerFor('SETTLE_REMAINDER', settleRef)} />
            </PermissionGate>
            <RefundProviderCallRetryForm picker={pickerFor('RETRY', retryRef)} />
            <details
                data-testid="refund-operate-by-id"
                className="space-y-4 rounded-md border p-4"
            >
                <summary className="cursor-pointer font-semibold">
                    {t('admin-billing.proposedRefunds.operateById.title')}
                </summary>
                <p className="text-muted-foreground text-sm">
                    {t('admin-billing.proposedRefunds.operateById.description')}
                </p>
                <div className="space-y-6">
                    <PermissionGate permissions={[PermissionEnum.BILLING_SETTLE_EXTERNAL]}>
                        <RefundRemainderSettlementForm />
                    </PermissionGate>
                    <RefundProviderCallRetryForm />
                </div>
            </details>
        </>
    );
}
