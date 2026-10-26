import { z } from 'zod';
import { CancellationReasonEnum } from './cancellation-reason.enum.js';

export const CancellationReasonSchema = z.nativeEnum(CancellationReasonEnum);
export type CancellationReason = z.infer<typeof CancellationReasonSchema>;
