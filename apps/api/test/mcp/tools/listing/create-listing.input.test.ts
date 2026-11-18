/**
 * HOS-2329 — `create_listing` input: one flat published object (C-2), validated
 * per vertical with that vertical's portal create schema (C-6), and a failure
 * that names only the failed field (AC-C21).
 *
 * @module test/mcp/tools/listing/create-listing.input
 */

import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
    bindingPayloadOf,
    CreateListingInputSchema
} from '../../../../src/mcp/tools/listing/create-listing-input';
import { VALID_INPUT, VERTICALS, type Vertical } from './create-listing.harness';

/** The field paths a failed parse names. */
function failedFields(input: Record<string, unknown>): string[] {
    const result = CreateListingInputSchema.safeParse(input);
    if (result.success) return [];
    return [...new Set(result.error.issues.map((issue) => issue.path.join('.')))].sort();
}

describe('create_listing input', () => {
    it('publishes ONE flat object, no union (C-2)', () => {
        // Act
        const json = z.toJSONSchema(CreateListingInputSchema, { io: 'input' });

        // Assert
        expect(json).toMatchObject({ type: 'object', additionalProperties: false });
        expect(json).not.toHaveProperty('anyOf');
        expect(json).not.toHaveProperty('oneOf');
        expect(Object.keys((json as { properties: object }).properties)).toEqual([
            'vertical',
            'name',
            'type',
            'summary',
            'description',
            'destinationId',
            'priceFrom',
            'priceUnit',
            'isPriceOnRequest',
            'businessLines',
            'maxGuests',
            'bedrooms',
            'bathrooms',
            'beds',
            'mapsUrl',
            'street',
            'number',
            'confirmationToken'
        ]);
    });

    it('publishes no coordinate field: the point only comes from mapsUrl (D-4)', () => {
        const json = JSON.stringify(z.toJSONSchema(CreateListingInputSchema, { io: 'input' }));
        expect(json).not.toMatch(/"(latitude|longitude|lat|lng|coordinates|meetingPointLat)"/);
    });

    it.each(VERTICALS)('%s: the valid fixture parses', (v) => {
        expect(failedFields({ ...VALID_INPUT[v] })).toEqual([]);
    });

    it.each([
        [VerticalEnum.ACCOMMODATION, { name: 'ab' }, ['name']],
        [VerticalEnum.ACCOMMODATION, { summary: 'corto' }, ['summary']],
        [VerticalEnum.ACCOMMODATION, { type: 'CASTLE' }, ['type']],
        [VerticalEnum.ACCOMMODATION, { maxGuests: 0 }, ['maxGuests']],
        [VerticalEnum.ACCOMMODATION, { street: 'x' }, ['street']],
        [VerticalEnum.VENUE, { description: undefined }, ['description']],
        [VerticalEnum.VENUE, { type: 'CABIN' }, ['type']],
        [VerticalEnum.VENUE, { number: '12345678901' }, ['number']],
        [VerticalEnum.EXPERIENCE, { priceUnit: 'per_week' }, ['priceUnit']]
    ])('%s %j fails on exactly %j (AC-C21)', (v, change, fields) => {
        expect(failedFields({ ...VALID_INPUT[v as Vertical], ...change })).toEqual(fields);
    });

    it.each([
        [VerticalEnum.ACCOMMODATION, { priceFrom: 100 }, ['priceFrom']],
        [VerticalEnum.ACCOMMODATION, { businessLines: ['standard'] }, ['businessLines']],
        [VerticalEnum.VENUE, { maxGuests: 4 }, ['maxGuests']],
        [VerticalEnum.VENUE, { priceFrom: 100 }, ['priceFrom']],
        [VerticalEnum.EXPERIENCE, { bedrooms: 2 }, ['bedrooms']]
    ])('%s refuses %j, a field of another vertical, by name', (v, change, fields) => {
        const result = CreateListingInputSchema.safeParse({
            ...VALID_INPUT[v as Vertical],
            ...change
        });
        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error.issues.map((i) => i.path.join('.'))).toEqual(fields);
        expect(result.error.issues[0]?.message).toContain('no se usa en');
    });

    it('experience: a price needs a unit, unless it is on request (route pricing rule)', () => {
        const base = { ...VALID_INPUT.experience };
        expect(failedFields({ ...base, priceUnit: undefined })).not.toEqual([]);
        expect(
            failedFields({
                ...base,
                priceFrom: undefined,
                priceUnit: undefined,
                isPriceOnRequest: true
            })
        ).toEqual([]);
    });

    it('refuses unknown keys (strict)', () => {
        expect(failedFields({ ...VALID_INPUT.venue, ownerId: 'x' })).toEqual(['']);
    });

    it('the token binding payload is the input minus the token, absent fields dropped', () => {
        const parsed = CreateListingInputSchema.parse({
            ...VALID_INPUT.venue,
            confirmationToken: 'tok'
        });
        expect(bindingPayloadOf({ input: parsed })).toEqual({ ...VALID_INPUT.venue });
    });
});
