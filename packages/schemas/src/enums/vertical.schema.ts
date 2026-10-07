import { z } from 'zod';
import { VerticalEnum } from './vertical.enum.js';

/**
 * Zod schema for {@link VerticalEnum}.
 *
 * Derived with `z.nativeEnum` so it widens with the vocabulary and never needs
 * restating. Do not replace it with a hand-written `z.enum([...])`.
 */
export const VerticalEnumSchema = z.nativeEnum(VerticalEnum);
export type Vertical = z.infer<typeof VerticalEnumSchema>;

/**
 * The enum's values as plain string literals, for typing anything a caller
 * passes a literal to.
 */
export type VerticalValue = `${VerticalEnum}`;
