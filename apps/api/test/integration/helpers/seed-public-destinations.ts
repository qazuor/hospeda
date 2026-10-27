import { randomUUID } from 'node:crypto';
import { destinations, getDb } from '@repo/db';

/** Result of {@link seedPublicDestinations}. */
export interface SeedPublicDestinationsResult {
    /** Inserted destinations, in insertion order. */
    readonly destinations: readonly { readonly id: string; readonly slug: string }[];
}

/**
 * Seeds `count` public ACTIVE destinations straight through Drizzle so public
 * list routes have real rows to serve. Call it per test: `testDb.clean()`
 * truncates between tests.
 *
 * @param input - Seeding options.
 * @param input.count - How many destinations to insert. Zero inserts nothing.
 * @param input.city - Optional `location.city` stamped on every inserted row.
 * @returns The inserted destinations.
 * @throws {RangeError} When `count` is negative or not an integer.
 */
export async function seedPublicDestinations({
    count,
    city
}: {
    readonly count: number;
    readonly city?: string;
}): Promise<SeedPublicDestinationsResult> {
    if (!Number.isInteger(count) || count < 0) {
        throw new RangeError(`seedPublicDestinations: invalid count ${count}`);
    }
    if (count === 0) return { destinations: [] };

    const suffix = randomUUID().slice(0, 8);
    const rows = await getDb()
        .insert(destinations)
        .values(
            Array.from({ length: count }, (_, index) => ({
                slug: `seed-dest-${index}-${suffix}`,
                name: `Seed Destination ${index} ${suffix}`,
                summary: 'Destination seeded for public list integration tests.',
                description: 'Destination seeded for public list integration tests.',
                destinationType: 'CITY' as const,
                path: `/seed-dest-${index}-${suffix}`,
                pathIds: '',
                level: 4,
                location: {
                    country: 'AR',
                    state: 'ER',
                    ...(city ? { city } : {}),
                    coordinates: { lat: '-32.48', long: '-58.23' }
                }
            }))
        )
        .returning({ id: destinations.id, slug: destinations.slug });
    return { destinations: rows };
}
