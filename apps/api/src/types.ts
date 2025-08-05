import type { OpenAPIHono, RouteConfig, RouteHandler } from '@hono/zod-openapi';
import type { Actor } from '@repo/service-core';
import type { MiddlewareHandler, Schema } from 'hono';
import type { ApiLogger } from './utils/logger';

export interface AppBindings {
    Variables: {
        logger: ApiLogger;
        actor: Actor;
    };
}

// biome-ignore lint/complexity/noBannedTypes: <explanation>
export type AppOpenAPI<S extends Schema = {}> = OpenAPIHono<AppBindings, S>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>;

export type AppMiddleware = MiddlewareHandler<AppBindings>;
