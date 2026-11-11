/**
 * HOS-2017: `includeNoPrice` / `includeNoReviews` listing toggles.
 *
 * The web forwards `=false` when the sidebar toggle is unchecked. The params
 * must parse (not be an unknown param) and reach the domain search as booleans.
 */

import { describe, expect, it } from 'vitest';
import {
    AccommodationSearchHttpSchema,
    httpToDomainAccommodationSearch
} from '../../../src/entities/accommodation/index.js';

describe('AccommodationSearchHttpSchema: includeNoPrice / includeNoReviews (HOS-2017)', () => {
    it.each([
        ['includeNoPrice', 'false', false],
        ['includeNoPrice', 'true', true],
        ['includeNoReviews', 'false', false],
        ['includeNoReviews', 'true', true]
    ] as const)('coerces %s=%s to boolean', (key, raw, expected) => {
        // Act
        const parsed = AccommodationSearchHttpSchema.parse({ [key]: raw });

        // Assert
        expect(parsed[key]).toBe(expected);
    });

    it('leaves both undefined when absent', () => {
        // Act
        const parsed = AccommodationSearchHttpSchema.parse({});

        // Assert
        expect(parsed.includeNoPrice).toBeUndefined();
        expect(parsed.includeNoReviews).toBeUndefined();
    });

    it('rejects a non-boolean value', () => {
        expect(AccommodationSearchHttpSchema.safeParse({ includeNoPrice: 'maybe' }).success).toBe(
            false
        );
    });
});

describe('httpToDomainAccommodationSearch: includeNoPrice / includeNoReviews (HOS-2017)', () => {
    it('forwards explicit false to the domain search', () => {
        // Arrange
        const parsed = AccommodationSearchHttpSchema.parse({
            includeNoPrice: 'false',
            includeNoReviews: 'false'
        });

        // Act
        const domain = httpToDomainAccommodationSearch(parsed);

        // Assert
        expect(domain.includeNoPrice).toBe(false);
        expect(domain.includeNoReviews).toBe(false);
    });

    it('leaves them undefined when not provided', () => {
        // Act
        const domain = httpToDomainAccommodationSearch(AccommodationSearchHttpSchema.parse({}));

        // Assert
        expect(domain.includeNoPrice).toBeUndefined();
        expect(domain.includeNoReviews).toBeUndefined();
    });
});
