// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { PermissionEnum } from '@repo/schemas';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReconciliationMarkEventsScreen } from '../ReconciliationMarkEventsScreen';

const query = vi.hoisted(() => ({
    current: { isLoading: false, error: null as any, data: undefined as any }
}));
vi.mock('../../hooks/useReconciliationMarkEvents', () => ({
    useReconciliationMarkEvents: () => query.current
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
const markId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const base = {
    eventId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    occurredAt: '2026-01-01T00:00:00.000Z',
    actorType: 'provider',
    actorId: null,
    correlationId: 'correlation',
    outcome: 'OPENED',
    changes: []
};

describe('TEST:1620:10 reconciliation mark events screen', () => {
    it('distinguishes a failed condition, a recorded null and a historical event without the field', () => {
        query.current = {
            isLoading: false,
            error: null,
            data: {
                mark: {
                    markId,
                    reason: 'PAGO_TARDIO_RECHAZADO',
                    reasonNumber: 7,
                    openedAt: base.occurredAt,
                    liftedAt: null,
                    subject: { kind: 'SUBSCRIPTION', id: markId }
                },
                events: [
                    { ...base, failedCondition: 2, conditionRecorded: true },
                    {
                        ...base,
                        eventId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
                        failedCondition: null,
                        conditionRecorded: true
                    },
                    {
                        ...base,
                        eventId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
                        conditionRecorded: false
                    }
                ]
            }
        };
        render(<ReconciliationMarkEventsScreen markId={markId} />);
        const events = screen.getAllByTestId('reconciliation-mark-event');
        expect(events).toHaveLength(3);
        expect(
            within(events[0]!).getByTestId('reconciliation-mark-event-condition')
        ).toHaveTextContent(
            'Condición 2: El monto coincide con el esperado para el período que cubre.'
        );
        expect(
            within(events[1]!).getByTestId('reconciliation-mark-event-condition')
        ).toHaveTextContent('Este camino no evalúa las cuatro condiciones.');
        expect(
            within(events[2]!).getByTestId('reconciliation-mark-event-condition')
        ).toHaveTextContent('Este evento no registra la condición (anterior a este cambio).');
    });

    it('shows the not found response for a 404', () => {
        query.current = { isLoading: false, error: { status: 404 }, data: undefined };
        render(<ReconciliationMarkEventsScreen markId={markId} />);
        expect(screen.getByRole('alert')).toHaveTextContent('La marca no existe.');
    });
});
