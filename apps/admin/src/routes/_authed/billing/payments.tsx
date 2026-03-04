import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useToast } from '@/components/ui/ToastProvider';
import { PaymentDetailDialog } from '@/features/billing-payments/PaymentDetailDialog';
import { PaymentFilters } from '@/features/billing-payments/PaymentFilters';
import { PaymentsTable } from '@/features/billing-payments/PaymentsTable';
import { RefundDialog } from '@/features/billing-payments/RefundDialog';
import { usePaymentsQuery, useRefundPaymentMutation } from '@/features/billing-payments/hooks';
import type { Payment, PaymentMethod, PaymentStatus } from '@/features/billing-payments/types';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/billing/payments')({
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
    const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Dialog state
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const [detailDialogOpen, setDetailDialogOpen] = useState(false);
    const [refundDialogOpen, setRefundDialogOpen] = useState(false);

    // Data fetching
    const {
        data: paymentsData = [],
        isLoading,
        isError
    } = usePaymentsQuery({
        status: statusFilter,
        method: methodFilter,
        q: searchQuery,
        startDate,
        endDate,
        minAmount: minAmount ? Number.parseFloat(minAmount) : undefined,
        maxAmount: maxAmount ? Number.parseFloat(maxAmount) : undefined
    });

    const payments = ((paymentsData as { items?: Payment[] } | undefined)?.items ??
        []) as Payment[];

    const filteredPayments = payments.filter((payment: Payment) => {
        const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
        const matchesMethod = methodFilter === 'all' || payment.method === methodFilter;
        const matchesSearch =
            searchQuery === '' ||
            payment.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            payment.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            payment.userEmail.toLowerCase().includes(searchQuery.toLowerCase());

        const paymentDate = new Date(payment.date);
        const matchesStartDate = !startDate || paymentDate >= new Date(startDate);
        const matchesEndDate = !endDate || paymentDate <= new Date(endDate);

        const matchesMinAmount = !minAmount || payment.amount >= Number.parseFloat(minAmount);
        const matchesMaxAmount = !maxAmount || payment.amount <= Number.parseFloat(maxAmount);

        return (
            matchesStatus &&
            matchesMethod &&
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
                    <h2 className="mb-2 font-bold text-2xl">{t('admin-billing.payments.title')}</h2>
                    <p className="text-muted-foreground">
                        {t('admin-billing.payments.description')}
                    </p>
                </div>

                <PaymentFilters
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    statusFilter={statusFilter}
                    onStatusChange={setStatusFilter}
                    methodFilter={methodFilter}
                    onMethodChange={setMethodFilter}
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
