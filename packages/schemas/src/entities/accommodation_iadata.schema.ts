import type { AccommodationIaDataType } from '@repo/types';
import { z } from 'zod';

import { BaseEntitySchema } from '../common.schema';

/**
 * Zod schema for AI data linked to an accommodation.
 */
export const AccommodationIaDataSchema: z.ZodType<AccommodationIaDataType> =
    BaseEntitySchema.extend({
        accommodationId: z.string().uuid({
            message: 'error:accommodationIaData.accommodationIdInvalid'
        }),
        title: z.string({
            required_error: 'error:accommodationIaData.titleRequired'
        }),
        content: z.string({
            required_error: 'error:accommodationIaData.contentRequired'
        }),
        category: z.string().optional()
    });
