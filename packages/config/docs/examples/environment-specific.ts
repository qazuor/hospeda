/**
 * Environment-Specific Configuration Example
 *
 * Demonstrates how to handle different configuration
 * for development, test, staging, and production environments.
 *
 * Key Concepts:
 * - Environment detection
 * - Environment-specific schemas
 * - Conditional defaults
 * - Override patterns
 * - Safe environment switching
 *
 * @packageDocumentation
 */

import { z } from 'zod';

// ============================================================================
// 1. ENVIRONMENT DETECTION
// ============================================================================

/**
 * Valid environment types
 */
export type Environment = 'development' | 'test' | 'staging' | 'production';

/**
 * Detect current environment from NODE_ENV
 *
 * @returns Current environment
 *
 * @example
 * ```typescript
 * const env = getEnvironment();
 * console.log(env); // 'development'
 * ```
 */
export function getEnvironment(): Environment {
  const env = process.env.NODE_ENV || 'development';

  if (env === 'test') return 'test';
  if (env === 'production') return 'production';
  if (env === 'staging') return 'staging';

  return 'development';
}

/**
 * Check if current environment is development
 */
export function isDevelopment(): boolean {
  return getEnvironment() === 'development';
}

/**
 * Check if current environment is production
 */
export function isProduction(): boolean {
  return getEnvironment() === 'production';
}

/**
 * Check if current environment is test
 */
export function isTest(): boolean {
  return getEnvironment() === 'test';
}

/**
 * Check if current environment is staging
 */
export function isStaging(): boolean {
  return getEnvironment() === 'staging';
}

// ============================================================================
// 2. ENVIRONMENT-SPECIFIC SCHEMAS
// ============================================================================

/**
 * Development Configuration Schema
 *
 * Relaxed validation and helpful defaults for local development
 */
export const DevelopmentConfigSchema = z.object({
  API_PORT: z.coerce.number().default(3000),

  API_HOST: z.string().default('http://localhost'),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('debug'),

  ENABLE_DEBUG: z.coerce.boolean().default(true),

  DATABASE_SSL: z.coerce.boolean().default(false),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:4321')
    .transform((val) => val.split(',').map((s) => s.trim())),
});

/**
 * Test Configuration Schema
 *
 * Minimal logging, mocked services
 */
export const TestConfigSchema = z.object({
  API_PORT: z.coerce.number().default(3001),

  API_HOST: z.string().default('http://localhost'),

  LOG_LEVEL: z.enum(['warn', 'error']).default('warn'), // Less verbose

  ENABLE_DEBUG: z.literal(false).default(false), // Never debug in tests

  DATABASE_SSL: z.coerce.boolean().default(false),

  CORS_ORIGINS: z
    .string()
    .default('*')
    .transform((val) => val.split(',').map((s) => s.trim())),
});

/**
 * Staging Configuration Schema
 *
 * Production-like but with test credentials
 */
export const StagingConfigSchema = z.object({
  API_PORT: z.coerce.number().default(8080),

  API_HOST: z.string().url(), // Required in staging

  LOG_LEVEL: z.enum(['info', 'warn', 'error']).default('info'),

  ENABLE_DEBUG: z.literal(false).default(false),

  DATABASE_SSL: z.literal(true).default(true), // Always SSL

  CORS_ORIGINS: z
    .string()
    .transform((val) => val.split(',').map((s) => s.trim()))
    .pipe(z.array(z.string().url())), // Must be valid URLs
});

/**
 * Production Configuration Schema
 *
 * Strict validation, secure defaults, no debug
 */
export const ProductionConfigSchema = z.object({
  API_PORT: z.coerce.number().default(8080),

  API_HOST: z.string().url(), // Required and must be valid URL

  LOG_LEVEL: z.enum(['info', 'warn', 'error']).default('warn'), // No debug

  ENABLE_DEBUG: z.literal(false).default(false), // Always false

  DATABASE_SSL: z.literal(true).default(true), // Always true

  CORS_ORIGINS: z
    .string()
    .min(1, 'CORS_ORIGINS required in production')
    .transform((val) => val.split(',').map((s) => s.trim()))
    .pipe(z.array(z.string().url())), // Must be valid URLs
});

// ============================================================================
// 3. CONFIGURATION TYPES
// ============================================================================

/**
 * Configuration type (inferred from schemas)
 */
export type ConfigType = z.infer<typeof DevelopmentConfigSchema>;

// All schemas produce compatible types
type DevConfig = z.infer<typeof DevelopmentConfigSchema>;
type TestConfig = z.infer<typeof TestConfigSchema>;
type StagingConfig = z.infer<typeof StagingConfigSchema>;
type ProdConfig = z.infer<typeof ProductionConfigSchema>;

// ============================================================================
// 4. DEFAULT VALUES PER ENVIRONMENT
// ============================================================================

/**
 * Default configuration values for each environment
 *
 * These are used as fallbacks when environment variables
 * are not provided.
 */
export const environmentDefaults: Record<Environment, Partial<ConfigType>> = {
  development: {
    API_PORT: 3000,
    API_HOST: 'http://localhost',
    LOG_LEVEL: 'debug',
    ENABLE_DEBUG: true,
    DATABASE_SSL: false,
    CORS_ORIGINS: ['http://localhost:3000', 'http://localhost:4321'],
  },

  test: {
    API_PORT: 3001,
    API_HOST: 'http://localhost',
    LOG_LEVEL: 'warn',
    ENABLE_DEBUG: false,
    DATABASE_SSL: false,
    CORS_ORIGINS: ['*'],
  },

  staging: {
    API_PORT: 8080,
    API_HOST: 'https://staging-api.hospeda.com',
    LOG_LEVEL: 'info',
    ENABLE_DEBUG: false,
    DATABASE_SSL: true,
    CORS_ORIGINS: [
      'https://staging.hospeda.com',
      'https://staging-admin.hospeda.com',
    ],
  },

  production: {
    API_PORT: 8080,
    API_HOST: 'https://api.hospeda.com',
    LOG_LEVEL: 'warn',
    ENABLE_DEBUG: false,
    DATABASE_SSL: true,
    CORS_ORIGINS: [
      'https://hospeda.com',
      'https://www.hospeda.com',
      'https://admin.hospeda.com',
    ],
  },
};

// ============================================================================
// 5. ENVIRONMENT-AWARE CONFIGURATION LOADER
// ============================================================================

/**
 * Get schema for current environment
 *
 * @param environment - Current environment
 * @returns Appropriate Zod schema
 */
export function getSchemaForEnvironment(environment: Environment) {
  switch (environment) {
    case 'development':
      return DevelopmentConfigSchema;
    case 'test':
      return TestConfigSchema;
    case 'staging':
      return StagingConfigSchema;
    case 'production':
      return ProductionConfigSchema;
    default:
      return DevelopmentConfigSchema;
  }
}

/**
 * Load and validate configuration for current environment
 *
 * This function:
 * 1. Detects the current environment
 * 2. Loads environment-specific defaults
 * 3. Overrides with actual environment variables
 * 4. Validates against environment-specific schema
 *
 * @returns Validated configuration
 *
 * @example
 * ```typescript
 * const config = getConfig();
 * console.log(config.API_PORT); // 3000 in dev, 8080 in prod
 * ```
 */
export function getConfig(): ConfigType {
  const environment = getEnvironment();
  const defaults = environmentDefaults[environment];
  const schema = getSchemaForEnvironment(environment);

  // Merge defaults with environment variables
  const merged = {
    ...defaults,
    ...process.env,
  };

  // Validate against environment-specific schema
  return schema.parse(merged);
}

// ============================================================================
// 6. OVERRIDE PATTERNS
// ============================================================================

/**
 * Override configuration with custom values
 *
 * Useful for testing or specific use cases
 *
 * @param overrides - Configuration overrides
 * @returns New configuration with overrides applied
 */
export function overrideConfig(overrides: Partial<ConfigType>): ConfigType {
  const currentConfig = getConfig();

  const merged = {
    ...currentConfig,
    ...overrides,
  };

  const environment = getEnvironment();
  const schema = getSchemaForEnvironment(environment);

  return schema.parse(merged);
}

/**
 * Create test configuration
 *
 * Convenience function for creating test-specific configuration
 *
 * @param overrides - Optional overrides
 * @returns Test configuration
 */
export function createTestConfig(overrides?: Partial<ConfigType>): ConfigType {
  const testDefaults = environmentDefaults.test;

  const merged = {
    ...testDefaults,
    ...overrides,
  };

  return TestConfigSchema.parse(merged);
}

// ============================================================================
// 7. USAGE IN APPLICATION STARTUP
// ============================================================================

/**
 * Initialize application with environment-specific configuration
 *
 * This function demonstrates how to use environment-specific
 * configuration during application startup.
 */
export function initializeApp(): void {
  const environment = getEnvironment();
  const config = getConfig();

  console.log(`🚀 Starting in ${environment} mode`);
  console.log(`📍 API Host: ${config.API_HOST}`);
  console.log(`🔧 Debug: ${config.ENABLE_DEBUG}`);
  console.log(`📊 Log Level: ${config.LOG_LEVEL}`);
  console.log(`🔒 Database SSL: ${config.DATABASE_SSL}`);
  console.log(`🌐 CORS Origins: ${config.CORS_ORIGINS.join(', ')}`);

  // Environment-specific initialization
  if (isDevelopment()) {
    console.log('💡 Development mode: Hot reload enabled');
  }

  if (isProduction()) {
    console.log('🚀 Production mode: Performance optimizations enabled');
  }

  if (isTest()) {
    console.log('🧪 Test mode: Minimal logging');
  }
}

// ============================================================================
// 8. ENVIRONMENT-SPECIFIC FEATURE FLAGS
// ============================================================================

/**
 * Feature flags based on environment
 */
export function getFeatureFlags(environment: Environment) {
  return {
    enableHotReload: environment === 'development',
    enableProfiling: environment === 'development' || environment === 'staging',
    enableAnalytics: environment === 'production' || environment === 'staging',
    enableMocking: environment === 'test',
    enableDebugUI: environment === 'development',
    enableRateLimiting: environment === 'production' || environment === 'staging',
  };
}

// ============================================================================
// 9. TESTING ENVIRONMENT-SPECIFIC CONFIGURATION
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Environment Detection', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should detect development environment', () => {
    vi.stubEnv('NODE_ENV', 'development');

    expect(getEnvironment()).toBe('development');
    expect(isDevelopment()).toBe(true);
    expect(isProduction()).toBe(false);
  });

  it('should detect production environment', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(getEnvironment()).toBe('production');
    expect(isProduction()).toBe(true);
    expect(isDevelopment()).toBe(false);
  });

  it('should default to development', () => {
    vi.unstubAllEnvs();

    expect(getEnvironment()).toBe('development');
  });
});

describe('Environment-Specific Configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should use development defaults', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const config = getConfig();

    expect(config.API_PORT).toBe(3000);
    expect(config.LOG_LEVEL).toBe('debug');
    expect(config.ENABLE_DEBUG).toBe(true);
    expect(config.DATABASE_SSL).toBe(false);
  });

  it('should use production defaults', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('API_HOST', 'https://api.hospeda.com');
    vi.stubEnv('CORS_ORIGINS', 'https://hospeda.com');

    const config = getConfig();

    expect(config.API_PORT).toBe(8080);
    expect(config.LOG_LEVEL).toBe('warn');
    expect(config.ENABLE_DEBUG).toBe(false);
    expect(config.DATABASE_SSL).toBe(true);
  });

  it('should allow environment variable overrides', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('API_PORT', '9000');

    const config = getConfig();

    expect(config.API_PORT).toBe(9000); // Overridden
    expect(config.LOG_LEVEL).toBe('debug'); // Default
  });
});

describe('Configuration Overrides', () => {
  it('should override configuration', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const config = overrideConfig({
      API_PORT: 5000,
      LOG_LEVEL: 'error',
    });

    expect(config.API_PORT).toBe(5000);
    expect(config.LOG_LEVEL).toBe('error');
  });

  it('should create test configuration', () => {
    const config = createTestConfig({
      API_PORT: 4000,
    });

    expect(config.API_PORT).toBe(4000);
    expect(config.LOG_LEVEL).toBe('warn'); // Test default
    expect(config.ENABLE_DEBUG).toBe(false); // Test default
  });
});

describe('Feature Flags', () => {
  it('should enable development features in development', () => {
    const flags = getFeatureFlags('development');

    expect(flags.enableHotReload).toBe(true);
    expect(flags.enableDebugUI).toBe(true);
    expect(flags.enableProfiling).toBe(true);
    expect(flags.enableAnalytics).toBe(false);
    expect(flags.enableRateLimiting).toBe(false);
  });

  it('should enable production features in production', () => {
    const flags = getFeatureFlags('production');

    expect(flags.enableHotReload).toBe(false);
    expect(flags.enableDebugUI).toBe(false);
    expect(flags.enableProfiling).toBe(false);
    expect(flags.enableAnalytics).toBe(true);
    expect(flags.enableRateLimiting).toBe(true);
  });

  it('should enable test features in test', () => {
    const flags = getFeatureFlags('test');

    expect(flags.enableMocking).toBe(true);
    expect(flags.enableHotReload).toBe(false);
  });
});

// ============================================================================
// SUMMARY: Environment-Specific Configuration Best Practices
// ============================================================================

/*
Best Practices Summary:

1. **Environment Detection:**
   - Use NODE_ENV consistently
   - Provide helper functions (isDevelopment, isProduction)
   - Default to development for safety

2. **Schema per Environment:**
   - Different validation rules per environment
   - Stricter validation in production
   - Relaxed defaults in development

3. **Secure Defaults:**
   - SSL enabled by default in staging/production
   - Debug disabled by default in production
   - Restrictive CORS in production

4. **Configuration Hierarchy:**
   - Environment-specific defaults (lowest priority)
   - Environment variables (override defaults)
   - Explicit overrides (highest priority, testing only)

5. **Feature Flags:**
   - Environment-based feature toggles
   - Type-safe flag access
   - Clear flag naming

6. **Testing:**
   - Test each environment configuration
   - Test override patterns
   - Test feature flag behavior

Example Environment Files:

// .env.local (development)
NODE_ENV=development
API_PORT=3000
LOG_LEVEL=debug

// .env.test (test)
NODE_ENV=test
API_PORT=3001
LOG_LEVEL=warn

// Vercel (production)
NODE_ENV=production
API_PORT=8080
API_HOST=https://api.hospeda.com
CORS_ORIGINS=https://hospeda.com,https://admin.hospeda.com
LOG_LEVEL=warn
*/
