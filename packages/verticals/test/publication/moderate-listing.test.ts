import { PublicationStatusEnum as Status } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { closeListingFixRequest, requestListingFix } from '../../src/publication/fix-request';
import { liftModeration } from '../../src/publication/lift-moderation';
import { takeDownListing } from '../../src/publication/moderate-listing';
import { clock, listingId, makeHarness, userId, vertical } from './support';

const adminId = '00000000-0000-4000-8000-000000000099';
const base = (harness: ReturnType<typeof makeHarness>) => ({
    ...harness,
    clock,
    adminId,
    ownerId: userId,
    vertical,
    listingId,
    reason: '  corregir datos  ',
    correlationId: 'moderation-test'
});

describe('listing moderation gestures', () => {
    it('TEST:V6:11 takes down with lock, reread, write, event and notice and no inactivity write', async () => {
        const harness = makeHarness({ status: Status.PUBLISHED });
        const result = await takeDownListing(base(harness));
        expect(result).toMatchObject({ ok: true });
        expect(harness.calls).toEqual([
            'lock',
            'read',
            'readOpenFixRequest',
            'set',
            'event',
            'enqueueListingNotice',
            'commit',
            'revalidate'
        ]);
        expect(harness.getStatus()).toBe(Status.MODERATED);
        expect(harness.statusWrites[0]?.inactiveSince).toBeUndefined();
        expect(harness.listingNotices[0]?.template).toBe('verticals.listing-moderated');
    });

    it('TEST:V6:11 does not write or emit when PB10 loses its conditional update', async () => {
        const harness = makeHarness({ status: Status.DRAFT, setReturnsFalse: true });
        expect(await takeDownListing(base(harness))).toEqual({
            ok: false,
            reason: 'STATE_CHANGED'
        });
        expect(harness.calls).not.toContain('event');
        expect(harness.calls).not.toContain('enqueueListingNotice');
    });

    it('TEST:V6:11 rejects blank reasons without writing', async () => {
        const harness = makeHarness();
        expect(await takeDownListing({ ...base(harness), reason: '  ' })).toEqual({
            ok: false,
            reason: 'REASON_REQUIRED'
        });
        expect(harness.calls).toEqual([]);
    });

    it('TEST:V6:11 does not revalidate a DRAFT take down', async () => {
        const harness = makeHarness({ status: Status.DRAFT });
        await takeDownListing(base(harness));
        expect(harness.calls).not.toContain('revalidate');
    });

    it('TEST:V6:11 opens a fix request without changing status and rejects a duplicate', async () => {
        const harness = makeHarness({ status: Status.PUBLISHED });
        const result = await requestListingFix({ ...base(harness), suggestedDate: null });
        expect(result).toMatchObject({ ok: true, warnings: [] });
        expect(harness.getStatus()).toBe(Status.PUBLISHED);
        expect(harness.calls).toContain('fixRequestEvent');
        expect(await requestListingFix({ ...base(harness), suggestedDate: null })).toEqual({
            ok: false,
            reason: 'ALREADY_OPEN'
        });
    });

    it('TEST:V6:11 rejects invalid states for each gesture', async () => {
        const purged = makeHarness({ status: Status.PURGED });
        expect(await requestListingFix({ ...base(purged), suggestedDate: null })).toEqual({
            ok: false,
            reason: 'INVALID_FROM'
        });
        expect(
            await closeListingFixRequest(base(makeHarness({ status: Status.MODERATED })))
        ).toEqual({ ok: false, reason: 'INVALID_FROM' });
        expect(
            await liftModeration({
                ...base(makeHarness({ status: Status.DRAFT })),
                billing: makeHarness().billing,
                keepFixRequest: false
            })
        ).toEqual({ ok: false, reason: 'INVALID_FROM' });
        expect(await takeDownListing(base(makeHarness({ status: Status.PURGED })))).toEqual({
            ok: false,
            reason: 'INVALID_FROM'
        });
    });

    it('TEST:V6:11 reads coverage for PB13 inside the owner lock', async () => {
        const harness = makeHarness({
            status: Status.MODERATED,
            covered: true,
            recordBillingCalls: true,
            moderationOrigin: { from: Status.PUBLISHED, archiveOrigin: null }
        });
        const result = await liftModeration({
            ...base(harness),
            billing: harness.billing,
            keepFixRequest: false
        });
        expect(result).toMatchObject({ ok: true, transition: 'PB13' });
        expect(harness.calls.indexOf('lock')).toBeLessThan(harness.calls.indexOf('coverage'));
        expect(harness.calls).toContain('declaredLimit');
    });

    it('TEST:V6:11 changes from request to moderation and back to request before closing it', async () => {
        const harness = makeHarness({
            status: Status.PUBLISHED,
            covered: true,
            moderationOrigin: { from: Status.PUBLISHED, archiveOrigin: null }
        });
        expect(await requestListingFix({ ...base(harness), suggestedDate: null })).toMatchObject({
            ok: true
        });
        expect(await takeDownListing(base(harness))).toMatchObject({ ok: true });
        const lifted = await liftModeration({
            ...base(harness),
            billing: harness.billing,
            keepFixRequest: true
        });
        expect(lifted).toMatchObject({ ok: true, transition: 'PB13', fixRequestOpen: true });
        const closed = await closeListingFixRequest(base(harness));
        expect(closed).toMatchObject({ ok: true, warnings: [] });
        expect(harness.getStatus()).toBe(Status.PUBLISHED);
    });
});
