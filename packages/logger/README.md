# @repo/logger

A centralized logger package for the Hospeda monorepo.

## Features

- Consistent logging across all applications and packages
- Configurable log levels (LOG, INFO, WARN, ERROR, DEBUG)
- Timestamp and log level inclusion options
- Colored output using chalk
- Optional labels/titles for log messages
- Environment variable configuration
- Create named loggers with predefined labels

## Installation

This package is internal to the Hospeda monorepo and is automatically available to all applications and packages.

## Usage

\`\`\`typescript
import logger from '@repo/logger';

// Basic usage
logger.log('This is a standard message');
logger.info('This is an informational message');
logger.warn('This is a warning message');
logger.error('This is an error message');
logger.debug('This is a debug message'); // Only shown if minLevel is DEBUG

// With labels
logger.info('User logged in', 'AUTH', { userId: '123', timestamp: new Date() });
logger.error('Operation failed', 'DATABASE', new Error('Connection error'));

// Create a logger with a predefined label
const authLogger = logger.createLogger('AUTH');
authLogger.info('User logged in'); // Will include [AUTH] label automatically
authLogger.error('Authentication failed');

// Configure the logger
import { LogLevel, configure } from '@repo/logger';

configure({
    minLevel: LogLevel.DEBUG,    // Show all log levels
    includeTimestamps: true,     // Include timestamps in log messages
    includeLevel: true,          // Include log level in log messages
    useColors: true              // Use colors in log messages
});

// Reset to default configuration
import { resetConfig } from '@repo/logger';

resetConfig();
\`\`\`

## Environment Variables

The logger can be configured using the following environment variables:

- `LOG_LEVEL`: Minimum log level to display (e.g., "INFO", "DEBUG")
- `LOG_INCLUDE_TIMESTAMPS`: Whether to include timestamps in logs ("true" or "false")
- `LOG_INCLUDE_LEVEL`: Whether to include log level in logs ("true" or "false")
- `LOG_USE_COLORS`: Whether to use colors in logs ("true" or "false")

## API

### Log Methods

- `logger.log(message, label?, ...args)`: Log a standard message
- `logger.info(message, label?, ...args)`: Log an informational message
- `logger.warn(message, label?, ...args)`: Log a warning message
- `logger.error(message, label?, ...args)`: Log an error message
- `logger.debug(message, label?, ...args)`: Log a debug message

### Configuration

- `configure(config)`: Configure the logger
- `resetConfig()`: Reset logger configuration to defaults
- `createLogger(label)`: Create a logger with a predefined label

### Log Levels

- `LogLevel.LOG`: Standard messages
- `LogLevel.INFO`: Informational messages
- `LogLevel.WARN`: Warning messages
- `LogLevel.ERROR`: Error messages
- `LogLevel.DEBUG`: Debug messages

## Configuration Options

- `minLevel`: Minimum log level to display (default: `LogLevel.INFO`)
- `includeTimestamps`: Whether to include timestamps in logs (default: `true`)
- `includeLevel`: Whether to include log level in logs (default: `true`)
- `useColors`: Whether to use colors in logs (default: `true`)
