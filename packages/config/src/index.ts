/**
 * @repo/config - Centralized configuration utilities for the monorepo
 *
 * This package provides utilities for managing environment variables
 * and configuration across different apps in the monorepo.
 */

export {
    EnvValidationError,
    commonEnvMappings,
    commonEnvSchemas,
    createStartupValidator,
    exposeSharedEnv,
    getEnv,
    getEnvBoolean,
    getEnvNumber,
    validateEnv,
    type EnvMapping
} from './env.js';
