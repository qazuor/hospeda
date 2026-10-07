/**
 * What Mercado Pago offers of each of the eight capabilities, measured
 * (`B/06` §2; B1.md "Qué de las ocho capacidades tiene Mercado Pago").
 *
 * Five are whole. Three are partial, and each gap carries what our side does
 * instead: those three govern the design (the pause clock is ours, the
 * inventory to reconcile is ours, and every mutation is confirmed by re-reading).
 * Nothing here claims a parity the provider does not have.
 *
 * Provider vocabulary is allowed in this folder: the adapter is the one place
 * that knows it is talking to Mercado Pago.
 */
import type { CapabilitySupportMap } from '../../provider/capabilities';

/** The measured support of Mercado Pago, capability by capability. */
export const MERCADOPAGO_CAPABILITY_SUPPORT: CapabilitySupportMap = Object.freeze({
    authorize: {
        level: 'full',
        note: 'The customer authorizes in the provider checkout; the preapproval is created first (B/06 §5.6).'
    },
    charge: {
        level: 'full',
        note: 'The provider executes each cycle charge on its own, with a variable and unpredictable delay.'
    },
    changeAmount: {
        level: 'full',
        note: 'Mutates without new customer consent (PC-1, PC-3); a 2xx is not proof it applied (INV:D5).'
    },
    pauseAndResume: {
        level: 'partial',
        gaps: [
            {
                gap: 'Pause and resume work (PS-1, PS-3, PS-5) but there is no automatic resume (PS-4).',
                handling: 'emulate',
                how: 'The end-of-pause clock is ours (B/03 §5, B8b).'
            }
        ]
    },
    cancel: {
        level: 'full',
        note: 'Irreversible (PA-5).'
    },
    refund: {
        level: 'full',
        note: 'Total and partial, cumulative against the balance, idempotent (RF-1, RF-2, RF-6).'
    },
    read: {
        level: 'partial',
        gaps: [
            {
                gap: 'Search is not reliable: it ignores our reference (RC-1). Read by id is.',
                handling: 'block',
                how: 'The domain only reads by id; the inventory to reconcile is ours (B/09).'
            }
        ]
    },
    notify: {
        level: 'partial',
        gaps: [
            {
                gap: 'No notice for an amount change (EX-15), for its own cancellation after a rejected first charge, for a reason change, nor for /v1/orders and their refunds (WH-5, EX-15).',
                handling: 'emulate',
                how: 'Every mutation is confirmed by re-reading by id (INV:D5), and the sweep re-reads the inventory (B/09 §3).'
            },
            {
                gap: 'The chargeback notice (topic_chargebacks_wh) is documented, not measured (RC-8, UNKNOWN).',
                handling: 'emulate',
                how: 'It enters like any notice and the payment is re-read by id; if it never arrives, the sweep sees it (B/03 §10.2, B/09 §3, DEC-SUB-020).'
            }
        ]
    }
});
