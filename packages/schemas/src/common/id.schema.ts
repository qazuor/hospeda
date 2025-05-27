import { z } from 'zod';

export const IdSchema = z
    .string({
        required_error: 'zodError.common.id.required',
        invalid_type_error: 'zodError.common.id.invalidType'
    })
    .min(1, { message: 'zodError.common.id.empty' });
