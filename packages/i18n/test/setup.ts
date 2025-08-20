/**
 * Test setup file for Vitest in i18n package
 * Configures test environment and global mocks for internationalization
 */

import { afterEach, beforeAll, vi } from 'vitest';

// Global test setup
beforeAll(() => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
});

// Cleanup after each test
afterEach(() => {
    vi.clearAllMocks();
});

// Mock file system operations for locale loading
vi.mock('node:fs', async () => {
    const actual = await vi.importActual('node:fs');
    return {
        ...actual,
        readFileSync: vi.fn((path: string) => {
            // Mock locale files
            if (path.includes('locales/es/')) {
                return JSON.stringify({
                    test: 'Prueba',
                    hello: 'Hola',
                    welcome: 'Bienvenido'
                });
            }
            if (path.includes('locales/en/')) {
                return JSON.stringify({
                    test: 'Test',
                    hello: 'Hello',
                    welcome: 'Welcome'
                });
            }
            return '{}';
        }),
        existsSync: vi.fn(() => true)
    };
});

// Mock path operations
vi.mock('node:path', async () => {
    const actual = await vi.importActual('node:path');
    return {
        ...actual,
        join: vi.fn((...args: string[]) => args.join('/')),
        resolve: vi.fn((...args: string[]) => args.join('/'))
    };
});
