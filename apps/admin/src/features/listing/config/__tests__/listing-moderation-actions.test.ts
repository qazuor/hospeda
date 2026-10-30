/**
 * Tests for `listing-moderation-actions` (HOS-1684, AC-1684:1 and AC-1684:2).
 *
 * The table mirrors the API's guards: a button the API can only refuse is a
 * trap for the admin, and a missing one leaves a listing that cannot be
 * moderated from the panel. The rejection map decides by status and action,
 * never by the error's message.
 */

import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/errors';
import {
    canEditListing,
    canPurgeListingOnRequest,
    describeModerationError,
    getAvailableModerationActions,
    LISTING_EDIT_STATES,
    LISTING_PURGE_ON_REQUEST_STATES,
    type ListingModerationActionKind
} from '../listing-moderation-actions';

describe('TEST:1760:2 AC:1760:2 action state matrix', () => {
    const states = Object.values(PublicationStatusEnum);
    const matrix: Record<string, Record<string, readonly string[]>> = {
        DRAFT: {
            open: ['TAKE_DOWN', 'CLOSE_FIX_REQUEST'],
            closed: ['REQUEST_FIX', 'TAKE_DOWN'],
            unknown: []
        },
        PUBLISHED: {
            open: ['TAKE_DOWN', 'CLOSE_FIX_REQUEST'],
            closed: ['REQUEST_FIX', 'TAKE_DOWN'],
            unknown: []
        },
        UNPUBLISHED_BY_BILLING: {
            open: ['TAKE_DOWN', 'CLOSE_FIX_REQUEST'],
            closed: ['REQUEST_FIX', 'TAKE_DOWN'],
            unknown: []
        },
        ARCHIVED: {
            open: ['TAKE_DOWN', 'CLOSE_FIX_REQUEST'],
            closed: ['REQUEST_FIX', 'TAKE_DOWN'],
            unknown: []
        },
        MODERATED: { open: ['LIFT'], closed: ['LIFT', 'REQUEST_FIX'], unknown: [] },
        PURGED: { open: [], closed: [], unknown: [] }
    };
    it.each(
        states.flatMap(
            (state) =>
                [
                    [state, 'open', true],
                    [state, 'closed', false],
                    [state, 'unknown', undefined]
                ] as const
        )
    )('%s with %s request offers its exact actions', (publicationStatus, state, fixRequestOpen) => {
        expect(getAvailableModerationActions({ publicationStatus, fixRequestOpen })).toEqual(
            matrix[publicationStatus][state]
        );
    });
    it('does not offer CLOSE_FIX_REQUEST to PUBLISHED without an open request', () => {
        expect(
            getAvailableModerationActions({
                publicationStatus: PublicationStatusEnum.PUBLISHED,
                fixRequestOpen: false
            })
        ).toEqual(['REQUEST_FIX', 'TAKE_DOWN']);
    });
    it.each([
        undefined,
        null
    ])('returns no actions when publication state is unknown (%s)', (publicationStatus) => {
        expect(getAvailableModerationActions({ publicationStatus, fixRequestOpen: false })).toEqual(
            []
        );
    });
    it.each(
        Object.values(PublicationStatusEnum)
    )('derives purge/edit eligibility for %s', (publicationStatus) => {
        expect(canPurgeListingOnRequest({ publicationStatus })).toBe(
            LISTING_PURGE_ON_REQUEST_STATES.includes(publicationStatus as never)
        );
        expect(canEditListing({ publicationStatus })).toBe(
            LISTING_EDIT_STATES.includes(publicationStatus as never)
        );
    });
    it('treats unknown listing state as ineligible', () => {
        expect(canPurgeListingOnRequest({ publicationStatus: null })).toBe(false);
        expect(canEditListing({ publicationStatus: undefined })).toBe(false);
    });
});

describe('TEST:1684:4 AC-1684:2 typed rejections', () => {
    it.each([
        [400, 'admin-entities.listingModeration.errors.invalid'],
        [403, 'admin-entities.listingModeration.errors.forbidden'],
        [404, 'admin-entities.listingModeration.errors.notFound']
    ] as const)('%i reads as %s, an error', (status, messageKey) => {
        // Arrange
        const error = new ApiError('refused', { status });

        // Act
        const description = describeModerationError({ action: 'TAKE_DOWN', error });

        // Assert
        expect(description).toEqual({ messageKey, variant: 'error' });
    });

    it.each([
        ['REQUEST_FIX', 'admin-entities.listingModeration.errors.conflict.requestFix'],
        ['TAKE_DOWN', 'admin-entities.listingModeration.errors.conflict.takeDown'],
        ['LIFT', 'admin-entities.listingModeration.errors.conflict.lift'],
        ['CLOSE_FIX_REQUEST', 'admin-entities.listingModeration.errors.conflict.closeFixRequest']
    ] as const satisfies readonly (readonly [
        ListingModerationActionKind,
        string
    ])[])('409 on %s reads as %s, a warning', (action, messageKey) => {
        // Arrange: every 409 carries the same code; only the action differs
        const error = new ApiError('Listing state changed', { status: 409 });

        // Act
        const description = describeModerationError({ action, error });

        // Assert
        expect(description).toEqual({ messageKey, variant: 'warning' });
    });

    it('gives the four 409s four distinct texts', () => {
        // Arrange
        const actions: readonly ListingModerationActionKind[] = [
            'REQUEST_FIX',
            'TAKE_DOWN',
            'LIFT',
            'CLOSE_FIX_REQUEST'
        ];
        const error = new ApiError('conflict', { status: 409 });

        // Act
        const keys = actions.map((action) => describeModerationError({ action, error }).messageKey);

        // Assert
        expect(new Set(keys).size).toBe(4);
    });

    it('does not read the message: a 409 saying "not found" is still a conflict', () => {
        // Arrange
        const error = new ApiError('Listing not found', { status: 409 });

        // Act
        const description = describeModerationError({ action: 'LIFT', error });

        // Assert
        expect(description.messageKey).toBe(
            'admin-entities.listingModeration.errors.conflict.lift'
        );
    });

    it.each([
        ['a plain Error', new Error('network down')],
        ['a 500 ApiError', new ApiError('boom', { status: 500 })],
        ['a non-error value', 'oops']
    ])('reads %s as generic, an error', (_label, error) => {
        // Arrange / Act
        const description = describeModerationError({ action: 'REQUEST_FIX', error });

        // Assert
        expect(description).toEqual({
            messageKey: 'admin-entities.listingModeration.errors.generic',
            variant: 'error'
        });
    });
});
