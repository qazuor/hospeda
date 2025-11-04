/**
 * AI Image Generation Package
 *
 * @description Generic, configurable, extensible package for AI-powered
 * image generation with multi-provider support
 *
 * @module @repo/ai-image-generation
 */

// Export configuration
export { loadEnvConfig, type EnvConfig } from './config';

// Export core functionality
export { MockupGenerator } from './core';

// Export utilities
export {
    ErrorHandler,
    craftPrompt,
    sanitizePrompt,
    FileSystemManager,
    MetadataRegistry,
    CostTracker,
    type UsageData,
    type ThresholdResult
} from './utils';

// Export types
export {
    ErrorCode,
    MockupError,
    type MockupGeneratorConfig,
    type GenerateParams,
    type GenerateResult,
    type GenerationMetadata,
    type DeviceType,
    type StyleType,
    type Language,
    type PromptOptions,
    type SaveMockupOptions,
    type MockupMetadata,
    type Registry
} from './types';
