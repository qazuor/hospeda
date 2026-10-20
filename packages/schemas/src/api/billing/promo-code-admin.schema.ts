import { z } from 'zod';
import { VerticalEnumSchema } from '../../enums/vertical.schema.js';

/** Admin action 21 effect. FIXED values are expressed in minor currency units (centavos). */
export const AdminPromoCodeEffectSchema = z.discriminatedUnion('kind', [
    z
        .strictObject({
            kind: z.literal('DISCOUNT'),
            discountKind: z.enum(['PERCENTAGE', 'FIXED']),
            value: z.number().int().min(1),
            durationKind: z.enum(['FIRST_CHARGE', 'N_CHARGES', 'FOREVER']),
            durationCharges: z.number().int().min(1).nullable()
        })
        .superRefine((effect, ctx) => {
            if (effect.discountKind === 'PERCENTAGE' && effect.value > 100) {
                ctx.addIssue({ code: 'custom', path: ['value'] });
            }
            if ((effect.durationKind === 'N_CHARGES') !== (effect.durationCharges !== null)) {
                ctx.addIssue({ code: 'custom', path: ['durationCharges'] });
            }
        }),
    z.strictObject({ kind: z.literal('TRIAL_EXTENSION'), extensionDays: z.number().int().min(1) })
]);

/** Strict create body for admin action 21. */
export const AdminPromoCodeCreateRequestSchema = z
    .strictObject({
        code: z
            .string()
            .trim()
            .regex(/^[A-Z0-9_-]{3,64}$/),
        effect: AdminPromoCodeEffectSchema,
        allVerticals: z.boolean(),
        verticals: z.array(VerticalEnumSchema).min(1).nullable(),
        totalQuota: z.number().int().min(1).nullable(),
        validFrom: z.coerce.date().optional(),
        validUntil: z.coerce.date().nullable(),
        stackable: z.boolean(),
        usableWithAnotherActive: z.boolean()
    })
    .superRefine((input, ctx) => {
        if (input.allVerticals !== (input.verticals === null)) {
            ctx.addIssue({ code: 'custom', path: ['verticals'] });
        }
        if (input.validFrom && input.validUntil && input.validUntil <= input.validFrom) {
            ctx.addIssue({ code: 'custom', path: ['validUntil'] });
        }
    });

/** Mirrors PROMO_CODE_AVAILABILITIES in service-core; the admin panel can import this contract. */
export const AdminPromoCodeAvailabilitySchema = z.enum([
    'OPEN',
    'CLOSED',
    'NOT_YET_VALID',
    'EXPIRED',
    'EXHAUSTED'
]);

/** Mirrors PROMO_CODE_ADMIN_REJECTIONS in service-core; checked against it by the route unit test. */
export const AdminPromoCodeRejectionSchema = z.enum([
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'PROMO_CODE_NOT_FOUND',
    'PROMO_CODE_ALREADY_EXISTS',
    'PROMO_CODE_ALREADY_CLOSED',
    'INVALID_PROMO_CODE_INPUT'
]);

/** Admin view returned for one promotional code. */
export const AdminPromoCodeSchema = z.object({
    id: z.string().uuid(),
    code: z.string(),
    effect: AdminPromoCodeEffectSchema,
    allVerticals: z.boolean(),
    verticals: z.array(VerticalEnumSchema).nullable(),
    totalQuota: z.number().int().positive().nullable(),
    validFrom: z.string().datetime(),
    validUntil: z.string().datetime().nullable(),
    stackable: z.boolean(),
    usableWithAnotherActive: z.boolean(),
    closedAt: z.string().datetime().nullable(),
    closedBy: z.string().uuid().nullable(),
    createdAt: z.string().datetime(),
    redemptionCount: z.number().int().nonnegative(),
    availability: AdminPromoCodeAvailabilitySchema
});

/** Query parameters for the paginated admin promo-code list. */
export const AdminPromoCodeListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50)
});

/** URL parameters for closing one promotional code. */
export const AdminPromoCodeParamsSchema = z.object({ promoCodeId: z.string().uuid() });

/** Successful response of closing a promotional code. */
export const AdminPromoCodeCloseResponseSchema = z.object({
    promoCodeId: z.string().uuid(),
    closedAt: z.string().datetime(),
    closedBy: z.string().uuid(),
    redemptionCount: z.number().int().nonnegative()
});

export type AdminPromoCodeEffect = z.infer<typeof AdminPromoCodeEffectSchema>;
export type AdminPromoCodeCreateRequest = z.infer<typeof AdminPromoCodeCreateRequestSchema>;
export type AdminPromoCode = z.infer<typeof AdminPromoCodeSchema>;
export type AdminPromoCodeListQuery = z.infer<typeof AdminPromoCodeListQuerySchema>;
export type AdminPromoCodeCloseResponse = z.infer<typeof AdminPromoCodeCloseResponseSchema>;
