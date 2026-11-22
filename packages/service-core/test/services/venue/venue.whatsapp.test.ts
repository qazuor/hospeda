/**
 * Tests for the venue WhatsApp contact rules (HOS-2256 section 7.8).
 *
 * The properties that matter: the public payload carries the number ONLY for
 * `PUBLIC`, an undecided owner (`null`) publishes nothing (the behaviour before
 * the setting existed), and the signed-in read never hands a number out for a
 * venue that is unpublished, deleted, or whose owner did not opt in.
 */
import type { VenueModel } from '@repo/db';
import { VenueWhatsappVisibilityEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    getVenueWhatsappForViewer,
    readVenueWhatsappNumber,
    resolveDefaultWhatsappVisibility,
    resolveVenuePublicWhatsapp
} from '../../../src/services/venue/venue.whatsapp';

const NUMBER = '+54 9 343 1234567';

describe('readVenueWhatsappNumber', () => {
    it.each([
        [null, null],
        [undefined, null],
        ['x', null],
        [{}, null],
        [{ whatsapp: null }, null],
        [{ whatsapp: '   ' }, null],
        [{ whatsapp: 42 }, null],
        [{ whatsapp: `  ${NUMBER} ` }, NUMBER]
    ])('reads %j as %j', (contactInfo, expected) => {
        expect(readVenueWhatsappNumber({ contactInfo })).toBe(expected);
    });
});

describe('resolveVenuePublicWhatsapp', () => {
    const contactInfo = { whatsapp: NUMBER };

    it('carries the number only for PUBLIC', () => {
        expect(
            resolveVenuePublicWhatsapp({
                contactInfo,
                mode: VenueWhatsappVisibilityEnum.PUBLIC
            })
        ).toEqual({ mode: 'PUBLIC', number: NUMBER });
    });

    it('never carries the number for LOGGED_IN_ONLY (AC-18)', () => {
        const result = resolveVenuePublicWhatsapp({
            contactInfo,
            mode: VenueWhatsappVisibilityEnum.LOGGED_IN_ONLY
        });

        expect(result).toEqual({ mode: 'LOGGED_IN_ONLY' });
        expect(JSON.stringify(result)).not.toContain('1234567');
    });

    it.each([null, undefined])('publishes nothing while the owner has not decided (%s)', (v) => {
        expect(resolveVenuePublicWhatsapp({ contactInfo, mode: v })).toBeUndefined();
    });

    it('publishes nothing without a stored number, whatever the mode (AC-16)', () => {
        for (const mode of Object.values(VenueWhatsappVisibilityEnum)) {
            expect(resolveVenuePublicWhatsapp({ contactInfo: {}, mode })).toBeUndefined();
        }
    });
});

describe('getVenueWhatsappForViewer', () => {
    const modelWith = (row: unknown) =>
        ({ findOne: vi.fn().mockResolvedValue(row) }) as unknown as VenueModel;
    const published = {
        id: 'v',
        deletedAt: null,
        publicationStatus: 'PUBLISHED',
        contactInfo: { whatsapp: NUMBER },
        whatsappVisibility: 'LOGGED_IN_ONLY'
    };

    it('returns the number of a published venue shared with signed-in users', async () => {
        const result = await getVenueWhatsappForViewer(modelWith(published), { venueId: 'v' });
        expect(result).toEqual({ data: { number: NUMBER } });
    });

    it('returns the number when the owner chose PUBLIC', async () => {
        const row = { ...published, whatsappVisibility: 'PUBLIC' };
        const result = await getVenueWhatsappForViewer(modelWith(row), { venueId: 'v' });
        expect(result).toEqual({ data: { number: NUMBER } });
    });

    it('returns a null number while the owner has not opted in', async () => {
        const row = { ...published, whatsappVisibility: null };
        const result = await getVenueWhatsappForViewer(modelWith(row), { venueId: 'v' });
        expect(result).toEqual({ data: { number: null } });
    });

    it.each([
        ['an unknown venue', null],
        ['a deleted venue', { ...published, deletedAt: new Date() }],
        ['a draft', { ...published, publicationStatus: 'DRAFT' }]
    ])('answers the same NOT_FOUND for %s', async (_name, row) => {
        const result = await getVenueWhatsappForViewer(modelWith(row), { venueId: 'v' });
        expect(result.error?.code).toBe('NOT_FOUND');
        expect(result.data).toBeUndefined();
    });
});

describe('resolveDefaultWhatsappVisibility (HOS-2557)', () => {
    const contactInfo = { whatsapp: NUMBER };

    it('defaults a number with no choice and nothing stored to PUBLIC', () => {
        expect(
            resolveDefaultWhatsappVisibility({ contactInfo, requested: undefined, stored: null })
        ).toEqual({ whatsappVisibility: VenueWhatsappVisibilityEnum.PUBLIC });
    });

    it('never overrides an explicit choice, an explicit null or a stored choice', () => {
        expect(
            resolveDefaultWhatsappVisibility({
                contactInfo,
                requested: VenueWhatsappVisibilityEnum.LOGGED_IN_ONLY,
                stored: null
            })
        ).toEqual({});
        expect(
            resolveDefaultWhatsappVisibility({ contactInfo, requested: null, stored: null })
        ).toEqual({});
        expect(
            resolveDefaultWhatsappVisibility({
                contactInfo,
                requested: undefined,
                stored: VenueWhatsappVisibilityEnum.LOGGED_IN_ONLY
            })
        ).toEqual({});
    });

    it('adds nothing when the write carries no number', () => {
        expect(
            resolveDefaultWhatsappVisibility({
                contactInfo: { mobilePhone: '1' },
                requested: undefined,
                stored: null
            })
        ).toEqual({});
        expect(
            resolveDefaultWhatsappVisibility({
                contactInfo: undefined,
                requested: undefined,
                stored: null
            })
        ).toEqual({});
    });
});
