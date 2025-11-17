import { z } from 'zod';
import { SupportLevelEnum } from './support-level.enum';

export const SupportLevelSchema = z.nativeEnum(SupportLevelEnum, {
    message: 'zodError.enums.supportLevel.invalid'
});
