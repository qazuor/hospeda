/** The six temporary billing answers watched by GUARD:G13. */
import {
    CanChargeArgsSchema,
    CanChargeResponseSchema,
    RetentionStoppedArgsSchema,
    RetentionStoppedResponseSchema,
    type CanChargeArgs,
    type CanChargeResponse,
    type CoverageSource,
    type RetentionStoppedArgs,
    type RetentionStoppedResponse
} from '@repo/billing-verticals-contract';

/** No subscription source is known to the bootstrap implementation. */
export function bootstrapSubscriptionAnswer(): CoverageSource[] {
    return [];
}

/** No courtesy source is known to the bootstrap implementation. */
export function bootstrapCourtesyAnswer(): CoverageSource[] {
    return [];
}

/** No grant source is known to the bootstrap implementation. */
export function bootstrapGrantAnswer(): CoverageSource[] {
    return [];
}

/** No addon source is known to the bootstrap implementation. */
export function bootstrapAddonAnswer(): CoverageSource[] {
    return [];
}

/** Retention is never stopped in the bootstrap implementation. */
export function bootstrapRetentionStoppedAnswer(
    input: RetentionStoppedArgs
): RetentionStoppedResponse {
    RetentionStoppedArgsSchema.parse(input);
    return RetentionStoppedResponseSchema.parse({
        stopped: false,
        pauseEndedAt: null,
        coverageLostAt: null
    });
}

/** The bootstrap implementation never authorizes a charge. */
export function bootstrapCanChargeAnswer(input: CanChargeArgs): CanChargeResponse {
    CanChargeArgsSchema.parse(input);
    return CanChargeResponseSchema.parse({ canCharge: false });
}
