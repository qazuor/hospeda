import { z } from 'zod';

/** Supported admin panel views for Partner applications. */
export const PartnerApplicationPanelViewSchema = z.enum([
    'pending',
    'approvedUnclaimed',
    'rejectedWaiting'
]);

/** Query parameters for the admin Partner application panel. */
export const AdminPartnerApplicationPanelQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    view: PartnerApplicationPanelViewSchema.default('pending')
});

/** One Partner application displayed in an admin panel view. */
export const AdminPartnerApplicationPanelItemSchema = z.object({
    id: z.uuid(),
    email: z.string(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
    createdAt: z.iso.datetime(),
    resolvedAt: z.iso.datetime().nullable(),
    overdue: z.boolean(),
    waitEndsAt: z.iso.datetime().nullable(),
    partner: z.object({ id: z.uuid(), name: z.string(), slug: z.string() }).nullable()
});

/** Paginated response for the admin Partner application panel. */
export const AdminPartnerApplicationPanelResponseSchema = z.object({
    items: z.array(AdminPartnerApplicationPanelItemSchema),
    pagination: z.object({
        page: z.number(),
        pageSize: z.number(),
        total: z.number(),
        totalPages: z.number(),
        hasNextPage: z.boolean(),
        hasPreviousPage: z.boolean()
    })
});

/** Parsed admin Partner application panel view. */
export type PartnerApplicationPanelView = z.infer<typeof PartnerApplicationPanelViewSchema>;
/** Parsed admin Partner application panel query. */
export type AdminPartnerApplicationPanelQuery = z.infer<
    typeof AdminPartnerApplicationPanelQuerySchema
>;
/** Partner application row returned by the admin panel. */
export type AdminPartnerApplicationPanelItem = z.infer<
    typeof AdminPartnerApplicationPanelItemSchema
>;
/** Paginated admin Partner application panel response. */
export type AdminPartnerApplicationPanelResponse = z.infer<
    typeof AdminPartnerApplicationPanelResponseSchema
>;
