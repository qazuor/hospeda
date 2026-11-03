import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { publishListing } from '../../src/publication/publish-listing';
import {
    at,
    clock,
    emailPseudonym,
    event,
    listingId,
    makeHarness,
    userId,
    vertical
} from './support';

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

    it('publishes a covered UNPUBLISHED_BY_BILLING listing by hand when the quota has a free slot (HOS-1997)', async () => {
        const harness = makeHarness({
            status: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
            limit: 1
        });
        expect(await publishListing(input(harness))).toMatchObject({
            published: true,
            trialStarted: false,
            trialConsumed: false
        });
        expect(harness.getStatus()).toBe(PublicationStatusEnum.PUBLISHED);
        expect(harness.statusWrites[0]).toMatchObject({
            from: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
            to: PublicationStatusEnum.PUBLISHED,
            actorId: userId
        });
        expect(harness.statusEvents[0]).toMatchObject({
            from: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
            to: PublicationStatusEnum.PUBLISHED,
            actorType: 'owner',
            actorId: userId
        });
        expect(harness.calls).toEqual(
            expect.arrayContaining(['lock', 'read', 'set', 'event', 'commit', 'revalidate'])
        );
    });

    it('rejects a covered UNPUBLISHED_BY_BILLING listing with LIMIT_REACHED when the quota is full (HOS-1997)', async () => {
        const harness = makeHarness({
            status: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
            limit: 1,
            listings: [
                {
                    id: listingId,
                    ownerId: userId,
                    publicationStatus: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
                    createdAt: at,
                    inactiveSince: at
                },
                {
                    id: '00000000-0000-4000-8000-0000000000aa',
                    ownerId: userId,
                    publicationStatus: PublicationStatusEnum.PUBLISHED,
                    createdAt: at,
                    inactiveSince: at
                }
            ]
        });
        expect(await publishListing(input(harness))).toEqual({
            published: false,
            reason: 'LIMIT_REACHED'
        });
        expect(harness.calls).not.toContain('set');
        expect(harness.calls).not.toContain('event');
    });

    it('refuses no-coverage without trial', async () => {
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
