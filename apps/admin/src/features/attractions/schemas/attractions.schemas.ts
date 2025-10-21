import { AttractionWithDestinationCountSchema as BaseAttractionListItemSchema } from '@repo/schemas';
import type { z } from 'zod';

/**
 * Admin Attraction Schemas
 *
 * Uses AttractionWithDestinationCountSchema which includes destinationCount
 */
export const AttractionListItemSchema = BaseAttractionListItemSchema;

/**
 * Type for attraction list items
 */
export type Attraction = z.infer<typeof AttractionListItemSchema>;
