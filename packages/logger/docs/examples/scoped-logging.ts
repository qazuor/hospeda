/**
 * Example: Scoped Logging
 *
 * Demonstrates creating and using scoped/categorized loggers:
 * - Creating multiple scoped loggers with registerCategory()
 * - Category-specific configuration (colors, levels, options)
 * - Using category loggers in service classes
 * - Real business logic with proper logging
 * - API middleware with request logging
 * - Service-level logging patterns
 *
 * Scoped loggers help organize logs by module, feature, or layer,
 * making it easier to filter and debug specific parts of the application.
 *
 * @module examples/scoped-logging
 */

import {
  logger,
  registerCategory,
  configureLogger,
  type CategoryConfig,
} from '@repo/logger';

/**
 * User entity
 */
interface User {
  id: string;
  email: string;
  name: string;
  role: 'guest' | 'host' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Accommodation entity
 */
interface Accommodation {
  id: string;
  title: string;
  description: string;
  city: string;
  pricePerNight: number;
  maxGuests: number;
  hostId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Booking entity
 */
interface Booking {
  id: string;
  accommodationId: string;
  guestId: string;
  checkIn: Date;
  checkOut: Date;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payment entity
 */
interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  provider: 'mercadopago' | 'stripe';
  transactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * HTTP request context
 */
interface RequestContext {
  requestId: string;
  method: string;
  path: string;
  userId?: string;
  startTime: number;
}

// ============================================================================
// Category Registration
// ============================================================================

/**
 * Registers all application categories with custom configurations
 *
 * Each category can have its own:
 * - Color scheme for visual distinction
 * - Log level for filtering
 * - Enable/disable state
 */
function registerAllCategories(): void {
  // API category - for HTTP request/response logging
  registerCategory('API', {
    color: 'BLUE',
    level: 'INFO',
    enabled: true,
  });

  // Database category - for database operations
  registerCategory('DATABASE', {
    color: 'GREEN',
    level: 'DEBUG',
    enabled: true,
  });

  // Auth category - for authentication/authorization
  registerCategory('AUTH', {
    color: 'YELLOW',
    level: 'INFO',
    enabled: true,
  });

  // Payment category - for payment processing
  registerCategory('PAYMENT', {
    color: 'MAGENTA',
    level: 'INFO',
    enabled: true,
  });

  // Service category - for business logic
  registerCategory('SERVICE', {
    color: 'CYAN',
    level: 'DEBUG',
    enabled: true,
  });

  // Validation category - for input validation
  registerCategory('VALIDATION', {
    color: 'YELLOW',
    level: 'WARN',
    enabled: true,
  });

  logger.info('All categories registered', 'SYSTEM');
}

// ============================================================================
// Database Service with Scoped Logging
// ============================================================================

/**
 * Simulated database service with scoped logging
 *
 * Demonstrates logging database operations with category-specific logger
 */
class DatabaseService {
  private readonly category = 'DATABASE';

  /**
   * Connects to database with logging
   */
  async connect(): Promise<void> {
    logger.info('Attempting database connection', this.category);

    try {
      // Simulate connection
      await this.delay(100);

      logger.info('Database connection established', this.category);
      logger.debug('Connection pool initialized', this.category);
    } catch (error) {
      logger.error(
        `Database connection failed: ${error}`,
        this.category
      );
      throw error;
    }
  }

  /**
   * Executes a query with logging
   *
   * @param input - Query execution input
   * @param input.query - SQL query string
   * @param input.params - Query parameters
   * @returns Query result
   */
  async query<T>(input: {
    query: string;
    params?: unknown[];
  }): Promise<T[]> {
    const { query, params = [] } = input;

    logger.debug(
      `Executing query: ${query.substring(0, 50)}...`,
      this.category
    );
    logger.debug(`Parameters: ${JSON.stringify(params)}`, this.category);

    const startTime = Date.now();

    try {
      // Simulate query execution
      await this.delay(50);

      const duration = Date.now() - startTime;
      logger.debug(`Query completed in ${duration}ms`, this.category);

      return [] as T[];
    } catch (error) {
      logger.error(
        `Query failed: ${error}`,
        this.category
      );
      throw error;
    }
  }

  /**
   * Begins a database transaction
   */
  async beginTransaction(): Promise<void> {
    logger.info('Starting transaction', this.category);
    await this.delay(10);
  }

  /**
   * Commits a database transaction
   */
  async commit(): Promise<void> {
    logger.info('Committing transaction', this.category);
    await this.delay(10);
  }

  /**
   * Rolls back a database transaction
   */
  async rollback(): Promise<void> {
    logger.warn('Rolling back transaction', this.category);
    await this.delay(10);
  }

  /**
   * Simulates async delay
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Accommodation Service with Scoped Logging
// ============================================================================

/**
 * Accommodation service with comprehensive logging
 *
 * Demonstrates service-level logging patterns for business operations
 */
class AccommodationService {
  private readonly category = 'SERVICE';
  private readonly db: DatabaseService;

  constructor(input: { db: DatabaseService }) {
    this.db = input.db;
    logger.info('AccommodationService initialized', this.category);
  }

  /**
   * Creates a new accommodation
   *
   * @param input - Accommodation creation input
   * @param input.title - Accommodation title
   * @param input.description - Description
   * @param input.city - City location
   * @param input.pricePerNight - Price per night
   * @param input.maxGuests - Maximum guests
   * @param input.hostId - Host user ID
   * @returns Created accommodation
   */
  async create(input: {
    title: string;
    description: string;
    city: string;
    pricePerNight: number;
    maxGuests: number;
    hostId: string;
  }): Promise<Accommodation> {
    const { title, description, city, pricePerNight, maxGuests, hostId } = input;

    logger.info('Creating new accommodation', this.category);
    logger.debug(
      `Details: ${JSON.stringify({ title, city, pricePerNight })}`,
      this.category
    );

    try {
      // Validation
      if (title.length < 10) {
        logger.warn('Title validation failed: too short', 'VALIDATION');
        throw new Error('Title must be at least 10 characters');
      }

      if (pricePerNight <= 0) {
        logger.warn('Price validation failed: invalid value', 'VALIDATION');
        throw new Error('Price must be greater than 0');
      }

      // Database operation
      await this.db.beginTransaction();

      const accommodation: Accommodation = {
        id: `acc-${Date.now()}`,
        title,
        description,
        city,
        pricePerNight,
        maxGuests,
        hostId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.db.query({
        query: 'INSERT INTO accommodations VALUES (...)',
        params: [accommodation],
      });

      await this.db.commit();

      logger.info(
        `Accommodation created successfully: ${accommodation.id}`,
        this.category
      );
      logger.debug(
        `Full details: ${JSON.stringify(accommodation)}`,
        this.category
      );

      return accommodation;
    } catch (error) {
      await this.db.rollback();
      logger.error(
        `Failed to create accommodation: ${error}`,
        this.category
      );
      throw error;
    }
  }

  /**
   * Finds accommodation by ID
   *
   * @param input - Find input
   * @param input.id - Accommodation ID
   * @returns Accommodation if found
   */
  async findById(input: { id: string }): Promise<Accommodation | null> {
    const { id } = input;

    logger.debug(`Finding accommodation: ${id}`, this.category);

    try {
      const results = await this.db.query<Accommodation>({
        query: 'SELECT * FROM accommodations WHERE id = $1',
        params: [id],
      });

      if (results.length === 0) {
        logger.warn(`Accommodation not found: ${id}`, this.category);
        return null;
      }

      logger.debug(`Accommodation found: ${id}`, this.category);
      return results[0];
    } catch (error) {
      logger.error(
        `Failed to find accommodation: ${error}`,
        this.category
      );
      throw error;
    }
  }

  /**
   * Updates accommodation
   *
   * @param input - Update input
   * @param input.id - Accommodation ID
   * @param input.updates - Fields to update
   * @returns Updated accommodation
   */
  async update(input: {
    id: string;
    updates: Partial<Accommodation>;
  }): Promise<Accommodation> {
    const { id, updates } = input;

    logger.info(`Updating accommodation: ${id}`, this.category);
    logger.debug(`Updates: ${JSON.stringify(updates)}`, this.category);

    try {
      const existing = await this.findById({ id });

      if (!existing) {
        logger.warn(`Cannot update non-existent accommodation: ${id}`, this.category);
        throw new Error('Accommodation not found');
      }

      await this.db.beginTransaction();

      const updated: Accommodation = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      };

      await this.db.query({
        query: 'UPDATE accommodations SET ... WHERE id = $1',
        params: [updated],
      });

      await this.db.commit();

      logger.info(`Accommodation updated successfully: ${id}`, this.category);
      return updated;
    } catch (error) {
      await this.db.rollback();
      logger.error(`Failed to update accommodation: ${error}`, this.category);
      throw error;
    }
  }
}

// ============================================================================
// Authentication Service with Scoped Logging
// ============================================================================

/**
 * Authentication service with security-focused logging
 *
 * Demonstrates auth-specific logging patterns
 */
class AuthService {
  private readonly category = 'AUTH';
  private readonly db: DatabaseService;

  constructor(input: { db: DatabaseService }) {
    this.db = input.db;
    logger.info('AuthService initialized', this.category);
  }

  /**
   * Authenticates user with credentials
   *
   * @param input - Login input
   * @param input.email - User email
   * @param input.password - User password
   * @returns Authentication result
   */
  async login(input: {
    email: string;
    password: string;
  }): Promise<{ success: boolean; user?: User; token?: string }> {
    const { email, password } = input;

    logger.info(`Login attempt: ${email}`, this.category);

    try {
      // Validation
      if (!email || !password) {
        logger.warn('Login failed: missing credentials', this.category);
        return { success: false };
      }

      if (!email.includes('@')) {
        logger.warn(`Login failed: invalid email format - ${email}`, this.category);
        return { success: false };
      }

      // Database lookup
      logger.debug(`Looking up user: ${email}`, this.category);
      const users = await this.db.query<User>({
        query: 'SELECT * FROM users WHERE email = $1',
        params: [email],
      });

      if (users.length === 0) {
        logger.warn(`Login failed: user not found - ${email}`, this.category);
        return { success: false };
      }

      const user = users[0];

      // Simulate password verification
      logger.debug('Verifying password', this.category);

      // Simulate token generation
      const token = `token-${Date.now()}`;

      logger.info(`Login successful: ${user.id} (${email})`, this.category);
      logger.debug(`Token generated: ${token.substring(0, 20)}...`, this.category);

      return { success: true, user, token };
    } catch (error) {
      logger.error(`Login error: ${error}`, this.category);
      return { success: false };
    }
  }

  /**
   * Logs out user
   *
   * @param input - Logout input
   * @param input.userId - User ID
   * @param input.token - Auth token
   */
  async logout(input: { userId: string; token: string }): Promise<void> {
    const { userId, token } = input;

    logger.info(`Logout: ${userId}`, this.category);
    logger.debug(`Invalidating token: ${token.substring(0, 20)}...`, this.category);

    try {
      // Simulate token invalidation
      await this.db.query({
        query: 'DELETE FROM sessions WHERE user_id = $1',
        params: [userId],
      });

      logger.info(`Logout successful: ${userId}`, this.category);
    } catch (error) {
      logger.error(`Logout error: ${error}`, this.category);
      throw error;
    }
  }

  /**
   * Validates authentication token
   *
   * @param input - Validation input
   * @param input.token - Auth token
   * @returns User if token is valid
   */
  async validateToken(input: { token: string }): Promise<User | null> {
    const { token } = input;

    logger.debug(`Validating token: ${token.substring(0, 20)}...`, this.category);

    try {
      // Simulate token validation
      const sessions = await this.db.query<{ userId: string }>({
        query: 'SELECT user_id FROM sessions WHERE token = $1',
        params: [token],
      });

      if (sessions.length === 0) {
        logger.warn('Token validation failed: invalid token', this.category);
        return null;
      }

      const userId = sessions[0].userId;
      logger.debug(`Token valid for user: ${userId}`, this.category);

      const users = await this.db.query<User>({
        query: 'SELECT * FROM users WHERE id = $1',
        params: [userId],
      });

      return users[0] || null;
    } catch (error) {
      logger.error(`Token validation error: ${error}`, this.category);
      return null;
    }
  }
}

// ============================================================================
// Payment Service with Scoped Logging
// ============================================================================

/**
 * Payment service with financial transaction logging
 *
 * Demonstrates payment-specific logging patterns with external integrations
 */
class PaymentService {
  private readonly category = 'PAYMENT';
  private readonly db: DatabaseService;

  constructor(input: { db: DatabaseService }) {
    this.db = input.db;
    logger.info('PaymentService initialized', this.category);
  }

  /**
   * Processes a payment for a booking
   *
   * @param input - Payment processing input
   * @param input.bookingId - Booking ID
   * @param input.amount - Payment amount
   * @param input.currency - Currency code
   * @param input.provider - Payment provider
   * @returns Processed payment
   */
  async processPayment(input: {
    bookingId: string;
    amount: number;
    currency: string;
    provider: 'mercadopago' | 'stripe';
  }): Promise<Payment> {
    const { bookingId, amount, currency, provider } = input;

    logger.info(
      `Processing payment: ${bookingId} - ${currency} ${amount}`,
      this.category
    );
    logger.debug(`Provider: ${provider}`, this.category);

    try {
      // Validate amount
      if (amount <= 0) {
        logger.warn('Payment validation failed: invalid amount', 'VALIDATION');
        throw new Error('Amount must be greater than 0');
      }

      await this.db.beginTransaction();

      // Create payment record
      const payment: Payment = {
        id: `pay-${Date.now()}`,
        bookingId,
        amount,
        currency,
        status: 'pending',
        provider,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.db.query({
        query: 'INSERT INTO payments VALUES (...)',
        params: [payment],
      });

      logger.debug(`Payment record created: ${payment.id}`, this.category);

      // Simulate external payment processing
      logger.info(`Calling ${provider} API`, this.category);
      const transactionId = await this.callPaymentProvider({ provider, amount });

      // Update payment with transaction ID
      payment.transactionId = transactionId;
      payment.status = 'completed';
      payment.updatedAt = new Date();

      await this.db.query({
        query: 'UPDATE payments SET ... WHERE id = $1',
        params: [payment],
      });

      await this.db.commit();

      logger.info(
        `Payment processed successfully: ${payment.id} (${transactionId})`,
        this.category
      );

      return payment;
    } catch (error) {
      await this.db.rollback();
      logger.error(`Payment processing failed: ${error}`, this.category);
      throw error;
    }
  }

  /**
   * Simulates calling external payment provider
   */
  private async callPaymentProvider(input: {
    provider: string;
    amount: number;
  }): Promise<string> {
    const { provider, amount } = input;

    logger.debug(
      `Sending request to ${provider} for ${amount}`,
      this.category
    );

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    const transactionId = `txn-${provider}-${Date.now()}`;

    logger.debug(
      `Received response from ${provider}: ${transactionId}`,
      this.category
    );

    return transactionId;
  }

  /**
   * Refunds a payment
   *
   * @param input - Refund input
   * @param input.paymentId - Payment ID
   * @returns Refunded payment
   */
  async refundPayment(input: { paymentId: string }): Promise<Payment> {
    const { paymentId } = input;

    logger.info(`Processing refund: ${paymentId}`, this.category);

    try {
      const payments = await this.db.query<Payment>({
        query: 'SELECT * FROM payments WHERE id = $1',
        params: [paymentId],
      });

      if (payments.length === 0) {
        logger.warn(`Refund failed: payment not found - ${paymentId}`, this.category);
        throw new Error('Payment not found');
      }

      const payment = payments[0];

      if (payment.status !== 'completed') {
        logger.warn(
          `Refund failed: invalid status - ${payment.status}`,
          this.category
        );
        throw new Error('Can only refund completed payments');
      }

      await this.db.beginTransaction();

      // Simulate refund with provider
      logger.info(`Calling ${payment.provider} API for refund`, this.category);
      await new Promise((resolve) => setTimeout(resolve, 100));

      payment.status = 'refunded';
      payment.updatedAt = new Date();

      await this.db.query({
        query: 'UPDATE payments SET ... WHERE id = $1',
        params: [payment],
      });

      await this.db.commit();

      logger.info(`Refund processed successfully: ${paymentId}`, this.category);
      return payment;
    } catch (error) {
      await this.db.rollback();
      logger.error(`Refund failed: ${error}`, this.category);
      throw error;
    }
  }
}

// ============================================================================
// API Middleware with Request Logging
// ============================================================================

/**
 * Simulates API middleware with request/response logging
 *
 * Demonstrates API-level logging patterns for HTTP requests
 */
class APIMiddleware {
  private readonly category = 'API';

  /**
   * Logs incoming HTTP request
   *
   * @param input - Request context
   * @returns Request context
   */
  logRequest(input: RequestContext): RequestContext {
    const { requestId, method, path, userId } = input;

    logger.info(
      `${method} ${path}`,
      this.category
    );
    logger.debug(`Request ID: ${requestId}`, this.category);

    if (userId) {
      logger.debug(`User ID: ${userId}`, this.category);
    }

    return input;
  }

  /**
   * Logs HTTP response
   *
   * @param input - Response logging input
   * @param input.context - Request context
   * @param input.statusCode - HTTP status code
   * @param input.responseSize - Response size in bytes
   */
  logResponse(input: {
    context: RequestContext;
    statusCode: number;
    responseSize?: number;
  }): void {
    const { context, statusCode, responseSize } = input;
    const duration = Date.now() - context.startTime;

    const statusEmoji = statusCode < 400 ? '✓' : '✗';

    logger.info(
      `${statusEmoji} ${context.method} ${context.path} - ${statusCode} (${duration}ms)`,
      this.category
    );

    if (responseSize) {
      logger.debug(`Response size: ${responseSize} bytes`, this.category);
    }
  }

  /**
   * Logs API error
   *
   * @param input - Error logging input
   * @param input.context - Request context
   * @param input.error - Error object
   */
  logError(input: { context: RequestContext; error: unknown }): void {
    const { context, error } = input;

    logger.error(
      `Error in ${context.method} ${context.path}: ${error}`,
      this.category
    );

    if (error instanceof Error && error.stack) {
      logger.debug(`Stack trace:\n${error.stack}`, this.category);
    }
  }
}

// ============================================================================
// Complete Example Workflow
// ============================================================================

/**
 * Demonstrates complete workflow with all scoped loggers
 */
async function demonstrateCompleteWorkflow(): Promise<void> {
  logger.log('\n=== Complete Workflow Example ===\n');

  // Initialize services
  const db = new DatabaseService();
  await db.connect();

  const accommodationService = new AccommodationService({ db });
  const authService = new AuthService({ db });
  const paymentService = new PaymentService({ db });
  const apiMiddleware = new APIMiddleware();

  // Simulate API request flow
  const requestContext: RequestContext = {
    requestId: 'req-12345',
    method: 'POST',
    path: '/api/accommodations',
    startTime: Date.now(),
  };

  apiMiddleware.logRequest(requestContext);

  try {
    // Step 1: Authenticate user
    logger.log('\n--- Step 1: Authentication ---');
    const loginResult = await authService.login({
      email: 'host@example.com',
      password: 'secret123',
    });

    if (!loginResult.success || !loginResult.user) {
      throw new Error('Authentication failed');
    }

    requestContext.userId = loginResult.user.id;

    // Step 2: Create accommodation
    logger.log('\n--- Step 2: Create Accommodation ---');
    const accommodation = await accommodationService.create({
      title: 'Beautiful Beach House with Ocean View',
      description: 'Stunning property right on the beach',
      city: 'Concepción del Uruguay',
      pricePerNight: 150,
      maxGuests: 6,
      hostId: loginResult.user.id,
    });

    // Step 3: Update accommodation
    logger.log('\n--- Step 3: Update Accommodation ---');
    await accommodationService.update({
      id: accommodation.id,
      updates: { pricePerNight: 175 },
    });

    // Step 4: Process payment
    logger.log('\n--- Step 4: Process Payment ---');
    const payment = await paymentService.processPayment({
      bookingId: 'booking-123',
      amount: 525, // 3 nights � $175
      currency: 'ARS',
      provider: 'mercadopago',
    });

    // Log successful response
    apiMiddleware.logResponse({
      context: requestContext,
      statusCode: 201,
      responseSize: JSON.stringify(accommodation).length,
    });

    logger.log('\n✓ Workflow completed successfully');
  } catch (error) {
    apiMiddleware.logError({ context: requestContext, error });

    apiMiddleware.logResponse({
      context: requestContext,
      statusCode: 500,
    });

    logger.log('\n✗ Workflow failed');
  }
}

// ============================================================================
// Main Example Runner
// ============================================================================

/**
 * Runs all scoped logging examples
 *
 * Demonstrates complete usage of category-based logging across
 * multiple services and layers of the application.
 */
async function main(): Promise<void> {
  logger.log('='.repeat(70));
  logger.log('SCOPED LOGGING EXAMPLES - @repo/logger');
  logger.log('='.repeat(70));

  // Register all categories
  logger.log('\n### Registering Categories ###');
  registerAllCategories();

  // Run complete workflow
  await demonstrateCompleteWorkflow();

  logger.log('\n' + '='.repeat(70));
  logger.log('All scoped logging examples completed!');
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
  registerAllCategories,
  DatabaseService,
  AccommodationService,
  AuthService,
  PaymentService,
  APIMiddleware,
  demonstrateCompleteWorkflow,
};
