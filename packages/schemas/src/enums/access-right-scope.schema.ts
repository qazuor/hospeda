import { z } from 'zod';
import { AccessRightScopeEnum } from './access-right-scope.enum.js';

/**
 * Access right scope enum schema for validation
 */
export const AccessRightScopeEnumSchema = z.nativeEnum(AccessRightScopeEnum, {
    message: 'zodError.enums.accessRightScope.invalid'
});
export type AccessRightScopeSchema = z.infer<typeof AccessRightScopeEnumSchema>;
