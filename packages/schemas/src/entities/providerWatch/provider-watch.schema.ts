import { z } from 'zod';
import { ProviderWatchAuthorizationInputSchema } from '../platformSettings/platform-settings.schema.js';

/**
 * Provider watch battery admin API schemas (HOS-1512).
 *
 * The owner confirms the provider account the battery will run against, authorizes the monthly
 * production run, and reviews and accepts changed response shapes.
 */

/** The accounts a watch run can target. */
export const ProviderWatchAccountKindSchema = z.enum(['sandbox', 'production']);

/** The account the API's provider token belongs to, read from `GET /users/me`. */
export const ProviderWatchAccountSchema = z.object({
    /** Mercado Pago account id. */
    id: z.string(),
    nickname: z.string().nullable(),
    /** Whether the account carries the `test_user` tag. */
    isTestAccount: z.boolean()
});

/** The account the API's provider token belongs to. */
export type ProviderWatchAccount = z.infer<typeof ProviderWatchAccountSchema>;

/**
 * Body of the authorization write. `confirmedAccountId` is the id the owner SAW in the admin;
 * the API reads the account again and refuses when it is not the same one, then stores the id it
 * read. The owner never types an account id.
 */
export const ProviderWatchAuthorizeInputSchema = ProviderWatchAuthorizationInputSchema.omit({
    accountId: true,
    accountNickname: true
}).extend({
    confirmedAccountId: z.string().regex(/^\d{1,20}$/)
});

/** Input of the authorization write. */
export type ProviderWatchAuthorizeInput = z.infer<typeof ProviderWatchAuthorizeInputSchema>;

/** Response shape map: path to the types seen there. */
export const ProviderWatchShapeMapSchema = z.record(z.string(), z.string());

/** One measurement's response shapes, by the label of the request. */
export const ProviderWatchShapesSchema = z.record(z.string(), ProviderWatchShapeMapSchema);

/** One measurement whose observed shape the owner can review. */
export const ProviderWatchShapeReviewSchema = z.object({
    measurementId: z.string(),
    account: ProviderWatchAccountKindSchema,
    /** Run that observed `observed`. */
    runId: z.string().uuid(),
    observedAt: z.string().datetime({ offset: true }),
    observed: ProviderWatchShapesSchema,
    /** The accepted shapes; `null` when none was accepted yet. */
    accepted: ProviderWatchShapesSchema.nullable(),
    acceptedAt: z.string().datetime({ offset: true }).nullable(),
    acceptedBy: z.string().uuid().nullable(),
    /** Whether `observed` is already the accepted baseline. */
    inSync: z.boolean(),
    /** Added, removed and retyped fields, one line each. */
    differences: z.array(z.string())
});

/** One measurement whose observed shape the owner can review. */
export type ProviderWatchShapeReview = z.infer<typeof ProviderWatchShapeReviewSchema>;

/** Body of the acceptance: the owner accepts what run `runId` observed for the measurement. */
export const ProviderWatchAcceptShapeInputSchema = z.object({
    account: ProviderWatchAccountKindSchema,
    runId: z.string().uuid()
});

/** Input of the shape acceptance. */
export type ProviderWatchAcceptShapeInput = z.infer<typeof ProviderWatchAcceptShapeInputSchema>;
