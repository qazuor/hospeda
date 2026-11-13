import { z } from 'zod';
import { VerticalEnumSchema } from '../../enums/vertical.schema.js';

/** Persisted subscription statuses exposed in the administrative list. */
export const AdminSubscriptionStatusSchema = z.enum([
    'PENDING_AUTHORIZATION',
    'ABANDONED',
    'ACTIVE',
    'GRACE_PERIOD',
    'PAUSED',
    'SUSPENDED',
    'CANCEL_SCHEDULED',
    'CANCELLED',
    'CHARGE_DECLINED'
]);

/** Persisted subscription classes exposed in the administrative list. */
export const AdminSubscriptionClassSchema = z.enum(['PRINCIPAL', 'COMPLEMENTO', 'LAPIDA']);

/** Search and pagination accepted by the administrative subscription list. */
export const AdminSubscriptionListQuerySchema = z
    .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        q: z.string().trim().min(1).max(254).optional(),
        vertical: VerticalEnumSchema.optional(),
        status: AdminSubscriptionStatusSchema.optional()
    })
    .strict();

/** One administrative list item, before the HTTP route converts dates to ISO. */
export const AdminSubscriptionListItemSchema = z.object({
    id: z.string().uuid(),
    status: AdminSubscriptionStatusSchema,
    class: AdminSubscriptionClassSchema,
    vertical: VerticalEnumSchema.nullable(),
    owner: z
        .object({
            id: z.string().uuid(),
            email: z.string().email(),
            displayName: z.string().nullable(),
            deleted: z.boolean()
        })
        .nullable(),
    plan: z
        .object({
            planId: z.string().uuid(),
            planName: z.string(),
            planVersionId: z.string().uuid()
        })
        .nullable(),
    cycle: z.enum(['monthly', 'quarterly', 'semiannual', 'annual']).nullable(),
    paymentMethod: z.enum(['CARD', 'MANUAL']).nullable(),
    nextChargeAt: z.date().nullable(),
    createdAt: z.date()
});

/** Paginated administrative subscription list before HTTP date serialization. */
export const AdminSubscriptionListResponseSchema = z.object({
    items: z.array(AdminSubscriptionListItemSchema),
    pagination: z.object({
        page: z.number().int(),
        pageSize: z.number().int(),
        total: z.number().int(),
        totalPages: z.number().int()
    })
});

/** One administrative subscription detail before HTTP date serialization. */
export const AdminSubscriptionDetailSchema = AdminSubscriptionListItemSchema.extend({
    serviceEndsAt: z.date().nullable(),
    planVersion: z
        .object({
            id: z.string().uuid(),
            current: z.boolean(),
            sellable: z.boolean(),
            createdAt: z.date()
        })
        .nullable(),
    price: z
        .object({
            amountMinor: z.number().int(),
            currency: z.string().length(3),
            cycle: z.enum(['monthly', 'quarterly', 'semiannual', 'annual'])
        })
        .nullable(),
    succeedsId: z.string().uuid().nullable(),
    succeededById: z.string().uuid().nullable(),
    pause: z
        .object({
            reason: z.enum(['CUSTOMER_REQUEST', 'COURTESY']),
            startsAt: z.date(),
            expectedEndAt: z.date().nullable(),
            requestedMonths: z.number().int().nullable()
        })
        .nullable(),
    courtesy: z
        .object({
            courtesyGrantId: z.string().uuid(),
            months: z.number().int().positive(),
            startsAt: z.date(),
            endsAt: z.date(),
            remainingMonths: z.number().int().nonnegative()
        })
        .nullable()
});

/** Route and service parameters for one administrative subscription detail. */
export const AdminSubscriptionDetailParamsSchema = z.object({ subscriptionId: z.uuid() }).strict();

/** One administrative list item serialized for HTTP (dates as ISO strings). */
export const AdminSubscriptionListItemHttpSchema = AdminSubscriptionListItemSchema.extend({
    nextChargeAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime()
});

/** One administrative subscription detail serialized for HTTP (dates as ISO strings). */
export const AdminSubscriptionDetailHttpSchema = AdminSubscriptionDetailSchema.extend({
    nextChargeAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    serviceEndsAt: z.string().datetime().nullable(),
    planVersion: z
        .object({
            id: z.string().uuid(),
            current: z.boolean(),
            sellable: z.boolean(),
            createdAt: z.string().datetime()
        })
        .nullable(),
    pause: z
        .object({
            reason: z.enum(['CUSTOMER_REQUEST', 'COURTESY']),
            startsAt: z.string().datetime(),
            expectedEndAt: z.string().datetime().nullable(),
            requestedMonths: z.number().int().nullable()
        })
        .nullable(),
    courtesy: z
        .object({
            courtesyGrantId: z.string().uuid(),
            months: z.number().int().positive(),
            startsAt: z.string().datetime(),
            endsAt: z.string().datetime(),
            remainingMonths: z.number().int().nonnegative()
        })
        .nullable()
});

/** One administrative subscription detail. */
export type AdminSubscriptionDetail = z.infer<typeof AdminSubscriptionDetailSchema>;

/** Parsed administrative subscription list query. */
export type AdminSubscriptionListQuery = z.infer<typeof AdminSubscriptionListQuerySchema>;

/** One administrative subscription list item. */
export type AdminSubscriptionListItem = z.infer<typeof AdminSubscriptionListItemSchema>;

/** One administrative list item serialized for HTTP. */
export type AdminSubscriptionListItemHttp = z.infer<typeof AdminSubscriptionListItemHttpSchema>;

/** One administrative subscription detail serialized for HTTP. */
export type AdminSubscriptionDetailHttp = z.infer<typeof AdminSubscriptionDetailHttpSchema>;
