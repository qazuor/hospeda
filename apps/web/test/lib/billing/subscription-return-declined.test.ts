import { describe, expect, it } from 'vitest';
import { selectDeclinedNoticesToShow } from '../../../src/lib/billing/subscription-return';

const notices = [
    { subscriptionId: 'declined-1', vertical: 'accommodation' },
    { subscriptionId: 'declined-2', vertical: 'tourist' }
];

describe('HOS-2064 declined notice selection', () => {
    it('keeps every declined notice without a return id', () => {
        // Arrange
        const declinedSignups = notices;
        // Act
        const result = selectDeclinedNoticesToShow({ declinedSignups, returnSubscriptionId: null });
        // Assert
        expect(result).toEqual(notices);
    });

    it('drops the notice the return screen already shows', () => {
        // Arrange
        const declinedSignups = notices;
        // Act
        const result = selectDeclinedNoticesToShow({
            declinedSignups,
            returnSubscriptionId: 'declined-1'
        });
        // Assert
        expect(result).toEqual([notices[1]]);
    });
});
