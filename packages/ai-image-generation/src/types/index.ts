/**
 * Shared type definitions for AI Image Generation package
 *
 * @module types
 */

/**
 * Error codes for mockup generation failures
 */
export enum ErrorCode {
    MISSING_API_KEY = 'MISSING_API_KEY',
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
    INVALID_PROMPT = 'INVALID_PROMPT',
    DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
    FILE_SYSTEM_ERROR = 'FILE_SYSTEM_ERROR',
    API_ERROR = 'API_ERROR'
}

/**
 * Custom error for mockup generation
 */
export class MockupError extends Error {
    public readonly code: ErrorCode;
    public readonly retryable: boolean;
    public readonly details?: unknown;

    constructor(message: string, code: ErrorCode, retryable = false, details?: unknown) {
        super(message);
        this.name = 'MockupError';
        this.code = code;
        this.retryable = retryable;
        this.details = details;
    }
}

/**
 * Configuration for mockup generator
 */
export interface MockupGeneratorConfig {
    replicateApiToken: string;
    model?: string;
    outputPath: string;
    maxRetries?: number;
}

/**
 * Parameters for generating a mockup
 */
export interface GenerateParams {
    prompt: string;
    filename: string;
}

/**
 * Metadata about generated image
 */
export interface GenerationMetadata {
    generationTime: number;
    retries: number;
    cost: number;
    model: string;
    timestamp: string;
    dimensions?: {
        width: number;
        height: number;
    };
}

/**
 * Result of mockup generation
 */
export interface GenerateResult {
    success: boolean;
    imagePath?: string;
    imageUrl?: string;
    prompt: string;
    error?: string;
    metadata: GenerationMetadata;
}

/**
 * Device types for prompt engineering
 */
export type DeviceType = 'desktop' | 'mobile' | 'tablet';

/**
 * Style types for wireframes
 */
export type StyleType = 'balsamiq' | 'sketch' | 'wireframe';

/**
 * Language options
 */
export type Language = 'es' | 'en';

/**
 * Options for prompt crafting
 */
export interface PromptOptions {
    device?: DeviceType;
    style?: StyleType;
    language?: Language;
}

/**
 * Options for saving mockup
 */
export interface SaveMockupOptions {
    sessionPath: string;
    description: string;
    imageBuffer: Buffer;
    format?: 'png' | 'jpg' | 'webp';
}

/**
 * Mockup metadata for registry
 */
export interface MockupMetadata {
    id: string;
    filename: string;
    prompt: string;
    generatedAt: string;
    cost: number;
    model: string;
    dimensions: {
        width: number;
        height: number;
    };
    references: string[];
}

/**
 * Mockup registry structure
 */
export interface Registry {
    version: string;
    mockups: MockupMetadata[];
    totalCost: number;
    lastUpdated: string;
}
