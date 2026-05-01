import type { Accommodation, ApproximateLocationType, CityDestinationRef } from '@repo/schemas';
import { CityDestinationRefSchema, PermissionEnum } from '@repo/schemas';
import type { Actor } from '../../types';
import { obfuscateCoordinates } from '../../utils/location-obfuscation';

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

/**
 * Computes a privacy-aware `approximateLocation` field for an accommodation
 * based on its exact stored coordinates and the server-side
 * `HOSPEDA_LOCATION_SALT`. Used for public/anonymous response shapes where
 * exposing the exact pin would violate host privacy.
 *
 * The returned object contains the obfuscated circle center plus its radius;
 * callers are responsible for stripping the original `coordinates` from the
 * outgoing payload (the public response schema enforces this at the API
 * boundary).
 *
 * Returns an empty object when the entity has no coordinates or the stored
 * lat/long strings cannot be parsed as finite numbers.
 *
 * @example
 * ```ts
 * const projection = projectAccommodationApproximateLocation(accommodation, {
 *   salt: env.HOSPEDA_LOCATION_SALT,
 * });
 * const responsePayload = { ...accommodation, ...projection };
 * ```
 */
export function projectAccommodationApproximateLocation(
    entity: Pick<Accommodation, 'id' | 'location'> | null,
    options: { salt: string }
): { approximateLocation?: ApproximateLocationType } {
    if (!entity?.location?.coordinates) return {};
    const lat = Number.parseFloat(entity.location.coordinates.lat);
    const lng = Number.parseFloat(entity.location.coordinates.long);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return {};
    return {
        approximateLocation: obfuscateCoordinates({
            exactLat: lat,
            exactLng: lng,
            accommodationId: entity.id,
            salt: options.salt
        })
    };
}

const SENSITIVE_LOCATION_FIELDS = [
    'street',
    'number',
    'floor',
    'apartment',
    'coordinates'
] as const;

/**
 * Determines whether the given actor is allowed to see exact accommodation
 * location data (precise lat/long, street address, floor, apartment).
 *
 * Returns `true` when:
 * - The actor holds `ACCOMMODATION_LOCATION_EXACT_VIEW` (admins, super-admins).
 * - The actor is the owner of the accommodation (host viewing their own).
 *
 * Returns `false` for anonymous visitors and logged-in users without the
 * permission and without ownership.
 */
export function canViewExactLocation(actor: Actor | null | undefined, ownerId?: string): boolean {
    if (!actor?.id) return false;
    if (actor.permissions.includes(PermissionEnum.ACCOMMODATION_LOCATION_EXACT_VIEW)) {
        return true;
    }
    if (ownerId && actor.id === ownerId) return true;
    return false;
}

/**
 * Applies the privacy-aware location projection to a single accommodation:
 * 1) Computes `approximateLocation` (always — useful for admin preview).
 * 2) When the actor cannot view exact location, strips sensitive fields
 *    (`coordinates`, `street`, `number`, `floor`, `apartment`) from the
 *    embedded `location` object so they never reach the wire payload.
 *
 * The original entity is not mutated. Returns the entity unchanged when there
 * is no location or no coordinates to obfuscate.
 */
export function applyAccommodationLocationPrivacy<
    T extends Pick<Accommodation, 'id' | 'location'> & { ownerId?: string }
>(entity: T | null, args: { actor: Actor | null | undefined; salt: string }): T | null {
    if (!entity) return entity;
    const projection = projectAccommodationApproximateLocation(entity, { salt: args.salt });
    const allowExact = canViewExactLocation(args.actor, entity.ownerId);

    if (allowExact) {
        return { ...entity, ...projection };
    }

    if (!entity.location) return { ...entity, ...projection };
    const sanitizedLocation: Record<string, unknown> = { ...(entity.location as object) };
    for (const field of SENSITIVE_LOCATION_FIELDS) {
        delete sanitizedLocation[field];
    }
    return {
        ...entity,
        location: sanitizedLocation,
        ...projection
    } as T;
}

/**
 * List variant of {@link applyAccommodationLocationPrivacy}.
 */
export function applyAccommodationLocationPrivacyList<
    T extends Pick<Accommodation, 'id' | 'location'> & { ownerId?: string }
>(entities: T[], args: { actor: Actor | null | undefined; salt: string }): T[] {
    return entities.map((entity) => applyAccommodationLocationPrivacy(entity, args) as T);
}
