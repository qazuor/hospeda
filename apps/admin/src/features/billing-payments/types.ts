/**
 * Payment status types
 */
export type PaymentStatus = 'completed' | 'pending' | 'failed' | 'refunded';

/**
 * Payment method types
 */
export type PaymentMethod = 'credit_card' | 'debit_card' | 'mercado_pago' | 'bank_transfer';

/**
 * Payment data structure
 */
export interface Payment {
    readonly id: string;
    readonly userName: string;
    readonly userEmail: string;
    readonly amount: number;
    readonly status: PaymentStatus;
    readonly date: string;
    readonly method: PaymentMethod;
    readonly planName: string;
    readonly subscriptionId: string;
    readonly invoiceId: string;
    readonly transactionId: string;
}
