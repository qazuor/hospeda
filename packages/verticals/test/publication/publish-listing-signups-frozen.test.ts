import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { publishListing } from '../../src/publication/publish-listing';
import { clock, emailPseudonym, event, listingId, makeHarness, userId, vertical } from './support';

function input(harness: ReturnType<typeof makeHarness>, newSignupsFrozen?: () => Promise<boolean>) {
    return {
        ...harness,
        clock,
        userId,
        vertical,
        listingId,
        event,
        emailPseudonym,
        correlationId: listingId,
        ...(newSignupsFrozen ? { newSignupsFrozen } : {})
    };
}

describe('HOS-1749 PB1 refuses the first publish that would start a trial while signups are frozen', () => {
    it('uncovered owner, trial would start, frozen: refuses NEW_PAID_SIGNUPS_FROZEN and starts nothing', async () => {
        // Arrange
        const harness = makeHarness({ covered: false });

        // Act
        const result = await publishListing(input(harness, async () => true));

        // Assert
        expect(result).toEqual({ published: false, reason: 'NEW_PAID_SIGNUPS_FROZEN' });
        expect(harness.calls).toEqual(['lock', 'read', 'commit']);
        expect(harness.getStatus()).toBe(PublicationStatusEnum.DRAFT);
    });

    it('uncovered owner, frozen, not frozen port: publishes and starts the trial', async () => {
        // Arrange
        const harness = makeHarness({ covered: false });

        // Act
        const result = await publishListing(input(harness, async () => false));

        // Assert
        expect(result).toMatchObject({ published: true, trialStarted: true });
    });

    it('covered owner, frozen: publishes and never asks the freeze', async () => {
        // Arrange
        const harness = makeHarness();
        const isFrozen = vi.fn(async () => true);

        // Act
        const result = await publishListing(input(harness, isFrozen));

        // Assert
        expect(result).toMatchObject({ published: true, trialStarted: false });
        expect(isFrozen).toHaveBeenCalledTimes(0);
    });

    it('uncovered owner who already had a trial, frozen: keeps the trial refusal', async () => {
        // Arrange
        const harness = makeHarness({ covered: false, userHasTrialRow: true });
        const isFrozen = vi.fn(async () => true);

        // Act
        const result = await publishListing(input(harness, isFrozen));

        // Assert
        expect(result).toEqual({ published: false, reason: 'USER_ALREADY_HAS_TRIAL_ROW' });
        expect(isFrozen).toHaveBeenCalledTimes(0);
    });

    it('no port supplied: behaves as not frozen', async () => {
        // Arrange
        const harness = makeHarness({ covered: false });

        // Act
        const result = await publishListing(input(harness));

        // Assert
        expect(result).toMatchObject({ published: true, trialStarted: true });
    });
});
