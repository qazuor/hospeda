import { z } from 'zod';
import { VerticalEnumSchema } from '../../enums/vertical.schema.js';

const Id = z.uuid();
const Validity = z.enum(['FIXED_DAYS', 'WHILE_SUBSCRIPTION_ALIVE']);
const ScopeType = z.enum(['LISTING', 'VERTICAL_SUBSCRIPTION', 'USER', 'GLOBAL']);
const ChargeKind = z.enum(['UNA_VEZ', 'PERIODICO']);
const Cycle = z.enum(['monthly', 'quarterly', 'semiannual', 'annual']);
const Limit = z.strictObject({ key: z.string().min(1).max(64), value: z.int().nonnegative() });

/** Content of a new immutable addon version. */
export const AddonVersionContentSchema = z
    .strictObject({
        validity: Validity,
        validityDays: z.int().positive().nullable(),
        scopeType: ScopeType,
        entitlements: z.array(z.string().min(1).max(64)),
        limits: z.array(Limit)
    })
    .refine((value) => (value.validity === 'FIXED_DAYS') === (value.validityDays !== null), {
        message: 'FIXED_DAYS requires validityDays'
    });

/** Request to create an addon and its first immutable version in one transaction. */
export const CreateAddonRequestSchema = z.strictObject({
    slug: z.string().min(1).max(64),
    name: z.string().min(1).max(120),
    description: z.string().nullable(),
    firstVersion: AddonVersionContentSchema
});

/** Request to add an immutable version to an existing addon. */
export const CreateAddonVersionRequestSchema = z
    .strictObject({
        addonId: Id,
        validity: Validity,
        validityDays: z.int().positive().nullable(),
        scopeType: ScopeType,
        entitlements: z.array(z.string().min(1).max(64)),
        limits: z.array(Limit)
    })
    .refine((value) => (value.validity === 'FIXED_DAYS') === (value.validityDays !== null), {
        message: 'FIXED_DAYS requires validityDays'
    });

/** Request to create the one saleable product for an addon. */
export const CreateAddonProductRequestSchema = z
    .strictObject({
        addonId: Id,
        versionId: Id,
        price: z.int().positive(),
        chargeKind: ChargeKind,
        cycle: Cycle.nullable(),
        compatibleVerticals: z.array(VerticalEnumSchema).min(1)
    })
    .refine((value) => (value.chargeKind === 'PERIODICO') === (value.cycle !== null), {
        message: 'PERIODICO requires a cycle'
    });

/** One version with its grants and count of live purchases. */
export const AdminAddonVersionSchema = z.strictObject({
    id: Id,
    addonId: Id,
    validity: Validity,
    validityDays: z.int().positive().nullable(),
    scopeType: ScopeType,
    entitlements: z.array(z.string()),
    limits: z.array(Limit),
    liveInstances: z.int().nonnegative()
});

/** Current saleable product, if one has been created. */
export const AdminAddonProductSchema = z.strictObject({
    id: Id,
    versionId: Id,
    price: z.int().positive(),
    currency: z.literal('ARS'),
    chargeKind: ChargeKind,
    cycle: Cycle.nullable(),
    compatibleVerticals: z.array(VerticalEnumSchema).min(1)
});

/** Complete addon catalog for the action 20 editor. */
export const AdminAddonCatalogResponseSchema = z.strictObject({
    items: z.array(
        z.strictObject({
            id: Id,
            slug: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            versions: z.array(AdminAddonVersionSchema),
            product: AdminAddonProductSchema.nullable()
        })
    )
});

/** Parsed request to create an addon. */
export type CreateAddonRequest = z.infer<typeof CreateAddonRequestSchema>;
/** Parsed request to create a version. */
export type CreateAddonVersionRequest = z.infer<typeof CreateAddonVersionRequestSchema>;
/** Parsed request to create a product. */
export type CreateAddonProductRequest = z.infer<typeof CreateAddonProductRequestSchema>;
/** Parsed admin catalog response. */
export type AdminAddonCatalogResponse = z.infer<typeof AdminAddonCatalogResponseSchema>;
