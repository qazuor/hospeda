import {
    AccommodationCreateInputSchema,
    AccommodationUpdateInputSchema,
    AmenityCreateInputSchema,
    AmenityUpdateInputSchema,
    AttractionCreateInputSchema,
    AttractionUpdateInputSchema,
    DestinationCreateInputSchema,
    DestinationUpdateInputSchema,
    EventCreateInputSchema,
    EventLocationCreateInputSchema,
    EventLocationUpdateInputSchema,
    EventOrganizerCreateInputSchema,
    EventOrganizerUpdateInputSchema,
    EventUpdateInputSchema,
    FeatureCreateInputSchema,
    FeatureUpdateInputSchema,
    PostCreateInputSchema,
    PostSponsorCreateInputSchema,
    PostSponsorUpdateInputSchema,
    PostUpdateInputSchema,
    TagCreateInputSchema,
    TagUpdateInputSchema,
    UserCreateInputSchema,
    UserUpdateInputSchema
} from '@repo/schemas';
import type { ZodSchema } from 'zod';

/** Supported entity types for form validation */
export type EntityType =
    | 'accommodation'
    | 'amenity'
    | 'attraction'
    | 'destination'
    | 'event'
    | 'eventLocation'
    | 'eventOrganizer'
    | 'feature'
    | 'post'
    | 'sponsor'
    | 'tag'
    | 'user';

/** Form mode determining which schema variant to use */
export type FormMode = 'create' | 'edit';

const SCHEMA_REGISTRY: Record<
    EntityType,
    { readonly create: ZodSchema; readonly edit: ZodSchema }
> = {
    accommodation: {
        create: AccommodationCreateInputSchema,
        edit: AccommodationUpdateInputSchema
    },
    amenity: {
        create: AmenityCreateInputSchema,
        edit: AmenityUpdateInputSchema
    },
    attraction: {
        create: AttractionCreateInputSchema,
        edit: AttractionUpdateInputSchema
    },
    destination: {
        create: DestinationCreateInputSchema,
        edit: DestinationUpdateInputSchema
    },
    event: {
        create: EventCreateInputSchema,
        edit: EventUpdateInputSchema
    },
    eventLocation: {
        create: EventLocationCreateInputSchema,
        edit: EventLocationUpdateInputSchema
    },
    eventOrganizer: {
        create: EventOrganizerCreateInputSchema,
        edit: EventOrganizerUpdateInputSchema
    },
    feature: {
        create: FeatureCreateInputSchema,
        edit: FeatureUpdateInputSchema
    },
    post: {
        create: PostCreateInputSchema,
        edit: PostUpdateInputSchema
    },
    sponsor: {
        create: PostSponsorCreateInputSchema,
        edit: PostSponsorUpdateInputSchema
    },
    tag: {
        create: TagCreateInputSchema,
        edit: TagUpdateInputSchema
    },
    user: {
        create: UserCreateInputSchema,
        edit: UserUpdateInputSchema
    }
};

/**
 * Returns the Zod schema for a given entity type and form mode.
 *
 * Accepts `entityType` as a plain string for flexibility at call sites.
 * Returns `undefined` when the entity type is not registered.
 *
 * @param params.entityType - The entity type key (e.g. `'accommodation'`)
 * @param params.mode - `'create'` or `'edit'`
 * @returns The matching Zod schema, or `undefined` if the entity is unknown
 *
 * @example
 * const schema = getEntitySchema({ entityType: 'accommodation', mode: 'create' });
 * if (schema) {
 *     const result = schema.safeParse(data);
 * }
 */
export function getEntitySchema({
    entityType,
    mode
}: {
    readonly entityType: string;
    readonly mode: FormMode;
}): ZodSchema | undefined {
    const entry = SCHEMA_REGISTRY[entityType as EntityType];
    if (!entry) return undefined;
    return entry[mode === 'edit' ? 'edit' : 'create'];
}
