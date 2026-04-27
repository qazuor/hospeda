import type { Accommodation, CityDestinationRef } from '@repo/schemas';
import { CityDestinationRefSchema } from '@repo/schemas';

/**
 * Projects an accommodation's eager-loaded `destination` relation into a
 * lightweight `cityDestination` field that matches the public response shape
 * (SPEC-095). The original `destination` relation is kept on the entity so
 * internal consumers continue to work; the API boundary's response-schema
 * parse strips it from the wire payload.
 *
 * If the entity does not carry a `destination` relation (e.g. fetched without
 * `with: { destination: true }`), or the relation does not satisfy
 * `CityDestinationRefSchema`, the entity is returned unchanged.
 */
export function projectAccommodationCityDestination<T extends Accommodation>(
    entity: T | null
): T | null {
    if (!entity) return entity;
    const dest = (entity as { destination?: unknown }).destination;
    if (!dest) return entity;
    const parsed = CityDestinationRefSchema.safeParse(dest);
    if (!parsed.success) return entity;
    return {
        ...entity,
        cityDestination: parsed.data satisfies CityDestinationRef
    } as T;
}

/**
 * Plural helper for arrays returned by list/search/adminList.
 */
export function projectAccommodationCityDestinationList<T extends Accommodation>(
    entities: T[]
): T[] {
    return entities.map((entity) => projectAccommodationCityDestination(entity) as T);
}
