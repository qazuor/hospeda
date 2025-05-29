import { z } from 'zod';

export const IdSchema = z
    .string({
        required_error: 'zodError.common.id.required',
        invalid_type_error: 'zodError.common.id.invalidType'
    })
    .uuid({ message: 'zodError.common.id.invalidUuid' });
