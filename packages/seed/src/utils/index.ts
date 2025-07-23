/**
 * Utility functions for the seed package.
 *
 * This module provides a centralized export point for all utility functions
 * used throughout the seeding process, including:
 * - Core utilities for database operations and ID mapping
 * - Factory systems for creating seeds and relations
 * - Normalizers for data transformation
 * - Error handlers for robust error management
 * - Relation builders for entity relationships
 */

export * from './actor';
export * from './icons';
export * from './logger';
export * from './seedContext';
export * from './validateAllManifests';

// Core utilities
export { IdMapper } from './idMapper.js';
export { loadJsonFiles } from './loadJsonFile.js';
export { createSeedContext, defaultSeedContext, type SeedContext } from './seedContext.js';
export { seedRunner } from './seedRunner.js';
export { summaryTracker } from './summaryTracker.js';

// Factory system
export { createSeedFactory, type SeedFactoryConfig } from './seedFactory.js';

// Normalizers
export {
    createCombinedNormalizer,
    createDateTransformer,
    createExcludingNormalizer,
    createFieldMapper,
    createIncludingNormalizer
} from './normalizers.js';

// Relation builders
export {
    createCustomRelationBuilder,
    createManyToManyRelation,
    createOneToManyRelation
} from './relationBuilders.js';

// Service relation builders
export {
    createServiceRelationBuilder,
    type ServiceRelationBuilderConfig
} from './serviceRelationBuilder.js';

// Error handlers
export {
    createContinueOnErrorHandler,
    createDetailedErrorHandler,
    createGroupedErrorHandler,
    createRetryErrorHandler,
    defaultErrorHandler
} from './errorHandlers.js';
