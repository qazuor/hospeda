import { describe, expect, it } from 'vitest';
import { buildAccommodationListingSummary } from '../../accommodation-listing-summary';

const build = (
    locale: 'es' | 'en' | 'pt',
    filters: Parameters<typeof buildAccommodationListingSummary>[0]['filters']
) => buildAccommodationListingSummary({ locale, filters, counts: { shown: 1, globalTotal: 5 } });

describe('quickAmenities / location / availability / opt-out descriptors', () => {
    it('es', () => {
        expect(build('es', { quickAmenities: { wifi: true, pool: true } })).toContain(
            'con wifi y pileta'
        );
        expect(build('es', { location: { radiusKm: 5 } })).toContain(
            'a menos de 5 km del punto elegido'
        );
        expect(
            build('es', { availability: { checkIn: '2026-12-01', checkOut: '2026-12-05' } })
        ).toContain('disponibles del 1 de dic de 2026 al 5 de dic de 2026');
        expect(build('es', { price: { includeWithoutPrice: false } })).toContain(
            'solo con precio definido'
        );
        expect(build('es', { includeWithoutRating: false })).toContain('solo con reseñas');
    });
    it('en', () => {
        expect(build('en', { quickAmenities: { parking: true } })).toContain('with parking');
        expect(build('en', { location: { radiusKm: 5 } })).toContain(
            'within 5 km of the chosen point'
        );
        expect(
            build('en', { availability: { checkIn: '2026-12-01', checkOut: '2026-12-05' } })
        ).toContain('available from Dec 1, 2026 to Dec 5, 2026');
        expect(build('en', { price: { includeWithoutPrice: false } })).toContain(
            'only with a listed price'
        );
        expect(build('en', { includeWithoutRating: false })).toContain('only with reviews');
    });
    it('pt', () => {
        expect(build('pt', { quickAmenities: { pets: true } })).toContain(
            'com permissão para pets'
        );
        expect(build('pt', { quickAmenities: { wifi: true, pets: true } })).toContain(
            'com wifi e permissão para pets'
        );
        expect(build('pt', { location: { radiusKm: 5 } })).toContain(
            'a menos de 5 km do ponto escolhido'
        );
        expect(
            build('pt', { availability: { checkIn: '2026-12-01', checkOut: '2026-12-05' } })
        ).toContain('disponíveis de 1 de dez. de 2026 a 5 de dez. de 2026');
        expect(build('pt', { price: { includeWithoutPrice: false } })).toContain(
            'somente com preço definido'
        );
        expect(build('pt', { includeWithoutRating: false })).toContain('somente com avaliações');
    });
    it('stays inactive when nothing is set', () => {
        expect(build('es', { quickAmenities: {}, location: null, availability: null })).toContain(
            'sin filtros activos'
        );
    });
});
