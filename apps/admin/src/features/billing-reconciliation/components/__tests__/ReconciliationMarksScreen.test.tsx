// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { PermissionEnum } from '@repo/schemas';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReconciliationMarksScreen } from '../ReconciliationMarksScreen';

const query = vi.hoisted(() => ({
    current: { isLoading: false, isError: false, data: undefined as any, refetch: vi.fn() }
}));
vi.mock('../../hooks/useReconciliationMarks', () => ({
    useReconciliationMarks: () => query.current
}));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) =>
            key
                .split('.')
                .slice(1)
                .reduce((obj: any, part) => obj?.[part], es),
        locale: 'es'
    })
}));
vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT]
}));
vi.mock('@/hooks/use-auth-context', () => ({ useAuthContext: () => ({ isLoading: false }) }));

const subject = {
    kind: 'SUBSCRIPTION',
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    status: 'GRACE_PERIOD'
};
const payment = (id: string) => ({
    source: 'PAYMENT',
    paymentId: id,
    amountMinor: 12500,
    currency: 'ARS',
    status: 'SUCCEEDED',
    hungAt: '2026-01-01T00:00:00.000Z',
    resolvedAt: null
});
const marks = [
    {
        markId: '11111111-1111-4111-8111-111111111111',
        reason: 'PAGO_TARDIO_RECHAZADO',
        reasonNumber: 7,
        refundConfirmation: true,
        defaultProposal: 'REFUND',
        openedAt: '2026-01-01T00:00:00.000Z',
        subject,
        payments: [
            payment('22222222-2222-4222-8222-222222222222'),
            payment('33333333-3333-4333-8333-333333333333')
        ],
        paymentCount: 2,
        totalAmount: [{ currency: 'ARS', amountMinor: 25000 }],
        unknownAmountCount: 0,
        eventLink: { markId: '11111111-1111-4111-8111-111111111111' }
    },
    {
        markId: '44444444-4444-4444-8444-444444444444',
        reason: 'DIVERGENCIA_DE_MONTO',
        reasonNumber: 5,
        refundConfirmation: false,
        defaultProposal: 'NO_REFUND',
        openedAt: '2026-01-02T00:00:00.000Z',
        subject,
        payments: [],
        paymentCount: 0,
        totalAmount: [],
        unknownAmountCount: 0,
        eventLink: null
    },
    {
        markId: '55555555-5555-4555-8555-555555555555',
        reason: 'REEMBOLSO_POR_CONFIRMAR',
        reasonNumber: 2,
        refundConfirmation: true,
        defaultProposal: 'REFUND_DIFFERENCE',
        openedAt: '2026-01-03T00:00:00.000Z',
        subject,
        payments: [payment('66666666-6666-4666-8666-666666666666')],
        paymentCount: 1,
        totalAmount: [{ currency: 'ARS', amountMinor: 12500 }],
        unknownAmountCount: 0,
        eventLink: null
    },
    {
        markId: '77777777-7777-4777-8777-777777777777',
        reason: 'TRANSICION_NO_DECLARADA',
        reasonNumber: 9,
        refundConfirmation: false,
        defaultProposal: 'NONE',
        openedAt: '2026-01-04T00:00:00.000Z',
        subject: { ...subject, status: null },
        payments: [],
        paymentCount: 0,
        totalAmount: [],
        unknownAmountCount: 0,
        eventLink: null
    }
];

describe('TEST:1620:9 actionable reconciliation marks screen', () => {
    it('renders each mark in API order with its own payments, proposal, total and event link', () => {
        query.current = {
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
            data: { items: marks, pagination: { page: 1, pageSize: 50, total: 4, totalPages: 1 } }
        };
        render(<ReconciliationMarksScreen />);
        const articles = screen.getAllByTestId('reconciliation-mark');
        expect(articles).toHaveLength(4);
        expect(articles.map((article) => article.getAttribute('data-mark-id'))).toEqual(
            marks.map((mark) => mark.markId)
        );
        const reasonSeven = within(articles[0]!);
        expect(reasonSeven.getByTestId('reconciliation-mark-event-link')).toHaveAttribute(
            'href',
            `/billing/reconciliation/${marks[0]!.markId}/events`
        );
        expect(reasonSeven.getAllByTestId('reconciliation-mark-payment')).toHaveLength(2);
        expect(reasonSeven.getByTestId('reconciliation-mark-payment-count')).toHaveTextContent('2');
        expect(reasonSeven.getByTestId('reconciliation-mark-total')).toHaveTextContent('250,00');
        expect(reasonSeven.getByTestId('reconciliation-mark-proposal')).toHaveTextContent(
            'Devolver'
        );
        expect(reasonSeven.getByText('Hay plata del cliente que devolver')).toBeInTheDocument();
        const reasonFive = within(articles[1]!);
        expect(reasonFive.queryByTestId('reconciliation-mark-event-link')).not.toBeInTheDocument();
        expect(
            within(articles[3]!).getByTestId('reconciliation-mark-subject-status')
        ).toHaveTextContent('Estado de la fila: Sujeto no resuelto');
    });

    it('shows the empty state', () => {
        query.current = {
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
            data: { items: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 } }
        };
        render(<ReconciliationMarksScreen />);
        expect(screen.getByText('No hay marcas abiertas.')).toBeInTheDocument();
    });

    it('shows an error and lets staff retry', () => {
        query.current = { isLoading: false, isError: true, refetch: vi.fn(), data: undefined };
        render(<ReconciliationMarksScreen />);
        expect(screen.getByRole('alert')).toHaveTextContent(
            'No se pudieron cargar las marcas abiertas.'
        );
        expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    });
});
