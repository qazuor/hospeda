import { AccommodationModel } from '@repo/db';
import type { AccommodationType, UserId } from '@repo/types';
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

interface ScenarioOptions {
    actorType?: ActorType;
    entityType?: EntityType;
    isOwner?: boolean;
    actorOverrides?: Partial<Actor>;
    entityOverrides?: Partial<AccommodationType>;
}

/**
 * Creates a complete test scenario for the AccommodationService.
 *
 * This factory orchestrates other factories/builders to set up:
 * 1. The Actor performing the action (using ActorFactoryBuilder).
 * 2. The Accommodation entity being acted upon (using AccommodationFactoryBuilder).
 * 3. Mocks for the AccommodationModel to return the entity.
 *
 * This allows for clean, declarative, and robust test setups.
 *
 * @param options - Configuration for the scenario.
 * @returns An object containing the service, actor, entity, and mocked model.
 *
 * @example
 * // Creates a scenario with a host who owns a public accommodation using builders
 * const { service, actor, entity } = createAccommodationScenario({
 *   actor: new ActorFactoryBuilder().host().withId('user-123').build(),
 *   entity: new AccommodationFactoryBuilder().public().withOwner('user-123').build()
 * });
 *
 * // Or using legacy options
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
        actor, // Nuevo: permite pasar un actor ya construido
        entity // Nuevo: permite pasar una entidad ya construida
    } = options as ScenarioOptions & { actor?: Actor; entity?: AccommodationType };

    // 1. Create the actor using the builder or legacy factory
    const finalActor = actor
        ? actor
        : new ActorFactoryBuilder()[actorType]().withOverrides(actorOverrides).build();

    // 2. Create the entity using the builder or legacy factory, ensuring ownerId matches if isOwner is true
    let finalEntity: AccommodationType;
    if (entity) {
        finalEntity = entity;
    } else {
        const ownerId = isOwner ? finalActor.id : undefined;
        const builder = new AccommodationFactoryBuilder()
            [entityType]()
            .withOverrides(entityOverrides);
        if (ownerId) builder.withOwner(ownerId as UserId);
        finalEntity = builder.build();
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
