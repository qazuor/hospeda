/**
 * @repo/config - Centralized configuration utilities for the monorepo
 *
 * This package provides utilities for managing environment variables
 * and configuration across different apps in the monorepo.
 */

export {
    commonEnvMappings,
    commonEnvSchemas,
    createStartupValidator,
    type EnvMapping,
    EnvValidationError,
    exposeSharedEnv,
    getEnv,
    getEnvBoolean,
    getEnvNumber,
    validateEnv
} from './env.js';
export {
    API_CONFIG_ENV_VARS,
    type AppId,
    CLIENT_ADMIN_ENV_VARS,
    CLIENT_WEB_ENV_VARS,
    DOCKER_ENV_VARS,
    ENV_REGISTRY,
    type EnvVarDefinition,
    type EnvVarType,
    HOSPEDA_ENV_VARS,
    SYSTEM_ENV_VARS
} from './env-registry.js';
export {
    type ExchangeRateConfig,
    ExchangeRateSchema,
    parseExchangeRateSchema
} from './sections/exchange-rate.schema.js';
export {
    type FeedbackConfig,
    FeedbackSchema,
    parseFeedbackSchema
} from './sections/feedback.schema.js';
