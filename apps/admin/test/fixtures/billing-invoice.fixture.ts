/**
 * Billing Invoice Fixtures
 *
 * Mock data for billing invoice entities used in admin integration tests.
 * Shapes derived from Invoice in apps/admin/src/routes/_authed/billing/components/InvoiceDetailDialog.tsx
 */
import { mockPaginatedResponse } from '../mocks/handlers';

/** Single valid invoice */
export const mockBillingInvoice = {
    id: 'inv-uuid-001',
    invoiceNumber: 'INV-2024-0001',
    userName: 'Juan Perez',
    userEmail: 'juan@example.com',
    amount: 500000,
    status: 'open',
    issueDate: '2024-02-01T00:00:00.000Z',
    dueDate: '2024-02-15T00:00:00.000Z',
    lineItems: [
        {
            description: 'Basic Owner Plan - Monthly',
            quantity: 1,
            unitPrice: 500000,
            total: 500000
        }
    ],
    subtotal: 500000,
    tax: 0,
    total: 500000
} as const;

/** List of 3 invoices */
export const mockBillingInvoiceList = [
    mockBillingInvoice,
    {
        ...mockBillingInvoice,
        id: 'inv-uuid-002',
        invoiceNumber: 'INV-2024-0002',
        userName: 'Maria Garcia',
        userEmail: 'maria@example.com',
        amount: 1500000,
        status: 'paid',
        issueDate: '2024-01-15T00:00:00.000Z',
        dueDate: '2024-01-30T00:00:00.000Z',
        paidDate: '2024-01-20T14:30:00.000Z',
        lineItems: [
            {
                description: 'Pro Owner Plan - Monthly',
                quantity: 1,
                unitPrice: 1500000,
                total: 1500000
            }
        ],
        subtotal: 1500000,
        tax: 0,
        total: 1500000,
        paymentMethod: 'MercadoPago'
    },
    {
        ...mockBillingInvoice,
        id: 'inv-uuid-003',
        invoiceNumber: 'INV-2024-0003',
        userName: 'Carlos Lopez',
        userEmail: 'carlos@example.com',
        amount: 5000000,
        status: 'void',
        issueDate: '2024-01-01T00:00:00.000Z',
        dueDate: '2024-01-15T00:00:00.000Z',
        lineItems: [
            {
                description: 'Enterprise Complex Plan - Monthly',
                quantity: 1,
                unitPrice: 5000000,
                total: 5000000
            }
        ],
        subtotal: 5000000,
        tax: 0,
        total: 5000000,
        notes: 'Subscription cancelled before payment'
    }
] as const;

/** Paginated response for invoices */
export const mockBillingInvoicePage = mockPaginatedResponse([...mockBillingInvoiceList]);
