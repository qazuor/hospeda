/**
 * Validation middleware for API requests
 * Validates headers, content-type, body size, sanitizes data, etc.
 */

import type { Context, Next } from 'hono';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import { type ValidationConfig, getValidationConfig } from '../types/validation-config';
import { ValidationErrorCode } from '../types/validation-errors.enum';
import { ValidationError, validationMessages } from '../types/validation-messages';
import { transformZodError } from '../utils/zod-error-transformer';
import { sanitizeObjectStrings } from './sanitization';

export interface ValidationMiddlewareOptions {
    config?: Partial<ValidationConfig>;
    manualZodSchema?: z.ZodTypeAny;
    skipSanitization?: boolean;
}

export const createValidationMiddleware = (options: ValidationMiddlewareOptions = {}) => {
    return createMiddleware(async (c: Context, next: Next) => {
        // Load config at request time so process.env overrides (tests) are respected
        const config = { ...getValidationConfig(), ...options.config } as ValidationConfig;
        try {
            // Auto-skip validation for basic public endpoints
            const path = c.req.path;
            const publicPaths = ['/api/v1/health', '/api/v1/public/health'];
            const isPublicPath = publicPaths.some((publicPath) => path.startsWith(publicPath));

            // Allow routes to opt-out of validation via route options.
            // Route factories attach routeOptions directly on the context object
            // (not through c.set/c.get) as a non-standard property. This pattern
            // is intentional and there is no ContextVariableMap entry for it.
            const routeOptions = (c as unknown as Record<string, unknown>).routeOptions as
                | { skipValidation?: boolean }
                | undefined;
            if (routeOptions?.skipValidation || isPublicPath) {
                await next();
                return;
            }

            // Note: even if no required headers are configured, we still validate Accept/content-type
            // to keep behavior consistent across environments/tests.

            // 1. Validate Content-Type
            const contentType = c.req.header('content-type');
            if (
                contentType &&
                !config.allowedContentTypes.some((type: string) => contentType.includes(type))
            ) {
                throw new ValidationError(
                    ValidationErrorCode.INVALID_CONTENT_TYPE,
                    validationMessages[ValidationErrorCode.INVALID_CONTENT_TYPE]
                );
            }

            // 2. Validate Accept header (only if present and not accepting any content type)
            const accept = c.req.header('accept');
            if (accept && !accept.includes('*/*') && !accept.includes('application/json')) {
                throw new ValidationError(
                    ValidationErrorCode.INVALID_ACCEPT_HEADER,
                    validationMessages[ValidationErrorCode.INVALID_ACCEPT_HEADER]
                );
            }

            // 3. Validate required headers
            for (const requiredHeader of config.requiredHeaders) {
                const headerValue = c.req.header(requiredHeader.toLowerCase());
                if (!headerValue) {
                    throw new ValidationError(
                        ValidationErrorCode.MISSING_REQUIRED_HEADER,
                        validationMessages[ValidationErrorCode.MISSING_REQUIRED_HEADER]
                    );
                }
            }

            // 4. Validate Authorization header format (if auth validation is enabled)
            if (config.auth.enabled) {
                const authHeader = c.req.header('authorization');
                if (authHeader) {
                    // Validate Bearer token format
                    if (!authHeader.startsWith('Bearer ')) {
                        throw new ValidationError(
                            ValidationErrorCode.INVALID_AUTHORIZATION_FORMAT,
                            validationMessages[ValidationErrorCode.INVALID_AUTHORIZATION_FORMAT]
                        );
                    }

                    // Validate token length
                    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
                    if (token.length < 10) {
                        throw new ValidationError(
                            ValidationErrorCode.INVALID_AUTHORIZATION_FORMAT,
                            validationMessages[ValidationErrorCode.INVALID_AUTHORIZATION_FORMAT]
                        );
                    }
                }
            }

            // Note: Body size validation is handled by Hono's bodyLimit middleware
            // in create-app.ts at the stream level, which also covers chunked
            // transfer encoding (Content-Length header check is bypassable).

            // 8. Manual Zod validation (if provided)
            if (options.manualZodSchema) {
                try {
                    const body = await c.req.json();
                    const sanitizedBody = options.skipSanitization
                        ? body
                        : sanitizeObjectStrings(body);
                    const validatedData = options.manualZodSchema.parse(sanitizedBody);

                    // Store validated data in context
                    c.set('validatedBody', validatedData);
                } catch (error) {
                    if (error instanceof z.ZodError) {
                        // Transform Zod error to our standardized format
                        const transformedError = transformZodError(error);

                        return c.json(
                            {
                                success: false,
                                error: {
                                    code: transformedError.code,
                                    messageKey: transformedError.messageKey,
                                    details: transformedError.details,
                                    summary: transformedError.summary,
                                    userFriendlyMessage: transformedError.userFriendlyMessage
                                },
                                metadata: {
                                    timestamp: new Date().toISOString(),
                                    requestId: c.get('requestId') || 'unknown'
                                }
                            },
                            400
                        );
                    }

                    // Handle JSON syntax errors gracefully
                    if (error instanceof SyntaxError && error.message.includes('JSON')) {
                        return c.json(
                            {
                                success: false,
                                error: {
                                    code: 'INVALID_JSON',
                                    message: 'Invalid JSON format in request body',
                                    details: 'The request body contains malformed JSON'
                                },
                                metadata: {
                                    timestamp: new Date().toISOString(),
                                    requestId: c.get('requestId') || 'unknown'
                                }
                            },
                            400
                        );
                    }

                    throw error;
                }
            }

            // 9. Continue to next middleware/route
            await next();
        } catch (error) {
            if (error instanceof ValidationError) {
                return c.json(
                    {
                        success: false,
                        error: {
                            code: error.code,
                            // error.message stores the zodError.* translation key
                            messageKey: error.message,
                            details: error.details ? [error.details] : [],
                            summary: null
                        },
                        metadata: {
                            timestamp: new Date().toISOString(),
                            requestId:
                                c.get('requestId') || c.req.header('x-request-id') || 'unknown'
                        }
                    },
                    400
                );
            }

            // Re-throw other errors
            throw error;
        }
    });
};

export const validationMiddleware = () => createValidationMiddleware();
