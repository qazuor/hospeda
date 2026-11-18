/**
 * HOS-2329 — the `create_listing` preview record (M-1): `priceFrom` is
 * centavos, so the preview carries a formatted `priceLabel` in pesos with its
 * unit and tells the model to show that, never the raw number.
 *
 * @module test/mcp/tools/listing/create-listing-preview
 */

import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { CreateListingInput } from '../../../../src/mcp/tools/listing/create-listing-input';
import {
    PRICE_ON_REQUEST_LABEL,
    previewInstructions,
    previewListing
} from '../../../../src/mcp/tools/listing/create-listing-preview';
import { DESTINATION_ID, VALID_INPUT } from './create-listing.harness';

const previewOf = (input: Readonly<Record<string, unknown>>) =>
    previewListing({
        input: input as CreateListingInput,
        destinationName: 'Concepción del Uruguay'
    });

describe('create_listing preview', () => {
    it('formats priceFrom from centavos to pesos, with its unit', () => {
        // Act: 1500000 centavos per person
        const listing = previewOf(VALID_INPUT[VerticalEnum.EXPERIENCE]);

        // Assert
        expect(listing.priceLabel).toMatch(/^Desde \$\s15\.000 \S/);
        expect(String(listing.priceLabel)).not.toContain('1.500.000');
        expect(String(listing.priceLabel)).not.toContain('per_person');
    });

    it('keeps the cents of a fractional price', () => {
        // Act
        const listing = previewOf({ ...VALID_INPUT[VerticalEnum.EXPERIENCE], priceFrom: 150050 });

        // Assert
        expect(listing.priceLabel).toMatch(/^Desde \$\s1\.500,50 /);
    });

    it('drops the unit when there is none', () => {
        // Act
        const listing = previewOf({
            ...VALID_INPUT[VerticalEnum.EXPERIENCE],
            priceUnit: undefined
        });

        // Assert
        expect(listing.priceLabel).toMatch(/^Desde \$\s15\.000$/);
    });

    it.each([
        ['on request', { priceFrom: null, priceUnit: undefined, isPriceOnRequest: true }],
        ['without a price', { priceFrom: null, priceUnit: undefined }]
    ])('shows "Consultar precio" %s', (_case, change) => {
        // Act
        const listing = previewOf({ ...VALID_INPUT[VerticalEnum.EXPERIENCE], ...change });

        // Assert
        expect(PRICE_ON_REQUEST_LABEL).toBe('Consultar precio');
        expect(listing.priceLabel).toBe('Consultar precio');
    });

    it.each([
        VerticalEnum.ACCOMMODATION,
        VerticalEnum.VENUE
    ] as const)('%s: carries no price label', (vertical) => {
        // Act
        const listing = previewOf(VALID_INPUT[vertical]);

        // Assert
        expect(listing).not.toHaveProperty('priceLabel');
    });

    it('keeps the location fields and the token out of the record', () => {
        // Act
        const listing = previewOf({
            ...VALID_INPUT[VerticalEnum.EXPERIENCE],
            street: 'Calle Falsa',
            number: '123',
            confirmationToken: 'secret'
        });

        // Assert
        expect(listing).not.toHaveProperty('street');
        expect(listing).not.toHaveProperty('confirmationToken');
        expect(listing.destinationId).toBe(DESTINATION_ID);
    });

    it('tells the model to show the label, never the raw priceFrom', () => {
        // Act
        const instructions = previewInstructions({ expiresInSeconds: 600 });

        // Assert
        expect(instructions).toContain('"listing.priceLabel"');
        expect(instructions).toContain('nunca el número de "priceFrom"');
        expect(instructions).toContain('10 minutos');
    });
});
