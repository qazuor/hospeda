import { randomUUID } from 'node:crypto';
import { accommodations, destinations, getDb } from '@repo/db';
import { PublicationStatusEnum } from '@repo/schemas';
import { createTestUser } from '../../e2e/setup/seed-helpers';

/** Rows created by {@link seedPublicAccommodation}. */
export interface SeededPublicAccommodation {
    /** Accommodation id. */
    readonly id: string;
    /** Accommodation slug. */
    readonly slug: string;
    /** Accommodation display name. */
    readonly name: string;
    /** Owner user id. */
    readonly ownerId: string;
    /** Destination id the accommodation belongs to. */
    readonly destinationId: string;
}

/** Input for {@link seedPublicAccommodation}. */
export interface SeedPublicAccommodationInput {
    /** Overrides the generated name. */
    readonly name?: string;
    /** Overrides the generated slug. */
    readonly slug?: string;
    /** Marks the accommodation as featured by entitlement. Defaults to false. */
    readonly isFeatured?: boolean;
    /** Average rating column value (0-5). Defaults to the column default. */
    readonly averageRating?: number;
    /** Reuses this owner instead of creating one (lets a test seed many rows cheaply). */
    readonly ownerId?: string;
    /** Reuses this destination instead of creating one. */
    readonly destinationId?: string;
}

/**
 * Seeds one PUBLISHED accommodation (plus the owner and destination it needs)
 * straight through Drizzle, so public read routes have a real row to serve.
 * Call it per test: `testDb.clean()` truncates between tests.
 *
 * @param input - Optional overrides.
 * @returns Ids and identifying fields of the seeded rows.
 */
export async function seedPublicAccommodation(
    input: SeedPublicAccommodationInput = {}
): Promise<SeededPublicAccommodation> {
    const db = getDb();
    const suffix = randomUUID().slice(0, 8);
    const ownerId =
        input.ownerId ??
        (
            await createTestUser({
                email: `seed-acc-owner-${suffix}@example.test`,
                slug: `seed-acc-owner-${suffix}`
            })
        ).id;

    const destinationRows = input.destinationId
        ? [{ id: input.destinationId }]
        : await db
              .insert(destinations)
              .values({
                  slug: `seed-acc-dest-${suffix}`,
                  name: `Seed Accommodation Destination ${suffix}`,
                  summary: 'Destination seeded for public accommodation integration tests.',
                  description: 'Destination seeded for public accommodation integration tests.',
                  destinationType: 'CITY',
                  path: `/seed-acc-dest-${suffix}`,
                  pathIds: '',
                  level: 4,
                  location: { country: 'AR', state: 'ER', city: 'CDU' }
              } as typeof destinations.$inferInsert)
              .returning({ id: destinations.id });
    const destinationId = destinationRows[0]?.id;
    if (!destinationId) throw new Error('seedPublicAccommodation: destination insert failed');

    const slug = input.slug ?? `seed-acc-${suffix}`;
    const name = input.name ?? `Seed Accommodation ${suffix}`;
    const rows = await db
        .insert(accommodations)
        .values({
            slug,
            name,
            summary: 'Accommodation seeded for public integration tests.',
            description: 'Accommodation seeded for the public integration tests of the API.',
            type: 'HOTEL',
            ownerId,
            destinationId,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            inactiveSince: new Date(),
            deadlinesVersion: 1,
            featuredByEntitlement: input.isFeatured ?? false,
            ...(input.averageRating === undefined ? {} : { averageRating: input.averageRating })
        } as typeof accommodations.$inferInsert)
        .returning({ id: accommodations.id });
    const id = rows[0]?.id;
    if (!id) throw new Error('seedPublicAccommodation: accommodation insert failed');

    return { id, slug, name, ownerId, destinationId };
}
