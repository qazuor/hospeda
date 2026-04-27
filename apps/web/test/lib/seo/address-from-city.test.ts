import { describe, expect, it } from 'vitest';
import { parseCityPathToAddress } from '../../../src/lib/seo/address-from-city';

describe('parseCityPathToAddress (SPEC-095)', () => {
    it('parses an Argentine 4-segment path into locality + region + country', () => {
        const result = parseCityPathToAddress({
            cityName: 'Concepción del Uruguay',
            cityPath: '/argentina/litoral/entre-rios/concepcion-del-uruguay'
        });
        expect(result.addressLocality).toBe('Concepción del Uruguay');
        expect(result.addressRegion).toBe('entre-rios');
        expect(result.addressCountry).toBe('AR');
    });

    it('returns empty addressRegion when the path lacks a province segment', () => {
        const result = parseCityPathToAddress({
            cityName: 'Buenos Aires',
            cityPath: '/argentina/buenos-aires'
        });
        expect(result.addressRegion).toBe('');
        expect(result.addressLocality).toBe('Buenos Aires');
    });

    it('handles an empty path defensively', () => {
        const result = parseCityPathToAddress({ cityName: '', cityPath: '' });
        expect(result.addressLocality).toBe('');
        expect(result.addressRegion).toBe('');
        expect(result.addressCountry).toBe('AR');
    });

    it('hardcodes addressCountry to AR for MVP', () => {
        const result = parseCityPathToAddress({
            cityName: 'Colón',
            cityPath: '/argentina/litoral/entre-rios/colon'
        });
        expect(result.addressCountry).toBe('AR');
    });
});
