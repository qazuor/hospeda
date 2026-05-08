/**
 * Resolved environment identifier for Cloudinary folder paths.
 */
export type MediaEnvironment = 'dev' | 'test' | 'preview' | 'prod';

const VALID_DEPLOY_ENVS = new Set<MediaEnvironment>(['dev', 'test', 'preview', 'prod']);

/**
 * Determines the current environment for Cloudinary folder path construction.
 *
 * Resolution order:
 * 1. `HOSPEDA_DEPLOY_ENV` if it is one of `'prod' | 'preview' | 'test' | 'dev'`
 *    — explicit override; recommended in production / staging where the
 *    deployment platform wires it directly (Coolify on the VPS).
 * 2. `NODE_ENV=production` -> `'prod'`
 * 3. `NODE_ENV=test` -> `'test'`
 * 4. Everything else -> `'dev'`
 *
 * Note: there is intentionally no automatic detection of preview deployments;
 * preview environments must opt in via `HOSPEDA_DEPLOY_ENV=preview`.
 *
 * @returns The resolved {@link MediaEnvironment} for the current runtime context.
 *
 * @example
 * ```ts
 * // Production VPS deployment (Coolify):
 * // process.env.HOSPEDA_DEPLOY_ENV = 'prod'
 * resolveEnvironment(); // 'prod'
 *
 * // Staging VPS deployment:
 * // process.env.HOSPEDA_DEPLOY_ENV = 'preview'
 * resolveEnvironment(); // 'preview'
 *
 * // Test runner (Vitest/Jest):
 * // process.env.NODE_ENV = 'test'
 * resolveEnvironment(); // 'test'
 *
 * // Local development:
 * resolveEnvironment(); // 'dev'
 * ```
 */
export function resolveEnvironment(): MediaEnvironment {
    const deployEnv = process.env.HOSPEDA_DEPLOY_ENV;
    if (deployEnv && VALID_DEPLOY_ENVS.has(deployEnv as MediaEnvironment)) {
        return deployEnv as MediaEnvironment;
    }
    if (process.env.NODE_ENV === 'production') return 'prod';
    if (process.env.NODE_ENV === 'test') return 'test';
    return 'dev';
}
