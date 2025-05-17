import type { z } from 'zod';
import type { BaseEntitySchema } from '../common.schema.js';

export const SlugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const TimeRegExp = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const omittedBaseEntityFieldsForActions: (keyof z.infer<typeof BaseEntitySchema>)[] = [
    'id',
    'createdAt',
    'updatedAt',
    'deletedAt',
    'deletedById'
];
