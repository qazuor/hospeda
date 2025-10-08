import type { AttractionListItem } from '@repo/schemas';
import { AttractionWithDestinationCountSchema as BaseAttractionListItemSchema } from '@repo/schemas';

/**
 * Schema for attraction list items in admin
 * Uses AttractionWithDestinationCountSchema from @repo/schemas
 */
export const AttractionListItemSchema = BaseAttractionListItemSchema;

export type Attraction = AttractionListItem & {
    destinationCount?: number;
};
