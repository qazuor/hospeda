/**
 * Spanish labels of the reconciliation mails (HOS-2565 §7.2, D8).
 */
import { describe, expect, it, vi } from 'vitest';
import {
    REFUND_REASON_LABELS,
    REFUND_SOURCE_KIND_LABELS,
    refundReasonLabel,
    refundSourceKindLabel,
    resolveReasonLabel,
    SUBJECT_TYPE_LABELS,
    subjectTypeLabel
} from '../../src/templates/billing/reconciliation-labels';

describe('subjectTypeLabel', () => {
    it('names a subscription and an add-on in Spanish', () => {
        expect(subjectTypeLabel('subscription')).toBe('Suscripción');
        expect(subjectTypeLabel('addon_instance')).toBe('Complemento');
        expect(Object.keys(SUBJECT_TYPE_LABELS)).toEqual(['subscription', 'addon_instance']);
    });

    it('renders an unknown type as received', () => {
        expect(subjectTypeLabel('invoice')).toBe('invoice');
    });
});

describe('refund labels (email-only maps)', () => {
    it.each([
        ['REVOCATION', 'Revocación'],
        ['ADDON_ORPHAN', 'Complemento sin suscripción'],
        ['ONE_TIME_ADDON_REVOCATION', 'Revocación de complemento único']
    ])('labels the refund reason %s as "%s"', (reason, label) => {
        expect(refundReasonLabel(reason)).toBe(label);
    });

    it.each([
        ['payment', 'Pago con Mercado Pago'],
        ['manual_payment', 'Pago manual']
    ])('labels the source kind %s as "%s"', (kind, label) => {
        expect(refundSourceKindLabel(kind)).toBe(label);
    });

    it('renders unknown values as received and covers every closed value', () => {
        expect(refundReasonLabel('MARK_PROPOSAL')).toBe('MARK_PROPOSAL');
        expect(refundSourceKindLabel('cash')).toBe('cash');
        expect(Object.keys(REFUND_REASON_LABELS)).toHaveLength(3);
        expect(Object.keys(REFUND_SOURCE_KIND_LABELS)).toHaveLength(2);
    });
});

describe('resolveReasonLabel', () => {
    it('prefers the injected resolver (the admin wording, D8)', () => {
        const resolve = vi.fn(() => 'Cobro duplicado (panel)');

        expect(resolveReasonLabel({ reason: 'COBRO_DUPLICADO', resolve })).toBe(
            'Cobro duplicado (panel)'
        );
        expect(resolve).toHaveBeenCalledWith({ reason: 'COBRO_DUPLICADO' });
    });

    it('falls back to the package copy when the resolver does not know the code', () => {
        expect(resolveReasonLabel({ reason: 'COBRO_DUPLICADO', resolve: () => null })).toBe(
            'Cobro duplicado'
        );
        expect(resolveReasonLabel({ reason: 'COBRO_DUPLICADO' })).toBe('Cobro duplicado');
    });

    it('shows the raw code only as a last resort, for a code nobody knows', () => {
        expect(resolveReasonLabel({ reason: 'ALGO_NUEVO', resolve: () => null })).toBe(
            'ALGO_NUEVO'
        );
    });
});
