import { describe, expect, it } from 'vitest';
import type { UnregisteredChargeFacts } from '../../../../src/services/billing/reconciliation/sweep/comparisons/unregistered-charge-reason.js';
import { reasonForUnregisteredCharge } from '../../../../src/services/billing/reconciliation/sweep/comparisons/unregistered-charge-reason.js';
import type { LatePaymentFailedCondition } from '../../../../src/services/billing/subscription/late-payment-conditions.js';

const before = new Date('2026-10-01T00:00:00.000Z');
const after = new Date('2026-10-03T00:00:00.000Z');
const base: UnregisteredChargeFacts = {
    class: 'PRINCIPAL',
    status: 'ACTIVE',
    isLiveSuccessionPredecessor: false,
    cancellationDecision: null,
    openPauseStartsAt: null,
    chargeCreatedAt: before,
    latePaymentVerdict: null
};

describe('TEST:B11:9 (support) the tie-break table of B/05 §3', () => {
    it.each([
        ['ACTIVE', 'ACTIVE', 'COBRO_SIN_REGISTRAR'],
        ['pending', 'PENDING_AUTHORIZATION', 'COBRO_SIN_REGISTRAR'],
        ['predecessor active', 'ACTIVE', 'COBRO_SIN_REGISTRAR'],
        ['predecessor grace', 'GRACE_PERIOD', 'COBRO_SIN_REGISTRAR'],
        ['cancelled S13', 'CANCELLED', 'COBRO_POSTERIOR_AL_GRANT'],
        ['cancelled S12', 'CANCELLED', 'COBRO_POSTERIOR_A_LA_BAJA'],
        ['cancelled no decision', 'CANCELLED', 'COBRO_POSTERIOR_A_LA_BAJA'],
        ['abandoned', 'ABANDONED', 'COBRO_POSTERIOR_A_LA_BAJA'],
        ['charge declined', 'CHARGE_DECLINED', 'COBRO_POSTERIOR_A_LA_BAJA'],
        ['cancel scheduled before S11', 'CANCEL_SCHEDULED', 'COBRO_SIN_REGISTRAR'],
        ['cancel scheduled after S11', 'CANCEL_SCHEDULED', 'COBRO_POSTERIOR_A_LA_BAJA'],
        ['cancel scheduled without decision', 'CANCEL_SCHEDULED', 'COBRO_POSTERIOR_A_LA_BAJA'],
        ['paused before start', 'PAUSED', 'COBRO_SIN_REGISTRAR'],
        ['paused after start', 'PAUSED', 'PAGO_TARDIO_RECHAZADO'],
        ['paused without pause', 'PAUSED', 'PAGO_TARDIO_RECHAZADO'],
        ['tombstone', 'ACTIVE', 'PAGO_TARDIO_RECHAZADO'],
        ['grace ok', 'GRACE_PERIOD', 'COBRO_SIN_REGISTRAR'],
        ['grace retained', 'GRACE_PERIOD', 'COBRO_SIN_REGISTRAR'],
        ['grace failed 1', 'GRACE_PERIOD', 'PAGO_TARDIO_RECHAZADO'],
        ['grace failed 2', 'GRACE_PERIOD', 'PAGO_TARDIO_RECHAZADO'],
        ['grace failed 3', 'GRACE_PERIOD', 'PAGO_TARDIO_RECHAZADO'],
        ['grace failed 4', 'GRACE_PERIOD', 'PAGO_TARDIO_RECHAZADO'],
        ['suspended ok', 'SUSPENDED', 'COBRO_SIN_REGISTRAR'],
        ['suspended failed', 'SUSPENDED', 'PAGO_TARDIO_RECHAZADO']
    ] as const)('%s resolves to %s', (label, status, expected) => {
        const failedCondition: LatePaymentFailedCondition = label.endsWith('1')
            ? 1
            : label.endsWith('2')
              ? 2
              : label.endsWith('3')
                ? 3
                : 4;
        const facts: UnregisteredChargeFacts = {
            ...base,
            status,
            ...(label === 'predecessor active' || label === 'predecessor grace'
                ? { isLiveSuccessionPredecessor: true }
                : {}),
            ...(label === 'cancelled S13'
                ? { cancellationDecision: { transition: 'S13', decidedAt: before } }
                : label === 'cancelled S12'
                  ? { cancellationDecision: { transition: 'S12', decidedAt: before } }
                  : {}),
            ...(label === 'cancel scheduled before S11'
                ? { cancellationDecision: { transition: 'S11', decidedAt: after } }
                : label === 'cancel scheduled after S11'
                  ? { cancellationDecision: { transition: 'S11', decidedAt: before } }
                  : {}),
            ...(label === 'paused before start'
                ? { openPauseStartsAt: after }
                : label === 'paused after start'
                  ? { openPauseStartsAt: before }
                  : {}),
            ...(label === 'tombstone' ? { class: 'LAPIDA' } : {}),
            ...(label === 'grace ok' || label === 'suspended ok'
                ? { latePaymentVerdict: { ok: true } }
                : label === 'grace retained'
                  ? { latePaymentVerdict: { retainedForS19: true } }
                  : label.startsWith('grace failed') || label === 'suspended failed'
                    ? {
                          latePaymentVerdict: {
                              ok: false,
                              failedCondition
                          }
                      }
                    : {})
        };
        expect(reasonForUnregisteredCharge({ facts })).toBe(expected);
    });

    it('treats S20 as grant cancellation too', () => {
        expect(
            reasonForUnregisteredCharge({
                facts: {
                    ...base,
                    status: 'CANCELLED',
                    cancellationDecision: { transition: 'S20', decidedAt: before }
                }
            })
        ).toBe('COBRO_POSTERIOR_AL_GRANT');
    });
});
