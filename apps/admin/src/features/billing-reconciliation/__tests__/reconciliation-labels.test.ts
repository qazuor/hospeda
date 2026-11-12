import enAdminBilling from '@repo/i18n/locales/en/admin-billing.json';
import esAdminBilling from '@repo/i18n/locales/es/admin-billing.json';
import ptAdminBilling from '@repo/i18n/locales/pt/admin-billing.json';
import {
    AdminSubscriptionStatusSchema,
    RECONCILIATION_ADDON_INSTANCE_STATUS_VALUES,
    RECONCILIATION_EVENT_ACTOR_TYPE_VALUES,
    RECONCILIATION_MANUAL_PAYMENT_STATUS_VALUES,
    RECONCILIATION_MARK_OUTCOME_VALUES,
    RECONCILIATION_MARK_REASON_VALUES,
    RECONCILIATION_PAYMENT_STATUS_VALUES
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    RECONCILIATION_ACTOR_TYPE_KEYS,
    RECONCILIATION_ADDON_STATUS_KEYS,
    RECONCILIATION_MANUAL_PAYMENT_STATUS_KEYS,
    RECONCILIATION_OUTCOME_KEYS,
    RECONCILIATION_PAYMENT_STATUS_KEYS,
    RECONCILIATION_REASON_KEYS,
    RECONCILIATION_SUBJECT_KIND_KEYS,
    RECONCILIATION_SUBSCRIPTION_STATUS_KEYS,
    reconciliationLabel,
    reconciliationPaymentStatusLabel,
    reconciliationSubjectStatusLabel
} from '../reconciliation-labels';

function resolveKey(key: string, locale: Record<string, unknown>): unknown {
    return key
        .replace(/^admin-billing\./, '')
        .split('.')
        .reduce<unknown>(
            (node, segment) =>
                typeof node === 'object' && node !== null
                    ? (node as Record<string, unknown>)[segment]
                    : undefined,
            locale
        );
}

const t = (key: string) => String(resolveKey(key, esAdminBilling));

describe('HOS-1761 reconciliation labels', () => {
    it('every enum value has a key in its map and a string in es, en and pt', () => {
        // Arrange
        const cases = [
            [RECONCILIATION_MARK_REASON_VALUES, RECONCILIATION_REASON_KEYS],
            [AdminSubscriptionStatusSchema.options, RECONCILIATION_SUBSCRIPTION_STATUS_KEYS],
            [RECONCILIATION_ADDON_INSTANCE_STATUS_VALUES, RECONCILIATION_ADDON_STATUS_KEYS],
            [RECONCILIATION_PAYMENT_STATUS_VALUES, RECONCILIATION_PAYMENT_STATUS_KEYS],
            [
                RECONCILIATION_MANUAL_PAYMENT_STATUS_VALUES,
                RECONCILIATION_MANUAL_PAYMENT_STATUS_KEYS
            ],
            [['SUBSCRIPTION', 'ADDON_INSTANCE'], RECONCILIATION_SUBJECT_KIND_KEYS],
            [RECONCILIATION_EVENT_ACTOR_TYPE_VALUES, RECONCILIATION_ACTOR_TYPE_KEYS],
            [RECONCILIATION_MARK_OUTCOME_VALUES, RECONCILIATION_OUTCOME_KEYS]
        ] as const;
        const locales = [esAdminBilling, enAdminBilling, ptAdminBilling];
        // Act
        for (const [values, map] of cases) {
            // Assert
            expect(Object.keys(map)).toEqual([...values]);
            for (const value of values) {
                for (const locale of locales) {
                    const label = resolveKey(map[value], locale);
                    expect(typeof label).toBe('string');
                    if (locale === esAdminBilling) expect(label).not.toBe(value);
                }
            }
        }
    });

    it('an unknown value falls back to the raw value', () => {
        // Arrange
        const input = { map: RECONCILIATION_REASON_KEYS, value: 'NUEVO_MOTIVO', t };
        // Act
        const label = reconciliationLabel(input);
        // Assert
        expect(label).toBe('NUEVO_MOTIVO');
    });

    it('subject status picks the map of its kind', () => {
        // Arrange
        // Act
        const unresolved = reconciliationSubjectStatusLabel({
            kind: 'SUBSCRIPTION',
            status: null,
            t
        });
        const subscription = reconciliationSubjectStatusLabel({
            kind: 'SUBSCRIPTION',
            status: 'CANCELLED',
            t
        });
        const addon = reconciliationSubjectStatusLabel({
            kind: 'ADDON_INSTANCE',
            status: 'CANCELLED',
            t
        });
        // Assert
        expect([unresolved, subscription, addon]).toEqual([
            'Sujeto no resuelto',
            'Cancelada',
            'Cancelado'
        ]);
    });

    it('payment status picks the map of its source', () => {
        // Arrange
        // Act
        const payment = reconciliationPaymentStatusLabel({
            source: 'PAYMENT',
            status: 'SUCCEEDED',
            t
        });
        const manual = reconciliationPaymentStatusLabel({
            source: 'MANUAL_PAYMENT',
            status: 'REGISTERED',
            t
        });
        // Assert
        expect([payment, manual]).toEqual(['Acreditado', 'Registrado']);
    });
});
