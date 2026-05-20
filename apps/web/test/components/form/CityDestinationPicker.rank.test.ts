/**
 * Unit tests for `rankCityResults` — the client-side relevance ranking that
 * makes the autocomplete dropdown feel less "fuzzy" by surfacing exact and
 * prefix matches before substring matches.
 */

import { describe, expect, it } from 'vitest';
import { rankCityResults } from '../../../src/components/form/CityDestinationPicker.client';

const items = (...names: string[]) => names.map((name, i) => ({ id: String(i), name }));

describe('rankCityResults', () => {
    it('returns a copy of the input array without mutating it', () => {
        const input = items('Berlin', 'Buenos Aires');
        const result = rankCityResults(input, 'b');
        expect(result).not.toBe(input);
        expect(input.map((i) => i.name)).toEqual(['Berlin', 'Buenos Aires']);
    });

    it('puts exact case-insensitive matches first', () => {
        const result = rankCityResults(
            items('Concepción del Uruguay', 'Concepción', 'Concepción de Tucumán'),
            'concepción'
        );
        expect(result.map((r) => r.name)).toEqual([
            'Concepción',
            'Concepción de Tucumán',
            'Concepción del Uruguay'
        ]);
    });

    it('puts prefix matches before substring matches', () => {
        const result = rankCityResults(
            items('San Antonio de Areco', 'Antonio Berni', 'Antonioville'),
            'antonio'
        );
        expect(result.map((r) => r.name)).toEqual([
            'Antonio Berni',
            'Antonioville',
            'San Antonio de Areco'
        ]);
    });

    it('sorts alphabetically inside the same bucket', () => {
        const result = rankCityResults(
            items('San José', 'San Antonio', 'San Bernardo', 'San Carlos'),
            'san'
        );
        expect(result.map((r) => r.name)).toEqual([
            'San Antonio',
            'San Bernardo',
            'San Carlos',
            'San José'
        ]);
    });

    it('is case-insensitive when ranking; tied items keep input order (stable sort)', () => {
        const result = rankCityResults(
            items('BUENOS aires', 'buenos aires', 'Buenos Aires'),
            'BUE'
        );
        // All three lowercase-equal "buenos aires" → input order preserved.
        expect(result.map((r) => r.name)).toEqual(['BUENOS aires', 'buenos aires', 'Buenos Aires']);
    });

    it('returns the input unchanged when the query is empty (after trim)', () => {
        const input = items('Buenos Aires', 'Berlin');
        const result = rankCityResults(input, '   ');
        expect(result.map((r) => r.name)).toEqual(['Buenos Aires', 'Berlin']);
    });

    it('handles whitespace around the needle', () => {
        const result = rankCityResults(items('Buenos Aires', 'Berlin'), '  buenos  ');
        expect(result[0]?.name).toBe('Buenos Aires');
    });

    it('keeps non-matching items in the array (model already filters; ranker just orders)', () => {
        // The ranker does not drop results — that is the API's job. Verify
        // it does not silently filter when there is no prefix match.
        const result = rankCityResults(items('Mar del Plata', 'Bahia Blanca'), 'mar');
        expect(result.map((r) => r.name).sort()).toEqual(['Bahia Blanca', 'Mar del Plata']);
        // Prefix-matched first.
        expect(result[0]?.name).toBe('Mar del Plata');
    });
});
