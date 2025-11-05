/**
 * Example: Structured Logging
 *
 * Demonstrates advanced structured logging patterns:
 * - Logging with rich metadata objects
 * - Request context propagation
 * - Performance metrics tracking
 * - Business event logging
 * - Error logging with detailed context
 * - Integration patterns for monitoring systems
 * - JSON-friendly log structures
 *
 * Structured logging makes logs machine-readable and enables
 * powerful querying, filtering, and monitoring capabilities.
 *
 * @module examples/structured-logging
 */

import { logger, registerCategory } from '@repo/logger';

/**
 * Request context that propagates through the application
 */
interface RequestContext {
  requestId: string;
  timestamp: string;
  method: string;
  path: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Performance metrics for operations
 */
interface PerformanceMetrics {
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryUsed?: number;
  cpuUsage?: number;
}

/**
 * Error context for detailed error logging
 */
interface ErrorContext {
  errorCode: string;
  errorType: string;
  message: string;
  stack?: string;
  context: Record<string, unknown>;
  timestamp: string;
}

/**
 * Business event metadata
 */
interface BusinessEvent {
  eventType: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  timestamp: string;
  metadata: Record<string, unknown>;
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
  guests: number;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

/**
 * Payment entity
 */
interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  provider: string;
  transactionId?: string;
  createdAt: string;
}

// ============================================================================
// Category Registration for Structured Logging
// ============================================================================

/**
 * Registers categories optimized for structured logging
 */
function registerStructuredCategories(): void {
  registerCategory('REQUEST', {
    color: 'BLUE',
    level: 'INFO',
    enabled: true,
  });

  registerCategory('PERFORMANCE', {
    color: 'CYAN',
    level: 'DEBUG',
    enabled: true,
  });

  registerCategory('BUSINESS_EVENT', {
    color: 'GREEN',
    level: 'INFO',
    enabled: true,
  });

  registerCategory('ERROR', {
    color: 'RED',
    level: 'ERROR',
    enabled: true,
  });

  registerCategory('METRICS', {
    color: 'MAGENTA',
    level: 'DEBUG',
    enabled: true,
  });
}

// ============================================================================
// Request Context Logging
// ============================================================================

/**
 * Creates a request context with full metadata
 *
 * @param input - Request creation input
 * @param input.method - HTTP method
 * @param input.path - Request path
 * @param input.userId - User ID if authenticated
 * @param input.ipAddress - Client IP address
 * @param input.userAgent - User agent string
 * @returns Request context
 */
function createRequestContext(input: {
  method: string;
  path: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}): RequestContext {
  const context: RequestContext = {
    requestId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    method: input.method,
    path: input.path,
    userId: input.userId,
    sessionId: `sess-${Date.now()}`,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  };

  logger.info('Request initiated', 'REQUEST', context);

  return context;
}

/**
 * Logs request completion with full context
 *
 * @param input - Request completion input
 * @param input.context - Request context
 * @param input.statusCode - HTTP status code
 * @param input.duration - Request duration in ms
 * @param input.responseSize - Response size in bytes
 */
function logRequestCompletion(input: {
  context: RequestContext;
  statusCode: number;
  duration: number;
  responseSize?: number;
}): void {
  const { context, statusCode, duration, responseSize } = input;

  const logData = {
    ...context,
    statusCode,
    duration: `${duration}ms`,
    responseSize: responseSize ? `${responseSize} bytes` : undefined,
    success: statusCode < 400,
  };

  if (statusCode < 400) {
    logger.info('Request completed successfully', 'REQUEST', logData);
  } else {
    logger.warn('Request completed with error', 'REQUEST', logData);
  }
}

// ============================================================================
// Performance Tracking
// ============================================================================

/**
 * Performance tracker for operations
 */
class PerformanceTracker {
  private metrics: Map<string, PerformanceMetrics> = new Map();

  /**
   * Starts tracking an operation
   *
   * @param input - Operation tracking input
   * @param input.operationName - Name of the operation
   * @param input.metadata - Additional metadata
   * @returns Operation ID for reference
   */
  startOperation(input: {
    operationName: string;
    metadata?: Record<string, unknown>;
  }): string {
    const { operationName, metadata = {} } = input;
    const operationId = `${operationName}-${Date.now()}`;

    const metrics: PerformanceMetrics = {
      operationName,
      startTime: Date.now(),
    };

    this.metrics.set(operationId, metrics);

    logger.debug('Operation started', 'PERFORMANCE', {
      operationId,
      operationName,
      ...metadata,
    });

    return operationId;
  }

  /**
   * Ends tracking an operation
   *
   * @param input - Operation completion input
   * @param input.operationId - Operation ID
   * @param input.metadata - Additional metadata
   */
  endOperation(input: {
    operationId: string;
    metadata?: Record<string, unknown>;
  }): void {
    const { operationId, metadata = {} } = input;
    const metrics = this.metrics.get(operationId);

    if (!metrics) {
      logger.warn('Operation not found for tracking', 'PERFORMANCE', {
        operationId,
      });
      return;
    }

    metrics.endTime = Date.now();
    metrics.duration = metrics.endTime - metrics.startTime;

    // Simulate memory usage
    metrics.memoryUsed = Math.round(Math.random() * 100);

    logger.debug('Operation completed', 'PERFORMANCE', {
      operationId,
      operationName: metrics.operationName,
      duration: `${metrics.duration}ms`,
      memoryUsed: `${metrics.memoryUsed}MB`,
      ...metadata,
    });

    this.metrics.delete(operationId);
  }

  /**
   * Records a metric point
   *
   * @param input - Metric recording input
   * @param input.metricName - Name of the metric
   * @param input.value - Metric value
   * @param input.unit - Unit of measurement
   * @param input.tags - Additional tags
   */
  recordMetric(input: {
    metricName: string;
    value: number;
    unit: string;
    tags?: Record<string, string>;
  }): void {
    const { metricName, value, unit, tags = {} } = input;

    logger.debug('Metric recorded', 'METRICS', {
      metric: metricName,
      value,
      unit,
      timestamp: new Date().toISOString(),
      ...tags,
    });
  }
}

// ============================================================================
// Business Event Logging
// ============================================================================

/**
 * Logs a business event with full context
 *
 * @param input - Business event input
 * @param input.eventType - Type of event
 * @param input.entityType - Type of entity
 * @param input.entityId - Entity ID
 * @param input.action - Action performed
 * @param input.actorId - ID of actor performing action
 * @param input.metadata - Additional event metadata
 */
function logBusinessEvent(input: {
  eventType: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  metadata?: Record<string, unknown>;
}): void {
  const { eventType, entityType, entityId, action, actorId, metadata = {} } = input;

  const event: BusinessEvent = {
    eventType,
    entityType,
    entityId,
    action,
    actorId,
    timestamp: new Date().toISOString(),
    metadata,
  };

  logger.info(`Business event: ${eventType}`, 'BUSINESS_EVENT', event);
}

// ============================================================================
// Error Logging with Context
// ============================================================================

/**
 * Logs an error with comprehensive context
 *
 * @param input - Error logging input
 * @param input.error - Error object
 * @param input.errorCode - Application error code
 * @param input.context - Additional context
 * @param input.severity - Error severity
 */
function logError(input: {
  error: Error;
  errorCode: string;
  context: Record<string, unknown>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}): void {
  const { error, errorCode, context, severity = 'medium' } = input;

  const errorContext: ErrorContext = {
    errorCode,
    errorType: error.name,
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  };

  logger.error(`Error [${errorCode}]: ${error.message}`, 'ERROR', {
    ...errorContext,
    severity,
  });
}

// ============================================================================
// Booking Service with Structured Logging
// ============================================================================

/**
 * Booking service demonstrating structured logging patterns
 */
class BookingService {
  private readonly perfTracker = new PerformanceTracker();

  /**
   * Creates a new booking with comprehensive logging
   *
   * @param input - Booking creation input
   * @param input.requestContext - Request context
   * @param input.accommodationId - Accommodation ID
   * @param input.guestId - Guest ID
   * @param input.checkIn - Check-in date
   * @param input.checkOut - Check-out date
   * @param input.guests - Number of guests
   * @param input.totalPrice - Total price
   * @returns Created booking
   */
  async createBooking(input: {
    requestContext: RequestContext;
    accommodationId: string;
    guestId: string;
    checkIn: string;
    checkOut: string;
    guests: number;
    totalPrice: number;
  }): Promise<Booking> {
    const {
      requestContext,
      accommodationId,
      guestId,
      checkIn,
      checkOut,
      guests,
      totalPrice,
    } = input;

    // Start performance tracking
    const opId = this.perfTracker.startOperation({
      operationName: 'createBooking',
      metadata: {
        requestId: requestContext.requestId,
        accommodationId,
        guestId,
      },
    });

    try {
      // Log business intent
      logger.info('Creating new booking', 'SERVICE', {
        requestId: requestContext.requestId,
        accommodationId,
        guestId,
        checkIn,
        checkOut,
        guests,
        totalPrice,
      });

      // Validate input
      this.validateBookingInput({
        checkIn,
        checkOut,
        guests,
        totalPrice,
      });

      // Check availability
      await this.checkAvailability({
        accommodationId,
        checkIn,
        checkOut,
      });

      // Create booking
      const booking: Booking = {
        id: `booking-${Date.now()}`,
        accommodationId,
        guestId,
        checkIn,
        checkOut,
        guests,
        totalPrice,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Simulate database save
      await this.saveBooking({ booking });

      // Log business event
      logBusinessEvent({
        eventType: 'booking.created',
        entityType: 'booking',
        entityId: booking.id,
        action: 'create',
        actorId: guestId,
        metadata: {
          accommodationId,
          checkIn,
          checkOut,
          totalPrice,
        },
      });

      // End performance tracking
      this.perfTracker.endOperation({
        operationId: opId,
        metadata: {
          bookingId: booking.id,
          success: true,
        },
      });

      // Record metric
      this.perfTracker.recordMetric({
        metricName: 'bookings.created',
        value: 1,
        unit: 'count',
        tags: {
          accommodationId,
          status: 'pending',
        },
      });

      logger.info('Booking created successfully', 'SERVICE', {
        requestId: requestContext.requestId,
        bookingId: booking.id,
        status: booking.status,
      });

      return booking;
    } catch (error) {
      // End performance tracking on error
      this.perfTracker.endOperation({
        operationId: opId,
        metadata: { success: false },
      });

      // Log error with context
      if (error instanceof Error) {
        logError({
          error,
          errorCode: 'BOOKING_CREATE_FAILED',
          context: {
            requestId: requestContext.requestId,
            accommodationId,
            guestId,
            checkIn,
            checkOut,
          },
          severity: 'high',
        });
      }

      throw error;
    }
  }

  /**
   * Confirms a booking
   *
   * @param input - Booking confirmation input
   * @param input.requestContext - Request context
   * @param input.bookingId - Booking ID
   * @param input.paymentId - Payment ID
   * @returns Confirmed booking
   */
  async confirmBooking(input: {
    requestContext: RequestContext;
    bookingId: string;
    paymentId: string;
  }): Promise<Booking> {
    const { requestContext, bookingId, paymentId } = input;

    const opId = this.perfTracker.startOperation({
      operationName: 'confirmBooking',
      metadata: {
        requestId: requestContext.requestId,
        bookingId,
        paymentId,
      },
    });

    try {
      logger.info('Confirming booking', 'SERVICE', {
        requestId: requestContext.requestId,
        bookingId,
        paymentId,
      });

      // Simulate booking update
      const booking: Booking = {
        id: bookingId,
        accommodationId: 'acc-123',
        guestId: 'guest-456',
        checkIn: '2024-02-01',
        checkOut: '2024-02-05',
        guests: 2,
        totalPrice: 600,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Log business event
      logBusinessEvent({
        eventType: 'booking.confirmed',
        entityType: 'booking',
        entityId: bookingId,
        action: 'confirm',
        actorId: requestContext.userId || 'system',
        metadata: {
          paymentId,
          confirmedAt: new Date().toISOString(),
        },
      });

      this.perfTracker.endOperation({
        operationId: opId,
        metadata: { bookingId, success: true },
      });

      this.perfTracker.recordMetric({
        metricName: 'bookings.confirmed',
        value: 1,
        unit: 'count',
        tags: { bookingId },
      });

      logger.info('Booking confirmed successfully', 'SERVICE', {
        requestId: requestContext.requestId,
        bookingId,
        status: booking.status,
      });

      return booking;
    } catch (error) {
      this.perfTracker.endOperation({
        operationId: opId,
        metadata: { success: false },
      });

      if (error instanceof Error) {
        logError({
          error,
          errorCode: 'BOOKING_CONFIRM_FAILED',
          context: {
            requestId: requestContext.requestId,
            bookingId,
            paymentId,
          },
          severity: 'critical',
        });
      }

      throw error;
    }
  }

  /**
   * Cancels a booking
   *
   * @param input - Booking cancellation input
   * @param input.requestContext - Request context
   * @param input.bookingId - Booking ID
   * @param input.reason - Cancellation reason
   * @returns Cancelled booking
   */
  async cancelBooking(input: {
    requestContext: RequestContext;
    bookingId: string;
    reason: string;
  }): Promise<Booking> {
    const { requestContext, bookingId, reason } = input;

    const opId = this.perfTracker.startOperation({
      operationName: 'cancelBooking',
      metadata: {
        requestId: requestContext.requestId,
        bookingId,
        reason,
      },
    });

    try {
      logger.info('Cancelling booking', 'SERVICE', {
        requestId: requestContext.requestId,
        bookingId,
        reason,
      });

      // Simulate booking update
      const booking: Booking = {
        id: bookingId,
        accommodationId: 'acc-123',
        guestId: 'guest-456',
        checkIn: '2024-02-01',
        checkOut: '2024-02-05',
        guests: 2,
        totalPrice: 600,
        status: 'cancelled',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Log business event
      logBusinessEvent({
        eventType: 'booking.cancelled',
        entityType: 'booking',
        entityId: bookingId,
        action: 'cancel',
        actorId: requestContext.userId || 'system',
        metadata: {
          reason,
          cancelledAt: new Date().toISOString(),
        },
      });

      this.perfTracker.endOperation({
        operationId: opId,
        metadata: { bookingId, success: true },
      });

      this.perfTracker.recordMetric({
        metricName: 'bookings.cancelled',
        value: 1,
        unit: 'count',
        tags: {
          bookingId,
          reason,
        },
      });

      logger.info('Booking cancelled successfully', 'SERVICE', {
        requestId: requestContext.requestId,
        bookingId,
        status: booking.status,
      });

      return booking;
    } catch (error) {
      this.perfTracker.endOperation({
        operationId: opId,
        metadata: { success: false },
      });

      if (error instanceof Error) {
        logError({
          error,
          errorCode: 'BOOKING_CANCEL_FAILED',
          context: {
            requestId: requestContext.requestId,
            bookingId,
            reason,
          },
          severity: 'high',
        });
      }

      throw error;
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

    if (new Date(checkIn) >= new Date(checkOut)) {
      throw new Error('Check-out must be after check-in');
    }

    if (guests < 1) {
      throw new Error('At least 1 guest required');
    }

    if (totalPrice <= 0) {
      throw new Error('Total price must be greater than 0');
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

    logger.debug('Checking availability', 'SERVICE', {
      accommodationId,
      checkIn,
      checkOut,
    });

    // Simulate availability check
    await new Promise((resolve) => setTimeout(resolve, 50));

    logger.debug('Availability confirmed', 'SERVICE', {
      accommodationId,
      available: true,
    });
  }

  /**
   * Saves booking to database
   */
  private async saveBooking(input: { booking: Booking }): Promise<void> {
    const { booking } = input;

    logger.debug('Saving booking to database', 'SERVICE', {
      bookingId: booking.id,
    });

    // Simulate database save
    await new Promise((resolve) => setTimeout(resolve, 100));

    logger.debug('Booking saved successfully', 'SERVICE', {
      bookingId: booking.id,
    });
  }
}

// ============================================================================
// Request Middleware with Structured Logging
// ============================================================================

/**
 * Request middleware demonstrating full context propagation
 */
class RequestMiddleware {
  private readonly bookingService = new BookingService();

  /**
   * Handles a booking creation request
   *
   * @param input - Request handling input
   * @param input.method - HTTP method
   * @param input.path - Request path
   * @param input.userId - User ID
   * @param input.body - Request body
   * @returns Response
   */
  async handleCreateBooking(input: {
    method: string;
    path: string;
    userId: string;
    body: {
      accommodationId: string;
      checkIn: string;
      checkOut: string;
      guests: number;
      totalPrice: number;
    };
  }): Promise<{ statusCode: number; data?: Booking; error?: string }> {
    const { method, path, userId, body } = input;

    // Create request context
    const context = createRequestContext({
      method,
      path,
      userId,
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0...',
    });

    const startTime = Date.now();

    try {
      // Call service with context
      const booking = await this.bookingService.createBooking({
        requestContext: context,
        guestId: userId,
        ...body,
      });

      // Log successful response
      logRequestCompletion({
        context,
        statusCode: 201,
        duration: Date.now() - startTime,
        responseSize: JSON.stringify(booking).length,
      });

      return { statusCode: 201, data: booking };
    } catch (error) {
      // Log error response
      logRequestCompletion({
        context,
        statusCode: 500,
        duration: Date.now() - startTime,
      });

      if (error instanceof Error) {
        logError({
          error,
          errorCode: 'REQUEST_FAILED',
          context: {
            requestId: context.requestId,
            method,
            path,
            userId,
          },
          severity: 'high',
        });

        return { statusCode: 500, error: error.message };
      }

      return { statusCode: 500, error: 'Unknown error' };
    }
  }
}

// ============================================================================
// Main Example Runner
// ============================================================================

/**
 * Demonstrates complete structured logging workflow
 */
async function demonstrateStructuredLogging(): Promise<void> {
  logger.log('='.repeat(70));
  logger.log('STRUCTURED LOGGING EXAMPLES - @repo/logger');
  logger.log('='.repeat(70));

  // Register categories
  logger.log('\n### Registering Categories ###');
  registerStructuredCategories();

  // Example 1: Request with full context
  logger.log('\n### Example 1: Create Booking Request ###');
  const middleware = new RequestMiddleware();

  await middleware.handleCreateBooking({
    method: 'POST',
    path: '/api/bookings',
    userId: 'user-123',
    body: {
      accommodationId: 'acc-456',
      checkIn: '2024-02-01',
      checkOut: '2024-02-05',
      guests: 2,
      totalPrice: 600,
    },
  });

  // Example 2: Booking confirmation
  logger.log('\n### Example 2: Confirm Booking ###');
  const bookingService = new BookingService();
  const context = createRequestContext({
    method: 'POST',
    path: '/api/bookings/confirm',
    userId: 'user-123',
  });

  await bookingService.confirmBooking({
    requestContext: context,
    bookingId: 'booking-789',
    paymentId: 'payment-101',
  });

  // Example 3: Booking cancellation
  logger.log('\n### Example 3: Cancel Booking ###');
  const cancelContext = createRequestContext({
    method: 'POST',
    path: '/api/bookings/cancel',
    userId: 'user-123',
  });

  await bookingService.cancelBooking({
    requestContext: cancelContext,
    bookingId: 'booking-789',
    reason: 'User requested cancellation',
  });

  logger.log('\n' + '='.repeat(70));
  logger.log('All structured logging examples completed!');
  logger.log('='.repeat(70));
}

/**
 * Runs all structured logging examples
 */
async function main(): Promise<void> {
  await demonstrateStructuredLogging();
}

// Run examples if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error(`Example failed: ${error}`, 'EXAMPLE:ERROR');
    process.exit(1);
  });
}

export {
  registerStructuredCategories,
  createRequestContext,
  logRequestCompletion,
  logBusinessEvent,
  logError,
  PerformanceTracker,
  BookingService,
  RequestMiddleware,
  demonstrateStructuredLogging,
};
