import { z } from 'zod';
import { SocialApprovalStatusEnum } from './social-approval-status.enum.js';

/**
 * Zod schema for {@link SocialApprovalStatusEnum} validation.
 * Accepts all 4 approval status values.
 */
export const SocialApprovalStatusEnumSchema = z.nativeEnum(SocialApprovalStatusEnum, {
    error: () => ({ message: 'zodError.enums.socialApprovalStatus.invalid' })
});

/** TypeScript type inferred from {@link SocialApprovalStatusEnumSchema}. */
export type SocialApprovalStatus = z.infer<typeof SocialApprovalStatusEnumSchema>;
