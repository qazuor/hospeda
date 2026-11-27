import {
    DYNAMIC_SOURCES_BY_ENTITY_TYPE,
    ENABLED_DYNAMIC_ENTITY_TYPES,
    NewsletterDynamicEntityTypeEnum,
    NewsletterDynamicSourceEnum,
    PermissionEnum
} from '@repo/schemas';
import { createAdminRoute } from '../../../utils/route-factory';
import { z } from '../../../utils/zod';

/** Declared entity/source support, including disabled future capabilities. */
export const adminDynamicSourcesRoute = createAdminRoute({
    method: 'get',
    path: '/dynamic-sources',
    summary: 'List newsletter dynamic sources',
    description:
        'Lists all declared entity types and their supported sources with availability flags.',
    tags: ['Newsletter'],
    requiredPermissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_VIEW],
    responseSchema: z.object({
        entityTypes: z.array(
            z.object({
                entityType: z.nativeEnum(NewsletterDynamicEntityTypeEnum),
                enabled: z.boolean(),
                sources: z.array(
                    z.object({
                        source: z.nativeEnum(NewsletterDynamicSourceEnum),
                        enabled: z.boolean()
                    })
                )
            })
        )
    }),
    handler: async () => ({
        entityTypes: Object.values(NewsletterDynamicEntityTypeEnum).map((entityType) => ({
            entityType,
            enabled: ENABLED_DYNAMIC_ENTITY_TYPES.includes(entityType),
            sources: DYNAMIC_SOURCES_BY_ENTITY_TYPE[entityType].map((source) => ({
                source,
                enabled:
                    ENABLED_DYNAMIC_ENTITY_TYPES.includes(entityType) &&
                    source !== NewsletterDynamicSourceEnum.FEATURED
            }))
        }))
    })
});
