/**
 * Startup-time advisory check for Cloudinary configuration on Vercel preview deploys.
 *
 * SPEC-078-GAPS T-051 / GAP-078-134:
 *   In Vercel preview environments (where `VERCEL_ENV === 'preview'`), Cloudinary
 *   credentials are commonly absent — preview branches typically inherit only
 *   the production env vars that are explicitly marked for preview scope.
 *   When the credentials are missing, the media provider falls back to the
 *   in-memory provider (T-018) and upload routes degrade gracefully instead of
 *   crashing. This warn surfaces the misconfiguration in the boot log so the
 *   degradation is visible.
 *
 * Behaviour:
 *   - Production: skipped (production validation throws hard via Zod elsewhere
 *     when creds are required — T-009 territory).
 *   - Development / test: skipped.
 *   - Preview (VERCEL_ENV=preview) with any missing Cloudinary var: warn.
 *   - Preview with all three vars present: silent.
 */
import type { ILogger } from '@repo/logger';
import { apiLogger } from './logger.js';

/**
 * Set of Cloudinary env var names whose presence is required for the
 * provider to initialize. Kept inline (not imported from `env.ts`) so the
 * check can run before {@link import('./env').env} is populated and so the
 * names appear once, here, as the canonical list for this advisory.
 */
const CLOUDINARY_VAR_NAMES = [
    'HOSPEDA_CLOUDINARY_CLOUD_NAME',
    'HOSPEDA_CLOUDINARY_API_KEY',
    'HOSPEDA_CLOUDINARY_API_SECRET'
] as const;

type CloudinaryVarName = (typeof CLOUDINARY_VAR_NAMES)[number];

/**
 * Parameters for {@link warnIfCloudinaryMissingOnPreview}.
 */
export interface WarnIfCloudinaryMissingOnPreviewParams {
    /**
     * Reader for environment variables. Defaults to `process.env`. Injectable
     * so tests can stub the env without mutating global state.
     */
    readonly env?: Readonly<Record<string, string | undefined>>;
    /**
     * Logger used to emit the warn. Defaults to the API logger so callers in
     * production code do not have to wire it up. Tests inject a mock.
     */
    readonly logger?: Pick<ILogger, 'warn'>;
}

/**
 * Result of the advisory check. `triggered` is true when the warn was emitted.
 */
export interface WarnIfCloudinaryMissingOnPreviewResult {
    readonly triggered: boolean;
    readonly missing: readonly CloudinaryVarName[];
}

/**
 * Emits a warn line when running on a Vercel preview deploy without all
 * Cloudinary credentials. Does NOT throw — preview deploys must keep booting.
 *
 * @param params - Optional injectable env reader and logger (RO-RO).
 * @returns Object describing whether the warn fired and which vars were missing.
 */
export const warnIfCloudinaryMissingOnPreview = (
    params: WarnIfCloudinaryMissingOnPreviewParams = {}
): WarnIfCloudinaryMissingOnPreviewResult => {
    const env = params.env ?? process.env;
    const logger = params.logger ?? apiLogger;

    if (env.VERCEL_ENV !== 'preview') {
        return { triggered: false, missing: [] };
    }

    const missing = CLOUDINARY_VAR_NAMES.filter((name) => {
        const value = env[name];
        return value === undefined || value.trim() === '';
    });

    if (missing.length === 0) {
        return { triggered: false, missing: [] };
    }

    logger.warn({
        message:
            '[cloudinary] Missing Cloudinary configuration on Vercel preview deploy — upload routes will degrade to in-memory provider',
        missing,
        vercelEnv: env.VERCEL_ENV
    });

    return { triggered: true, missing };
};
