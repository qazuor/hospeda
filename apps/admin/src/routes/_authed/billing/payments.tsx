import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useToast } from '@/components/ui/ToastProvider';
import { usePaymentsQuery, useRefundPaymentMutation } from '@/features/billing-payments/hooks';
import { PaymentDetailDialog } from '@/features/billing-payments/PaymentDetailDialog';
import { PaymentFilters } from '@/features/billing-payments/PaymentFilters';
import { PaymentsTable } from '@/features/billing-payments/PaymentsTable';
import { RefundDialog } from '@/features/billing-payments/RefundDialog';
import type { Payment, PaymentStatus } from '@/features/billing-payments/types';
import { useTranslations } from '@/hooks/use-translations';
import { requireBillingAccess } from '@/lib/billing-access';

export const Route = createFileRoute('/_authed/billing/payments')({
    beforeLoad: ({ context }) => requireBillingAccess(context),
    component: BillingPaymentsPage
});

/**
 * Billing payments page.
 * Orchestrates state management, data fetching, and mutations.
 * Delegates all UI rendering to feature components.
 */
function BillingPaymentsPage() {
    const { t } = useTranslations();
    const { addToast } = useToast();

    // Filter state
    const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    // Whole-unit ARS as typed by the operator — converted to centavos below,
    // right before it reaches the API filter (AdminPaymentViewSearchSchema
    // only accepts minAmountInCents/maxAmountInCents).
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Dialog state
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const [detailDialogOpen, setDetailDialogOpen] = useState(false);
    const [refundDialogOpen, setRefundDialogOpen] = useState(false);

    // Data fetching
    const {
        data: paymentsData,
        isLoading,
        isError
    } = usePaymentsQuery({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchQuery,
        startDate,
        endDate,
        minAmountInCents: minAmount ? Math.round(Number.parseFloat(minAmount) * 100) : undefined,
        maxAmountInCents: maxAmount ? Math.round(Number.parseFloat(maxAmount) * 100) : undefined
    });

    const payments = paymentsData?.items ?? [];

    const filteredPayments = payments.filter((payment: Payment) => {
        const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
        const matchesSearch =
            searchQuery === '' ||
            payment.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (payment.user?.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ??
                false) ||
            (payment.user?.email.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

        const paymentDate = new Date(payment.createdAt);
        const matchesStartDate = !startDate || paymentDate >= new Date(startDate);
        const matchesEndDate = !endDate || paymentDate <= new Date(endDate);

        const amountArs = payment.amountInCents / 100;
        const matchesMinAmount = !minAmount || amountArs >= Number.parseFloat(minAmount);
        const matchesMaxAmount = !maxAmount || amountArs <= Number.parseFloat(maxAmount);

        return (
            matchesStatus &&
            matchesSearch &&
            matchesStartDate &&
            matchesEndDate &&
            matchesMinAmount &&
            matchesMaxAmount
        );
    });

    // Mutations
    const refundMutation = useRefundPaymentMutation();

    // Handlers
    const handleViewDetails = (payment: Payment) => {
        setSelectedPayment(payment);
        setDetailDialogOpen(true);
    };

    const handleRefund = (payment: Payment) => {
        setSelectedPayment(payment);
        setRefundDialogOpen(true);
    };

    const handleClearAdvancedFilters = () => {
        setStartDate('');
        setEndDate('');
        setMinAmount('');
        setMaxAmount('');
    };

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="mb-2 font-bold text-2xl">{t('admin-billing.payments.title')}</h1>
                    <p className="text-muted-foreground">
                        {t('admin-billing.payments.description')}
                    </p>
                </div>

                <PaymentFilters
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    statusFilter={statusFilter}
                    onStatusChange={setStatusFilter}
                    startDate={startDate}
                    onStartDateChange={setStartDate}
                    endDate={endDate}
                    onEndDateChange={setEndDate}
                    minAmount={minAmount}
                    onMinAmountChange={setMinAmount}
                    maxAmount={maxAmount}
                    onMaxAmountChange={setMaxAmount}
                    showFilters={showFilters}
                    onToggleFilters={() => setShowFilters(!showFilters)}
                    onClearAdvancedFilters={handleClearAdvancedFilters}
                />

                <PaymentsTable
                    payments={filteredPayments}
                    isLoading={isLoading}
                    isError={isError}
                    onViewDetails={handleViewDetails}
                    onRefund={handleRefund}
                />
            </div>

            {/* Dialogs */}
            <PaymentDetailDialog
                payment={selectedPayment}
                open={detailDialogOpen}
                onOpenChange={setDetailDialogOpen}
            />

            <RefundDialog
                payment={selectedPayment}
                open={refundDialogOpen}
                onOpenChange={setRefundDialogOpen}
                refundMutation={refundMutation}
                addToast={addToast}
            />
        </SidebarPageLayout>
    );
}
