/**
 * Compression middleware using Hono's built-in compress
 * Compresses response bodies according to Accept-Encoding header
 */
import { compress } from 'hono/compress';
import { env } from '../utils/env';

/**
 * Creates compression middleware with environment-based configuration
 * @returns Configured compression middleware
 */
export const createCompressionMiddleware = () => {
    // Skip compression if disabled
    if (!env.COMPRESSION_ENABLED) {
        return async (
            // biome-ignore lint/suspicious/noExplicitAny: Hono context type
            _c: any,
            // biome-ignore lint/suspicious/noExplicitAny: Hono next function type
            next: any
        ) => {
            await next();
        };
    }

    // Parse algorithms from environment
    const algorithms = env.COMPRESSION_ALGORITHMS.split(',').map((a) => a.trim());

    // Determine encoding based on available algorithms
    let encoding: 'gzip' | 'deflate' | undefined;
    if (algorithms.includes('gzip') && !algorithms.includes('deflate')) {
        encoding = 'gzip';
    } else if (algorithms.includes('deflate') && !algorithms.includes('gzip')) {
        encoding = 'deflate';
    }
    // If both or neither are specified, let Hono choose based on Accept-Encoding

    return compress({
        encoding,
        threshold: env.COMPRESSION_THRESHOLD
    });
};

/**
 * Default compression middleware instance
 * Uses environment-based configuration
 */
export const compressionMiddleware = createCompressionMiddleware();
