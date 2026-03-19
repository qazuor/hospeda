/**
 * MSW Server Configuration for Node.js/Vitest Tests
 *
 * This module sets up the MSW server for intercepting HTTP requests
 * in the test environment.
 */

import { setupServer } from 'msw/node';
import { getAdminHandlers } from './admin-handlers';
import { handlers } from './handlers';

/**
 * MSW Server instance
 *
 * Includes both public handlers (from handlers.ts) and admin handlers
 * (from admin-handlers.ts) for comprehensive API coverage in tests.
 *
 * Usage:
 * - server.listen() - Start intercepting requests (called in setup.tsx)
 * - server.close() - Stop intercepting (called in afterAll)
 * - server.resetHandlers() - Reset to initial handlers (called in afterEach)
 * - server.use(...handlers) - Add runtime handlers for specific tests
 */
export const server = setupServer(...handlers, ...getAdminHandlers());

/**
 * Export handlers for extending in tests
 */
export { handlers } from './handlers';
