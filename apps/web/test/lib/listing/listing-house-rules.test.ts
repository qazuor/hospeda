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

describe('buildHouseRuleRows — deposit, languages and event details (HOS-2120, HOS-2122)', () => {
    it('renders a deposit with its percentage and note', () => {
        // Act
        const rows = buildHouseRuleRows({
            policies: {
                deposit: {
                    required: true,
                    percentage: 30,
                    notes: { es: 'Por transferencia', en: 'By transfer', pt: '' }
                }
            },
            t,
            locale: 'en'
        });

        // Assert
        expect(rows).toEqual([
            {
                id: 'deposit',
                label: 'Seña para reservar',
                value: 'Se pide seña del 30%',
                note: 'By transfer'
            }
        ]);
    });

    it.each([
        ['without a percentage', { required: true }, 'Se pide seña'],
        ['when none is asked', { required: false }, 'No se pide seña']
    ])('renders a deposit %s', (_label, deposit, value) => {
        const rows = buildHouseRuleRows({ policies: { deposit }, t, locale: 'es' });
        expect(rows.map((row) => [row.id, row.value])).toEqual([['deposit', value]]);
    });

    it('renders the spoken languages, and nothing for an empty list', () => {
        expect(
            buildHouseRuleRows({
                policies: { spokenLanguages: ['es', 'it', 'other'] },
                t,
                locale: 'es'
            })
        ).toEqual([
            {
                id: 'spokenLanguages',
                label: 'Idiomas en que te atendemos',
                value: 'Español, Italiano, Otros idiomas'
            }
        ]);
        expect(buildHouseRuleRows({ policies: { spokenLanguages: [] }, t, locale: 'es' })).toEqual(
            []
        );
    });

    it('appends only the informed event details when events are allowed', () => {
        // Act
        const rows = buildHouseRuleRows({
            policies: {
                eventsAllowed: true,
                eventsDetails: {
                    maxGuests: 40,
                    endTime: '00:00',
                    amplifiedSound: false,
                    extraCost: true,
                    notes: { es: 'Avisar con una semana', en: '', pt: '' }
                }
            },
            t,
            locale: 'es'
        });

        // Assert
        expect(rows).toEqual([
            {
                id: 'eventsAllowed',
                label: 'Eventos',
                value: 'Se permiten eventos privados · máximo de invitados: 40 · hasta las 00:00 · sin música amplificada · con cargo extra',
                note: 'Avisar con una semana'
            }
        ]);
    });

    it('renders the bare yes when no detail is informed', () => {
        const rows = buildHouseRuleRows({
            policies: { eventsAllowed: true, eventsDetails: {} },
            t,
            locale: 'es'
        });
        expect(rows.map((row) => row.value)).toEqual(['Se permiten eventos privados']);
    });

    it('ignores orphan details when events are not allowed', () => {
        const rows = buildHouseRuleRows({
            policies: { eventsAllowed: false, eventsDetails: { maxGuests: 40, extraCost: true } },
            t,
            locale: 'es'
        });
        expect(rows).toEqual([
            { id: 'eventsAllowed', label: 'Eventos', value: 'No se permiten eventos' }
        ]);
    });
});
