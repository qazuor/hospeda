import { describe, expect, it } from 'vitest';
import { buildAccommodationListingSummary } from '../../accommodation-listing-summary';

const build = (
    locale: 'es' | 'en' | 'pt',
    filters: Parameters<typeof buildAccommodationListingSummary>[0]['filters']
) => buildAccommodationListingSummary({ locale, filters, counts: { shown: 1, globalTotal: 5 } });

describe('quickAmenities / location / availability descriptors', () => {
    it('es', () => {
        expect(build('es', { quickAmenities: { wifi: true, pool: true } })).toContain(
            'con wifi y pileta'
        );
        expect(build('es', { location: { radiusKm: 5 } })).toContain(
            'a menos de 5 km del punto elegido'
        );
        expect(
            build('es', { availability: { checkIn: '2026-12-01', checkOut: '2026-12-05' } })
        ).toContain('disponibles del 2026-12-01 al 2026-12-05');
    });
    it('en', () => {
        expect(build('en', { quickAmenities: { parking: true } })).toContain('with parking');
        expect(build('en', { location: { radiusKm: 5 } })).toContain(
            'within 5 km of the chosen point'
        );
        expect(
            build('en', { availability: { checkIn: '2026-12-01', checkOut: '2026-12-05' } })
        ).toContain('available from 2026-12-01 to 2026-12-05');
    });
    it('pt', () => {
        expect(build('pt', { quickAmenities: { pets: true } })).toContain('com aceita pets');
        expect(build('pt', { location: { radiusKm: 5 } })).toContain(
            'a menos de 5 km do ponto escolhido'
        );
        expect(
            build('pt', { availability: { checkIn: '2026-12-01', checkOut: '2026-12-05' } })
        ).toContain('disponíveis de 2026-12-01 a 2026-12-05');
    });
    it('stays inactive when nothing is set', () => {
        expect(build('es', { quickAmenities: {}, location: null, availability: null })).toContain(
            'sin filtros activos'
        );
    });
});
