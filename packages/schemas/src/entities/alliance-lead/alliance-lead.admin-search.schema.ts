import { z } from 'zod';
import { AllianceLeadKindEnum, AllianceLeadStatusEnum } from './alliance-lead.schema.js';

// ---------------------------------------------------------------------------
// Admin list query
// ---------------------------------------------------------------------------

/**
 * Query parameters accepted by the admin alliance leads inbox
 * (`GET /api/v1/admin/alliance/leads`).
 *
 * Unlike most admin list endpoints, this does NOT extend `AdminSearchBaseSchema`
 * — that base schema's `status` filter is tied to `LifecycleStatusEnum`
 * (DRAFT/ACTIVE/ARCHIVED), which is a different vocabulary than the lead
 * workflow status (`pending`/`reviewing`/`approved`/`rejected`). `page`/`pageSize`
 * follow the same admin convention (NOT `limit`) as every other admin route.
 */
export const AllianceLeadAdminListQuerySchema = z.object({
    /** Filter by alliance kind (partner | sponsor | editor | service_provider). */
    kind: AllianceLeadKindEnum.optional(),

    /** Filter by workflow status (pending | reviewing | approved | rejected). */
    status: AllianceLeadStatusEnum.optional(),

    /** Page number for pagination (1-based). */
    page: z.coerce
        .number()
        .int()
        .positive({ message: 'zodError.allianceLead.adminList.page.positive' })
        .default(1)
        .describe('Page number for pagination (1-based)'),

    /** Number of items per page (1-100, default 20). */
    pageSize: z.coerce
        .number()
        .int()
        .positive({ message: 'zodError.allianceLead.adminList.pageSize.positive' })
        .max(100, { message: 'zodError.allianceLead.adminList.pageSize.max' })
        .default(20)
        .describe('Number of items per page (max 100)')
});

/** TypeScript type for {@link AllianceLeadAdminListQuerySchema}. */
export type AllianceLeadAdminListQuery = z.infer<typeof AllianceLeadAdminListQuerySchema>;
