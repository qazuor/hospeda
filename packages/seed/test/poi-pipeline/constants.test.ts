import { describe, expect, it } from 'vitest';
import {
    AUTO_GEOCODE_MARKER,
    buildAutoGeocodeMarker,
    DESTINATION_SLUG_FIXUPS,
    REGIONAL_QUALIFIER
} from '../../scripts/poi-pipeline/constants.js';
import { CSV_COLUMNS } from '../../scripts/poi-pipeline/types.js';

describe('DESTINATION_SLUG_FIXUPS', () => {
    it('maps the two known CSV mismatches to their real fixture slugs', () => {
        // Arrange / Act / Assert
        expect(DESTINATION_SLUG_FIXUPS).toEqual({
            'pueblo-liebig': 'liebig',
            'villa-paranacito': 'paranacito'
        });
    });

    it('contains exactly the two documented fixups (no third mismatch)', () => {
        // Arrange
        const keys = Object.keys(DESTINATION_SLUG_FIXUPS);

        // Act / Assert
        expect(keys).toHaveLength(2);
    });
});

describe('REGIONAL_QUALIFIER', () => {
    it('is the fixed Entre Rios, Argentina suffix', () => {
        expect(REGIONAL_QUALIFIER).toBe(', Entre Rios, Argentina');
    });
});

describe('buildAutoGeocodeMarker', () => {
    it('embeds the searchable AUTO_GEOCODE_MARKER token', () => {
        // Arrange
        const marker = buildAutoGeocodeMarker({ provider: 'nominatim', isoDate: '2026-07-13' });

        // Act / Assert
        expect(marker).toContain(AUTO_GEOCODE_MARKER);
        expect(AUTO_GEOCODE_MARKER).toBe('auto-geocoded');
    });

    it('includes the provider and date so provenance is auditable', () => {
        // Arrange
        const marker = buildAutoGeocodeMarker({ provider: 'nominatim', isoDate: '2026-07-13' });

        // Act / Assert
        expect(marker).toContain('nominatim');
        expect(marker).toContain('2026-07-13');
        expect(marker).toMatch(/pending human cartographic verification/);
    });
});

describe('CSV_COLUMNS', () => {
    it('lists all 20 CSV columns in file order', () => {
        // Arrange / Act / Assert
        expect(CSV_COLUMNS).toHaveLength(20);
        expect(CSV_COLUMNS[0]).toBe('id');
        expect(CSV_COLUMNS[CSV_COLUMNS.length - 1]).toBe('nearbyDestinationNames');
    });
});
