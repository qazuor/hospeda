import { expect, test } from '@playwright/test';
import { PublicationStatusEnum } from '@repo/schemas';
import {
    type CreatedUser,
    createAccommodation,
    createUser,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
import { cleanupArrearsRows, runCron } from '../../fixtures/arrears-cycle.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import {
    createFeaturedDestination,
    deleteFeaturedDestination,
    readFeaturedFlag,
    readPublicList
} from '../../fixtures/listing-featured.ts';
import { renameListing } from '../../fixtures/listing-notices.ts';
import { seedActivePlanHolder } from '../../fixtures/signup-checkout.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

/** TEST:HOS-2138:3 proves daily coverage reconciliation respects plan and trial sources. */
test.describe('TEST:HOS-2138:3 the daily reconciler features paid plans, never trials @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(300_000);
    let userIds: string[] = [];
    let destinationId = '';
    let admin: CreatedUser;

    test.beforeEach(async () => {
        userIds = [];
        admin = await createUser({ role: 'SUPER_ADMIN' });
        userIds.push(admin.id);
        const destination = await createFeaturedDestination();
        destinationId = destination.id;
    });

    test.afterEach(async () => {
        try {
            await cleanupArrearsRows({ userIds });
            await cleanupTestUsers(getDbPool(), userIds);
            if (destinationId) await deleteFeaturedDestination({ id: destinationId });
        } finally {
            userIds = [];
            destinationId = '';
        }
    });

    test('paid Pro and Premium feature after reconciliation while Basic and trial stay unfeatured', async () => {
        const pro = await makeOwner('P');
        const premium = await makeOwner('Q');
        const basic = await makeOwner('B');
        const trial = await makeOwner('T');
        await seedActivePlanHolder({ userId: pro.id, slug: 'owner-pro' });
        await seedActivePlanHolder({ userId: premium.id, slug: 'owner-premium' });
        await seedActivePlanHolder({ userId: basic.id, slug: 'owner-basico' });

        const listings = await Promise.all([
            listing({ user: pro, label: '2-P' }),
            listing({ user: premium, label: '3-Q' }),
            listing({ user: basic, label: '1-B' }),
            listing({ user: trial, label: '4-T', withTrial: true })
        ]);
        const [p, q, b, t] = listings;
        expect(
            await Promise.all(
                listings.map(({ id }) => readFeaturedFlag({ table: 'accommodations', id }))
            )
        ).toEqual([false, false, false, false]);
        expect(await readPublicList({ vertical: 'accommodation', destinationId })).toEqual([
            { id: b.id, isFeatured: false },
            { id: p.id, isFeatured: false },
            { id: q.id, isFeatured: false },
            { id: t.id, isFeatured: false }
        ]);

        await runCron({ jobName: 'listing-coverage-reconciler', adminCookie: admin.sessionCookie });
        expect(await readFeaturedFlag({ table: 'accommodations', id: p.id })).toBe(true);
        expect(await readFeaturedFlag({ table: 'accommodations', id: q.id })).toBe(true);
        expect(await readFeaturedFlag({ table: 'accommodations', id: b.id })).toBe(false);
        expect(await readFeaturedFlag({ table: 'accommodations', id: t.id })).toBe(false);
        expect(await readPublicList({ vertical: 'accommodation', destinationId })).toEqual([
            { id: p.id, isFeatured: true },
            { id: q.id, isFeatured: true },
            { id: b.id, isFeatured: false },
            { id: t.id, isFeatured: false }
        ]);
        expect(await Promise.all(listings.map(({ id }) => publicationStatus(id)))).toEqual([
            'PUBLISHED',
            'PUBLISHED',
            'PUBLISHED',
            'PUBLISHED'
        ]);
    });

    async function makeOwner(label: string): Promise<CreatedUser> {
        const user = await createUser({ role: 'HOST' });
        userIds.push(user.id);
        await markProfileCompleted({ userId: user.id });
        await execSQL('UPDATE users SET first_name = $2 WHERE id = $1', [
            user.id,
            `HOS-2138 ${label}`
        ]);
        return user;
    }

    async function listing(args: {
        readonly user: CreatedUser;
        readonly label: string;
        readonly withTrial?: boolean;
    }): Promise<{ readonly id: string }> {
        const created = await createAccommodation({
            ownerId: args.user.id,
            destinationId,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            withTrial: args.withTrial ?? false
        });
        await renameListing({ listingId: created.id, name: `HOS-2138 ${args.label}` });
        return created;
    }

    async function publicationStatus(id: string): Promise<string | undefined> {
        const rows = await execSQL<{ publication_status: string }>(
            'SELECT publication_status FROM accommodations WHERE id = $1',
            [id]
        );
        return rows[0]?.publication_status;
    }
});
