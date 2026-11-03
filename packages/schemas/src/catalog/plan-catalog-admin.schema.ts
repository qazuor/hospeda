import { z } from 'zod';
import { VerticalEnumSchema } from '../enums/vertical.schema.js';
import {
    BILLING_CYCLES,
    PlanVersionContentSchema,
    PlanVersionEntitlementInputSchema,
    PlanVersionLimitInputSchema
} from './plan-publication.schema.js';

/** Query for reading one vertical's complete plan catalog as an administrator. */
export const AdminPlanCatalogQuerySchema = z.object({ vertical: VerticalEnumSchema });

/** Current plan version including effects and its complete cycle list. */
export const AdminCatalogPlanVersionSchema = PlanVersionContentSchema.extend({
    versionId: z.string().uuid(),
    entitlements: z.array(PlanVersionEntitlementInputSchema),
    limits: z.array(PlanVersionLimitInputSchema),
    cycles: z.array(z.enum(BILLING_CYCLES))
});

/** A plan and its current version, if one has been published. */
export const AdminCatalogPlanSchema = z.object({
    planId: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    pricingOrder: z.number().int(),
    role: z.string().nullable(),
    currentVersion: AdminCatalogPlanVersionSchema.nullable()
});

/** Full admin catalog for one vertical. */
export const AdminPlanCatalogResponseSchema = z.object({
    vertical: VerticalEnumSchema,
    plans: z.array(AdminCatalogPlanSchema)
});

/** Inferred query type for the admin plan catalog. */
export type AdminPlanCatalogQuery = z.infer<typeof AdminPlanCatalogQuerySchema>;
/** Inferred current-version type returned by the admin plan catalog. */
export type AdminCatalogPlanVersion = z.infer<typeof AdminCatalogPlanVersionSchema>;
/** Inferred plan type returned by the admin plan catalog. */
export type AdminCatalogPlan = z.infer<typeof AdminCatalogPlanSchema>;
/** Inferred response type for the admin plan catalog. */
export type AdminPlanCatalogResponse = z.infer<typeof AdminPlanCatalogResponseSchema>;
