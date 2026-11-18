import { z } from 'zod';
import { EntityInteractionKindEnum } from './entity-interaction-kind.enum.js';

/**
 * Zod schema for {@link EntityInteractionKindEnum} validation (HOS-2256).
 */
export const EntityInteractionKindEnumSchema = z.nativeEnum(EntityInteractionKindEnum, {
    message: 'zodError.enums.entityInteractionKind.invalid'
});

/** TypeScript type inferred from {@link EntityInteractionKindEnumSchema}. */
export type EntityInteractionKind = z.infer<typeof EntityInteractionKindEnumSchema>;
