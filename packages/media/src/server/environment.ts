/**
 * Resolved environment identifier for Cloudinary folder paths.
 */
export type MediaEnvironment = 'dev' | 'test' | 'preview' | 'prod';

/**
 * Determines the current environment for Cloudinary folder path construction.
 *
 * Resolution order:
 * 1. VERCEL_ENV=production -> 'prod'
 * 2. VERCEL_ENV=preview -> 'preview'
 * 3. NODE_ENV=test (no VERCEL_ENV) -> 'test'
 * 4. Everything else -> 'dev'
 *
 * @returns The resolved {@link MediaEnvironment} for the current runtime context.
 *
 * @example
 * ```ts
 * // In a Vercel production deployment:
 * // process.env.VERCEL_ENV = 'production'
 * resolveEnvironment(); // 'prod'
 *
 * // In a Vercel preview deployment:
 * // process.env.VERCEL_ENV = 'preview'
 * resolveEnvironment(); // 'preview'
 *
 * // In a test runner (Vitest/Jest):
 * // process.env.NODE_ENV = 'test'
 * resolveEnvironment(); // 'test'
 *
 * // Local development:
 * resolveEnvironment(); // 'dev'
 * ```
 */
export function resolveEnvironment(): MediaEnvironment {
    const vercelEnv = process.env.VERCEL_ENV;
    if (vercelEnv === 'production') return 'prod';
    if (vercelEnv === 'preview') return 'preview';
    if (process.env.NODE_ENV === 'test') return 'test';
    return 'dev';
}
