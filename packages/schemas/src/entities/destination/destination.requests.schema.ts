import { DestinationFilterInputSchema } from './destination.schema.js';
import {
    CreateDestinationServiceSchema,
    UpdateDestinationServiceSchema
} from './destination.service.schema.js';

/**
 * Request schemas for Destination entity (API-facing).
 * These mirror the organization used in `accommodation`.
 */

/**
 * Schema used to validate body for creating a Destination via API.
 */
export const DestinationCreateSchema = CreateDestinationServiceSchema;
export type DestinationCreateRequest = import('zod').infer<typeof DestinationCreateSchema>;

/**
 * Schema used to validate body for updating a Destination via API.
 */
export const DestinationUpdateSchema = UpdateDestinationServiceSchema;
export type DestinationUpdateRequest = import('zod').infer<typeof DestinationUpdateSchema>;

/**
 * Schema for filtering Destinations in list endpoints (query params).
 */
export const DestinationFilterSchema = DestinationFilterInputSchema;
export type DestinationFilterRequest = import('zod').infer<typeof DestinationFilterSchema>;

/**
 * Schema for destination search (kept aligned with filters for now).
 * TODO: Extend with advanced search fields if needed.
 */
export const DestinationSearchSchema = DestinationFilterSchema;
export type DestinationSearchRequest = import('zod').infer<typeof DestinationSearchSchema>;
