import type { Accommodation, Experience, Venue } from '@repo/schemas';
import { PublicationStatusEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { ExperienceModel } from '../../src/models/experience/experience.model.ts';
import { VenueModel } from '../../src/models/venue/venue.model.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

const accommodationModel = new AccommodationModel();
const venueModel = new VenueModel();
const experienceModel = new ExperienceModel();

afterAll(async () => closeTestPool());

describe('listing birth model integration (TEST:V6:19)', () => {
    it('writes accommodation birth state: DRAFT by default, the written status when given, current version and paired clock', async () => {
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
                destinationId: destination.id
            };
            const draft = await accommodationModel.create(
                { ...base, slug: `birth-d-${crypto.randomUUID()}` } as Partial<Accommodation>,
                tx
            );
            expect(draft.publicationStatus).toBe(PublicationStatusEnum.DRAFT);
            expect(draft.inactiveSince).toBeInstanceOf(Date);
            const current = await tx.execute(
                sql`SELECT max(version)::int AS version FROM vertical_deadline_version`
            );
            expect(draft.deadlinesVersion).toBe(current.rows[0]?.version);
            const published = await accommodationModel.create(
                {
                    ...base,
                    slug: `birth-p-${crypto.randomUUID()}`,
                    publicationStatus: PublicationStatusEnum.PUBLISHED
                } as Partial<Accommodation>,
                tx
            );
            expect(published.publicationStatus).toBe(PublicationStatusEnum.PUBLISHED);
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
            const row = await venueModel.create(
                {
                    name: 'Birth restaurant',
                    slug: `birth-g-${crypto.randomUUID()}`,
                    summary: 'Summary',
                    description: 'Description',
                    type: 'RESTAURANT',
                    ownerId: user.id,
                    destinationId: destination.id
                } as Partial<Venue>,
                tx
            );
            expect(row.publicationStatus).toBe(PublicationStatusEnum.DRAFT);
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
                    destinationId: destination.id
                } as Partial<Experience>,
                tx
            );
            expect(row.publicationStatus).toBe(PublicationStatusEnum.DRAFT);
            expect(row.inactiveSince).toBeInstanceOf(Date);
            const current = await tx.execute(
                sql`SELECT max(version)::int AS version FROM vertical_deadline_version`
            );
            expect(row.deadlinesVersion).toBe(current.rows[0]?.version);
        });
    });
});
