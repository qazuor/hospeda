import { describe, expect, it } from 'vitest';
import {
    applyDestinationGuards,
    extractExplicitDestinationDistanceKm,
    isGenericDestinationAddress
} from '../../scripts/poi-pipeline/geocode-guards.js';
import type { RawGeocodeHit } from '../../scripts/poi-pipeline/geocoder.js';

const destinationCenter = {
    lat: -32.217,
    long: -58.133
} as const;

const nearHit: RawGeocodeHit = {
    lat: -32.2174,
    long: -58.1326,
    importance: 0.9,
    featureClass: 'place',
    featureType: 'square',
    displayName: 'Plaza San Martín',
    provider: 'google-places'
};

describe('extractExplicitDestinationDistanceKm', () => {
    it('extracts only "a N km de <destino>" style distance hints', () => {
        expect(
            extractExplicitDestinationDistanceKm({
                rowAddress: 'Ruta Provincial 42, a 15 km de Gualeguaychú, Entre Ríos',
                destinationNames: ['Gualeguaychú']
            })
        ).toBe(15);

        expect(
            extractExplicitDestinationDistanceKm({
                rowAddress: 'Ruta Provincial 23 km 28, zona de Arroyo Barú, Entre Ríos',
                destinationNames: ['Villa Elisa']
            })
        ).toBeNull();
    });
});

describe('isGenericDestinationAddress', () => {
    it('treats town-only addresses as generic destination-level matches', () => {
        expect(
            isGenericDestinationAddress({
                rowAddress: 'Chajarí, Entre Ríos',
                destinationNames: ['Chajarí']
            })
        ).toBe(true);

        expect(
            isGenericDestinationAddress({
                rowAddress: 'Laprida 86, Colón, Entre Ríos',
                destinationNames: ['Colón']
            })
        ).toBe(false);
    });
});

describe('applyDestinationGuards', () => {
    it('accepts an in-radius hit', () => {
        const result = applyDestinationGuards({
            hit: nearHit,
            context: {
                destinationNames: ['Colón'],
                destinationCenter,
                rowAddress: 'Laprida 86, Colón, Entre Ríos'
            }
        });

        expect(result).toEqual({ hit: nearHit, reason: null });
    });

    it('rejects an out-of-radius hit', () => {
        const result = applyDestinationGuards({
            hit: {
                ...nearHit,
                lat: -31.7179736,
                long: -60.537909299999995,
                displayName: 'Monumento a Justo José de Urquiza'
            },
            context: {
                destinationNames: ['San Justo'],
                destinationCenter: {
                    lat: -32.4469,
                    long: -58.4352
                },
                rowAddress: 'Centro de San Justo, Entre Ríos'
            }
        });

        expect(result).toEqual({ hit: null, reason: 'outside-radius' });
    });

    it('rejects a town-centroid hit for a generic destination-only address', () => {
        const result = applyDestinationGuards({
            hit: {
                ...nearHit,
                lat: destinationCenter.lat,
                long: destinationCenter.long,
                displayName: 'Chajarí'
            },
            context: {
                destinationNames: ['Chajarí'],
                destinationCenter,
                rowAddress: 'Chajarí, Entre Ríos'
            }
        });

        expect(result).toEqual({ hit: null, reason: 'town-centroid' });
    });

    it('preserves legitimately distant rows when the address states the distance', () => {
        const result = applyDestinationGuards({
            hit: {
                ...nearHit,
                lat: -32.5008,
                long: -58.8938
            },
            context: {
                destinationNames: ['Urdinarrain'],
                destinationCenter: {
                    lat: -32.6858,
                    long: -58.8938
                },
                rowAddress: 'A 20 km de Urdinarrain, costa del río Gualeguay, Entre Ríos'
            }
        });

        expect(result).toEqual({
            hit: {
                ...nearHit,
                lat: -32.5008,
                long: -58.8938
            },
            reason: null
        });
    });
});
