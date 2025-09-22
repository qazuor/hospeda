import { z } from 'zod';
import { EntityPermissionReasonEnum } from './entity-permission-reason.enum.js';

export const EntityPermissionReasonEnumSchema = z.nativeEnum(EntityPermissionReasonEnum, {
    error: () => ({ message: 'zodError.enums.entityPermissionReason.invalid' })
});
