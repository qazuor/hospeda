/**
 * Test setup file for Vitest
 * Configures test environment and global mocks
 */

import { webcrypto } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

// Polyfill crypto for Hono request-id middleware
if (!globalThis.crypto) {
    globalThis.crypto = webcrypto as Crypto;
}

// Global test setup
beforeAll(async () => {
    // Setup test environment
    process.env.NODE_ENV = 'test';

    // Mock environment variables for testing
    process.env.PORT = '3001';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
    process.env.CLERK_SECRET_KEY = 'test_clerk_secret';
    process.env.CLERK_PUBLISHABLE_KEY = 'test_clerk_publishable';
});

// Global test cleanup
afterAll(async () => {
    // Cleanup test environment
});

// Per-test setup
beforeEach(async () => {
    // Setup before each test
});

// Per-test cleanup
afterEach(async () => {
    // Cleanup after each test
});
