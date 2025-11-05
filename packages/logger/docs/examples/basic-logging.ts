/**
 * Example: Basic Logging
 *
 * Demonstrates fundamental logging patterns using @repo/logger:
 * - All log methods (log, info, warn, error, debug)
 * - Log level configuration and filtering
 * - Labels and context information
 * - Environment-specific configuration
 * - Production vs development setup
 *
 * This example shows the most common logging patterns you'll use
 * in day-to-day development.
 *
 * @module examples/basic-logging
 */

import {
  logger,
  configureLogger,
  type LogLevel,
  type LoggerOptions,
} from '@repo/logger';

/**
 * User entity for example purposes
 */
interface User {
  id: string;
  email: string;
  name: string;
  role: 'guest' | 'host' | 'admin';
}

/**
 * Accommodation entity for example purposes
 */
interface Accommodation {
  id: string;
  title: string;
  city: string;
  pricePerNight: number;
  hostId: string;
}

/**
 * Configuration for example environments
 */
interface EnvironmentConfig {
  logLevel: LogLevel;
  enableColors: boolean;
  enableTimestamps: boolean;
  enableLabels: boolean;
}

// ============================================================================
// Example 1: Basic Log Methods
// ============================================================================

/**
 * Demonstrates all available log methods
 *
 * Each method has a specific purpose:
 * - log(): General information, default level
 * - info(): Informational messages, system events
 * - warn(): Warning conditions, potential issues
 * - error(): Error conditions, failures
 * - debug(): Detailed debugging information
 */
function demonstrateLogMethods(): void {
  logger.log('This is a general log message');
  logger.log('Use log() for standard information output');

  logger.info('This is an informational message');
  logger.info('Use info() for system events and notifications');

  logger.warn('This is a warning message');
  logger.warn('Use warn() for potential issues that need attention');

  logger.error('This is an error message');
  logger.error('Use error() for failures and error conditions');

  logger.debug('This is a debug message');
  logger.debug('Use debug() for detailed troubleshooting information');
}

// ============================================================================
// Example 2: Log Levels and Filtering
// ============================================================================

/**
 * Demonstrates log level filtering
 *
 * Log levels control which messages are displayed:
 * - LOG (0): Shows all messages
 * - INFO (1): Shows info, warn, error (hides log, debug)
 * - WARN (2): Shows warn, error (hides log, info, debug)
 * - ERROR (3): Shows only error (hides all others)
 * - DEBUG (-1): Shows all including debug messages
 */
function demonstrateLogLevels(): void {
  logger.log('\n=== Log Level: LOG (default) ===');
  configureLogger({ level: 'LOG' });
  logger.log('LOG level: This message is visible');
  logger.info('LOG level: Info is visible');
  logger.warn('LOG level: Warn is visible');
  logger.error('LOG level: Error is visible');
  logger.debug('LOG level: Debug is hidden');

  logger.log('\n=== Log Level: INFO ===');
  configureLogger({ level: 'INFO' });
  logger.log('INFO level: Log is hidden');
  logger.info('INFO level: Info is visible');
  logger.warn('INFO level: Warn is visible');
  logger.error('INFO level: Error is visible');
  logger.debug('INFO level: Debug is hidden');

  logger.log('\n=== Log Level: WARN ===');
  configureLogger({ level: 'WARN' });
  logger.log('WARN level: Log is hidden');
  logger.info('WARN level: Info is hidden');
  logger.warn('WARN level: Warn is visible');
  logger.error('WARN level: Error is visible');
  logger.debug('WARN level: Debug is hidden');

  logger.log('\n=== Log Level: ERROR ===');
  configureLogger({ level: 'ERROR' });
  logger.log('ERROR level: Log is hidden');
  logger.info('ERROR level: Info is hidden');
  logger.warn('ERROR level: Warn is hidden');
  logger.error('ERROR level: Error is visible');
  logger.debug('ERROR level: Debug is hidden');

  logger.log('\n=== Log Level: DEBUG ===');
  configureLogger({ level: 'DEBUG' });
  logger.log('DEBUG level: Log is visible');
  logger.info('DEBUG level: Info is visible');
  logger.warn('DEBUG level: Warn is visible');
  logger.error('DEBUG level: Error is visible');
  logger.debug('DEBUG level: Debug is visible');

  // Reset to default
  configureLogger({ level: 'LOG' });
}

// ============================================================================
// Example 3: Labels and Context
// ============================================================================

/**
 * Demonstrates using labels for message context
 *
 * Labels help categorize and identify log sources:
 * - Module names (Service, Controller, Repository)
 * - Operation types (CREATE, UPDATE, DELETE)
 * - Request identifiers (REQ-123)
 * - User context (USER:john@example.com)
 */
function demonstrateLabels(): void {
  logger.log('\n=== Using Labels ===');

  // Module labels
  logger.info('Starting application', 'STARTUP');
  logger.info('Connecting to database', 'DATABASE');
  logger.info('Initializing services', 'SERVICES');

  // Operation labels
  logger.log('User logged in successfully', 'AUTH:LOGIN');
  logger.log('Session created', 'AUTH:SESSION');
  logger.log('Token generated', 'AUTH:TOKEN');

  // Request labels
  logger.info('Processing request', 'REQ-12345');
  logger.info('Validating input', 'REQ-12345');
  logger.info('Request completed', 'REQ-12345');

  // Error context labels
  logger.warn('Rate limit approaching', 'RATE_LIMIT');
  logger.error('Payment failed', 'PAYMENT:ERROR');
  logger.error('Database connection lost', 'DB:CONNECTION');
}

// ============================================================================
// Example 4: Configuration Options
// ============================================================================

/**
 * Demonstrates logger configuration options
 *
 * Configure logger behavior:
 * - Log level filtering
 * - Color output (enabled/disabled)
 * - Timestamp display
 * - Label display
 */
function demonstrateConfiguration(): void {
  logger.log('\n=== Configuration Options ===');

  // Configuration 1: Minimal (production-like)
  logger.log('\n--- Minimal Configuration ---');
  configureLogger({
    level: 'INFO',
    enableColors: false,
    enableTimestamps: false,
    enableLabels: false,
  });
  logger.info('Production-style logging');
  logger.warn('Clean, minimal output');

  // Configuration 2: Development (full features)
  logger.log('\n--- Development Configuration ---');
  configureLogger({
    level: 'DEBUG',
    enableColors: true,
    enableTimestamps: true,
    enableLabels: true,
  });
  logger.debug('Development-style logging', 'DEV');
  logger.info('Full featured output with colors and timestamps', 'DEV');

  // Configuration 3: Debugging (verbose)
  logger.log('\n--- Debug Configuration ---');
  configureLogger({
    level: 'DEBUG',
    enableColors: true,
    enableTimestamps: true,
    enableLabels: true,
  });
  logger.debug('Verbose debugging enabled', 'DEBUG');
  logger.debug('All messages visible including debug', 'DEBUG');

  // Reset to default
  configureLogger({
    level: 'LOG',
    enableColors: true,
    enableTimestamps: true,
    enableLabels: true,
  });
}

// ============================================================================
// Example 5: Environment-Specific Setup
// ============================================================================

/**
 * Get logger configuration based on environment
 *
 * Different environments need different logging configurations:
 * - Development: Verbose, all features enabled
 * - Staging: Moderate, some features enabled
 * - Production: Minimal, optimized for performance
 *
 * @param input - Configuration input
 * @param input.environment - Target environment
 * @returns Logger configuration for the environment
 */
function getEnvironmentConfig(input: {
  environment: 'development' | 'staging' | 'production';
}): EnvironmentConfig {
  const { environment } = input;

  const configs: Record<string, EnvironmentConfig> = {
    development: {
      logLevel: 'DEBUG',
      enableColors: true,
      enableTimestamps: true,
      enableLabels: true,
    },
    staging: {
      logLevel: 'INFO',
      enableColors: true,
      enableTimestamps: true,
      enableLabels: true,
    },
    production: {
      logLevel: 'WARN',
      enableColors: false,
      enableTimestamps: true,
      enableLabels: false,
    },
  };

  return configs[environment];
}

/**
 * Demonstrates environment-specific logging configuration
 */
function demonstrateEnvironmentSetup(): void {
  logger.log('\n=== Environment-Specific Configuration ===');

  // Development environment
  logger.log('\n--- Development Environment ---');
  const devConfig = getEnvironmentConfig({ environment: 'development' });
  configureLogger({
    level: devConfig.logLevel,
    enableColors: devConfig.enableColors,
    enableTimestamps: devConfig.enableTimestamps,
    enableLabels: devConfig.enableLabels,
  });
  logger.debug('Development mode active', 'ENV:DEV');
  logger.info('All features enabled for debugging', 'ENV:DEV');
  logger.warn('Verbose logging may impact performance', 'ENV:DEV');

  // Staging environment
  logger.log('\n--- Staging Environment ---');
  const stagingConfig = getEnvironmentConfig({ environment: 'staging' });
  configureLogger({
    level: stagingConfig.logLevel,
    enableColors: stagingConfig.enableColors,
    enableTimestamps: stagingConfig.enableTimestamps,
    enableLabels: stagingConfig.enableLabels,
  });
  logger.info('Staging mode active', 'ENV:STAGING');
  logger.info('Balanced configuration for testing', 'ENV:STAGING');
  logger.warn('Some debug messages hidden', 'ENV:STAGING');

  // Production environment
  logger.log('\n--- Production Environment ---');
  const prodConfig = getEnvironmentConfig({ environment: 'production' });
  configureLogger({
    level: prodConfig.logLevel,
    enableColors: prodConfig.enableColors,
    enableTimestamps: prodConfig.enableTimestamps,
    enableLabels: prodConfig.enableLabels,
  });
  logger.warn('Production mode active', 'ENV:PROD');
  logger.error('Only warnings and errors logged', 'ENV:PROD');

  // Reset to development
  configureLogger({
    level: 'LOG',
    enableColors: true,
    enableTimestamps: true,
    enableLabels: true,
  });
}

// ============================================================================
// Example 6: Real-World Logging Patterns
// ============================================================================

/**
 * Simulates user authentication flow with logging
 *
 * @param input - Authentication input
 * @param input.email - User email
 * @param input.password - User password
 * @returns Authentication result
 */
async function authenticateUser(input: {
  email: string;
  password: string;
}): Promise<{ success: boolean; user?: User; error?: string }> {
  const { email, password } = input;

  logger.info(`Authentication attempt for user: ${email}`, 'AUTH');

  try {
    // Simulate validation
    if (!email || !password) {
      logger.warn('Missing credentials', 'AUTH:VALIDATION');
      return { success: false, error: 'Missing credentials' };
    }

    if (!email.includes('@')) {
      logger.warn(`Invalid email format: ${email}`, 'AUTH:VALIDATION');
      return { success: false, error: 'Invalid email format' };
    }

    // Simulate database lookup
    logger.debug(`Looking up user: ${email}`, 'AUTH:DB');

    // Simulate successful authentication
    const user: User = {
      id: 'user-123',
      email,
      name: 'John Doe',
      role: 'guest',
    };

    logger.info(`User authenticated successfully: ${user.id}`, 'AUTH:SUCCESS');
    logger.debug(`User details: ${JSON.stringify(user)}`, 'AUTH:DEBUG');

    return { success: true, user };
  } catch (error) {
    logger.error(`Authentication failed: ${error}`, 'AUTH:ERROR');
    return { success: false, error: 'Authentication failed' };
  }
}

/**
 * Simulates accommodation creation with logging
 *
 * @param input - Accommodation creation input
 * @param input.title - Accommodation title
 * @param input.city - City location
 * @param input.pricePerNight - Price per night
 * @param input.hostId - Host user ID
 * @returns Created accommodation
 */
async function createAccommodation(input: {
  title: string;
  city: string;
  pricePerNight: number;
  hostId: string;
}): Promise<{ success: boolean; accommodation?: Accommodation; error?: string }> {
  const { title, city, pricePerNight, hostId } = input;

  logger.info('Creating new accommodation', 'ACCOMMODATION:CREATE');
  logger.debug(
    `Details: ${JSON.stringify({ title, city, pricePerNight, hostId })}`,
    'ACCOMMODATION:DEBUG'
  );

  try {
    // Validation
    if (!title || title.length < 10) {
      logger.warn('Title too short', 'ACCOMMODATION:VALIDATION');
      return { success: false, error: 'Title must be at least 10 characters' };
    }

    if (pricePerNight <= 0) {
      logger.warn('Invalid price', 'ACCOMMODATION:VALIDATION');
      return { success: false, error: 'Price must be greater than 0' };
    }

    // Simulate database operation
    logger.debug('Saving to database', 'ACCOMMODATION:DB');

    const accommodation: Accommodation = {
      id: 'acc-456',
      title,
      city,
      pricePerNight,
      hostId,
    };

    logger.info(
      `Accommodation created successfully: ${accommodation.id}`,
      'ACCOMMODATION:SUCCESS'
    );
    logger.log(`Title: ${accommodation.title}`, 'ACCOMMODATION');
    logger.log(`City: ${accommodation.city}`, 'ACCOMMODATION');
    logger.log(`Price: $${accommodation.pricePerNight}/night`, 'ACCOMMODATION');

    return { success: true, accommodation };
  } catch (error) {
    logger.error(
      `Failed to create accommodation: ${error}`,
      'ACCOMMODATION:ERROR'
    );
    return { success: false, error: 'Failed to create accommodation' };
  }
}

/**
 * Demonstrates real-world logging patterns in action
 */
async function demonstrateRealWorldPatterns(): Promise<void> {
  logger.log('\n=== Real-World Logging Patterns ===');

  // Pattern 1: Authentication flow
  logger.log('\n--- Authentication Flow ---');
  const authResult = await authenticateUser({
    email: 'john@example.com',
    password: 'secret123',
  });

  if (authResult.success) {
    logger.info(
      `Welcome ${authResult.user?.name}!`,
      'APP'
    );
  }

  // Pattern 2: Invalid input handling
  logger.log('\n--- Invalid Input Handling ---');
  await authenticateUser({
    email: 'invalid-email',
    password: 'secret123',
  });

  // Pattern 3: Business operation
  logger.log('\n--- Business Operation ---');
  const createResult = await createAccommodation({
    title: 'Beautiful Beach House with Ocean View',
    city: 'Concepción del Uruguay',
    pricePerNight: 150,
    hostId: 'user-123',
  });

  if (createResult.success) {
    logger.info('Accommodation is now live', 'APP');
  }

  // Pattern 4: Validation failure
  logger.log('\n--- Validation Failure ---');
  await createAccommodation({
    title: 'Short',
    city: 'Concepción',
    pricePerNight: -10,
    hostId: 'user-123',
  });
}

// ============================================================================
// Example 7: Using Environment Variables
// ============================================================================

/**
 * Demonstrates configuring logger from environment variables
 *
 * In real applications, use environment variables:
 * - LOG_LEVEL: LOG, INFO, WARN, ERROR, DEBUG
 * - LOG_COLORS: true, false
 * - LOG_TIMESTAMPS: true, false
 * - LOG_LABELS: true, false
 */
function demonstrateEnvironmentVariables(): void {
  logger.log('\n=== Environment Variable Configuration ===');

  // Simulate reading from environment
  const envLogLevel = (process.env.LOG_LEVEL || 'LOG') as LogLevel;
  const envColors = process.env.LOG_COLORS !== 'false';
  const envTimestamps = process.env.LOG_TIMESTAMPS !== 'false';
  const envLabels = process.env.LOG_LABELS !== 'false';

  logger.info('Configuring from environment variables', 'CONFIG');
  logger.info(`LOG_LEVEL=${envLogLevel}`, 'CONFIG');
  logger.info(`LOG_COLORS=${envColors}`, 'CONFIG');
  logger.info(`LOG_TIMESTAMPS=${envTimestamps}`, 'CONFIG');
  logger.info(`LOG_LABELS=${envLabels}`, 'CONFIG');

  configureLogger({
    level: envLogLevel,
    enableColors: envColors,
    enableTimestamps: envTimestamps,
    enableLabels: envLabels,
  });

  logger.log('Logger configured from environment', 'CONFIG');
  logger.info('Environment-based configuration active', 'CONFIG');
}

// ============================================================================
// Main Example Runner
// ============================================================================

/**
 * Runs all basic logging examples
 *
 * This function demonstrates all fundamental logging patterns
 * provided by @repo/logger. Run this file to see complete examples
 * of basic logging usage.
 */
async function main(): Promise<void> {
  logger.log('='.repeat(70));
  logger.log('BASIC LOGGING EXAMPLES - @repo/logger');
  logger.log('='.repeat(70));

  // Example 1: Log Methods
  logger.log('\n### Example 1: Log Methods ###');
  demonstrateLogMethods();

  // Example 2: Log Levels
  logger.log('\n### Example 2: Log Levels ###');
  demonstrateLogLevels();

  // Example 3: Labels
  logger.log('\n### Example 3: Labels ###');
  demonstrateLabels();

  // Example 4: Configuration
  logger.log('\n### Example 4: Configuration ###');
  demonstrateConfiguration();

  // Example 5: Environment Setup
  logger.log('\n### Example 5: Environment Setup ###');
  demonstrateEnvironmentSetup();

  // Example 6: Real-World Patterns
  logger.log('\n### Example 6: Real-World Patterns ###');
  await demonstrateRealWorldPatterns();

  // Example 7: Environment Variables
  logger.log('\n### Example 7: Environment Variables ###');
  demonstrateEnvironmentVariables();

  logger.log('\n' + '='.repeat(70));
  logger.log('All examples completed successfully!');
  logger.log('='.repeat(70));
}

// Run examples if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error(`Example failed: ${error}`, 'EXAMPLE:ERROR');
    process.exit(1);
  });
}

export {
  demonstrateLogMethods,
  demonstrateLogLevels,
  demonstrateLabels,
  demonstrateConfiguration,
  demonstrateEnvironmentSetup,
  demonstrateRealWorldPatterns,
  demonstrateEnvironmentVariables,
  authenticateUser,
  createAccommodation,
  getEnvironmentConfig,
};
