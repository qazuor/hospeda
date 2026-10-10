import { z } from 'zod';
import { VerticalEnumSchema } from '../../enums/vertical.schema.js';

/** Administrative action 11 request: extend another person's running trial. */
export const AdminExtendTrialRequestSchema = z.strictObject({
    userId: z.uuid(),
    vertical: VerticalEnumSchema,
    days: z.int().positive(),
    reason: z.string().trim().min(1).max(1000)
});

/** Validated request for administrative T4. */
export type AdminExtendTrialRequest = z.infer<typeof AdminExtendTrialRequestSchema>;

/** Result of a successful administrative T4 extension. */
export const AdminExtendTrialResponseSchema = z.strictObject({
    previousEndsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    totalDays: z.int().positive()
});

/** Response showing the previous end, new end, and accumulated days. */
export type AdminExtendTrialResponse = z.infer<typeof AdminExtendTrialResponseSchema>;
