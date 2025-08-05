/**
 * Compression middleware using Hono's built-in compress
 * Compresses response bodies according to Accept-Encoding header
 */
import { compress } from 'hono/compress';
import { getCompressionConfig } from '../utils/env';

/**
 * Creates compression middleware with environment-based configuration
 * @returns Configured compression middleware
 */
export const createCompressionMiddleware = () => {
    const compressionConfig = getCompressionConfig();

    // Skip compression if disabled
    if (!compressionConfig.enabled) {
        return async (
            // biome-ignore lint/suspicious/noExplicitAny: Hono context type
            _c: any,
            // biome-ignore lint/suspicious/noExplicitAny: Hono next function type
            next: any
        ) => {
            await next();
        };
    }

    // Determine encoding based on available algorithms
    let encoding: 'gzip' | 'deflate' | undefined;
    if (
        compressionConfig.algorithms.includes('gzip') &&
        !compressionConfig.algorithms.includes('deflate')
    ) {
        encoding = 'gzip';
    } else if (
        compressionConfig.algorithms.includes('deflate') &&
        !compressionConfig.algorithms.includes('gzip')
    ) {
        encoding = 'deflate';
    }
    // If both or neither are specified, let Hono choose based on Accept-Encoding

    return compress({
        encoding,
        threshold: compressionConfig.threshold
    });
};

/**
 * Default compression middleware instance
 * Uses environment-based configuration
 */
export const compressionMiddleware = createCompressionMiddleware();
