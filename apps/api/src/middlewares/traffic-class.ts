import { runWithTrafficClass } from '@repo/payments';
import type { MiddlewareHandler } from 'hono';
import type { AppBindings } from '../types';

/** Mark every API request as interactive while downstream handlers run. */
export function trafficClassMiddleware(): MiddlewareHandler<AppBindings> {
    return async (_context, next) => {
        await runWithTrafficClass({ context: { trafficClass: 'interactive' }, fn: () => next() });
    };
}
