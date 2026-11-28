import { z } from 'zod';
import { DirectEmailSuppressionReasonEnum } from './direct-email-suppression-reason.enum.js';

export const DirectEmailSuppressionReasonEnumSchema = z.nativeEnum(
    DirectEmailSuppressionReasonEnum,
    {
        error: () => ({ message: 'zodError.enums.directEmailSuppressionReason.invalid' })
    }
);
