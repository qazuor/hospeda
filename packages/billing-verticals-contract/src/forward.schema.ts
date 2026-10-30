/**
 * The rest of the forward direction (what verticals asks billing), besides
 * `coverage`: `retentionStopped` and `canCharge` (contract §4.1), and the
 * coverage-changed notice billing pushes (contract §3).
 */
import { z } from 'zod';
import { CoverageSourceTypeSchema } from './coverage.schema';
import { InstantSchema, UserIdSchema, UserVerticalArgsSchema } from './primitives.schema';

/** The argument of `retentionStopped` (`retenciónDetenida(user, vertical)`). */
export const RetentionStoppedArgsSchema = UserVerticalArgsSchema;

/** The argument of `retentionStopped`. */
export type RetentionStoppedArgs = z.infer<typeof RetentionStoppedArgsSchema>;

/**
 * The response of `retentionStopped` (contract §4.1): `detenida` →
 * `stopped`; `pausaTerminadaEn` → `pauseEndedAt`; `coberturaPerdidaEn` →
 * `coverageLostAt`. `NINGUNO` is `null`.
 */
export const RetentionStoppedResponseSchema = z.strictObject({
    stopped: z.boolean(),
    pauseEndedAt: InstantSchema.nullable(),
    coverageLostAt: InstantSchema.nullable()
});

/** The response of `retentionStopped`. */
export type RetentionStoppedResponse = z.infer<typeof RetentionStoppedResponseSchema>;

/** The argument of `canCharge` (`puedeCobrarle(user)`): the whole account, no vertical. */
export const CanChargeArgsSchema = z.strictObject({ userId: UserIdSchema });

/** The argument of `canCharge`. */
export type CanChargeArgs = z.infer<typeof CanChargeArgsSchema>;

/** The response of `canCharge`: a yes or no, with no state (contract §4.1). */
export const CanChargeResponseSchema = z.strictObject({ canCharge: z.boolean() });

/** The response of `canCharge`. */
export type CanChargeResponse = z.infer<typeof CanChargeResponseSchema>;

/**
 * Which way a source changed: it appeared, it went away, or one of its fields
 * (`reference`, `since`, `until`, `scope`, `target`, `charged`, `floor`)
 * changed (contract §3, "quién emite").
 */
export const CoverageChangeSchema = z.enum(['ADDED', 'REMOVED', 'CHANGED']);

/** Which way a source changed. */
export type CoverageChange = z.infer<typeof CoverageChangeSchema>;

/**
 * The coverage-changed notice ("la cobertura de (user, vertical) cambió",
 * contract §3): which source changed and in which direction. It is emitted
 * AFTER the commit of the write that changed the answer, never inside its
 * transaction, and it is not believed: a consumer asks `coverage` again.
 */
export const CoverageChangedEventSchema = z.strictObject({
    userId: UserIdSchema,
    vertical: UserVerticalArgsSchema.shape.vertical,
    sourceType: CoverageSourceTypeSchema,
    change: CoverageChangeSchema
});

/** The coverage-changed notice. */
export type CoverageChangedEvent = z.infer<typeof CoverageChangedEventSchema>;
