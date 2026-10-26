import { randomUUID } from 'node:crypto';
import { destinations, getDb } from '@repo/db';

/**
 * Seeds `count` public ACTIVE destinations straight through Drizzle so public
 * list routes have real rows to serve. Call it per test: `testDb.clean()`
 * truncates between tests.
 *
 * @param input - Seeding options.
 * @param input.count - How many destinations to insert.
 * @returns The ids of the inserted destinations.
 */
export async function seedPublicDestinations({
    count
}: {
    readonly count: number;
}): Promise<readonly string[]> {
    const suffix = randomUUID().slice(0, 8);
    const rows = await getDb()
        .insert(destinations)
        .values(
            Array.from({ length: count }, (_, index) => ({
                slug: `seed-dest-${index}-${suffix}`,
                name: `Seed Destination ${index} ${suffix}`,
                summary: 'Destination seeded for public list integration tests.',
                description: 'Destination seeded for public list integration tests.',
                destinationType: 'CITY',
                path: `/seed-dest-${index}-${suffix}`,
                pathIds: '',
                level: 4,
                location: {
                    country: 'AR',
                    state: 'ER',
                    city: 'CDU',
                    coordinates: { lat: '-32.48', long: '-58.23' }
                }
            })) as (typeof destinations.$inferInsert)[]
        )
        .returning({ id: destinations.id });
    return rows.map((row) => row.id);
}
