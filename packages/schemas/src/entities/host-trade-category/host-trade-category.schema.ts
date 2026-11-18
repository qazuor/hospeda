import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { TranslationMetaSchema } from '../../common/i18n.schema.js';
import {
    HostTradeCategoryGroupIdSchema,
    HostTradeCategoryIdSchema
} from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import {
    HostTradeCatalogDisplayWeightSchema,
    HostTradeCatalogNameSchema,
    HostTradeCatalogSlugSchema,
    HostTradeCategoryKeywordsSchema
} from './host-trade-category.fields.js';

/**
 * Host Trade Category Group Schema (HOS-919).
 *
 * A heading that groups provider trade categories in the selector and on the
 * marketing page (e.g. «Instalaciones»). Admin-managed: rows carry their own
 * `nameI18n` instead of i18n keys, following the HOS-139 POI-category
 * precedent.
 */
export const HostTradeCategoryGroupSchema = z.object({
    id: HostTradeCategoryGroupIdSchema,
    ...BaseAuditFields,
    ...BaseLifecycleFields,
    ...BaseAdminFields,
    slug: HostTradeCatalogSlugSchema,
    nameI18n: HostTradeCatalogNameSchema,
    /** Per-locale translation curation metadata. Admin responses only. */
    translationMeta: TranslationMetaSchema.nullish(),
    displayWeight: HostTradeCatalogDisplayWeightSchema
});

/**
 * Host Trade Category Schema (HOS-919).
 *
 * One provider trade category (e.g. «Plomería»). Replaces the closed
 * `HostTradeCategoryEnum`: a provider links to 1..N of these through
 * `r_host_trade_category`. A deactivated category (`lifecycleState`
 * `INACTIVE`) is no longer offered but stays on providers that have it.
 */
export const HostTradeCategorySchema = z.object({
    id: HostTradeCategoryIdSchema,
    ...BaseAuditFields,
    ...BaseLifecycleFields,
    ...BaseAdminFields,
    slug: HostTradeCatalogSlugSchema,
    groupId: HostTradeCategoryGroupIdSchema,
    nameI18n: HostTradeCatalogNameSchema,
    /** Related words per locale for the selector search. */
    keywordsI18n: HostTradeCategoryKeywordsSchema.default({}),
    /** Per-locale translation curation metadata. Admin responses only. */
    translationMeta: TranslationMetaSchema.nullish(),
    displayWeight: HostTradeCatalogDisplayWeightSchema
});

export type HostTradeCategoryGroup = z.infer<typeof HostTradeCategoryGroupSchema>;
export type HostTradeCategory = z.infer<typeof HostTradeCategorySchema>;
