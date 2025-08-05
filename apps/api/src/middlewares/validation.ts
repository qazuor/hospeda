/**
 * Validation middleware for API requests
 * Valida headers, content-type, body size, sanitiza datos, etc.
 */

import type { Context, Next } from 'hono';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import { type ValidationConfig, getValidationConfig } from '../types/validation-config';
import { ValidationErrorCode } from '../types/validation-errors.enum';
import { ValidationError, validationMessages } from '../types/validation-messages';
import { transformZodError } from '../utils/zod-error-transformer';
import { sanitizeHeaders, sanitizeObjectStrings, sanitizeQueryParams } from './sanitization';

export interface ValidationMiddlewareOptions {
    config?: Partial<ValidationConfig>;
    manualZodSchema?: z.ZodTypeAny;
    skipSanitization?: boolean;
}

export const createValidationMiddleware = (options: ValidationMiddlewareOptions = {}) => {
    const config = { ...getValidationConfig(), ...options.config };

    return createMiddleware(async (c: Context, next: Next) => {
        try {
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

            // 4. Validate Authorization header format (if Clerk is enabled)
            if (config.clerkAuth.enabled) {
                const authHeader = c.req.header('authorization');
                if (authHeader) {
                    // Validate Bearer token format for Clerk
                    if (!authHeader.startsWith('Bearer ')) {
                        throw new ValidationError(
                            ValidationErrorCode.INVALID_AUTHORIZATION_FORMAT,
                            validationMessages[ValidationErrorCode.INVALID_AUTHORIZATION_FORMAT]
                        );
                    }

                    // Validate token length (Clerk tokens are typically long)
                    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
                    if (token.length < 10) {
                        throw new ValidationError(
                            ValidationErrorCode.INVALID_AUTHORIZATION_FORMAT,
                            validationMessages[ValidationErrorCode.INVALID_AUTHORIZATION_FORMAT]
                        );
                    }
                }
            }

            // 5. Validate request body size
            const contentLength = c.req.header('content-length');
            if (contentLength) {
                const size = Number.parseInt(contentLength, 10);
                if (size > config.maxBodySize) {
                    throw new ValidationError(
                        ValidationErrorCode.REQUEST_TOO_LARGE,
                        validationMessages[ValidationErrorCode.REQUEST_TOO_LARGE]
                    );
                }
            }

            // 6. Sanitize headers (if not skipped)
            if (!options.skipSanitization) {
                const headers = c.req.raw.headers;
                const sanitizedHeaders = sanitizeHeaders(Object.fromEntries(headers.entries()));

                // Update headers in context (shallow copy)
                Object.assign(c.req.raw.headers, sanitizedHeaders);
            }

            // 7. Sanitize query parameters (if not skipped)
            if (!options.skipSanitization) {
                const url = new URL(c.req.url);
                const sanitizedParams = sanitizeQueryParams(url.searchParams);
                url.search = sanitizedParams.toString();

                // Update URL in context
                Object.defineProperty(c.req, 'url', {
                    value: url.toString(),
                    writable: false
                });
            }

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
                                error: transformedError,
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
                            message: error.message,
                            details: error.details
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

export const validationMiddleware = createValidationMiddleware();

export const automaticValidation = createMiddleware(async (_c: Context, next: Next) => {
    // TODO: Implement automatic validation when Hono types are better understood
    await next();
});
