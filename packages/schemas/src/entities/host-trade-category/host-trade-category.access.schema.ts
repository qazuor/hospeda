import { z } from 'zod';
import {
    HostTradeCatalogSlugSchema,
    HostTradeCategoryKeywordsSchema
} from './host-trade-category.fields.js';
import {
    HostTradeCategoryGroupSchema,
    HostTradeCategorySchema
} from './host-trade-category.schema.js';

/**
 * Reference to a category embedded in other entities (a provider, a benefit
 * usage). Carries the group slug so a consumer can order or group badges
 * without a second request.
 */
export const HostTradeCategoryRefSchema = HostTradeCategorySchema.pick({
    id: true,
    slug: true,
    nameI18n: true
}).extend({
    groupSlug: HostTradeCatalogSlugSchema
});

/** A category as the public catalog endpoint returns it. No admin fields. */
export const PublicHostTradeCategorySchema = HostTradeCategorySchema.pick({
    id: true,
    slug: true,
    nameI18n: true,
    displayWeight: true
}).extend({
    keywordsI18n: HostTradeCategoryKeywordsSchema
});

/** A group with its active categories, as the public catalog returns it. */
export const PublicHostTradeCategoryGroupSchema = HostTradeCategoryGroupSchema.pick({
    slug: true,
    nameI18n: true,
    displayWeight: true
}).extend({
    categories: z.array(PublicHostTradeCategorySchema)
});

/**
 * Response of `GET /api/v1/public/host-trade-categories`: active groups,
 * each with its active categories, already ordered.
 */
export const PublicHostTradeCatalogSchema = z.object({
    groups: z.array(PublicHostTradeCategoryGroupSchema)
});

/** Admin access: the full rows. */
export const HostTradeCategoryAdminSchema = HostTradeCategorySchema;
export const HostTradeCategoryGroupAdminSchema = HostTradeCategoryGroupSchema;

export type HostTradeCategoryRef = z.infer<typeof HostTradeCategoryRefSchema>;
export type PublicHostTradeCategory = z.infer<typeof PublicHostTradeCategorySchema>;
export type PublicHostTradeCategoryGroup = z.infer<typeof PublicHostTradeCategoryGroupSchema>;
export type PublicHostTradeCatalog = z.infer<typeof PublicHostTradeCatalogSchema>;
export type HostTradeCategoryAdmin = z.infer<typeof HostTradeCategoryAdminSchema>;
export type HostTradeCategoryGroupAdmin = z.infer<typeof HostTradeCategoryGroupAdminSchema>;
