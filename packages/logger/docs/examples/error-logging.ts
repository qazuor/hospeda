/**
 * Example: Error Logging
 *
 * Demonstrates comprehensive error handling and logging patterns:
 * - Error categorization (validation, database, network, business)
 * - Error logging with full context and stack traces
 * - Error recovery strategies
 * - Error boundaries in services
 * - Custom error classes with metadata
 * - Integration with error tracking systems (Sentry pattern)
 * - Real business scenarios and error cases
 *
 * Proper error logging is critical for debugging production issues
 * and maintaining system reliability.
 *
 * @module examples/error-logging
 */

import { logger, registerCategory } from '@repo/logger';

/**
 * Base application error with metadata support
 */
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly metadata?: Record<string, unknown>,
    public readonly isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error for input validation failures
 */
class ValidationError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, metadata);
  }
}

/**
 * Database error for database operation failures
 */
class DatabaseError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'DATABASE_ERROR', 500, metadata);
  }
}

/**
 * Network error for external API failures
 */
class NetworkError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'NETWORK_ERROR', 503, metadata);
  }
}

/**
 * Business logic error for domain rule violations
 */
class BusinessLogicError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'BUSINESS_LOGIC_ERROR', 422, metadata);
  }
}

/**
 * Authentication error
 */
class AuthenticationError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'AUTHENTICATION_ERROR', 401, metadata);
  }
}

/**
 * Authorization error
 */
class AuthorizationError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'AUTHORIZATION_ERROR', 403, metadata);
  }
}

/**
 * Not found error
 */
class NotFoundError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'NOT_FOUND_ERROR', 404, metadata);
  }
}

/**
 * Booking entity
 */
interface Booking {
  id: string;
  accommodationId: string;
  guestId: string;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  status: string;
}

/**
 * Accommodation entity
 */
interface Accommodation {
  id: string;
  title: string;
  maxGuests: number;
  isActive: boolean;
}

// ============================================================================
// Category Registration for Error Logging
// ============================================================================

/**
 * Registers error-related categories
 */
function registerErrorCategories(): void {
  registerCategory('ERROR', {
    color: 'RED',
    level: 'ERROR',
    enabled: true,
  });

  registerCategory('ERROR_RECOVERY', {
    color: 'YELLOW',
    level: 'WARN',
    enabled: true,
  });

  registerCategory('ERROR_TRACKING', {
    color: 'MAGENTA',
    level: 'ERROR',
    enabled: true,
  });

  registerCategory('VALIDATION', {
    color: 'YELLOW',
    level: 'WARN',
    enabled: true,
  });
}

// ============================================================================
// Error Logging Utilities
// ============================================================================

/**
 * Logs an error with comprehensive context
 *
 * @param input - Error logging input
 * @param input.error - Error object
 * @param input.context - Additional context
 * @param input.severity - Error severity
 */
function logErrorWithContext(input: {
  error: Error;
  context: Record<string, unknown>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}): void {
  const { error, context, severity = 'medium' } = input;

  const errorData = {
    errorType: error.name,
    message: error.message,
    stack: error.stack,
    ...context,
    severity,
    timestamp: new Date().toISOString(),
  };

  if (error instanceof AppError) {
    errorData.code = error.code;
    errorData.statusCode = error.statusCode;
    errorData.isOperational = error.isOperational;
    if (error.metadata) {
      Object.assign(errorData, { metadata: error.metadata });
    }
  }

  logger.error(`${error.name}: ${error.message}`, 'ERROR', errorData);
}

/**
 * Sends error to tracking service (e.g., Sentry)
 *
 * @param input - Error tracking input
 * @param input.error - Error object
 * @param input.context - Additional context
 * @param input.userId - User ID if available
 */
function sendToErrorTracking(input: {
  error: Error;
  context: Record<string, unknown>;
  userId?: string;
}): void {
  const { error, context, userId } = input;

  logger.info('Sending error to tracking service', 'ERROR_TRACKING', {
    errorType: error.name,
    message: error.message,
    userId,
    context,
    timestamp: new Date().toISOString(),
  });

  // In real implementation, this would call Sentry, Datadog, etc.
  // Example: Sentry.captureException(error, { extra: context, user: { id: userId } });
}

// ============================================================================
// Database Service with Error Handling
// ============================================================================

/**
 * Database service demonstrating database error patterns
 */
class DatabaseService {
  private isConnected = false;
  private shouldSimulateError = false;

  /**
   * Connects to database with error handling
   */
  async connect(): Promise<void> {
    logger.info('Attempting database connection', 'DATABASE');

    try {
      // Simulate connection that might fail
      if (Math.random() < 0.1) {
        throw new Error('Connection timeout');
      }

      await this.delay(100);
      this.isConnected = true;

      logger.info('Database connected successfully', 'DATABASE');
    } catch (error) {
      const dbError = new DatabaseError('Failed to connect to database', {
        originalError: error instanceof Error ? error.message : String(error),
        host: 'localhost',
        port: 5432,
        database: 'hospeda',
      });

      logErrorWithContext({
        error: dbError,
        context: {
          operation: 'connect',
          attempt: 1,
        },
        severity: 'critical',
      });

      sendToErrorTracking({
        error: dbError,
        context: { operation: 'connect' },
      });

      throw dbError;
    }
  }

  /**
   * Executes a query with error handling
   *
   * @param input - Query input
   * @param input.sql - SQL query
   * @param input.params - Query parameters
   * @returns Query results
   */
  async query<T>(input: { sql: string; params?: unknown[] }): Promise<T[]> {
    const { sql, params = [] } = input;

    if (!this.isConnected) {
      const error = new DatabaseError('Database not connected', {
        query: sql.substring(0, 100),
      });

      logErrorWithContext({
        error,
        context: { operation: 'query' },
        severity: 'high',
      });

      throw error;
    }

    try {
      logger.debug(`Executing query: ${sql.substring(0, 50)}...`, 'DATABASE');

      // Simulate query that might fail
      if (this.shouldSimulateError) {
        throw new Error('Query execution failed');
      }

      await this.delay(50);
      return [] as T[];
    } catch (error) {
      const dbError = new DatabaseError('Query execution failed', {
        query: sql.substring(0, 100),
        params: JSON.stringify(params),
        originalError: error instanceof Error ? error.message : String(error),
      });

      logErrorWithContext({
        error: dbError,
        context: {
          operation: 'query',
          query: sql,
        },
        severity: 'high',
      });

      sendToErrorTracking({
        error: dbError,
        context: { query: sql, params },
      });

      throw dbError;
    }
  }

  /**
   * Begins a transaction with error handling
   */
  async beginTransaction(): Promise<void> {
    try {
      logger.debug('Beginning transaction', 'DATABASE');
      await this.delay(10);
    } catch (error) {
      const dbError = new DatabaseError('Failed to begin transaction', {
        originalError: error instanceof Error ? error.message : String(error),
      });

      logErrorWithContext({
        error: dbError,
        context: { operation: 'beginTransaction' },
        severity: 'high',
      });

      throw dbError;
    }
  }

  /**
   * Commits a transaction with error handling
   */
  async commit(): Promise<void> {
    try {
      logger.debug('Committing transaction', 'DATABASE');
      await this.delay(10);
    } catch (error) {
      const dbError = new DatabaseError('Failed to commit transaction', {
        originalError: error instanceof Error ? error.message : String(error),
      });

      logErrorWithContext({
        error: dbError,
        context: { operation: 'commit' },
        severity: 'critical',
      });

      throw dbError;
    }
  }

  /**
   * Rolls back a transaction
   */
  async rollback(): Promise<void> {
    try {
      logger.warn('Rolling back transaction', 'ERROR_RECOVERY');
      await this.delay(10);
    } catch (error) {
      const dbError = new DatabaseError('Failed to rollback transaction', {
        originalError: error instanceof Error ? error.message : String(error),
      });

      logErrorWithContext({
        error: dbError,
        context: { operation: 'rollback' },
        severity: 'critical',
      });

      throw dbError;
    }
  }

  /**
   * Simulates async delay
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Sets whether to simulate errors
   */
  setSimulateError(value: boolean): void {
    this.shouldSimulateError = value;
  }
}

// ============================================================================
// Booking Service with Comprehensive Error Handling
// ============================================================================

/**
 * Booking service demonstrating error handling patterns
 */
class BookingService {
  private readonly db: DatabaseService;

  constructor(input: { db: DatabaseService }) {
    this.db = input.db;
  }

  /**
   * Creates a booking with validation and error handling
   *
   * @param input - Booking creation input
   * @param input.accommodationId - Accommodation ID
   * @param input.guestId - Guest ID
   * @param input.checkIn - Check-in date
   * @param input.checkOut - Check-out date
   * @param input.guests - Number of guests
   * @param input.totalPrice - Total price
   * @returns Created booking
   */
  async createBooking(input: {
    accommodationId: string;
    guestId: string;
    checkIn: string;
    checkOut: string;
    guests: number;
    totalPrice: number;
  }): Promise<Booking> {
    const { accommodationId, guestId, checkIn, checkOut, guests, totalPrice } = input;

    logger.info('Creating booking', 'SERVICE', {
      accommodationId,
      guestId,
      checkIn,
      checkOut,
    });

    try {
      // Step 1: Validate input
      this.validateBookingInput({ checkIn, checkOut, guests, totalPrice });

      // Step 2: Check accommodation exists and is available
      const accommodation = await this.getAccommodation({ accommodationId });

      // Step 3: Validate business rules
      this.validateBusinessRules({
        accommodation,
        guests,
        checkIn,
        checkOut,
      });

      // Step 4: Check availability
      await this.checkAvailability({
        accommodationId,
        checkIn,
        checkOut,
      });

      // Step 5: Create booking in database
      await this.db.beginTransaction();

      const booking: Booking = {
        id: `booking-${Date.now()}`,
        accommodationId,
        guestId,
        checkIn,
        checkOut,
        totalPrice,
        status: 'pending',
      };

      await this.db.query({
        sql: 'INSERT INTO bookings VALUES (...)',
        params: [booking],
      });

      await this.db.commit();

      logger.info('Booking created successfully', 'SERVICE', {
        bookingId: booking.id,
      });

      return booking;
    } catch (error) {
      // Rollback transaction on any error
      try {
        await this.db.rollback();
        logger.info('Transaction rolled back', 'ERROR_RECOVERY');
      } catch (rollbackError) {
        logger.error(
          'Failed to rollback transaction',
          'ERROR',
          {
            originalError: error,
            rollbackError,
          }
        );
      }

      // Re-throw the original error
      if (error instanceof AppError) {
        throw error;
      }

      // Wrap unexpected errors
      const wrappedError = new DatabaseError('Failed to create booking', {
        originalError: error instanceof Error ? error.message : String(error),
        accommodationId,
        guestId,
      });

      logErrorWithContext({
        error: wrappedError,
        context: {
          operation: 'createBooking',
          input,
        },
        severity: 'high',
      });

      sendToErrorTracking({
        error: wrappedError,
        context: { input },
        userId: guestId,
      });

      throw wrappedError;
    }
  }

  /**
   * Validates booking input
   */
  private validateBookingInput(input: {
    checkIn: string;
    checkOut: string;
    guests: number;
    totalPrice: number;
  }): void {
    const { checkIn, checkOut, guests, totalPrice } = input;

    const errors: string[] = [];

    // Validate dates
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (Number.isNaN(checkInDate.getTime())) {
      errors.push('Invalid check-in date format');
    }

    if (Number.isNaN(checkOutDate.getTime())) {
      errors.push('Invalid check-out date format');
    }

    if (checkInDate >= checkOutDate) {
      errors.push('Check-out must be after check-in');
    }

    if (checkInDate < new Date()) {
      errors.push('Check-in cannot be in the past');
    }

    // Validate guests
    if (guests < 1) {
      errors.push('At least 1 guest is required');
    }

    if (guests > 50) {
      errors.push('Maximum 50 guests allowed');
    }

    // Validate price
    if (totalPrice <= 0) {
      errors.push('Total price must be greater than 0');
    }

    if (errors.length > 0) {
      const error = new ValidationError('Booking validation failed', {
        errors,
        input,
      });

      logErrorWithContext({
        error,
        context: {
          operation: 'validateBookingInput',
          errors,
        },
        severity: 'low',
      });

      throw error;
    }
  }

  /**
   * Gets accommodation by ID
   */
  private async getAccommodation(input: {
    accommodationId: string;
  }): Promise<Accommodation> {
    const { accommodationId } = input;

    try {
      const results = await this.db.query<Accommodation>({
        sql: 'SELECT * FROM accommodations WHERE id = $1',
        params: [accommodationId],
      });

      if (results.length === 0) {
        throw new NotFoundError('Accommodation not found', {
          accommodationId,
        });
      }

      return results[0];
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new DatabaseError('Failed to fetch accommodation', {
        accommodationId,
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Validates business rules
   */
  private validateBusinessRules(input: {
    accommodation: Accommodation;
    guests: number;
    checkIn: string;
    checkOut: string;
  }): void {
    const { accommodation, guests } = input;

    // Check if accommodation is active
    if (!accommodation.isActive) {
      const error = new BusinessLogicError('Accommodation is not available', {
        accommodationId: accommodation.id,
        isActive: accommodation.isActive,
      });

      logErrorWithContext({
        error,
        context: {
          operation: 'validateBusinessRules',
          accommodationId: accommodation.id,
        },
        severity: 'medium',
      });

      throw error;
    }

    // Check guest capacity
    if (guests > accommodation.maxGuests) {
      const error = new BusinessLogicError('Too many guests for accommodation', {
        accommodationId: accommodation.id,
        requestedGuests: guests,
        maxGuests: accommodation.maxGuests,
      });

      logErrorWithContext({
        error,
        context: {
          operation: 'validateBusinessRules',
          accommodationId: accommodation.id,
          guests,
          maxGuests: accommodation.maxGuests,
        },
        severity: 'medium',
      });

      throw error;
    }
  }

  /**
   * Checks accommodation availability
   */
  private async checkAvailability(input: {
    accommodationId: string;
    checkIn: string;
    checkOut: string;
  }): Promise<void> {
    const { accommodationId, checkIn, checkOut } = input;

    try {
      const overlappingBookings = await this.db.query<Booking>({
        sql: `
          SELECT * FROM bookings
          WHERE accommodation_id = $1
          AND status != 'cancelled'
          AND check_in < $3
          AND check_out > $2
        `,
        params: [accommodationId, checkIn, checkOut],
      });

      if (overlappingBookings.length > 0) {
        const error = new BusinessLogicError('Accommodation not available for selected dates', {
          accommodationId,
          checkIn,
          checkOut,
          conflictingBookings: overlappingBookings.length,
        });

        logErrorWithContext({
          error,
          context: {
            operation: 'checkAvailability',
            accommodationId,
            checkIn,
            checkOut,
          },
          severity: 'medium',
        });

        throw error;
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new DatabaseError('Failed to check availability', {
        accommodationId,
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// ============================================================================
// External Service with Network Error Handling
// ============================================================================

/**
 * Payment service demonstrating network error handling
 */
class PaymentService {
  /**
   * Processes payment with external provider
   *
   * @param input - Payment processing input
   * @param input.bookingId - Booking ID
   * @param input.amount - Payment amount
   * @param input.currency - Currency code
   * @returns Payment result
   */
  async processPayment(input: {
    bookingId: string;
    amount: number;
    currency: string;
  }): Promise<{ transactionId: string; status: string }> {
    const { bookingId, amount, currency } = input;

    logger.info('Processing payment', 'PAYMENT', {
      bookingId,
      amount,
      currency,
    });

    try {
      // Simulate network call to external payment provider
      const result = await this.callPaymentProvider({
        amount,
        currency,
      });

      logger.info('Payment processed successfully', 'PAYMENT', {
        bookingId,
        transactionId: result.transactionId,
      });

      return result;
    } catch (error) {
      const networkError = new NetworkError('Payment provider unavailable', {
        provider: 'mercadopago',
        bookingId,
        amount,
        currency,
        originalError: error instanceof Error ? error.message : String(error),
      });

      logErrorWithContext({
        error: networkError,
        context: {
          operation: 'processPayment',
          bookingId,
          amount,
          currency,
        },
        severity: 'high',
      });

      sendToErrorTracking({
        error: networkError,
        context: { bookingId, amount, currency },
      });

      throw networkError;
    }
  }

  /**
   * Calls external payment provider
   */
  private async callPaymentProvider(input: {
    amount: number;
    currency: string;
  }): Promise<{ transactionId: string; status: string }> {
    const { amount, currency } = input;

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Simulate random network failure
    if (Math.random() < 0.2) {
      throw new Error('Network timeout');
    }

    return {
      transactionId: `txn-${Date.now()}`,
      status: 'completed',
    };
  }
}

// ============================================================================
// Error Recovery Strategies
// ============================================================================

/**
 * Demonstrates error recovery with retry logic
 *
 * @param input - Retry operation input
 * @param input.operation - Operation to retry
 * @param input.maxRetries - Maximum retry attempts
 * @param input.delayMs - Delay between retries
 * @returns Operation result
 */
async function retryWithExponentialBackoff<T>(input: {
  operation: () => Promise<T>;
  maxRetries: number;
  delayMs: number;
}): Promise<T> {
  const { operation, maxRetries, delayMs } = input;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug(`Attempting operation (attempt ${attempt}/${maxRetries})`, 'ERROR_RECOVERY');
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = delayMs * Math.pow(2, attempt - 1);

        logger.warn(
          `Operation failed, retrying in ${delay}ms`,
          'ERROR_RECOVERY',
          {
            attempt,
            maxRetries,
            error: lastError.message,
          }
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  logger.error(
    'Operation failed after all retries',
    'ERROR',
    {
      maxRetries,
      lastError: lastError?.message,
    }
  );

  throw lastError;
}

// ============================================================================
// Example Demonstrations
// ============================================================================

/**
 * Demonstrates validation error handling
 */
async function demonstrateValidationErrors(): Promise<void> {
  logger.log('\n=== Validation Error Example ===\n');

  const db = new DatabaseService();
  await db.connect();

  const bookingService = new BookingService({ db });

  try {
    await bookingService.createBooking({
      accommodationId: 'acc-123',
      guestId: 'guest-456',
      checkIn: '2024-02-05',
      checkOut: '2024-02-01', // Invalid: before check-in
      guests: -1, // Invalid: negative
      totalPrice: -100, // Invalid: negative
    });
  } catch (error) {
    logger.log('\n✓ Validation error caught and logged');
  }
}

/**
 * Demonstrates database error handling
 */
async function demonstrateDatabaseErrors(): Promise<void> {
  logger.log('\n=== Database Error Example ===\n');

  const db = new DatabaseService();
  await db.connect();
  db.setSimulateError(true);

  const bookingService = new BookingService({ db });

  try {
    await bookingService.createBooking({
      accommodationId: 'acc-123',
      guestId: 'guest-456',
      checkIn: '2024-02-01',
      checkOut: '2024-02-05',
      guests: 2,
      totalPrice: 600,
    });
  } catch (error) {
    logger.log('\n✓ Database error caught and logged');
  }
}

/**
 * Demonstrates network error handling with retry
 */
async function demonstrateNetworkErrors(): Promise<void> {
  logger.log('\n=== Network Error with Retry Example ===\n');

  const paymentService = new PaymentService();

  try {
    await retryWithExponentialBackoff({
      operation: () =>
        paymentService.processPayment({
          bookingId: 'booking-123',
          amount: 600,
          currency: 'ARS',
        }),
      maxRetries: 3,
      delayMs: 100,
    });
  } catch (error) {
    logger.log('\n✓ Network error caught after retries');
  }
}

// ============================================================================
// Main Example Runner
// ============================================================================

/**
 * Runs all error logging examples
 */
async function main(): Promise<void> {
  logger.log('='.repeat(70));
  logger.log('ERROR LOGGING EXAMPLES - @repo/logger');
  logger.log('='.repeat(70));

  // Register categories
  logger.log('\n### Registering Error Categories ###');
  registerErrorCategories();

  // Example 1: Validation errors
  await demonstrateValidationErrors();

  // Example 2: Database errors
  await demonstrateDatabaseErrors();

  // Example 3: Network errors with retry
  await demonstrateNetworkErrors();

  logger.log('\n' + '='.repeat(70));
  logger.log('All error logging examples completed!');
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
  AppError,
  ValidationError,
  DatabaseError,
  NetworkError,
  BusinessLogicError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  registerErrorCategories,
  logErrorWithContext,
  sendToErrorTracking,
  DatabaseService,
  BookingService,
  PaymentService,
  retryWithExponentialBackoff,
  demonstrateValidationErrors,
  demonstrateDatabaseErrors,
  demonstrateNetworkErrors,
};
