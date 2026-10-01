/**
 * HOS-1377 — host-initiated disconnect must close the provider-side grant.
 *
 * Before the fix the disconnect only flipped `is_active = false`, leaving the
 * Google refresh token valid indefinitely. These tests pin three things:
 *
 *  1. A Google disconnect asks the revocation port to revoke.
 *  2. A failed revocation does NOT fail the disconnect, and is recorded on the
 *     row with the greppable HOS-663 prefix plus an ERROR log.
 *  3. An iCal disconnect gets `revoked: false` from the adapter by design and
 *     is NOT stamped as a failure.
 */

import { OccupancySourceEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { deactivate, markRevocationFailed } = vi.hoisted(() => ({
    deactivate: vi.fn(),
    markRevocationFailed: vi.fn()
}));

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        accommodationCalendarSyncModel: { deactivate, markRevocationFailed }
    };
});

import {
    type CalendarConnectionRevocationPort,
    REVOCATION_FAILURE_PREFIX,
    setCalendarConnectionRevocationPort
} from '../../../src/services/accommodation/accommodation.calendar-cascade';
import { disconnectCalendarConnection } from '../../../src/services/accommodation/accommodation.calendar-disconnect';
import { createLoggerMock } from '../../utils/modelMockFactory';

const ACCOMMODATION_ID = '33333333-3333-4333-8333-333333333333';

const inactiveRow = (provider: OccupancySourceEnum) => ({
    id: 'conn-1',
    accommodationId: ACCOMMODATION_ID,
    provider,
    isActive: false
});

describe('disconnectCalendarConnection (HOS-1377)', () => {
    const logger = createLoggerMock();
    const revoke = vi.fn<CalendarConnectionRevocationPort['revoke']>();

    beforeEach(() => {
        vi.clearAllMocks();
        setCalendarConnectionRevocationPort({ revoke });
        markRevocationFailed.mockResolvedValue({ id: 'conn-1' });
    });

    afterEach(() => {
        setCalendarConnectionRevocationPort(undefined);
    });

    it('revokes the Google grant after deactivating the connection', async () => {
        // Arrange
        deactivate.mockResolvedValue(inactiveRow(OccupancySourceEnum.GOOGLE_CALENDAR));
        revoke.mockResolvedValue({ revoked: true });

        // Act
        const result = await disconnectCalendarConnection({
            accommodationId: ACCOMMODATION_ID,
            provider: OccupancySourceEnum.GOOGLE_CALENDAR,
            logger
        });

        // Assert
        expect(result).toEqual({ disconnected: true, revocation: 'revoked' });
        expect(deactivate).toHaveBeenCalledWith({
            accommodationId: ACCOMMODATION_ID,
            provider: OccupancySourceEnum.GOOGLE_CALENDAR
        });
        expect(revoke).toHaveBeenCalledWith({
            accommodationId: ACCOMMODATION_ID,
            provider: OccupancySourceEnum.GOOGLE_CALENDAR
        });
        expect(deactivate.mock.invocationCallOrder[0]).toBeLessThan(
            revoke.mock.invocationCallOrder[0] ?? 0
        );
        expect(markRevocationFailed).not.toHaveBeenCalled();
    });

    it('still disconnects when Google revocation fails, and stamps + logs the failure', async () => {
        // Arrange
        deactivate.mockResolvedValue(inactiveRow(OccupancySourceEnum.GOOGLE_CALENDAR));
        revoke.mockResolvedValue({ revoked: false, reason: 'google revocation failed (network)' });

        // Act
        const result = await disconnectCalendarConnection({
            accommodationId: ACCOMMODATION_ID,
            provider: OccupancySourceEnum.GOOGLE_CALENDAR,
            logger
        });

        // Assert
        expect(result).toEqual({ disconnected: true, revocation: 'failed' });
        expect(markRevocationFailed).toHaveBeenCalledWith({
            accommodationId: ACCOMMODATION_ID,
            provider: OccupancySourceEnum.GOOGLE_CALENDAR,
            errorMessage: `${REVOCATION_FAILURE_PREFIX}: google revocation failed (network)`
        });
        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({ provider: OccupancySourceEnum.GOOGLE_CALENDAR }),
            expect.stringContaining(REVOCATION_FAILURE_PREFIX)
        );
    });

    it('still disconnects when the adapter throws', async () => {
        // Arrange
        deactivate.mockResolvedValue(inactiveRow(OccupancySourceEnum.GOOGLE_CALENDAR));
        revoke.mockRejectedValue(new Error('socket hang up'));

        // Act
        const result = await disconnectCalendarConnection({
            accommodationId: ACCOMMODATION_ID,
            provider: OccupancySourceEnum.GOOGLE_CALENDAR,
            logger
        });

        // Assert
        expect(result).toEqual({ disconnected: true, revocation: 'failed' });
        expect(markRevocationFailed).toHaveBeenCalledWith(
            expect.objectContaining({
                errorMessage: `${REVOCATION_FAILURE_PREFIX}: adapter threw: socket hang up`
            })
        );
    });

    it('still disconnects when stamping the failure itself throws', async () => {
        // Arrange
        deactivate.mockResolvedValue(inactiveRow(OccupancySourceEnum.GOOGLE_CALENDAR));
        revoke.mockResolvedValue({ revoked: false, reason: 'google responded 500' });
        markRevocationFailed.mockRejectedValue(new Error('db down'));

        // Act
        const result = await disconnectCalendarConnection({
            accommodationId: ACCOMMODATION_ID,
            provider: OccupancySourceEnum.GOOGLE_CALENDAR,
            logger
        });

        // Assert
        expect(result).toEqual({ disconnected: true, revocation: 'failed' });
        expect(logger.error).toHaveBeenCalledTimes(2);
    });

    it('treats a missing adapter as a failed revocation, not a success', async () => {
        // Arrange
        setCalendarConnectionRevocationPort(undefined);
        deactivate.mockResolvedValue(inactiveRow(OccupancySourceEnum.GOOGLE_CALENDAR));

        // Act
        const result = await disconnectCalendarConnection({
            accommodationId: ACCOMMODATION_ID,
            provider: OccupancySourceEnum.GOOGLE_CALENDAR,
            logger
        });

        // Assert
        expect(result.revocation).toBe('failed');
        expect(markRevocationFailed).toHaveBeenCalledTimes(1);
    });

    it.each([
        OccupancySourceEnum.AIRBNB,
        OccupancySourceEnum.BOOKING,
        OccupancySourceEnum.OTHER
    ])('does not stamp an iCal (%s) disconnect as a revocation failure', async (provider) => {
        // Arrange
        deactivate.mockResolvedValue(inactiveRow(provider));
        revoke.mockResolvedValue({ revoked: false, reason: `${provider} is an iCal feed` });

        // Act
        const result = await disconnectCalendarConnection({
            accommodationId: ACCOMMODATION_ID,
            provider,
            logger
        });

        // Assert
        expect(result).toEqual({ disconnected: true, revocation: 'not-revocable' });
        expect(revoke).toHaveBeenCalledWith({ accommodationId: ACCOMMODATION_ID, provider });
        expect(markRevocationFailed).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('does not revoke anything when there is no connection to disconnect', async () => {
        // Arrange
        deactivate.mockResolvedValue(null);

        // Act
        const result = await disconnectCalendarConnection({
            accommodationId: ACCOMMODATION_ID,
            provider: OccupancySourceEnum.GOOGLE_CALENDAR,
            logger
        });

        // Assert
        expect(result).toEqual({ disconnected: false, revocation: 'skipped' });
        expect(revoke).not.toHaveBeenCalled();
    });
});
