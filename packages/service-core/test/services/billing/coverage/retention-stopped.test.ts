// TEST:B4:3 (AC:B4:4), the pure half: `retenciónDetenida` decided from what was read
// (contract §4.1; DEC-DATA-006 and its 📌1). `coverageLostAt` is the later of the recorded loss
// and the elapsed end of service of a scheduled cancellation (I-5).
import { describe, expect, it } from 'vitest';
import {
    decideRetentionStopped,
    type RetentionStoppedReading
} from '../../../../src/services/billing/coverage/retention-stopped';

const earlier = new Date('2026-10-01T10:00:00.000Z');
const later = new Date('2026-10-05T10:00:00.000Z');

function reading(overrides: Partial<RetentionStoppedReading> = {}): RetentionStoppedReading {
    return {
        openCustomerPauses: 0,
        latestCustomerPauseEnd: null,
        recordedLoss: null,
        latestElapsedServiceEnd: null,
        ...overrides
    };
}

describe('TEST:B4:3 decideRetentionStopped (AC:B4:4)', () => {
    it('nothing read ⇒ not stopped, no pause end, no loss', () => {
        // Arrange
        const input = reading();

        // Act
        const result = decideRetentionStopped(input);

        // Assert
        expect(result).toEqual({ stopped: false, pauseEndedAt: null, coverageLostAt: null });
    });

    it('an open CUSTOMER_REQUEST pause ⇒ stopped, carrying the closed pause end as read', () => {
        // Arrange
        const input = reading({ openCustomerPauses: 1, latestCustomerPauseEnd: earlier });

        // Act
        const result = decideRetentionStopped(input);

        // Assert
        expect(result).toEqual({ stopped: true, pauseEndedAt: earlier, coverageLostAt: null });
    });

    it('only the recorded loss ⇒ coverageLostAt is that instant', () => {
        // Arrange
        const input = reading({ recordedLoss: earlier });

        // Act
        const result = decideRetentionStopped(input);

        // Assert
        expect(result).toEqual({ stopped: false, pauseEndedAt: null, coverageLostAt: earlier });
    });

    it('only an elapsed end of service ⇒ coverageLostAt is that end', () => {
        // Arrange
        const input = reading({ latestElapsedServiceEnd: earlier });

        // Act
        const result = decideRetentionStopped(input);

        // Assert
        expect(result).toEqual({ stopped: false, pauseEndedAt: null, coverageLostAt: earlier });
    });

    it('an end of service later than the recorded loss wins', () => {
        // Arrange
        const input = reading({ recordedLoss: earlier, latestElapsedServiceEnd: later });

        // Act
        const result = decideRetentionStopped(input);

        // Assert
        expect(result).toEqual({ stopped: false, pauseEndedAt: null, coverageLostAt: later });
    });

    it('a recorded loss later than the end of service wins', () => {
        // Arrange
        const input = reading({ recordedLoss: later, latestElapsedServiceEnd: earlier });

        // Act
        const result = decideRetentionStopped(input);

        // Assert
        expect(result).toEqual({ stopped: false, pauseEndedAt: null, coverageLostAt: later });
    });
});
