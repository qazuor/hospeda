import { z } from 'zod';
import { TrialStatusEnum } from './trial-status.enum.js';

/** Zod schema for {@link TrialStatusEnum} (the state of a `trial` row, `V/03` §2). */
export const TrialStatusEnumSchema = z.nativeEnum(TrialStatusEnum, {
    error: () => ({ message: 'zodError.enums.trialStatus.invalid' })
});
/** One status of a `trial` row. */
export type TrialStatusSchema = z.infer<typeof TrialStatusEnumSchema>;
