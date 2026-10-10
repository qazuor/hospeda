import type { Accommodation, Experience, Gastronomy } from '@repo/schemas';
import { PublicationStatusEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { ExperienceModel } from '../../src/models/experience/experience.model.ts';
import { GastronomyModel } from '../../src/models/gastronomy/gastronomy.model.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

const accommodationModel = new AccommodationModel();
const gastronomyModel = new GastronomyModel();
const experienceModel = new ExperienceModel();

afterAll(async () => closeTestPool());

describe('listing birth model integration (TEST:V6:19)', () => {
    it('writes accommodation birth state from the bridge, current version and paired clock', async () => {
        await withTestTransaction(async (tx) => {
            const user = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values(user);
            await tx.insert(destinations).values(destination);
            const base = {
                name: 'Birth accommodation',
                summary: 'Summary',
                description: 'Description',
                type: 'CABIN',
                ownerId: user.id,
                destinationId: destination.id,
                lifecycleState: 'ACTIVE',
                visibility: 'PUBLIC'
            };
            const published = await accommodationModel.create(
                { ...base, slug: `birth-a-${crypto.randomUUID()}` } as Partial<Accommodation>,
                tx
            );
            expect(published.publicationStatus).toBe(PublicationStatusEnum.PUBLISHED);
            expect(published.inactiveSince).toBeInstanceOf(Date);
            const current = await tx.execute(
                sql`SELECT max(version)::int AS version FROM vertical_deadline_version`
            );
            expect(published.deadlinesVersion).toBe(current.rows[0]?.version);
            const restricted = await accommodationModel.create(
                {
                    ...base,
                    slug: `birth-r-${crypto.randomUUID()}`,
                    planRestricted: true
                } as Partial<Accommodation>,
                tx
            );
            expect(restricted.publicationStatus).toBe(PublicationStatusEnum.DRAFT);
            const explicit = await accommodationModel.create(
                {
                    ...base,
                    slug: `birth-e-${crypto.randomUUID()}`,
                    publicationStatus: 'MODERATED'
                } as Partial<Accommodation>,
                tx
            );
            expect(explicit.publicationStatus).toBe(PublicationStatusEnum.MODERATED);
            await expect(
                accommodationModel.create(
                    {
                        ...base,
                        slug: `birth-i-${crypto.randomUUID()}`,
                        inactiveSince: new Date()
                    } as Partial<Accommodation>,
                    tx
                )
            ).rejects.toThrow('inactiveSince and deadlinesVersion are written together');
        });
    });

    it('writes gastronomy birth state and its current deadline version', async () => {
        await withTestTransaction(async (tx) => {
            const user = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values(user);
            await tx.insert(destinations).values(destination);
            const row = await gastronomyModel.create(
                {
                    name: 'Birth restaurant',
                    slug: `birth-g-${crypto.randomUUID()}`,
                    summary: 'Summary',
                    description: 'Description',
                    type: 'RESTAURANT',
                    ownerId: user.id,
                    destinationId: destination.id,
                    lifecycleState: 'ACTIVE',
                    visibility: 'PUBLIC'
                } as Partial<Gastronomy>,
                tx
            );
            expect(row.publicationStatus).toBe(PublicationStatusEnum.PUBLISHED);
            expect(row.inactiveSince).toBeInstanceOf(Date);
            const current = await tx.execute(
                sql`SELECT max(version)::int AS version FROM vertical_deadline_version`
            );
            expect(row.deadlinesVersion).toBe(current.rows[0]?.version);
        });
    });

    it('writes experience birth state and its current deadline version', async () => {
        await withTestTransaction(async (tx) => {
            const user = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values(user);
            await tx.insert(destinations).values(destination);
            const row = await experienceModel.create(
                {
                    name: 'Birth excursion',
                    slug: `birth-x-${crypto.randomUUID()}`,
                    summary: 'Summary',
                    description: 'Description',
                    type: 'EXCURSION',
                    ownerId: user.id,
                    destinationId: destination.id,
                    lifecycleState: 'ACTIVE',
                    visibility: 'PUBLIC'
                } as Partial<Experience>,
                tx
            );
            expect(row.publicationStatus).toBe(PublicationStatusEnum.PUBLISHED);
            expect(row.inactiveSince).toBeInstanceOf(Date);
            const current = await tx.execute(
                sql`SELECT max(version)::int AS version FROM vertical_deadline_version`
            );
            expect(row.deadlinesVersion).toBe(current.rows[0]?.version);
        });
    });
});
