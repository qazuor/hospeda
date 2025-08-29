/**
 * @file Server Function Types
 *
 * This file defines the core types for server functions with:
 * - Generic CRUD operation types
 * - Authentication and authorization context
 * - Error handling and validation
 * - Caching and performance optimizations
 */

import type { z } from 'zod';

/**
 * Server function context with authentication and request information
 */
export type ServerContext = {
    readonly userId?: string;
    readonly permissions: readonly string[];
    readonly request: Request;
    readonly headers: Record<string, string>;
};

/**
 * Generic server function input with validation
 */
export type ServerFunctionInput<TSchema extends z.ZodSchema = z.ZodSchema> = {
    readonly data: z.infer<TSchema>;
    readonly context: ServerContext;
};

/**
 * Server function result with success/error states
 */
export type ServerFunctionResult<TData = unknown> =
    | {
          readonly success: true;
          readonly data: TData;
          readonly meta?: {
              readonly cached?: boolean;
              readonly timestamp?: string;
              readonly version?: string;
          };
      }
    | {
          readonly success: false;
          readonly error: {
              readonly code: string;
              readonly message: string;
              readonly details?: Record<string, unknown>;
              readonly field?: string;
          };
      };

/**
 * CRUD operation types
 */
export type CrudOperation = 'create' | 'read' | 'update' | 'delete' | 'list';

/**
 * Entity configuration for server functions
 */
export type EntityServerConfig<TData = unknown, TCreateData = unknown, TUpdateData = unknown> = {
    readonly name: string;
    readonly endpoint: string;
    readonly schema: {
        readonly data: z.ZodSchema<TData>;
        readonly create: z.ZodSchema<TCreateData>;
        readonly update: z.ZodSchema<TUpdateData>;
        readonly id: z.ZodSchema<string>;
    };
    readonly permissions: {
        readonly create?: readonly string[];
        readonly read?: readonly string[];
        readonly update?: readonly string[];
        readonly delete?: readonly string[];
        readonly list?: readonly string[];
    };
    readonly cache?: {
        readonly ttl: number;
        readonly tags: readonly string[];
        readonly invalidateOn: readonly CrudOperation[];
    };
};

/**
 * List query parameters
 */
export type ListQueryParams = {
    readonly page?: number;
    readonly limit?: number;
    readonly sort?: string;
    readonly order?: 'asc' | 'desc';
    readonly search?: string;
    readonly filters?: Record<string, unknown>;
};

/**
 * List result with pagination
 */
export type ListResult<TData> = {
    readonly data: readonly TData[];
    readonly pagination: {
        readonly page: number;
        readonly limit: number;
        readonly total: number;
        readonly totalPages: number;
        readonly hasNext: boolean;
        readonly hasPrev: boolean;
    };
    readonly meta?: {
        readonly filters?: Record<string, unknown>;
        readonly sort?: string;
        readonly order?: 'asc' | 'desc';
    };
};

/**
 * Server function options
 */
export type ServerFunctionOptions = {
    readonly cache?: {
        readonly enabled: boolean;
        readonly ttl?: number;
        readonly tags?: readonly string[];
    };
    readonly auth?: {
        readonly required: boolean;
        readonly permissions?: readonly string[];
    };
    readonly validation?: {
        readonly input?: z.ZodSchema;
        readonly output?: z.ZodSchema;
    };
    readonly rateLimit?: {
        readonly requests: number;
        readonly window: number;
    };
};
