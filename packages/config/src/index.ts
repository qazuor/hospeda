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

export {
    ExchangeRateSchema,
    parseExchangeRateSchema,
    type ExchangeRateConfig
} from './sections/exchange-rate.schema.js';

export {
    FeedbackSchema,
    parseFeedbackSchema,
    type FeedbackConfig
} from './sections/feedback.schema.js';

export {
    ENV_REGISTRY,
    HOSPEDA_ENV_VARS,
    API_CONFIG_ENV_VARS,
    CLIENT_WEB_ENV_VARS,
    CLIENT_ADMIN_ENV_VARS,
    DOCKER_ENV_VARS,
    SYSTEM_ENV_VARS,
    type AppId,
    type EnvVarDefinition,
    type EnvVarType
} from './env-registry.js';
