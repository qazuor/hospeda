/**
 * Type-Safe Configuration Example
 *
 * Demonstrates comprehensive type-safe configuration patterns
 * using Zod schemas and TypeScript type inference.
 *
 * Key Concepts:
 * - Schema definition with Zod
 * - Type inference from schemas
 * - Validated configuration access
 * - Usage in different contexts (API routes, services, tests)
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import type { Hono } from 'hono';

// ============================================================================
// 1. DEFINE SCHEMA WITH ZOD
// ============================================================================

/**
 * Application Configuration Schema
 *
 * Defines the complete structure and validation rules for
 * application configuration.
 */
export const AppConfigSchema = z.object({
  /**
   * API server port
   *
   * Must be between 1000 and 65535 for security
   * (ports below 1024 require root privileges)
   */
  API_PORT: z.coerce
    .number()
    .min(1000, 'Port must be at least 1000')
    .max(65535, 'Port must be at most 65535')
    .int('Port must be an integer'),

  /**
   * API server host
   *
   * Must be a valid URL with http or https protocol
   */
  API_HOST: z
    .string()
    .url('API_HOST must be a valid URL')
    .refine(
      (val) => val.startsWith('http://') || val.startsWith('https://'),
      { message: 'API_HOST must use HTTP or HTTPS protocol' }
    ),

  /**
   * Database connection URL
   *
   * Must be a PostgreSQL connection string
   */
  DATABASE_URL: z
    .string()
    .url('DATABASE_URL must be a valid URL')
    .startsWith('postgresql://', 'DATABASE_URL must be a PostgreSQL connection string'),

  /**
   * Logging level
   *
   * Controls verbosity of application logs
   */
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error'], {
    errorMap: () => ({ message: 'LOG_LEVEL must be debug, info, warn, or error' }),
  }),

  /**
   * Enable caching
   *
   * When true, responses are cached for performance
   *
   * @default true
   */
  ENABLE_CACHING: z.coerce.boolean().default(true),

  /**
   * Node environment
   *
   * Determines which configuration and features are active
   */
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
});

// ============================================================================
// 2. INFER TYPESCRIPT TYPE FROM SCHEMA
// ============================================================================

/**
 * Application Configuration Type
 *
 * This type is automatically inferred from AppConfigSchema.
 * It ensures type safety throughout the application without
 * duplicating type definitions.
 *
 * Inferred type structure:
 * ```typescript
 * {
 *   API_PORT: number;
 *   API_HOST: string;
 *   DATABASE_URL: string;
 *   LOG_LEVEL: "debug" | "info" | "warn" | "error";
 *   ENABLE_CACHING: boolean;
 *   NODE_ENV: "development" | "test" | "staging" | "production";
 * }
 * ```
 */
export type AppConfig = z.infer<typeof AppConfigSchema>;

// Type inference examples:
type PortType = AppConfig['API_PORT']; // number
type LogLevelType = AppConfig['LOG_LEVEL']; // "debug" | "info" | "warn" | "error"
type CachingType = AppConfig['ENABLE_CACHING']; // boolean

// ============================================================================
// 3. VALIDATE AND PARSE CONFIGURATION
// ============================================================================

/**
 * Validated application configuration
 *
 * This configuration is parsed and validated when the module loads.
 * If validation fails, the application will not start.
 *
 * All values are guaranteed to match the schema constraints.
 */
export const appConfig: AppConfig = AppConfigSchema.parse(process.env);

// TypeScript knows the exact types:
const port: number = appConfig.API_PORT;
const logLevel: 'debug' | 'info' | 'warn' | 'error' = appConfig.LOG_LEVEL;
const caching: boolean = appConfig.ENABLE_CACHING;

// ============================================================================
// 4. USE IN API ROUTES (Type-Safe)
// ============================================================================

/**
 * Setup API server with type-safe configuration
 *
 * TypeScript ensures configuration is used correctly
 *
 * @param app - Hono application instance
 */
export function setupServer(app: Hono): void {
  /**
   * Health check endpoint
   *
   * Returns server status and configuration details
   */
  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      port: appConfig.API_PORT, // TypeScript knows this is number
      caching: appConfig.ENABLE_CACHING, // TypeScript knows this is boolean
      environment: appConfig.NODE_ENV, // TypeScript knows valid values
    });
  });

  /**
   * Configuration endpoint
   *
   * Returns public configuration details
   */
  app.get('/config', (c) => {
    // TypeScript provides autocomplete for all config properties
    return c.json({
      environment: appConfig.NODE_ENV,
      version: '1.0.0',
      features: {
        caching: appConfig.ENABLE_CACHING,
      },
    });
  });

  /**
   * Start server
   *
   * TypeScript ensures port is a number
   */
  app.listen(appConfig.API_PORT, () => {
    // TypeScript knows LOG_LEVEL is one of the enum values
    if (appConfig.LOG_LEVEL === 'debug') {
      console.log('Debug mode enabled');
    }

    console.log(`Server running on port ${appConfig.API_PORT}`);
  });
}

// ============================================================================
// 5. USE IN SERVICES (Type-Safe)
// ============================================================================

/**
 * Cache Service with type-safe configuration
 *
 * Demonstrates how configuration type safety extends
 * to service implementations
 */
export class CacheService {
  /**
   * Whether caching is enabled
   *
   * TypeScript knows this is a boolean from the schema
   */
  private enabled: boolean = appConfig.ENABLE_CACHING;

  /**
   * Get value from cache
   *
   * @param key - Cache key
   * @returns Cached value or null
   */
  async get(key: string): Promise<string | null> {
    // TypeScript ensures boolean check
    if (!this.enabled) {
      return null;
    }

    // Cache implementation...
    return null;
  }

  /**
   * Set value in cache
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds
   */
  async set(key: string, value: string, ttl: number): Promise<void> {
    if (!this.enabled) {
      return;
    }

    // Cache implementation...
  }

  /**
   * Check if caching is enabled
   *
   * @returns True if caching is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * Database Service with type-safe configuration
 */
export class DatabaseService {
  /**
   * Database connection URL
   *
   * TypeScript knows this is a string validated as PostgreSQL URL
   */
  private connectionUrl: string = appConfig.DATABASE_URL;

  /**
   * Connect to database
   *
   * Uses validated DATABASE_URL from configuration
   */
  async connect(): Promise<void> {
    // TypeScript ensures connectionUrl is a string
    console.log(`Connecting to ${this.connectionUrl}`);

    // Connection implementation...
  }

  /**
   * Get database URL (for internal use)
   *
   * @returns Database connection URL
   */
  getConnectionUrl(): string {
    return this.connectionUrl;
  }
}

/**
 * Logger Service with type-safe configuration
 */
export class LoggerService {
  /**
   * Current log level
   *
   * TypeScript knows this is one of: debug, info, warn, error
   */
  private level: AppConfig['LOG_LEVEL'] = appConfig.LOG_LEVEL;

  /**
   * Log debug message
   *
   * Only logs if LOG_LEVEL is 'debug'
   */
  debug(message: string): void {
    // TypeScript knows valid LOG_LEVEL values
    if (this.level === 'debug') {
      console.log(`[DEBUG] ${message}`);
    }
  }

  /**
   * Log info message
   *
   * Logs if LOG_LEVEL is 'debug' or 'info'
   */
  info(message: string): void {
    if (this.level === 'debug' || this.level === 'info') {
      console.log(`[INFO] ${message}`);
    }
  }

  /**
   * Log warning message
   *
   * Logs if LOG_LEVEL is not 'error'
   */
  warn(message: string): void {
    if (this.level !== 'error') {
      console.warn(`[WARN] ${message}`);
    }
  }

  /**
   * Log error message
   *
   * Always logs (error level is always enabled)
   */
  error(message: string): void {
    console.error(`[ERROR] ${message}`);
  }
}

// ============================================================================
// 6. TEST WITH MOCK CONFIGURATION (Type-Safe)
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('AppConfig', () => {
  beforeEach(() => {
    // Mock environment variables
    vi.stubEnv('API_PORT', '3000');
    vi.stubEnv('API_HOST', 'http://localhost');
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/test');
    vi.stubEnv('LOG_LEVEL', 'info');
    vi.stubEnv('ENABLE_CACHING', 'true');
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should parse valid configuration', () => {
    const config = AppConfigSchema.parse(process.env);

    // TypeScript knows exact types
    expect(config.API_PORT).toBe(3000);
    expect(typeof config.API_PORT).toBe('number');

    expect(config.LOG_LEVEL).toBe('info');

    expect(config.ENABLE_CACHING).toBe(true);
    expect(typeof config.ENABLE_CACHING).toBe('boolean');
  });

  it('should provide type-safe access', () => {
    const config = AppConfigSchema.parse(process.env);

    // TypeScript autocomplete and type checking
    const port: number = config.API_PORT;
    const logLevel: 'debug' | 'info' | 'warn' | 'error' = config.LOG_LEVEL;

    expect(port).toBe(3000);
    expect(logLevel).toBe('info');
  });

  it('should use default values', () => {
    vi.unstubAllEnvs();
    vi.stubEnv('API_PORT', '3000');
    vi.stubEnv('API_HOST', 'http://localhost');
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/test');
    // LOG_LEVEL not set

    const config = AppConfigSchema.parse(process.env);

    // Default values are type-safe
    expect(config.ENABLE_CACHING).toBe(true); // Default
    expect(config.NODE_ENV).toBe('development'); // Default
  });
});

describe('CacheService', () => {
  it('should use configuration correctly', () => {
    const service = new CacheService();

    // TypeScript knows isEnabled() returns boolean
    const enabled: boolean = service.isEnabled();

    expect(enabled).toBe(true);
  });
});

describe('DatabaseService', () => {
  it('should use validated database URL', () => {
    const service = new DatabaseService();

    // TypeScript knows getConnectionUrl() returns string
    const url: string = service.getConnectionUrl();

    expect(url).toBe('postgresql://localhost/test');
    expect(url.startsWith('postgresql://')).toBe(true);
  });
});

describe('LoggerService', () => {
  it('should respect log level', () => {
    vi.stubEnv('LOG_LEVEL', 'warn');

    const config = AppConfigSchema.parse(process.env);
    const logger = new LoggerService();

    // TypeScript ensures LOG_LEVEL is one of the enum values
    expect(config.LOG_LEVEL).toBe('warn');

    // Logger uses type-safe configuration
    logger.debug('This should not log'); // Won't log (level is warn)
    logger.warn('This should log'); // Will log
  });
});

// ============================================================================
// 7. ADVANCED TYPE SAFETY PATTERNS
// ============================================================================

/**
 * Conditional configuration based on environment
 *
 * Demonstrates type-safe environment-specific behavior
 */
export function getEnvironmentConfig(): {
  isDevelopment: boolean;
  isProduction: boolean;
  debugEnabled: boolean;
} {
  // TypeScript knows NODE_ENV is one of the valid values
  const env = appConfig.NODE_ENV;

  return {
    isDevelopment: env === 'development',
    isProduction: env === 'production',
    debugEnabled: appConfig.LOG_LEVEL === 'debug',
  };
}

/**
 * Validate configuration at runtime with type safety
 *
 * @param config - Configuration to validate
 * @returns True if valid
 */
export function isValidConfig(config: unknown): config is AppConfig {
  const result = AppConfigSchema.safeParse(config);
  return result.success;
}

/**
 * Merge configurations with type safety
 *
 * @param base - Base configuration
 * @param override - Configuration overrides
 * @returns Merged configuration
 */
export function mergeConfig(
  base: AppConfig,
  override: Partial<AppConfig>
): AppConfig {
  return AppConfigSchema.parse({
    ...base,
    ...override,
  });
}

// ============================================================================
// SUMMARY: Type Safety Benefits
// ============================================================================

/*
Benefits of Type-Safe Configuration:

1. **Compile-Time Errors:**
   - TypeScript catches invalid usage before runtime
   - Autocomplete for all configuration properties
   - Refactoring is safe (find all references)

2. **Runtime Validation:**
   - Zod validates at application startup
   - Clear error messages for invalid configuration
   - Guaranteed valid values

3. **Developer Experience:**
   - IntelliSense/autocomplete in IDE
   - Type hints while coding
   - Reduced debugging time

4. **Maintainability:**
   - Single source of truth (Zod schema)
   - Types automatically updated
   - Documentation in code

5. **Safety:**
   - No typos in property names
   - No invalid values
   - Required fields guaranteed to exist

Example of prevented errors:

// ❌ Would fail at compile time:
const port: string = appConfig.API_PORT; // Type 'number' is not assignable to type 'string'
const level = appConfig.LOG_LEVL; // Property 'LOG_LEVL' does not exist

// ✅ Type-safe usage:
const port: number = appConfig.API_PORT;
const level = appConfig.LOG_LEVEL;
*/
