import { REntityTagModel, TagModel, UserModel } from '@repo/db';
import { EntityTypeEnum, TagTypeEnum } from '@repo/schemas';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Minimal interface for tag model operations used by E-3.
 *
 * @internal
 */
export interface TagModelPort {
    findOne(filter: Partial<Record<string, unknown>>): Promise<Record<string, unknown> | null>;
}

/**
 * Minimal interface for user model operations used by E-3.
 *
 * @internal
 */
export interface UserModelPort {
    findOne(filter: Partial<Record<string, unknown>>): Promise<Record<string, unknown> | null>;
}

/**
 * Minimal interface for entity lookup — used to resolve seed IDs for
 * accommodations, posts, destinations, and events.
 *
 * @internal
 */
export interface GenericEntityModelPort {
    findOne(filter: Partial<Record<string, unknown>>): Promise<Record<string, unknown> | null>;
}

/**
 * Minimal interface for the r_entity_tag join model.
 *
 * @internal
 */
export interface REntityTagModelPort {
    findOne(filter: Partial<Record<string, unknown>>): Promise<Record<string, unknown> | null>;
    create(data: Partial<Record<string, unknown>>): Promise<Record<string, unknown>>;
}

/**
 * All entity model overrides accepted by `seedEntityTagAssignments`.
 *
 * Tests may inject fakes for any or all of these models.
 *
 * @internal
 */
export interface EntityTagSeedModels {
    tagModel?: TagModelPort;
    userModel?: UserModelPort;
    accommodationModel?: GenericEntityModelPort;
    postModel?: GenericEntityModelPort;
    destinationModel?: GenericEntityModelPort;
    eventModel?: GenericEntityModelPort;
    rEntityTagModel?: REntityTagModelPort;
}

/**
 * A single entity-tag assignment to create.
 *
 * `assignedBySlug` is the user's `slug` column value (stable, preserved as-is
 * from the fixture file). We use slug instead of the fixture seed ID because
 * the fixture `id` field (e.g. "004-user-ana-rodríguez") is a non-UUID seed
 * identifier, not the real UUID stored in `users.id`.
 *
 * `entityLookupKey` is the stable display name of the entity:
 * - ACCOMMODATION / DESTINATION / EVENT: `name` column (preserved from fixture)
 * - POST: `title` column (preserved from fixture)
 * - USER: `slug` column (preserved from fixture)
 *
 * @internal
 */
interface EntityTagAssignmentDef {
    /** Display name for logging. */
    label: string;
    /** Slug of the user who assigns the tag (stable, preserved in DB). */
    assignedBySlug: string;
    /** Tag name as it appears in the DB (INTERNAL or SYSTEM type). */
    tagName: string;
    /** Tag type used for lookup (INTERNAL or SYSTEM). */
    tagType: TagTypeEnum.INTERNAL | TagTypeEnum.SYSTEM;
    /**
     * Stable lookup key for the entity:
     * - ACCOMMODATION / DESTINATION / EVENT: entity `name` value
     * - POST: post `title` value
     * - USER: user `slug` value
     */
    entityLookupKey: string;
    /** EntityType discriminator used in r_entity_tag. */
    entityType: EntityTypeEnum;
}

/**
 * E-3 assignment definitions.
 *
 * Source of truth: tag-seeds.md § Example Assignments (E-3).
 *
 * HOST (slug: ana-rodríguez) → applies SYSTEM tags to own accommodations:
 *   Favorito, Importante, Revisar luego, Mejorar fotos, Revisar precio → acc-1 / acc-2 / acc-3
 *   Cliente potencial → USER entity (guest slug: usuario-invitado)
 *
 * EDITOR (slug: carlos-martínez) → applies SYSTEM tags to own posts:
 *   Borrador × 2, Listo para publicar, Revisar luego, Pendiente, Mejorar contenido → posts 1-5
 *
 * ADMIN (slug: admin-user) → applies INTERNAL + SYSTEM tags across entities.
 *
 * Entity name mapping (DB `name`/`title`/`slug` columns, all preserved from fixtures):
 *   acc-1  → name: "Retiro Soleado"
 *   acc-2  → name: "Rio Soleado Cabaña"
 *   acc-3  → name: "Sendero Natural Country House"
 *   post-1 → title: "Los 10 Destinos Imperdibles de Entre Ríos en 2024"
 *   post-2 → title: "Gastronomía Entrerriana: Sabores Auténticos del Litoral"
 *   post-3 → title: "El Carnaval de Gualeguaychú: Un Espectáculo de Color y Tradición"
 *   post-draft-1 → title: "Termas de Federación: Tu Refugio de Relax y Bienestar"
 *   post-draft-2 → title: "Aventura en el Delta del Paraná: Ecoturismo en Estado Puro"
 *   dest-1 → name: "Chajarí"
 *   dest-2 → name: "Colón"
 *   event-2 → name: "Encuentro de Historia en Palacio San José 2025"
 *   host-user → slug: "ana-rodríguez" (HOST test user as USER entity target for ADMIN)
 *   guest-user → slug: "usuario-invitado" (GUEST user as CLIENT POTENCIAL target for HOST)
 *
 * @internal
 */
const ENTITY_TAG_ASSIGNMENTS: ReadonlyArray<EntityTagAssignmentDef> = [
    // -------------------------------------------------------------------------
    // HOST (slug: ana-rodríguez) → SYSTEM tags on own accommodations
    // -------------------------------------------------------------------------
    {
        label: 'HOST: Favorito → acc-1',
        assignedBySlug: 'ana-rodríguez',
        tagName: 'Favorito',
        tagType: TagTypeEnum.SYSTEM,
        entityLookupKey: 'Retiro Soleado',
        entityType: EntityTypeEnum.ACCOMMODATION
    },
    {
        label: 'HOST: Favorito → acc-2',
        assignedBySlug: 'ana-rodríguez',
        tagName: 'Favorito',
        tagType: TagTypeEnum.SYSTEM,
        entityLookupKey: 'Rio Soleado Cabaña',
        entityType: EntityTypeEnum.ACCOMMODATION
    },
    {
        label: 'HOST: Importante → acc-1',
        assignedBySlug: 'ana-rodríguez',
        tagName: 'Importante',
        tagType: TagTypeEnum.SYSTEM,
        entityLookupKey: 'Retiro Soleado',
        entityType: EntityTypeEnum.ACCOMMODATION
    },
    {
        label: 'HOST: Revisar luego → acc-3',
        assignedBySlug: 'ana-rodríguez',
        tagName: 'Revisar luego',
        tagType: TagTypeEnum.SYSTEM,
        entityLookupKey: 'Sendero Natural Country House',
        entityType: EntityTypeEnum.ACCOMMODATION
    },
    {
        label: 'HOST: Mejorar fotos → acc-2',
        assignedBySlug: 'ana-rodríguez',
        tagName: 'Mejorar fotos',
        tagType: TagTypeEnum.SYSTEM,
        entityLookupKey: 'Rio Soleado Cabaña',
        entityType: EntityTypeEnum.ACCOMMODATION
    },
    {
        label: 'HOST: Revisar precio → acc-1',
        assignedBySlug: 'ana-rodríguez',
        tagName: 'Revisar precio',
        tagType: TagTypeEnum.SYSTEM,
        entityLookupKey: 'Retiro Soleado',
        entityType: EntityTypeEnum.ACCOMMODATION
    },
    {
        label: 'HOST: Cliente potencial → guest user',
        assignedBySlug: 'ana-rodríguez',
        tagName: 'Cliente potencial',
        tagType: TagTypeEnum.SYSTEM,
        entityLookupKey: 'usuario-invitado',
        entityType: EntityTypeEnum.USER
    },
    // -------------------------------------------------------------------------
    // EDITOR (slug: carlos-martínez) → SYSTEM tags on own posts
    // -------------------------------------------------------------------------
    {
        label: 'EDITOR: Borrador → post-draft-1',
        assignedBySlug: 'carlos-martínez',
        tagName: 'Borrador',
        tagType: TagTypeEnum.SYSTEM,
        entityLookupKey: 'Termas de Federación: Tu Refugio de Relax y Bienestar',
        entityType: EntityTypeEnum.POST
    },
    {
        label: 'EDITOR: Borrador → post-draft-2',
        assignedBySlug: 'carlos-martínez',
        tagName: 'Borrador',
        tagType: TagTypeEnum.SYSTEM,
        entityLookupKey: 'Aventura en el Delta del Paraná: Ecoturismo en Estado Puro',
        entityType: EntityTypeEnum.POST
    },
    {
        label: 'EDITOR: Listo para publicar → post-1',
        assignedBySlug: 'carlos-martínez',
        tagName: 'Listo para publicar',
        tagType: TagTypeEnum.SYSTEM,
        entityLookupKey: 'Los 10 Destinos Imperdibles de Entre Ríos en 2024',
        entityType: EntityTypeEnum.POST
    },
    {
        label: 'EDITOR: Revisar luego → post-2',
        assignedBySlug: 'carlos-martínez',
        tagName: 'Revisar luego',
        tagType: TagTypeEnum.SYSTEM,
        entityLookupKey: 'Gastronomía Entrerriana: Sabores Auténticos del Litoral',
        entityType: EntityTypeEnum.POST
    },
    {
        label: 'EDITOR: Pendiente → post-3',
        assignedBySlug: 'carlos-martínez',
        tagName: 'Pendiente',
        tagType: TagTypeEnum.SYSTEM,
        entityLookupKey: 'El Carnaval de Gualeguaychú: Un Espectáculo de Color y Tradición',
        entityType: EntityTypeEnum.POST
    },
    {
        label: 'EDITOR: Mejorar contenido → post-draft-1',
        assignedBySlug: 'carlos-martínez',
        tagName: 'Mejorar contenido',
        tagType: TagTypeEnum.SYSTEM,
        entityLookupKey: 'Termas de Federación: Tu Refugio de Relax y Bienestar',
        entityType: EntityTypeEnum.POST
    },
    // -------------------------------------------------------------------------
    // ADMIN (slug: admin-user) → INTERNAL + SYSTEM tags across entities
    // -------------------------------------------------------------------------
    {
        label: 'ADMIN: Pendiente de aprobación (INTERNAL) → acc-3',
        assignedBySlug: 'admin-user',
        tagName: 'Pendiente de aprobación',
        tagType: TagTypeEnum.INTERNAL,
        entityLookupKey: 'Sendero Natural Country House',
        entityType: EntityTypeEnum.ACCOMMODATION
    },
    {
        label: 'ADMIN: Datos incompletos (INTERNAL) → dest-1',
        assignedBySlug: 'admin-user',
        tagName: 'Datos incompletos',
        tagType: TagTypeEnum.INTERNAL,
        entityLookupKey: 'Chajarí',
        entityType: EntityTypeEnum.DESTINATION
    },
    {
        label: 'ADMIN: Posible duplicado (INTERNAL) → event-2',
        assignedBySlug: 'admin-user',
        tagName: 'Posible duplicado',
        tagType: TagTypeEnum.INTERNAL,
        entityLookupKey: 'Encuentro de Historia en Palacio San José 2025',
        entityType: EntityTypeEnum.EVENT
    },
    {
        label: 'ADMIN: Revisar imágenes (INTERNAL) → post-3',
        assignedBySlug: 'admin-user',
        tagName: 'Revisar imágenes',
        tagType: TagTypeEnum.INTERNAL,
        entityLookupKey: 'El Carnaval de Gualeguaychú: Un Espectáculo de Color y Tradición',
        entityType: EntityTypeEnum.POST
    },
    {
        label: 'ADMIN: Cliente prioritario (INTERNAL) → host-user',
        assignedBySlug: 'admin-user',
        tagName: 'Cliente prioritario',
        tagType: TagTypeEnum.INTERNAL,
        entityLookupKey: 'ana-rodríguez',
        entityType: EntityTypeEnum.USER
    },
    {
        label: 'ADMIN: Importante (SYSTEM) → acc-1',
        assignedBySlug: 'admin-user',
        tagName: 'Importante',
        tagType: TagTypeEnum.SYSTEM,
        entityLookupKey: 'Retiro Soleado',
        entityType: EntityTypeEnum.ACCOMMODATION
    },
    {
        label: 'ADMIN: Validar datos (SYSTEM) → dest-2',
        assignedBySlug: 'admin-user',
        tagName: 'Validar datos',
        tagType: TagTypeEnum.SYSTEM,
        entityLookupKey: 'Colón',
        entityType: EntityTypeEnum.DESTINATION
    }
] as const;

/**
 * Resolves a stable entity lookup key to its real DB UUID.
 *
 * Dynamic import is used to avoid circular dependencies and keep the seed
 * file self-contained. Tests override this via the `models` parameter.
 *
 * Lookup strategy per entity type (all stable, preserved from fixtures):
 * - ACCOMMODATION / DESTINATION / EVENT: `name` column
 * - POST: `title` column
 * - USER: `slug` column
 *
 * We never look up by the fixture `id` field (e.g. `"004-user-ana-rodríguez"`)
 * because that value is a non-UUID seed identifier, not the real UUID stored
 * in the DB `id` column (which is a PostgreSQL UUID).
 *
 * @internal
 */
async function resolveEntityId(
    entityType: EntityTypeEnum,
    entityLookupKey: string,
    models: EntityTagSeedModels
): Promise<string | null> {
    let entityRecord: Record<string, unknown> | null = null;

    switch (entityType) {
        case EntityTypeEnum.ACCOMMODATION: {
            if (models.accommodationModel) {
                entityRecord = await models.accommodationModel.findOne({ name: entityLookupKey });
            } else {
                const { AccommodationModel } = await import('@repo/db');
                entityRecord = await new AccommodationModel().findOne({ name: entityLookupKey });
            }
            break;
        }
        case EntityTypeEnum.POST: {
            if (models.postModel) {
                entityRecord = await models.postModel.findOne({ title: entityLookupKey });
            } else {
                const { PostModel } = await import('@repo/db');
                entityRecord = await new PostModel().findOne({ title: entityLookupKey });
            }
            break;
        }
        case EntityTypeEnum.DESTINATION: {
            if (models.destinationModel) {
                entityRecord = await models.destinationModel.findOne({ name: entityLookupKey });
            } else {
                const { DestinationModel } = await import('@repo/db');
                entityRecord = await new DestinationModel().findOne({ name: entityLookupKey });
            }
            break;
        }
        case EntityTypeEnum.EVENT: {
            if (models.eventModel) {
                entityRecord = await models.eventModel.findOne({ name: entityLookupKey });
            } else {
                const { EventModel } = await import('@repo/db');
                entityRecord = await new EventModel().findOne({ name: entityLookupKey });
            }
            break;
        }
        case EntityTypeEnum.USER: {
            // Users are looked up by slug (stable, preserved as-is from fixtures).
            if (models.userModel) {
                entityRecord = await models.userModel.findOne({ slug: entityLookupKey });
            } else {
                entityRecord = await new UserModel().findOne({ slug: entityLookupKey });
            }
            break;
        }
        default: {
            logger.info(
                `${STATUS_ICONS.Warning} Unsupported entity type "${entityType}", skipping`
            );
            return null;
        }
    }

    return entityRecord ? (entityRecord.id as string) : null;
}

/**
 * Seeds entity-tag assignments for test actors (SPEC-086 E-3).
 *
 * Assigns INTERNAL and SYSTEM tags to various entities, with per-user
 * attribution (D-007). Each row in `r_entity_tag` represents a specific
 * actor's assignment of a specific tag to a specific entity — multiple
 * actors can independently assign the same tag to the same entity, creating
 * separate rows (4-column composite PK).
 *
 * Idempotent: checks the full composite PK `(tagId, entityId, entityType,
 * assignedById)` before inserting. Existing rows are skipped.
 *
 * Actor → assignment mapping (from tag-seeds.md § E-3):
 * - HOST test user: SYSTEM tags on 3 own accommodations + CLIENT on a guest
 * - EDITOR test user: SYSTEM tags on 5 own posts
 * - ADMIN test user: INTERNAL tags (5) + SYSTEM tags (2) across entities
 *
 * Prerequisites:
 *   - INTERNAL + SYSTEM tags required seeds (R-2, R-3) must have run.
 *   - Example users, accommodations, posts, destinations, events seeds must have run.
 *
 * @param models - Optional model overrides for dependency injection in tests.
 * @returns Promise that resolves when all entity-tag assignments have been seeded
 *
 * @throws {Error} When an unexpected DB error occurs
 *
 * @example
 * ```ts
 * await seedEntityTagAssignments();
 * // Creates up to 20 rows in r_entity_tag (7 HOST + 6 EDITOR + 7 ADMIN)
 * ```
 */
export async function seedEntityTagAssignments(models: EntityTagSeedModels = {}): Promise<void> {
    const separator = '#'.repeat(90);

    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  SEEDING ENTITY TAG ASSIGNMENTS — E-3 (SPEC-086)`);

    const tagModel: TagModelPort = models.tagModel ?? new TagModel();
    const userModel: UserModelPort = models.userModel ?? new UserModel();
    const rEntityTagModelInstance: REntityTagModelPort =
        models.rEntityTagModel ?? new REntityTagModel();

    try {
        let totalCreated = 0;
        let totalSkipped = 0;
        let totalNotFound = 0;

        for (const def of ENTITY_TAG_ASSIGNMENTS) {
            // Resolve assignedBy user slug → real UUID.
            // We look up by slug because the fixture `id` field (e.g. "004-user-ana-rodríguez")
            // is a non-UUID seed identifier, not the real UUID stored in `users.id`.
            const userRecord = await userModel.findOne({ slug: def.assignedBySlug });

            if (!userRecord) {
                logger.info(
                    `${STATUS_ICONS.Warning} User (slug: "${def.assignedBySlug}") not found, skipping: ${def.label}`
                );
                totalNotFound++;
                continue;
            }

            const assignedById = userRecord.id as string;

            // Resolve tag by (type, name)
            const tagRecord = await tagModel.findOne({
                type: def.tagType,
                name: def.tagName
            });

            if (!tagRecord) {
                logger.info(
                    `${STATUS_ICONS.Warning} Tag "${def.tagName}" (${def.tagType}) not found, skipping: ${def.label}`
                );
                totalNotFound++;
                continue;
            }

            const tagId = tagRecord.id as string;

            // Resolve entity lookup key → real UUID
            const entityId = await resolveEntityId(def.entityType, def.entityLookupKey, models);

            if (!entityId) {
                logger.info(
                    `${STATUS_ICONS.Warning} Entity "${def.entityLookupKey}" (${def.entityType}) not found, skipping: ${def.label}`
                );
                totalNotFound++;
                continue;
            }

            // Idempotency: check full 4-column composite PK
            const existing = await rEntityTagModelInstance.findOne({
                tagId,
                entityId,
                entityType: def.entityType,
                assignedById
            });

            if (existing) {
                logger.info(
                    `${STATUS_ICONS.Skip} Assignment already exists, skipping: ${def.label}`
                );
                totalSkipped++;
                continue;
            }

            await rEntityTagModelInstance.create({
                tagId,
                entityId,
                entityType: def.entityType,
                assignedById
            });

            logger.info(`${STATUS_ICONS.Success} Created assignment: ${def.label}`);
            totalCreated++;
        }

        logger.info(
            `${STATUS_ICONS.Success} Entity tag assignments E-3 done — created: ${totalCreated}, skipped: ${totalSkipped}, not found: ${totalNotFound}`
        );
        summaryTracker.trackSuccess('Entity Tag Assignments E-3');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(
            `${STATUS_ICONS.Error} Failed to seed entity tag assignments (E-3): ${message}`
        );
        summaryTracker.trackError(
            'Entity Tag Assignments E-3',
            'entity-tag-assignments-e3',
            message
        );
        throw error;
    }
}
