# Monitoring Integration Guide

Complete guide to integrating logger with monitoring and observability platforms.

## Table of Contents

- [Overview](#overview)
- [Log Aggregation](#log-aggregation)
- [Production Log Management](#production-log-management)
- [Structured Logging for Monitoring](#structured-logging-for-monitoring)
- [Error Tracking Integration](#error-tracking-integration)
- [Alerting Strategies](#alerting-strategies)
- [Monitoring Tools](#monitoring-tools)
- [Log Retention Policies](#log-retention-policies)
- [Cost Optimization](#cost-optimization)
- [Compliance and Security](#compliance-and-security)
- [Real-World Integrations](#real-world-integrations)

---

## Overview

Integrating logger with monitoring platforms enables comprehensive observability, alerting, and analytics for production applications.

**Monitoring Goals:**

- Centralized log aggregation
- Real-time error tracking
- Performance monitoring
- Alerting on critical events
- Compliance and audit trails
- Cost-effective log retention

**Supported Platforms:**

- AWS CloudWatch Logs
- Google Cloud Logging
- Datadog
- New Relic
- Splunk
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Sentry (errors)
- Rollbar (errors)

---

## Log Aggregation

Collect and centralize logs from distributed applications.

### Why Log Aggregation?

```typescript
/**
 * Without aggregation:
 * - Logs scattered across multiple servers
 * - Hard to search across instances
 * - No correlation between services
 * - Manual log access required
 *
 * With aggregation:
 * - All logs in one place
 * - Searchable and filterable
 * - Cross-service correlation
 * - Real-time visibility
 */
```

### Structured Logging for Aggregation

```typescript
import { logger } from '@repo/logger';

/**
 * Log in aggregation-friendly format
 */
const aggregationLogger = logger.registerCategory('aggregation', {
  stringifyObjects: true, // JSON format
  expandObjectLevels: 0, // Compact
});

aggregationLogger.info('Request processed', {
  // Service identification
  service: 'api',
  instance: process.env.INSTANCE_ID,
  version: process.env.APP_VERSION,
  environment: process.env.NODE_ENV,

  // Request details
  method: 'POST',
  path: '/bookings',
  status: 201,
  duration: 234,

  // Context
  requestId: 'req-123',
  userId: 'user-456',
  timestamp: new Date().toISOString(),
});

// Output (JSON format for parsing):
// {"service":"api","instance":"i-abc123","version":"1.2.3","environment":"production",...}
```

### Standard Fields for Aggregation

```typescript
import { logger } from '@repo/logger';

/**
 * Standard fields across all logs
 */
interface StandardLogFields {
  // Service identification
  service: string; // 'api', 'web', 'admin'
  instance?: string; // Instance/container ID
  version?: string; // Application version
  environment: string; // 'production', 'staging', 'development'

  // Temporal
  timestamp: string; // ISO 8601

  // Tracing
  requestId?: string; // Request identifier
  traceId?: string; // Distributed trace ID
  spanId?: string; // Span identifier

  // User context
  userId?: string; // User identifier
  sessionId?: string; // Session identifier

  // Additional context
  [key: string]: unknown;
}

/**
 * Create log with standard fields
 */
function createStandardLog(
  level: string,
  message: string,
  data: Record<string, unknown>
): StandardLogFields {
  return {
    service: 'api',
    instance: process.env.INSTANCE_ID,
    version: process.env.APP_VERSION,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  };
}

// Usage
const logData = createStandardLog('info', 'Booking created', {
  bookingId: 'book-123',
  userId: 'user-456',
});

logger.info(logData.message, logData);
```

---

## Production Log Management

Strategies for managing logs in production environments.

### Production Configuration

```typescript
import { logger, LoggerColors } from '@repo/logger';

/**
 * Production-optimized configuration
 */
if (process.env.NODE_ENV === 'production') {
  logger.configure({
    level: 'info', // Filter debug logs
    INCLUDE_TIMESTAMPS: true, // Essential for aggregation
    INCLUDE_LEVEL: true,
    NO_COLOR: true, // No ANSI codes in logs
  });

  const prodLogger = logger.registerCategory('production', {
    color: LoggerColors.RESET,
    level: 'info',
    expandObjectLevels: 0,
    truncateLongText: true,
    truncateLongTextAt: 500,
    stringifyObjects: true, // JSON for parsing
    save: true,
  });
}
```

### Log Levels Strategy

```typescript
import { logger } from '@repo/logger';

/**
 * Log level strategy by environment
 */
const logLevelByEnv = {
  development: 'debug', // All logs
  test: 'error', // Errors only
  staging: 'info', // Info and above
  production: 'warn', // Warnings and errors
} as const;

logger.configure({
  level: logLevelByEnv[process.env.NODE_ENV as keyof typeof logLevelByEnv] || 'info',
});
```

### Critical vs Non-Critical Logging

```typescript
import { logger } from '@repo/logger';

/**
 * Separate critical and non-critical logs
 */

// Critical: Always logged, sent to monitoring
const criticalLogger = logger.registerCategory('critical', {
  level: 'error',
  save: true,
});

// Non-critical: Sampled, may be filtered
const debugLogger = logger.registerCategory('debug', {
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  save: process.env.NODE_ENV === 'production',
});

// Usage
criticalLogger.error('Payment failed', {
  paymentId: 'pay-123',
  amount: 1500,
  error: 'Gateway timeout',
}); // Always logged

debugLogger.debug('Cache hit', { key: 'user:123' }); // Filtered in production
```

---

## Structured Logging for Monitoring

Optimize log structure for monitoring platforms.

### CloudWatch-Friendly Logging

```typescript
import { logger } from '@repo/logger';

/**
 * CloudWatch Logs integration
 */
const cloudwatchLogger = logger.registerCategory('cloudwatch', {
  stringifyObjects: true,
  expandObjectLevels: 0,
});

cloudwatchLogger.info('API request', {
  // CloudWatch dimensions (for filtering)
  service: 'api',
  environment: process.env.NODE_ENV,
  region: process.env.AWS_REGION,

  // Metrics (for CloudWatch Insights)
  http_method: 'POST',
  http_path: '/bookings',
  http_status: 201,
  duration_ms: 234,

  // Context
  request_id: 'req-123',
  user_id: 'user-456',
  timestamp: new Date().toISOString(),
});

// CloudWatch Insights query:
// fields @timestamp, http_method, http_path, http_status, duration_ms
// | filter service = "api" and http_status >= 500
// | stats avg(duration_ms), max(duration_ms), count() by http_path
```

### Datadog-Friendly Logging

```typescript
import { logger } from '@repo/logger';

/**
 * Datadog integration
 */
const datadogLogger = logger.registerCategory('datadog', {
  stringifyObjects: true,
});

datadogLogger.info('Payment processed', {
  // Datadog standard attributes
  'ddsource': 'nodejs',
  'service': 'hospeda-api',
  'host': process.env.HOSTNAME,
  'env': process.env.NODE_ENV,

  // Custom attributes
  'payment.id': 'pay-123',
  'payment.amount': 150.5,
  'payment.currency': 'USD',
  'payment.status': 'success',
  'payment.gateway': 'mercadopago',

  // User context
  'usr.id': 'user-456',

  // Request context
  'http.method': 'POST',
  'http.url': '/payments',
  'http.status_code': 201,

  // Timestamp
  'timestamp': new Date().toISOString(),
});

// Datadog query:
// service:hospeda-api payment.status:success
// | group by payment.gateway
// | avg(payment.amount)
```

### ELK Stack-Friendly Logging

```typescript
import { logger } from '@repo/logger';

/**
 * Elasticsearch integration
 */
const elkLogger = logger.registerCategory('elk', {
  stringifyObjects: true,
  expandObjectLevels: 0,
});

elkLogger.info('User search', {
  // Elasticsearch fields
  '@timestamp': new Date().toISOString(),
  'service.name': 'api',
  'service.version': process.env.APP_VERSION,
  'service.environment': process.env.NODE_ENV,

  // Event classification
  'event.type': 'search',
  'event.category': 'accommodation',
  'event.outcome': 'success',
  'event.duration': 123000000, // Nanoseconds

  // Search details
  'search.query': 'beach house',
  'search.filters.city': 'Concepción',
  'search.filters.price_min': 50,
  'search.filters.price_max': 200,
  'search.result_count': 12,

  // User context
  'user.id': 'user-456',

  // Request context
  'http.request.method': 'GET',
  'http.request.id': 'req-123',
});

// Elasticsearch query:
// GET /logs/_search
// {
//   "query": {
//     "bool": {
//       "must": [
//         { "match": { "event.type": "search" } },
//         { "range": { "search.result_count": { "gte": 10 } } }
//       ]
//     }
//   },
//   "aggs": {
//     "top_cities": {
//       "terms": { "field": "search.filters.city" }
//     }
//   }
// }
```

---

## Error Tracking Integration

Integrate with error tracking platforms for better error management.

### Sentry Integration

```typescript
import * as Sentry from '@sentry/node';
import { logger } from '@repo/logger';

/**
 * Sentry error tracking
 */
Sentry.init({
  dsn: process.env.HOSPEDA_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

const sentryLogger = logger.registerCategory('sentry', {
  level: 'error',
});

/**
 * Log error and send to Sentry
 */
function logErrorWithSentry(
  error: Error,
  context: Record<string, unknown>
): void {
  // Log to logger
  sentryLogger.error(error.message, {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    ...context,
  });

  // Send to Sentry
  Sentry.captureException(error, {
    contexts: {
      custom: context,
    },
    tags: {
      service: 'api',
      environment: process.env.NODE_ENV,
    },
  });
}

// Usage
try {
  await processPayment(paymentData);
} catch (error) {
  logErrorWithSentry(error as Error, {
    paymentId: paymentData.id,
    amount: paymentData.amount,
    userId: paymentData.userId,
  });

  throw error;
}
```

### Rollbar Integration

```typescript
import Rollbar from 'rollbar';
import { logger } from '@repo/logger';

/**
 * Rollbar error tracking
 */
const rollbar = new Rollbar({
  accessToken: process.env.ROLLBAR_ACCESS_TOKEN,
  environment: process.env.NODE_ENV,
  captureUncaught: true,
  captureUnhandledRejections: true,
});

const rollbarLogger = logger.registerCategory('rollbar', {
  level: 'error',
});

/**
 * Log error and send to Rollbar
 */
function logErrorWithRollbar(
  error: Error,
  context: Record<string, unknown>
): void {
  // Log to logger
  rollbarLogger.error(error.message, {
    error: {
      message: error.message,
      stack: error.stack,
    },
    ...context,
  });

  // Send to Rollbar
  rollbar.error(error, context);
}

// Usage
try {
  await createBooking(bookingData);
} catch (error) {
  logErrorWithRollbar(error as Error, {
    bookingData,
    userId: 'user-123',
  });

  throw error;
}
```

---

## Alerting Strategies

Set up alerts based on log patterns and metrics.

### Critical Error Alerts

```typescript
import { logger } from '@repo/logger';

/**
 * Log with alerting metadata
 */
const alertLogger = logger.registerCategory('alert', {
  level: 'error',
  save: true,
});

/**
 * Log critical error for alerting
 */
function logCriticalError(
  message: string,
  error: Error,
  context: Record<string, unknown>
): void {
  alertLogger.error(message, {
    // Alert metadata
    alert: {
      severity: 'critical', // critical, high, medium, low
      category: 'payment', // payment, database, auth, etc.
      actionRequired: true,
    },

    // Error details
    error: {
      message: error.message,
      stack: error.stack,
      type: error.constructor.name,
    },

    // Context
    ...context,

    // Timestamp
    timestamp: new Date().toISOString(),
  });
}

// Usage - Payment failure
try {
  await processPayment(paymentData);
} catch (error) {
  logCriticalError(
    'Payment processing failed',
    error as Error,
    {
      paymentId: paymentData.id,
      amount: paymentData.amount,
      userId: paymentData.userId,
      retries: 3,
    }
  );
}

// CloudWatch Alarm:
// Trigger when: alert.severity = "critical" AND count > 5 in 5 minutes
```

### Performance Degradation Alerts

```typescript
import { logger } from '@repo/logger';

/**
 * Log slow operations for alerting
 */
const performanceLogger = logger.registerCategory('performance', {
  level: 'warn',
});

/**
 * Log slow operation
 */
function logSlowOperation(
  operation: string,
  duration: number,
  threshold: number,
  context: Record<string, unknown>
): void {
  if (duration > threshold) {
    performanceLogger.warn('Slow operation detected', {
      // Performance metadata
      performance: {
        operation,
        duration,
        threshold,
        degradation: ((duration - threshold) / threshold) * 100,
      },

      // Context
      ...context,

      // Alert flag
      alert: {
        severity: duration > threshold * 2 ? 'high' : 'medium',
        category: 'performance',
      },
    });
  }
}

// Usage
const startTime = Date.now();
const results = await accommodationService.search(filters);
const duration = Date.now() - startTime;

logSlowOperation('accommodation_search', duration, 1000, {
  filters,
  resultCount: results.length,
});

// Alert rule:
// Trigger when: performance.operation = "accommodation_search" AND performance.duration > 2000
```

### Rate Limit Alerts

```typescript
import { logger } from '@repo/logger';

/**
 * Track and alert on rate limits
 */
class RateLimitMonitor {
  private counts = new Map<string, number>();
  private windowMs = 60000; // 1 minute

  increment(key: string): void {
    const count = (this.counts.get(key) || 0) + 1;
    this.counts.set(key, count);

    // Alert if threshold exceeded
    if (count > 100) {
      logger.warn('Rate limit threshold exceeded', {
        alert: {
          severity: count > 200 ? 'high' : 'medium',
          category: 'rate_limit',
        },
        rateLimit: {
          key,
          count,
          threshold: 100,
          window: '1m',
        },
      });
    }

    // Reset after window
    setTimeout(() => {
      this.counts.delete(key);
    }, this.windowMs);
  }
}

const rateLimitMonitor = new RateLimitMonitor();

// Usage
app.use(async (c, next) => {
  const userId = c.get('userId');
  rateLimitMonitor.increment(`user:${userId}`);
  await next();
});
```

---

## Monitoring Tools

Integration examples for popular monitoring platforms.

### AWS CloudWatch Logs

```typescript
import { logger } from '@repo/logger';

/**
 * CloudWatch Logs configuration
 */
const cloudwatchLogger = logger.registerCategory('cloudwatch', {
  stringifyObjects: true,
  expandObjectLevels: 0,
});

// Log to CloudWatch
cloudwatchLogger.info('Application event', {
  service: 'api',
  environment: process.env.NODE_ENV,
  region: process.env.AWS_REGION,
  logGroup: '/aws/lambda/hospeda-api',
  logStream: process.env.AWS_LAMBDA_LOG_STREAM_NAME,

  // Event data
  event: 'booking_created',
  bookingId: 'book-123',
  userId: 'user-456',
  timestamp: new Date().toISOString(),
});

// CloudWatch Insights queries:

// 1. Error rate
// fields @timestamp, @message
// | filter level = "error"
// | stats count() as errors by bin(5m)

// 2. Slow requests
// fields @timestamp, duration_ms, http_path
// | filter duration_ms > 1000
// | sort duration_ms desc
// | limit 20

// 3. User activity
// fields @timestamp, user_id, event
// | filter user_id = "user-456"
// | sort @timestamp desc
```

### Google Cloud Logging

```typescript
import { logger } from '@repo/logger';

/**
 * Google Cloud Logging configuration
 */
const gcloudLogger = logger.registerCategory('gcloud', {
  stringifyObjects: true,
});

gcloudLogger.info('Request processed', {
  // Structured logging format
  severity: 'INFO',
  timestamp: new Date().toISOString(),

  // HTTP request
  httpRequest: {
    requestMethod: 'POST',
    requestUrl: '/bookings',
    status: 201,
    userAgent: 'Mozilla/5.0...',
    remoteIp: '192.168.1.1',
    latency: '0.234s',
  },

  // Labels for filtering
  labels: {
    service: 'api',
    environment: 'production',
  },

  // Custom fields
  bookingId: 'book-123',
  userId: 'user-456',
});

// Google Cloud Logging query:
// resource.type="cloud_run_revision"
// severity="ERROR"
// httpRequest.status>=500
```

### Datadog

```typescript
import { logger } from '@repo/logger';

/**
 * Datadog configuration
 */
const datadogLogger = logger.registerCategory('datadog', {
  stringifyObjects: true,
});

datadogLogger.info('Database query', {
  // Datadog tags
  'dd.service': 'hospeda-api',
  'dd.env': process.env.NODE_ENV,
  'dd.version': process.env.APP_VERSION,
  'dd.trace_id': '1234567890',
  'dd.span_id': '9876543210',

  // Database metrics
  'db.system': 'postgresql',
  'db.operation': 'SELECT',
  'db.statement': 'SELECT * FROM accommodations WHERE city = $1',
  'db.duration': 45,
  'db.rows': 12,

  // Custom metrics
  city: 'Concepción',
  timestamp: new Date().toISOString(),
});

// Datadog query:
// service:hospeda-api db.duration:>100
// | group by db.operation
// | avg(db.duration)
```

### New Relic

```typescript
import { logger } from '@repo/logger';

/**
 * New Relic configuration
 */
const newrelicLogger = logger.registerCategory('newrelic', {
  stringifyObjects: true,
});

newrelicLogger.info('Transaction', {
  // New Relic attributes
  'newrelic.source': 'api',
  'entity.guid': process.env.NEW_RELIC_ENTITY_GUID,
  'trace.id': '1234567890',

  // Transaction details
  'transaction.name': 'POST /bookings',
  'transaction.duration': 234,
  'transaction.status': 'success',

  // Custom attributes
  bookingId: 'book-123',
  accommodationId: 'acc-456',
  userId: 'user-789',
  amount: 600,

  timestamp: new Date().toISOString(),
});

// New Relic NRQL query:
// SELECT average(transaction.duration)
// FROM Log
// WHERE transaction.name = 'POST /bookings'
// SINCE 1 hour ago
// FACET transaction.status
```

### Splunk

```typescript
import { logger } from '@repo/logger';

/**
 * Splunk configuration
 */
const splunkLogger = logger.registerCategory('splunk', {
  stringifyObjects: true,
});

splunkLogger.info('Security event', {
  // Splunk sourcetype
  sourcetype: 'hospeda:api',
  source: 'api-server',
  host: process.env.HOSTNAME,

  // Event classification
  event_type: 'authentication',
  event_action: 'login',
  event_outcome: 'success',

  // User details
  user_id: 'user-123',
  user_email: 'juan@example.com',
  user_role: 'owner',

  // Security context
  src_ip: '192.168.1.1',
  user_agent: 'Mozilla/5.0...',
  session_id: 'sess-456',

  // Timestamp
  timestamp: new Date().toISOString(),
});

// Splunk query:
// sourcetype=hospeda:api event_type=authentication event_outcome=failure
// | stats count by src_ip
// | where count > 5
```

---

## Log Retention Policies

Manage log storage and retention effectively.

### Retention Strategy

```typescript
/**
 * Log retention policy by log level
 */
const retentionPolicyByLevel = {
  debug: 1, // 1 day
  info: 7, // 7 days
  warn: 30, // 30 days
  error: 90, // 90 days
  critical: 365, // 1 year
} as const;

/**
 * Log retention policy by category
 */
const retentionPolicyByCategory = {
  audit: 365, // 1 year (compliance)
  security: 180, // 6 months
  payment: 365, // 1 year (financial)
  api: 30, // 30 days
  debug: 7, // 7 days
} as const;
```

### CloudWatch Retention

```typescript
// AWS SDK example
import { CloudWatchLogs } from '@aws-sdk/client-cloudwatch-logs';

const client = new CloudWatchLogs({ region: 'us-east-1' });

/**
 * Set log retention policy
 */
async function setLogRetention(
  logGroupName: string,
  retentionDays: number
): Promise<void> {
  await client.putRetentionPolicy({
    logGroupName,
    retentionInDays: retentionDays,
  });
}

// Set retention for different log groups
await setLogRetention('/aws/lambda/hospeda-api/error', 90);
await setLogRetention('/aws/lambda/hospeda-api/info', 30);
await setLogRetention('/aws/lambda/hospeda-api/debug', 7);
```

### Archival Strategy

```typescript
/**
 * Archive old logs to S3
 */
interface ArchivalConfig {
  source: string; // Log source
  destination: string; // S3 bucket
  retentionDays: number; // Days before archival
  compressionFormat: 'gzip' | 'none';
}

const archivalConfigs: ArchivalConfig[] = [
  {
    source: '/aws/lambda/hospeda-api/error',
    destination: 's3://hospeda-logs-archive/error',
    retentionDays: 90,
    compressionFormat: 'gzip',
  },
  {
    source: '/aws/lambda/hospeda-api/audit',
    destination: 's3://hospeda-logs-archive/audit',
    retentionDays: 365,
    compressionFormat: 'gzip',
  },
];
```

---

## Cost Optimization

Reduce logging costs while maintaining visibility.

### Sampling Strategy

```typescript
import { logger } from '@repo/logger';

/**
 * Sample logs based on environment and frequency
 */
class SamplingLogger {
  private sampleRates = {
    production: {
      debug: 0, // 0% (disabled)
      info: 0.1, // 10%
      warn: 0.5, // 50%
      error: 1, // 100%
    },
    staging: {
      debug: 0.1,
      info: 0.5,
      warn: 1,
      error: 1,
    },
    development: {
      debug: 1,
      info: 1,
      warn: 1,
      error: 1,
    },
  };

  shouldLog(level: string): boolean {
    const env = process.env.NODE_ENV || 'development';
    const rate = this.sampleRates[env as keyof typeof this.sampleRates]?.[level as keyof typeof this.sampleRates.production] || 1;

    return Math.random() < rate;
  }

  log(level: string, message: string, data?: unknown): void {
    if (this.shouldLog(level)) {
      logger[level as keyof typeof logger](message, data);
    }
  }
}

const samplingLogger = new SamplingLogger();

// Usage - Only 10% of info logs in production
samplingLogger.log('info', 'Health check');
```

### Conditional Verbose Logging

```typescript
import { logger } from '@repo/logger';

/**
 * Verbose logging only for specific users/requests
 */
const VERBOSE_USER_IDS = process.env.VERBOSE_USER_IDS?.split(',') || [];

function shouldLogVerbose(userId?: string): boolean {
  return (
    process.env.NODE_ENV !== 'production' ||
    (userId && VERBOSE_USER_IDS.includes(userId))
  );
}

// Usage
if (shouldLogVerbose(userId)) {
  logger.debug('Detailed operation', {
    /* verbose data */
  });
}
```

### Log Level Optimization

```typescript
/**
 * Cost by log level
 * - Debug: $$$$ (high volume, short retention)
 * - Info: $$$ (medium volume, medium retention)
 * - Warn: $$ (low volume, long retention)
 * - Error: $ (very low volume, long retention)
 *
 * Optimization strategy:
 * 1. Disable debug in production
 * 2. Sample info logs
 * 3. Always log warn and error
 */
logger.configure({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
});
```

---

## Compliance and Security

Ensure logging meets compliance and security requirements.

### PII Filtering

```typescript
import { logger } from '@repo/logger';

/**
 * Filter PII from logs
 */
function sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
  const piiFields = ['password', 'creditCard', 'ssn', 'token', 'secret'];

  const sanitized = { ...data };

  for (const field of piiFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  // Mask email
  if (typeof sanitized.email === 'string') {
    sanitized.email = sanitized.email.replace(
      /^(.{1,3}).*(@.*)$/,
      (_, prefix, domain) => `${prefix}***${domain}`
    );
  }

  return sanitized;
}

// Usage
const userData = {
  email: 'juan@example.com',
  password: 'secret123',
  name: 'Juan Pérez',
};

logger.info('User login', sanitizeLogData(userData));
// Output: { email: 'jua***@example.com', password: '[REDACTED]', name: 'Juan Pérez' }
```

### Audit Logging

```typescript
import { logger } from '@repo/logger';

/**
 * Audit trail logger
 */
const auditLogger = logger.registerCategory('audit', {
  level: 'info',
  save: true,
  stringifyObjects: true,
});

/**
 * Log audit event
 */
function logAuditEvent(
  action: string,
  resource: string,
  actor: string,
  changes?: Record<string, unknown>
): void {
  auditLogger.info('Audit event', {
    // Audit metadata
    audit: {
      action, // create, update, delete, read
      resource, // accommodation, booking, user
      actor, // User ID who performed action
      timestamp: new Date().toISOString(),
    },

    // Changes (before/after)
    changes,

    // Retention: 1 year for compliance
    retentionDays: 365,
  });
}

// Usage
logAuditEvent(
  'update',
  'accommodation',
  'user-123',
  {
    before: { pricePerNight: 100 },
    after: { pricePerNight: 150 },
  }
);
```

---

## Real-World Integrations

Complete integration examples for production use.

### Complete CloudWatch Setup

```typescript
import { logger } from '@repo/logger';

/**
 * Production CloudWatch configuration
 */
const cloudwatchProdLogger = logger.registerCategory('cloudwatch-prod', {
  level: 'info',
  stringifyObjects: true,
  expandObjectLevels: 0,
  truncateLongText: true,
  truncateLongTextAt: 1000,
});

// Standard logging format
function logToCloudWatch(
  level: string,
  message: string,
  data: Record<string, unknown>
): void {
  cloudwatchProdLogger[level as keyof typeof cloudwatchProdLogger](message, {
    // Service identification
    service: 'hospeda-api',
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION,
    instance: process.env.INSTANCE_ID,

    // AWS context
    aws: {
      region: process.env.AWS_REGION,
      logGroup: process.env.AWS_LAMBDA_LOG_GROUP_NAME,
      logStream: process.env.AWS_LAMBDA_LOG_STREAM_NAME,
      requestId: process.env.AWS_REQUEST_ID,
    },

    // Event data
    ...data,

    // Timestamp
    timestamp: new Date().toISOString(),
  });
}
```

### Complete Datadog Setup

```typescript
import { logger } from '@repo/logger';

/**
 * Production Datadog configuration
 */
const datadogProdLogger = logger.registerCategory('datadog-prod', {
  level: 'info',
  stringifyObjects: true,
});

function logToDatadog(
  level: string,
  message: string,
  data: Record<string, unknown>
): void {
  datadogProdLogger[level as keyof typeof datadogProdLogger](message, {
    // Datadog standard attributes
    'ddsource': 'nodejs',
    'service': 'hospeda-api',
    'host': process.env.HOSTNAME,
    'env': process.env.NODE_ENV,
    'version': process.env.APP_VERSION,

    // Event data
    ...data,

    // Timestamp
    'timestamp': new Date().toISOString(),
  });
}
```

---

## Related Documentation

- [Structured Logging](./structured-logging.md) - Structured logging best practices
- [Configuration](../configuration.md) - Logger configuration
- [API Reference](../api/logger.md) - Complete API documentation

---

**Last updated:** 2024-01-15
