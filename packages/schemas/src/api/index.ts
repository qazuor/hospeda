/**
 * API-specific schemas
 * These schemas are used exclusively by the API routes
 */

export * from './api.schema.js'; // Query parameters (pagination, sort, search, date/price/location ranges)
export * from './health.schema.js'; // Health check schemas (health, database, liveness, readiness)
export * from './params.schema.js'; // Path parameters (IDs, slugs, entity-specific parameters)
export * from './response.schema.js'; // Response structures (success, error, paginated, list, stats)
export * from './result.schema.js'; // Result schemas (success, delete, restore, assignment, removal)
