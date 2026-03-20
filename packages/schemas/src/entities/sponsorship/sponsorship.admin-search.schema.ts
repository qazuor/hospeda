import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { SponsorshipStatusEnumSchema, SponsorshipTargetTypeEnumSchema } from '../../enums/index.js';

/**
 * Admin search schema for sponsorship entity.
 * Extends AdminSearchBaseSchema with sponsorship-specific filters.
 */
export const SponsorshipAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by sponsor user UUID */
    sponsorUserId: z.string().uuid().optional().describe('Filter by sponsor user'),

    /** Filter by target type */
    targetType: SponsorshipTargetTypeEnumSchema.optional().describe('Filter by target type'),

    /** Filter by target entity UUID */
    targetId: z.string().uuid().optional().describe('Filter by target entity'),

    /**
     * Filter by sponsorship status.
     * Named `sponsorshipStatus` (not `status`) to avoid collision with
     * the base schema's `status` field which maps to lifecycleState.
     */
    sponsorshipStatus: SponsorshipStatusEnumSchema.optional().describe(
        'Filter by sponsorship status'
    )
});

/** Inferred type for SponsorshipAdminSearch */
export type SponsorshipAdminSearch = z.infer<typeof SponsorshipAdminSearchSchema>;
