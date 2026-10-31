/**
 * HOS-1922: `isAvailable`, `city` and `country` were accepted by the accommodation
 * search schemas and never implemented anywhere. They are gone; this pins it so
 * they cannot return as unimplemented params.
 */

import { describe, expect, it } from 'vitest';
import {
    AccommodationFiltersSchema,
    AccommodationSearchHttpSchema,
    AccommodationSearchSchema,
    httpToDomainAccommodationSearch
} from '../../../src/entities/accommodation/index.js';

const REMOVED = ['isAvailable', 'city', 'country'] as const;

describe('accommodation search schemas: removed dead filters (HOS-1922)', () => {
    it.each([
        ['AccommodationSearchSchema', AccommodationSearchSchema.shape],
        ['AccommodationFiltersSchema', AccommodationFiltersSchema.shape],
        ['AccommodationSearchHttpSchema', AccommodationSearchHttpSchema.shape]
    ])('%s does not declare the removed params', (_name, shape) => {
        // Arrange
        const keys = Object.keys(shape);

        // Act / Assert
        for (const removed of REMOVED) {
            expect(keys).not.toContain(removed);
        }
    });

    it('does not forward isAvailable from the HTTP query to the domain search', () => {
        // Arrange
        const parsed = AccommodationSearchHttpSchema.parse({ isAvailable: 'true' });

        // Act
        const domain = httpToDomainAccommodationSearch(parsed);

        // Assert
        expect(Object.keys(domain)).not.toContain('isAvailable');
    });
});
