import type { Accommodation, Experience, Gastronomy } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../../src/models/accommodation/accommodation.model.ts';
import { accountClosureModel } from '../../../src/models/account-closure/account-closure.model.ts';
import { ExperienceModel } from '../../../src/models/experience/experience.model.ts';
import { GastronomyModel } from '../../../src/models/gastronomy/gastronomy.model.ts';
import { destinations } from '../../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from '../helpers.ts';

afterAll(async () => closeTestPool());

type Vertical = 'accommodation' | 'gastronomy' | 'experience';

const TABLES: Record<Vertical, string> = {
    accommodation: 'accommodations',
    gastronomy: 'gastronomies',
    experience: 'experiences'
};

const CREATE: Record<
    Vertical,
    (args: {
        readonly tx: DrizzleClient;
        readonly base: Record<string, unknown>;
    }) => Promise<{ id: string }>
> = {
    accommodation: ({ tx, base }) =>
        new AccommodationModel().create({ ...base, type: 'CABIN' } as Partial<Accommodation>, tx),
    gastronomy: ({ tx, base }) =>
        new GastronomyModel().create({ ...base, type: 'RESTAURANT' } as Partial<Gastronomy>, tx),
    experience: ({ tx, base }) =>
        new ExperienceModel().create({ ...base, type: 'EXCURSION' } as Partial<Experience>, tx)
};

async function createListing(args: {
    readonly tx: DrizzleClient;
    readonly vertical: Vertical;
    readonly ownerId: string;
    readonly destinationId: string;
    readonly status: string;
    readonly deleted?: boolean;
}): Promise<string> {
    const { tx, vertical, ownerId, destinationId, status, deleted } = args;
    const listing = await CREATE[vertical]({
        tx,
        base: {
            name: `V8a ${crypto.randomUUID()}`,
            slug: `v8a-${crypto.randomUUID()}`,
            summary: 'summary',
            description: 'description',
            ownerId,
            destinationId
        }
    });
    await tx.execute(sql`UPDATE ${sql.identifier(TABLES[vertical])}
        SET publication_status = ${status},
            deleted_at = ${deleted ? sql`now()` : sql`NULL`}
        WHERE id = ${listing.id}`);
    return listing.id;
}

async function insertPartner(args: {
    readonly tx: DrizzleClient;
    readonly ownerUserId: string;
    readonly logoUrl?: string;
    readonly deleted?: boolean;
}): Promise<string> {
    const result = await args.tx.execute(sql`
        INSERT INTO partners (slug, name, type, owner_user_id, logo_url, deleted_at)
        VALUES (${`v8a-${crypto.randomUUID()}`}, 'V8a partner', 'business', ${args.ownerUserId},
            ${args.logoUrl ?? null}, ${args.deleted ? sql`now()` : sql`NULL`})
        RETURNING id`);
    return String(result.rows[0]?.id);
}

describe('TEST:V8a:12 the account closure locked reads (model)', () => {
    it('(a) locks the listings outside PURGED and nothing else', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const owner = testData.user();
            const stranger = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values([owner, stranger]);
            await tx.insert(destinations).values(destination);
            const common = { tx, ownerId: owner.id, destinationId: destination.id };
            const draft = await createListing({
                ...common,
                vertical: 'accommodation',
                status: 'DRAFT'
            });
            const archived = await createListing({
                ...common,
                vertical: 'gastronomy',
                status: 'ARCHIVED'
            });
            const moderated = await createListing({
                ...common,
                vertical: 'experience',
                status: 'MODERATED'
            });
            await createListing({ ...common, vertical: 'accommodation', status: 'PURGED' });
            await createListing({
                ...common,
                vertical: 'gastronomy',
                status: 'PUBLISHED',
                deleted: true
            });
            await createListing({
                ...common,
                ownerId: stranger.id,
                vertical: 'experience',
                status: 'PUBLISHED'
            });

            // Act
            const listings = await accountClosureModel.lockListingsNotPurged({
                tx,
                ownerId: owner.id
            });

            // Assert
            expect(listings).toEqual([
                { vertical: 'accommodation', id: draft },
                { vertical: 'gastronomy', id: archived },
                { vertical: 'experience', id: moderated }
            ]);
        });
    });

    it('(b) reads the live partner presence and whether it holds content', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const none = testData.user();
            const empty = testData.user();
            const withLogo = testData.user();
            const deleted = testData.user();
            await tx.insert(users).values([none, empty, withLogo, deleted]);
            const emptyId = await insertPartner({ tx, ownerUserId: empty.id });
            const logoId = await insertPartner({
                tx,
                ownerUserId: withLogo.id,
                logoUrl: 'https://cdn.test/logo.png'
            });
            await insertPartner({
                tx,
                ownerUserId: deleted.id,
                logoUrl: 'https://cdn.test/logo.png',
                deleted: true
            });

            // Act
            const read = (ownerUserId: string) =>
                accountClosureModel.lockPartnerPresence({ tx, ownerUserId });

            // Assert
            expect(await read(none.id)).toBeNull();
            expect(await read(empty.id)).toEqual({ partnerId: emptyId, hasContent: false });
            expect(await read(withLogo.id)).toEqual({ partnerId: logoId, hasContent: true });
            expect(await read(deleted.id)).toBeNull();
        });
    });

    it('(c) an unknown account id locks nothing', async () => {
        await withTestTransaction(async (tx) => {
            // Act
            const locked = await accountClosureModel.lockAccount({
                tx,
                userId: crypto.randomUUID()
            });

            // Assert
            expect(locked).toBeNull();
        });
    });

    it('(d) a closed account is still read, with its deleted_at, so the service answers 404', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const closedAt = new Date('2026-10-01T00:00:00.000Z');
            const account = testData.user({ deletedAt: closedAt, isSystemAccount: true });
            await tx.insert(users).values(account);

            // Act
            const locked = await accountClosureModel.lockAccount({ tx, userId: account.id });

            // Assert
            expect(locked).toEqual({
                id: account.id,
                email: account.email,
                displayName: 'Test User',
                firstName: null,
                lastName: null,
                deletedAt: closedAt,
                isSystemAccount: true
            });
        });
    });
});
