/**
 * @file listing-house-rules.test.ts
 * @description Public house-rule rows built from `policies` (HOS-2060).
 */

import { describe, expect, it } from 'vitest';
import { buildHouseRuleRows } from '../../../src/lib/listing/listing-house-rules';

/** Translator that returns the fallback with `{{x}}` interpolated. */
const t = (_key: string, fallback?: string, params?: Record<string, unknown>): string =>
    (fallback ?? _key).replace(/\{\{(\w+)\}\}/g, (_m, name: string) =>
        String(params?.[name] ?? '')
    );

describe('buildHouseRuleRows', () => {
    it('renders nothing for undeclared policies', () => {
        // Arrange / Act / Assert
        expect(buildHouseRuleRows({ policies: {}, t, locale: 'es' })).toEqual([]);
    });

    it('renders every declared rule in order', () => {
        // Arrange
        const policies = {
            checkIn: { from: '14:00', to: '20:00' },
            checkOut: { to: '10:00' },
            paymentMethods: ['cash', 'transfer'] as const,
            pets: {
                admission: 'yes' as const,
                extraCost: true,
                notes: { es: 'Solo perros chicos', en: '', pt: '' }
            },
            smokingAllowed: 'outdoor_only' as const,
            eventsAllowed: false
        };

        // Act
        const rows = buildHouseRuleRows({ policies, t, locale: 'es' });

        // Assert
        expect(rows.map((row) => [row.id, row.value])).toEqual([
            ['checkIn', '14:00 a 20:00'],
            ['checkOut', 'Hasta las 10:00'],
            ['paymentMethods', 'Efectivo, Transferencia bancaria'],
            ['pets', 'Se admiten mascotas · con cargo extra'],
            ['smokingAllowed', 'Solo en espacios al aire libre'],
            ['eventsAllowed', 'No se permiten eventos']
        ]);
        expect(rows[3]?.note).toBe('Solo perros chicos');
    });

    it('never shows a surcharge when pets are not admitted', () => {
        // Arrange / Act
        const rows = buildHouseRuleRows({
            policies: { pets: { admission: 'no', extraCost: true } },
            t,
            locale: 'es'
        });

        // Assert
        expect(rows).toEqual([{ id: 'pets', label: 'Mascotas', value: 'No se admiten mascotas' }]);
    });
});
