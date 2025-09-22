import { AccommodationModel } from '@repo/db';
import type { Accommodation, UserIdType } from '@repo/schemas';
import type { Mock } from 'vitest';
import { vi } from 'vitest';
import { AccommodationService } from '../../src/services/accommodation/accommodation.service';
import type { Actor } from '../../src/types';
import {
    AccommodationFactoryBuilder,
    createArchivedAccommodation,
    createDeletedAccommodation,
    createDraftAccommodation,
    createPendingAccommodation,
    createPublicAccommodation,
    createRejectedAccommodation
} from './accommodationFactory';
import {
    ActorFactoryBuilder,
    createAdminActor,
    createGuestActor,
    createHostActor,
    createSuperAdminActor
} from './actorFactory';

// Map actor and entity types to their respective factory functions
const actorFactoryMap = {
    guest: createGuestActor,
    host: createHostActor,
    admin: createAdminActor,
    superAdmin: createSuperAdminActor
};

const entityFactoryMap = {
    public: createPublicAccommodation,
    draft: createDraftAccommodation,
    pending: createPendingAccommodation,
    rejected: createRejectedAccommodation,
    archived: createArchivedAccommodation,
    deleted: createDeletedAccommodation
};

type ActorType = keyof typeof actorFactoryMap;
type EntityType = keyof typeof entityFactoryMap;

/**
 * Options for configuring a test scenario for AccommodationService.
 *
 * @property actorType - The type of actor to use (guest, host, admin, superAdmin). Default: 'guest'.
 * @property entityType - The type of accommodation entity to use (public, draft, pending, rejected, archived, deleted). Default: 'public'.
 * @property isOwner - Whether the actor should be set as the owner of the entity. Default: false.
 * @property actorOverrides - Partial overrides for the actor object.
 * @property entityOverrides - Partial overrides for the accommodation entity.
 * @property actor - (Advanced) A pre-built actor instance to use instead of building one.
 * @property entity - (Advanced) A pre-built accommodation entity to use instead of building one.
 */
interface ScenarioOptions {
    actorType?: ActorType;
    entityType?: EntityType;
    isOwner?: boolean;
    actorOverrides?: Partial<Actor>;
    entityOverrides?: Partial<Accommodation>;
    actor?: Actor;
    entity?: Accommodation;
}

/**
 * Creates a complete, robust test scenario for the AccommodationService.
 *
 * This factory orchestrates other factories/builders to set up:
 * 1. The Actor performing the action (using ActorFactoryBuilder or a provided actor).
 * 2. The Accommodation entity being acted upon (using AccommodationFactoryBuilder or a provided entity).
 * 3. Mocks for the AccommodationModel to return the entity.
 *
 * This allows for clean, declarative, and robust test setups for all service methods.
 *
 * @param options - Configuration for the scenario (see ScenarioOptions).
 * @returns An object containing:
 *   - service: The AccommodationService class (not an instance).
 *   - actor: The actor performing the action.
 *   - entity: The accommodation entity being acted upon.
 *   - mockModel: The mocked AccommodationModel.
 *
 * @example
 * // Using builders for full control
 * const { service, actor, entity } = createAccommodationScenario({
 *   actor: new ActorFactoryBuilder().host().withId('user-123').build(),
 *   entity: new AccommodationFactoryBuilder().public().withOwner('user-123').build()
 * });
 *
 * // Using legacy options for quick setup
 * const { service, actor, entity } = createAccommodationScenario({
 *   actorType: 'host',
 *   entityType: 'public',
 *   isOwner: true
 * });
 */
export const createAccommodationScenario = (options: ScenarioOptions = {}) => {
    const {
        actorType = 'guest',
        entityType = 'public',
        isOwner = false,
        actorOverrides = {},
        entityOverrides = {},
        actor, // New: allows passing a pre-built actor
        entity // New: allows passing a pre-built entity
    } = options as ScenarioOptions & { actor?: Actor; entity?: Accommodation };

    // 1. Create the actor using the builder or legacy factory
    const finalActor = actor
        ? actor
        : new ActorFactoryBuilder()[actorType]().withOverrides(actorOverrides).build();

    // 2. Create the entity using the builder or legacy factory, ensuring ownerId matches if isOwner is true
    let finalEntity: Accommodation;
    if (entity) {
        finalEntity = entity;
    } else {
        const ownerId = isOwner ? finalActor.id : undefined;
        const builder = new AccommodationFactoryBuilder()
            [entityType]()
            .withOverrides(entityOverrides);
        if (ownerId) builder.withOwner(ownerId as UserIdType);
        finalEntity = builder.build() as any; // Temporary cast for compatibility
    }

    // 3. Mock the database model to return the created entity
    (AccommodationModel as unknown as Record<string, Mock>).getById = vi.fn();
    (AccommodationModel as unknown as Record<string, Mock>).getByName = vi.fn();
    vi.spyOn(AccommodationModel as unknown as Record<string, Mock>, 'getById').mockResolvedValue(
        finalEntity
    );
    vi.spyOn(AccommodationModel as unknown as Record<string, Mock>, 'getByName').mockResolvedValue(
        finalEntity
    );

    return {
        service: AccommodationService,
        actor: finalActor,
        entity: finalEntity,
        mockModel: AccommodationModel
    };
};
