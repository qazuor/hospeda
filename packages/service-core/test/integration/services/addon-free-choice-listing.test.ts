import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { chooseFreeAddon } from '../../../src/services/billing/addon/choose-free-addon.service';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers';
import { freeChoiceFixture, retireFreeChoiceFixtures } from './support/addon-free-choice-fixtures';

afterEach(retireFreeChoiceFixtures);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B10:15 AC:B10:13 LISTING free choice', () => {
    it('hides foreign, incompatible, feature-ineligible, and missing listings', async () => {
        const f = await freeChoiceFixture({
            scopeType: 'LISTING',
            verticals: ['accommodation', 'venue']
        });
        const target = crypto.randomUUID();
        const listing = vi.fn(async () => ({
            ownerId: f.ownerId,
            vertical: VerticalEnum.ACCOMMODATION,
            acceptsFeature: true
        }));
        for (const response of [
            {
                ownerId: crypto.randomUUID(),
                vertical: VerticalEnum.ACCOMMODATION,
                acceptsFeature: true
            },
            { ownerId: f.ownerId, vertical: VerticalEnum.EXPERIENCE, acceptsFeature: true },
            // PURGED or MODERATED is decided by verticals through acceptsFeature.
            { ownerId: f.ownerId, vertical: VerticalEnum.ACCOMMODATION, acceptsFeature: false }
        ]) {
            listing.mockResolvedValueOnce(response);
            expect(
                await chooseFreeAddon(f.freeInput(crypto.randomUUID(), target), {
                    ...f.freePorts,
                    listing
                })
            ).toEqual({ outcome: 'REFUSED', reason: 'TARGET_NOT_FOUND' });
            expect(await f.instances()).toHaveLength(0);
        }
        const missing = vi.fn(async () => {
            const error = new Error('missing');
            error.name = 'ListingNotFoundError';
            throw error;
        });
        expect(
            await chooseFreeAddon(f.freeInput(crypto.randomUUID(), target), {
                ...f.freePorts,
                listing: missing
            })
        ).toEqual({ outcome: 'REFUSED', reason: 'TARGET_NOT_FOUND' });
        expect(await f.instances()).toHaveLength(0);
        expect(listing).toHaveBeenCalledTimes(3);
        expect(missing).toHaveBeenCalledTimes(1);
    });

    it('uses the listing contract answer and anchors only that listing vertical', async () => {
        const f = await freeChoiceFixture({
            scopeType: 'LISTING',
            verticals: ['accommodation', 'venue']
        });
        const target = crypto.randomUUID();
        const listing = vi.fn(async () => ({
            ownerId: f.ownerId,
            vertical: VerticalEnum.VENUE,
            acceptsFeature: true
        }));
        expect(
            await chooseFreeAddon(f.freeInput(crypto.randomUUID(), target), {
                ...f.freePorts,
                listing
            })
        ).toEqual({ outcome: 'REFUSED', reason: 'NO_FREE_TITLE' });
        expect(await f.instances()).toHaveLength(0);
        listing.mockResolvedValueOnce({
            ownerId: f.ownerId,
            vertical: VerticalEnum.ACCOMMODATION,
            acceptsFeature: true
        });
        const created = await chooseFreeAddon(f.freeInput(crypto.randomUUID(), target), {
            ...f.freePorts,
            listing
        });
        expect(created).toMatchObject({ outcome: 'CREATED', status: 'ACTIVE' });
        expect((await f.instances())[0]).toMatchObject({
            titleAnchorId: f.grant.anchorIds[0],
            targetId: target
        });
        expect(listing).toHaveBeenCalledTimes(2);
    });
});
