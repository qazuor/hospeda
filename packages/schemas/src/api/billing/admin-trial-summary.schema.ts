import { z } from 'zod';
import { TrialSummaryResponseSchema } from '../../common/listing-notices.schema.js';
import { SubscribeDestinationVerticalSchema } from './subscribe-destination.schema.js';

/** Query for reading one user's trial summary in a listing vertical. */
export const AdminTrialSummaryQuerySchema = z.object({
    vertical: SubscribeDestinationVerticalSchema
});

/** Admin response with the user's accumulated trial summary and its stored ceiling. */
export const AdminTrialSummaryResponseSchema = z.object({
    summary: TrialSummaryResponseSchema,
    ceilingDays: z.number().int().positive().nullable()
});

/** Query type for the admin trial summary. */
export type AdminTrialSummaryQuery = z.infer<typeof AdminTrialSummaryQuerySchema>;
/** Response type for the admin trial summary. */
export type AdminTrialSummaryResponse = z.infer<typeof AdminTrialSummaryResponseSchema>;
