import { TagModel, UserModel } from '@repo/db';
import { TagColorEnum, TagTypeEnum } from '@repo/schemas';
import { LifecycleStatusEnum } from '@repo/schemas';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Minimal interface for tag model operations used by E-1.
 *
 * Accepts a port instead of the concrete `TagModel` so unit tests
 * can inject an in-memory stub without a live DB connection.
 *
 * @internal
 */
export interface TagModelPort {
    findOne(filter: Partial<Record<string, unknown>>): Promise<Record<string, unknown> | null>;
    create(data: Partial<Record<string, unknown>>): Promise<Record<string, unknown>>;
}

/**
 * Minimal interface for user model operations used by E-1.
 *
 * @internal
 */
export interface UserModelPort {
    findOne(filter: Partial<Record<string, unknown>>): Promise<Record<string, unknown> | null>;
}

/**
 * Definition of a USER tag to create for a specific owner.
 *
 * @internal
 */
interface UserTagDefinition {
    name: string;
    color: string;
    description: string;
}

/**
 * Mapping of role to owner slug and tag definitions.
 *
 * Owner slugs correspond to the `slug` field stored in the `users` table
 * after the example seeds run. These slugs come from the fixture files in
 * `packages/seed/src/data/user/example/` and `required/` directories.
 *
 * - HOST: `ana-rodríguez` (slug of the first HOST user, fixture 004)
 * - EDITOR: `carlos-martínez` (slug of the EDITOR user, fixture 002)
 * - ADMIN: `admin-user` (slug of the admin user, required fixture)
 * - SUPER_ADMIN: No USER tags (E-1 baseline — exercises moderation views)
 *
 * We look up by `slug` instead of `id` because the fixture `id` field
 * (`004-user-ana-rodríguez`) is a non-UUID seed identifier, not the real
 * DB UUID stored in `users.id`. The `slug` column is always populated and
 * matches between the fixture and the DB row.
 *
 * @internal
 */
const USER_TAG_DEFINITIONS: ReadonlyArray<{
    ownerSlug: string;
    role: string;
    tags: ReadonlyArray<UserTagDefinition>;
}> = [
    {
        ownerSlug: 'ana-rodríguez',
        role: 'HOST',
        tags: [
            {
                name: 'Reservar después',
                color: TagColorEnum.BLUE,
                description: 'Alojamiento para reservar más adelante'
            },
            {
                name: 'Cliente VIP',
                color: TagColorEnum.PURPLE,
                description: 'Huésped o contacto de alta prioridad'
            },
            {
                name: 'Necesita seguimiento',
                color: TagColorEnum.YELLOW,
                description: 'Requiere contacto o acción de seguimiento'
            },
            {
                name: 'Para verano',
                color: TagColorEnum.ORANGE,
                description: 'Elemento relevante para la temporada de verano'
            }
        ]
    },
    {
        ownerSlug: 'carlos-martínez',
        role: 'EDITOR',
        tags: [
            {
                name: 'Pendiente edición',
                color: TagColorEnum.YELLOW,
                description: 'Publicación o evento pendiente de revisión editorial'
            },
            {
                name: 'Para destacar',
                color: TagColorEnum.PURPLE,
                description: 'Contenido candidato para ser destacado en el panel'
            },
            {
                name: 'Verificar fuentes',
                color: TagColorEnum.ORANGE,
                description: 'La información requiere verificación de sus fuentes'
            },
            {
                name: 'Idea para post',
                color: TagColorEnum.CYAN,
                description: 'Idea guardada para desarrollar como publicación futura'
            }
        ]
    },
    {
        ownerSlug: 'admin-user',
        role: 'ADMIN',
        tags: [
            {
                name: 'Revisar',
                color: TagColorEnum.YELLOW,
                description: 'Entidad que requiere revisión manual del administrador'
            },
            {
                name: 'Pendiente decisión',
                color: TagColorEnum.ORANGE,
                description: 'Esperando una decisión administrativa'
            },
            {
                name: 'Caso de prueba',
                color: TagColorEnum.GREY,
                description: 'Dato usado para pruebas o QA interno'
            },
            {
                name: 'Para reunión',
                color: TagColorEnum.BLUE,
                description: 'Ítem a tratar en la próxima reunión de equipo'
            }
        ]
    }
    // SUPER_ADMIN intentionally omitted — D-005 / E-1 baseline.
    // Super-admin test user exercises moderation views, not personal organization.
] as const;

/**
 * Seeds personal USER tags for HOST, EDITOR, and ADMIN test users (SPEC-086 E-1).
 *
 * Each test user in the admin panel gets a set of realistic USER tags for
 * personal organization (private to each owner). Tags are keyed by the
 * partial unique index `tags_user_name_uq (ownerId, type, name)` for
 * idempotency — existing rows are skipped.
 *
 * USER tag invariants at insert:
 *   - `type = USER`
 *   - `ownerId = <test-user-id>` (the user's real DB UUID)
 *   - `createdById = <test-user-id>` (user created their own tag)
 *   - `lifecycleState = ACTIVE`
 *
 * SUPER_ADMIN test user receives NO USER tags (E-1 baseline).
 *
 * Prerequisites:
 *   - Required users seed (R-1 / systemUser) must have run first.
 *   - Example users seed must have run first (test users must exist).
 *
 * @param tagModelOverride - Optional model override for dependency injection in tests.
 * @param userModelOverride - Optional user model override for dependency injection in tests.
 * @returns Promise that resolves when all USER tags have been seeded
 *
 * @throws {Error} When the database insert fails for a reason other than idempotency
 *
 * @example
 * ```ts
 * await seedUserTags();
 * // Creates 4 USER tags each for HOST, EDITOR, and ADMIN test users
 * ```
 */
export async function seedUserTags(
    tagModelOverride?: TagModelPort,
    userModelOverride?: UserModelPort
): Promise<void> {
    const separator = '#'.repeat(90);

    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  SEEDING USER TAGS — E-1 (SPEC-086)`);

    const tagModel: TagModelPort = tagModelOverride ?? new TagModel();
    const userModel: UserModelPort = userModelOverride ?? new UserModel();

    try {
        let totalCreated = 0;
        let totalSkipped = 0;

        for (const userDef of USER_TAG_DEFINITIONS) {
            // Resolve slug → real DB UUID.
            // We look up by `slug` because the fixture `id` field is a non-UUID seed
            // identifier (e.g. "004-user-ana-rodríguez"), not the real UUID stored
            // in `users.id`. The `slug` column is always populated from the fixture
            // and is safe to use as a stable lookup key.
            const userRecord = await userModel.findOne({ slug: userDef.ownerSlug });

            if (!userRecord) {
                logger.info(
                    `${STATUS_ICONS.Warning} ${userDef.role} test user not found (slug: "${userDef.ownerSlug}"), skipping their USER tags`
                );
                continue;
            }

            const ownerId = userRecord.id as string;

            logger.info(
                `${STATUS_ICONS.Info} Processing ${userDef.tags.length} USER tags for ${userDef.role} (id: ${ownerId})`
            );

            let roleCreated = 0;
            let roleSkipped = 0;

            for (const tagDef of userDef.tags) {
                // Idempotency guard: partial unique index tags_user_name_uq (ownerId, type, name)
                const existing = await tagModel.findOne({
                    ownerId,
                    type: TagTypeEnum.USER,
                    name: tagDef.name
                });

                if (existing) {
                    logger.info(
                        `${STATUS_ICONS.Skip} USER tag "${tagDef.name}" for ${userDef.role} already exists, skipping`
                    );
                    roleSkipped++;
                    continue;
                }

                await tagModel.create({
                    name: tagDef.name,
                    description: tagDef.description,
                    color: tagDef.color,
                    lifecycleState: LifecycleStatusEnum.ACTIVE,
                    type: TagTypeEnum.USER,
                    ownerId,
                    createdById: ownerId
                });

                logger.info(
                    `${STATUS_ICONS.Success} Created USER tag "${tagDef.name}" for ${userDef.role}`
                );
                roleCreated++;
            }

            logger.info(
                `${STATUS_ICONS.Info} ${userDef.role}: created ${roleCreated}, skipped ${roleSkipped}`
            );
            totalCreated += roleCreated;
            totalSkipped += roleSkipped;
        }

        logger.info(
            `${STATUS_ICONS.Success} USER tags E-1 done — created: ${totalCreated}, skipped: ${totalSkipped}`
        );
        summaryTracker.trackSuccess('User Tags E-1');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`${STATUS_ICONS.Error} Failed to seed USER tags (E-1): ${message}`);
        summaryTracker.trackError('User Tags E-1', 'user-tags-e1', message);
        throw error;
    }
}
