import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { publishListing } from '../../src/publication/publish-listing';
import { clock, emailPseudonym, event, listingId, makeHarness, userId, vertical } from './support';

function input(harness: ReturnType<typeof makeHarness>) {
    return {
        ...harness,
        clock,
        userId,
        vertical,
        listingId,
        event,
        emailPseudonym,
        correlationId: listingId
    };
}

describe('PB1 publication decisions (AC:V6:2)', () => {
    it('publishes a covered DRAFT immediately, under the lock, then revalidates', async () => {
        const harness = makeHarness();
        const result = await publishListing(input(harness));
        expect(result).toMatchObject({ published: true, trialStarted: false });
        expect(harness.getStatus()).toBe(PublicationStatusEnum.PUBLISHED);
        expect(harness.calls).toEqual([
            'lock',
            'read',
            'set',
            'event',
            'commit',
            'invalidate',
            'revalidate'
        ]);
    });

    it('starts T1 and publishes from PRE_TRIAL in one locked transaction', async () => {
        const harness = makeHarness({
            covered: false,
            status: PublicationStatusEnum.UNPUBLISHED_BY_BILLING
        });
        const result = await publishListing(input(harness));
        expect(result).toMatchObject({ published: true, trialStarted: true });
        expect(harness.calls).toEqual([
            'lock',
            'read',
            'trial',
            'campaign',
            'set',
            'event',
            'commit',
            'coverageNotice',
            'invalidate',
            'revalidate'
        ]);
    });

    it('refuses no-coverage without trial and covered UNPUBLISHED_BY_BILLING', async () => {
        const covered = makeHarness({ status: PublicationStatusEnum.UNPUBLISHED_BY_BILLING });
        expect(await publishListing(input(covered))).toEqual({
            published: false,
            reason: 'COVERED_USE_PB3'
        });
        const noTrial = makeHarness({ covered: false, trialAvailable: false });
        const result = await publishListing(input(noTrial));
        expect(result).toEqual({ published: false, reason: 'USER_ALREADY_HAS_TRIAL_ROW' });
        expect(noTrial.calls).not.toContain('set');
    });

    it('keeps post-commit effects out of a failed transaction', async () => {
        const harness = makeHarness({ failTransaction: true });
        await expect(publishListing(input(harness))).rejects.toThrow('rollback');
        expect(harness.calls).not.toContain('invalidate');
        expect(harness.calls).not.toContain('revalidate');
    });
});
