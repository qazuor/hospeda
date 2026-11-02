import { z } from 'zod';
import { PublicationStatusEnumSchema } from '../enums/publication-status.schema.js';
import { VerticalEnum } from '../enums/vertical.enum.js';

const ListingVerticalSchema = z.enum([
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
]);

/** Query parameters for the paginated admin list of open listing fix requests. */
export const AdminListingFixRequestListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    vertical: ListingVerticalSchema.optional(),
    ownerReported: z.enum(['yes', 'no']).optional(),
    overdue: z.enum(['true']).optional()
});

/** One open fix request and its listing summary for the admin queue. */
export const AdminListingFixRequestItemSchema = z.object({
    fixRequestId: z.string().uuid(),
    vertical: ListingVerticalSchema,
    listingId: z.string().uuid(),
    listingName: z.string(),
    listingSlug: z.string(),
    publicationStatus: PublicationStatusEnumSchema,
    reason: z.string(),
    suggestedDate: z.string().date().nullable(),
    overdue: z.boolean(),
    ageDays: z.number().int().nonnegative(),
    openedAt: z.iso.datetime(),
    ownerReportedFixedAt: z.iso.datetime().nullable()
});

/** Paginated response returned by the admin fix-request list route. */
export const AdminListingFixRequestListResponseSchema = z.object({
    items: z.array(AdminListingFixRequestItemSchema),
    pagination: z.object({
        page: z.number().int(),
        pageSize: z.number().int(),
        total: z.number().int(),
        totalPages: z.number().int(),
        hasNextPage: z.boolean(),
        hasPreviousPage: z.boolean()
    })
});

/** Inferred query type for the admin fix-request list. */
export type AdminListingFixRequestListQuery = z.infer<typeof AdminListingFixRequestListQuerySchema>;
/** Inferred item type for one admin fix-request row. */
export type AdminListingFixRequestItem = z.infer<typeof AdminListingFixRequestItemSchema>;
/** Inferred paginated response type for the admin fix-request list. */
export type AdminListingFixRequestListResponse = z.infer<
    typeof AdminListingFixRequestListResponseSchema
>;
