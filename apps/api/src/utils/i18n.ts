/**
 * Internationalization utilities
 * Supports multiple locales for user-facing messages
 */
import type { Context } from 'hono';
import { env } from './env';

/**
 * Supported locales for the API
 */
export const SUPPORTED_LOCALES = env.SUPPORTED_LOCALES;
export const DEFAULT_LOCALE = env.DEFAULT_LOCALE;

/**
 * Extract locale from request context
 * Checks Accept-Language header and query parameter
 *
 * @param c - Hono context
 * @returns {string} Locale code (e.g., 'en', 'es', 'pt')
 */
export const getLocaleFromContext = (c: Context): string => {
    // Check query parameter first (e.g., ?lang=es)
    const queryLocale = c.req.query('lang');
    if (queryLocale && SUPPORTED_LOCALES.includes(queryLocale)) {
        return queryLocale;
    }

    // Check Accept-Language header
    const acceptLanguage = c.req.header('Accept-Language');
    if (acceptLanguage) {
        // Parse Accept-Language header (e.g., "en-US,en;q=0.9,es;q=0.8")
        const languages = acceptLanguage
            .split(',')
            .map((lang) => lang.split(';')[0]?.trim())
            .map((lang) => lang?.split('-')[0])
            .filter((lang): lang is string => Boolean(lang)); // Filter out undefined values

        for (const lang of languages) {
            if (SUPPORTED_LOCALES.includes(lang)) {
                return lang;
            }
        }
    }

    return DEFAULT_LOCALE;
};

/**
 * Translation keys for error messages
 * These keys are used by the frontend for localization
 */
export const ERROR_MESSAGE_KEYS = {
    // Authentication errors
    UNAUTHORIZED: 'errors.unauthorized',
    FORBIDDEN: 'errors.forbidden',

    // Validation errors
    VALIDATION_ERROR: 'errors.validation.general',
    REQUIRED_FIELD: 'errors.validation.required',
    INVALID_FORMAT: 'errors.validation.format',

    // Resource errors
    NOT_FOUND: 'errors.notFound.general',
    ACCOMMODATION_NOT_FOUND: 'errors.notFound.accommodation',
    DESTINATION_NOT_FOUND: 'errors.notFound.destination',
    EVENT_NOT_FOUND: 'errors.notFound.event',
    POST_NOT_FOUND: 'errors.notFound.post',
    USER_NOT_FOUND: 'errors.notFound.user',

    // Rate limiting
    RATE_LIMIT_EXCEEDED: 'errors.rateLimitExceeded',

    // Server errors
    SERVER_ERROR: 'errors.serverError',
    REQUEST_TIMEOUT: 'errors.requestTimeout'
} as const;

/**
 * Locale-aware response middleware
 * Adds locale information to response headers
 */
export const localeMiddleware = () => {
    return async (c: Context, next: () => Promise<void>) => {
        const locale = getLocaleFromContext(c);

        // Store locale in context for use in handlers
        c.set('locale', locale);

        await next();

        // Add locale information to response headers
        c.res.headers.set('Content-Language', locale);
    };
};
