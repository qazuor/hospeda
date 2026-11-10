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

/** Parsed administrative subscription list query. */
export type AdminSubscriptionListQuery = z.infer<typeof AdminSubscriptionListQuerySchema>;

/** One administrative subscription list item. */
export type AdminSubscriptionListItem = z.infer<typeof AdminSubscriptionListItemSchema>;
