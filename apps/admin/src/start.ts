/**
 * Global middleware registration for TanStack Start.
 *
 * In TanStack Start 1.131.26, there is no `createStart` API for registering
 * HTTP request middleware. Instead, `registerGlobalMiddleware` registers
 * server function middleware that runs on every `createServerFn` invocation.
 *
 * This file must be imported early in the application lifecycle (e.g., from
 * the root route or router setup) to ensure middleware is registered before
 * any server functions execute.
 *
 * Phase 2 migration (TanStack Start >= 1.132.0 + Vite 7):
 *   Replace `registerGlobalMiddleware` with `createStart({ requestMiddleware })`
 *   to cover all HTTP requests (including SSR page loads), not just server functions.
 *
 * @see https://tanstack.com/start/latest/docs/framework/react/middleware
 */

import { registerGlobalMiddleware } from '@tanstack/react-start';
import { cspMiddleware } from './middleware';

registerGlobalMiddleware({
    middleware: [cspMiddleware]
});
