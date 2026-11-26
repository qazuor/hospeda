import { z } from 'zod';
import {
    ENABLED_DYNAMIC_ENTITY_TYPES,
    NewsletterDynamicEntityTypeEnum
} from '../../enums/newsletter-dynamic-entity-type.enum.js';
import { NewsletterDynamicSourceEnum } from '../../enums/newsletter-dynamic-source.enum.js';
import { NewsletterIfBelowMinEnum } from '../../enums/newsletter-if-below-min.enum.js';

/**
 * Declared source support by entity type. Featured is supported in the contract
 * for accommodations but independently disabled until its implementation ships.
 */
export const DYNAMIC_SOURCES_BY_ENTITY_TYPE: Readonly<
    Record<NewsletterDynamicEntityTypeEnum, readonly NewsletterDynamicSourceEnum[]>
> = {
    [NewsletterDynamicEntityTypeEnum.ACCOMMODATION]: [
        NewsletterDynamicSourceEnum.MOST_VIEWED,
        NewsletterDynamicSourceEnum.NEWEST,
        NewsletterDynamicSourceEnum.TOP_RATED,
        NewsletterDynamicSourceEnum.FEATURED
    ],
    [NewsletterDynamicEntityTypeEnum.VENUE]: [],
    [NewsletterDynamicEntityTypeEnum.POST]: [],
    [NewsletterDynamicEntityTypeEnum.EVENT]: [],
    [NewsletterDynamicEntityTypeEnum.EXPERIENCE]: [],
    [NewsletterDynamicEntityTypeEnum.PARTNER]: []
};

/** Configuration stored inline in campaign documents and template block versions. */
export const DynamicBlockConfigSchema = z
    .object({
        blockKey: z.string().regex(/^[a-z0-9-]{8,64}$/),
        entityType: z.nativeEnum(NewsletterDynamicEntityTypeEnum),
        source: z.nativeEnum(NewsletterDynamicSourceEnum),
        count: z.number().int().min(1).max(12),
        params: z
            .object({
                windowDays: z.number().int().min(1).max(90).optional(),
                minReviews: z.number().int().min(1).max(100).optional(),
                destinationId: z.string().uuid().optional()
            })
            .strict(),
        minItems: z.number().int().min(1),
        ifBelowMin: z.nativeEnum(NewsletterIfBelowMinEnum),
        excludeRecentEditions: z.number().int().min(0).max(12),
        fillWithRepeats: z.boolean()
    })
    .superRefine((config, ctx) => {
        if (config.minItems > config.count) {
            ctx.addIssue({
                code: 'custom',
                path: ['minItems'],
                message: 'minItems must not exceed count'
            });
        }
        if (config.source === NewsletterDynamicSourceEnum.FEATURED) {
            ctx.addIssue({
                code: 'custom',
                path: ['source'],
                message: 'FEATURED_SOURCE_DISABLED'
            });
        }
        if (!ENABLED_DYNAMIC_ENTITY_TYPES.includes(config.entityType)) {
            ctx.addIssue({
                code: 'custom',
                path: ['entityType'],
                message: 'ENTITY_TYPE_NOT_ENABLED'
            });
        }
        if (!DYNAMIC_SOURCES_BY_ENTITY_TYPE[config.entityType].includes(config.source)) {
            ctx.addIssue({
                code: 'custom',
                path: ['source'],
                message: 'SOURCE_NOT_SUPPORTED_FOR_ENTITY'
            });
        }
    });

/** Validated configuration for one newsletter dynamic block. */
export type DynamicBlockConfig = z.infer<typeof DynamicBlockConfigSchema>;
